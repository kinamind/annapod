/**
 * Sign in with KinaMind (OIDC).
 *
 * kinamind.org is the identity provider for every KinaMind application; this
 * module makes annapod a relying party without disturbing the existing
 * email/password login — both continue to work, and a person can end up with
 * one account regardless of which they use.
 *
 * Account resolution order:
 *   1. `users.kinamind_sub` matches   -> sign in, done.
 *   2. `users.email` matches          -> DO NOT link automatically. Issue a
 *      `link` ticket; the browser must post the account's existing annapod
 *      password to complete the binding.
 *   3. Otherwise                      -> provision a new passwordless account.
 *
 * Step 2 is the security-critical one. annapod never verified email addresses,
 * so linking on a matching address alone would let anyone who registered under
 * someone else's address inherit that person's counseling sessions — or hand
 * their own account away. Proving knowledge of the password closes that.
 */
import type { CloudflareEnv } from "./types";
import { jsonResponse, errorResponse, nowIso } from "./utils";
import { signJwt, verifyPassword, getAuthUserId } from "./auth";

const ISSUER = "https://kinamind.org";
const AUTHORIZE_ENDPOINT = `${ISSUER}/oauth/authorize`;
const TOKEN_ENDPOINT = `${ISSUER}/api/oauth/token`;
const USERINFO_ENDPOINT = `${ISSUER}/api/oauth/userinfo`;

const STATE_TTL_MS = 10 * 60 * 1000;
const TICKET_TTL_MS = 2 * 60 * 1000;

function base64url(bytes: Uint8Array): string {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function randomToken(length = 32): string {
  return base64url(crypto.getRandomValues(new Uint8Array(length)));
}

async function pkceChallenge(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
  return base64url(new Uint8Array(digest));
}

function redirectUri(request: Request): string {
  return new URL("/api/v1/auth/kinamind/callback", new URL(request.url).origin).toString();
}

function redirect(location: string): Response {
  return new Response(null, { status: 302, headers: { Location: location } });
}

function requireConfig(env: CloudflareEnv) {
  if (!env.KINAMIND_CLIENT_ID || !env.KINAMIND_CLIENT_SECRET) {
    throw new Error("Missing Pages secrets: KINAMIND_CLIENT_ID / KINAMIND_CLIENT_SECRET");
  }
  return { clientId: env.KINAMIND_CLIENT_ID, clientSecret: env.KINAMIND_CLIENT_SECRET };
}

/**
 * POST /api/v1/auth/kinamind/start  { intent?, return_to? }
 *
 * Returns the authorization URL for the browser to navigate to. This is a POST
 * rather than a redirect so the caller can present its bearer token in the
 * Authorization header — linking must never put a token in a URL.
 */
export async function startKinamindLogin(request: Request, env: CloudflareEnv) {
  const { clientId } = requireConfig(env);
  const body = (await request.json().catch(() => ({}))) as {
    intent?: string;
    return_to?: string;
  };

  const state = randomToken(24);
  const nonce = randomToken(16);
  const verifier = randomToken(32);

  // `link` is requested by an already-authenticated user from settings.
  const linkUserId = body.intent === "link" ? await getAuthUserId(request, env) : null;
  if (body.intent === "link" && !linkUserId) return errorResponse("Unauthorized", 401);

  const rawReturn = body.return_to || "/dashboard";
  const returnTo = rawReturn.startsWith("/") && !rawReturn.startsWith("//") ? rawReturn : "/dashboard";

  await env.DB.prepare(
    `INSERT INTO sso_states (state, nonce, code_verifier, link_user_id, return_to, expires_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  )
    .bind(
      state,
      nonce,
      verifier,
      linkUserId,
      returnTo,
      new Date(Date.now() + STATE_TTL_MS).toISOString(),
      nowIso()
    )
    .run();

  const authorize = new URL(AUTHORIZE_ENDPOINT);
  authorize.searchParams.set("client_id", clientId);
  authorize.searchParams.set("redirect_uri", redirectUri(request));
  authorize.searchParams.set("response_type", "code");
  authorize.searchParams.set("scope", "openid profile email");
  authorize.searchParams.set("state", state);
  authorize.searchParams.set("nonce", nonce);
  authorize.searchParams.set("code_challenge", await pkceChallenge(verifier));
  authorize.searchParams.set("code_challenge_method", "S256");

  return jsonResponse({ authorize_url: authorize.toString() });
}

interface IdTokenClaims {
  iss?: string;
  sub?: string;
  aud?: string;
  exp?: number;
  nonce?: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  preferred_username?: string;
  picture?: string;
}

/** Decodes the id_token payload. Signature is not re-checked here — see below. */
function decodeIdToken(token: string): IdTokenClaims | null {
  const parts = token.split(".");
  if (parts.length !== 3) return null;
  try {
    const payload = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    return JSON.parse(atob(payload + "=".repeat((4 - (payload.length % 4)) % 4)));
  } catch {
    return null;
  }
}

async function uniqueUsername(env: CloudflareEnv, candidate: string): Promise<string> {
  const base =
    candidate
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, "")
      .slice(0, 24) || "user";
  for (let attempt = 0; attempt < 50; attempt++) {
    const username = attempt === 0 ? base : `${base}${attempt + 1}`;
    const taken = await env.DB.prepare(`SELECT 1 FROM users WHERE username = ?`).bind(username).first();
    if (!taken) return username;
  }
  return `${base}_${crypto.randomUUID().slice(0, 6)}`;
}

async function issueLoginTicket(env: CloudflareEnv, userId: string): Promise<string> {
  const id = randomToken(24);
  const token = await signJwt(env, { sub: userId });
  await env.DB.prepare(
    `INSERT INTO sso_tickets (id, user_id, kind, token, expires_at, created_at)
     VALUES (?, ?, 'login', ?, ?, ?)`
  )
    .bind(id, userId, token, new Date(Date.now() + TICKET_TTL_MS).toISOString(), nowIso())
    .run();
  return id;
}

/**
 * GET /api/v1/auth/kinamind/callback
 *
 * Completes the OIDC exchange and hands the SPA a single-use ticket.
 */
export async function handleKinamindCallback(request: Request, env: CloudflareEnv) {
  const { clientId, clientSecret } = requireConfig(env);
  const url = new URL(request.url);

  const fail = (reason: string) => redirect(`/login?sso_error=${encodeURIComponent(reason)}`);

  if (url.searchParams.get("error")) return fail(url.searchParams.get("error")!);

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state) return fail("missing_code");

  const stateRow = await env.DB.prepare(`SELECT * FROM sso_states WHERE state = ?`)
    .bind(state)
    .first<any>();
  if (!stateRow) return fail("invalid_state");
  await env.DB.prepare(`DELETE FROM sso_states WHERE state = ?`).bind(state).run();
  if (new Date(stateRow.expires_at).getTime() < Date.now()) return fail("expired_state");

  const tokenResponse = await fetch(TOKEN_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri(request),
      client_id: clientId,
      client_secret: clientSecret,
      code_verifier: stateRow.code_verifier,
    }),
  });
  if (!tokenResponse.ok) return fail("token_exchange_failed");

  const tokens = (await tokenResponse.json()) as { id_token?: string; access_token?: string };
  if (!tokens.id_token || !tokens.access_token) return fail("token_exchange_failed");

  const claims = decodeIdToken(tokens.id_token);
  if (!claims?.sub) return fail("invalid_id_token");
  if (claims.iss !== ISSUER) return fail("issuer_mismatch");
  if (claims.aud !== clientId) return fail("audience_mismatch");
  if (!claims.exp || claims.exp * 1000 < Date.now()) return fail("id_token_expired");
  if (claims.nonce !== stateRow.nonce) return fail("nonce_mismatch");

  /*
   * The id_token signature is not verified locally. It was received directly
   * from the provider's token endpoint over TLS, in response to a request
   * authenticated with our client secret — per OIDC Core §3.1.3.7 that makes
   * signature validation optional for the authorization-code flow. The claims
   * that matter (iss/aud/nonce/exp) are all checked above, and the profile is
   * re-read from UserInfo with the access token rather than trusted from here.
   */
  const userinfoResponse = await fetch(USERINFO_ENDPOINT, {
    headers: { Authorization: `Bearer ${tokens.access_token}` },
  });
  if (!userinfoResponse.ok) return fail("userinfo_failed");
  const profile = (await userinfoResponse.json()) as IdTokenClaims;

  const sub = profile.sub || claims.sub;
  const email = (profile.email || claims.email || "").toLowerCase() || null;
  const emailVerified = Boolean(profile.email_verified ?? claims.email_verified);
  const displayName = profile.name || claims.name || profile.preferred_username || "KinaMind 用户";
  const avatar = profile.picture || claims.picture || null;
  const returnTo: string = stateRow.return_to || "/dashboard";

  // --- Explicit link requested from annapod settings -------------------------
  if (stateRow.link_user_id) {
    const clash = await env.DB.prepare(
      `SELECT id FROM users WHERE kinamind_sub = ? AND id != ?`
    )
      .bind(sub, stateRow.link_user_id)
      .first();
    if (clash) return redirect(`/profile?sso_error=already_linked_elsewhere`);

    await env.DB.prepare(
      `UPDATE users SET kinamind_sub = ?, kinamind_linked_at = ?, updated_at = ? WHERE id = ?`
    )
      .bind(sub, nowIso(), nowIso(), stateRow.link_user_id)
      .run();
    return redirect(`/profile?sso=linked`);
  }

  // --- 1. Already linked -----------------------------------------------------
  const linked = await env.DB.prepare(`SELECT * FROM users WHERE kinamind_sub = ?`)
    .bind(sub)
    .first<any>();
  if (linked) {
    if (!linked.is_active) return fail("account_disabled");
    await env.DB.prepare(`UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?`)
      .bind(nowIso(), nowIso(), linked.id)
      .run();
    const ticket = await issueLoginTicket(env, linked.id);
    return redirect(`/auth/kinamind?ticket=${ticket}&return_to=${encodeURIComponent(returnTo)}`);
  }

  // --- 2. Same address, different account: require the annapod password ------
  if (email) {
    const sameEmail = await env.DB.prepare(`SELECT * FROM users WHERE email = ?`)
      .bind(email)
      .first<any>();
    if (sameEmail) {
      const ticketId = randomToken(24);
      await env.DB.prepare(
        `INSERT INTO sso_tickets
           (id, user_id, kind, kinamind_sub, email, display_name, avatar_url, expires_at, created_at)
         VALUES (?, ?, 'link', ?, ?, ?, ?, ?, ?)`
      )
        .bind(
          ticketId,
          sameEmail.id,
          sub,
          email,
          displayName,
          avatar,
          new Date(Date.now() + TICKET_TTL_MS).toISOString(),
          nowIso()
        )
        .run();
      return redirect(
        `/auth/kinamind?ticket=${ticketId}&mode=link&email=${encodeURIComponent(email)}` +
          `&return_to=${encodeURIComponent(returnTo)}`
      );
    }
  }

  // --- 3. Brand new person ---------------------------------------------------
  if (!email) return fail("email_required");
  // Only a provider-verified address may seed a new account, otherwise someone
  // could pre-claim an address that a real annapod user later registers.
  if (!emailVerified) return fail("email_unverified");

  const id = crypto.randomUUID();
  const username = await uniqueUsername(env, profile.preferred_username || email.split("@")[0]);
  await env.DB.prepare(
    `INSERT INTO users
       (id, email, username, display_name, hashed_password, avatar_url, experience_level,
        is_active, is_admin, kinamind_sub, kinamind_linked_at, created_at, updated_at, last_login_at)
     VALUES (?, ?, ?, ?, NULL, ?, 'beginner', 1, 0, ?, ?, ?, ?, ?)`
  )
    .bind(id, email, username, displayName, avatar, sub, nowIso(), nowIso(), nowIso(), nowIso())
    .run();

  const ticket = await issueLoginTicket(env, id);
  return redirect(
    `/auth/kinamind?ticket=${ticket}&created=1&return_to=${encodeURIComponent(returnTo)}`
  );
}

async function takeTicket(env: CloudflareEnv, id: string, kind: string) {
  const row = await env.DB.prepare(
    `SELECT * FROM sso_tickets WHERE id = ? AND kind = ? AND consumed_at IS NULL`
  )
    .bind(id, kind)
    .first<any>();
  if (!row) return null;
  if (new Date(row.expires_at).getTime() < Date.now()) return null;
  await env.DB.prepare(`UPDATE sso_tickets SET consumed_at = ? WHERE id = ?`)
    .bind(nowIso(), id)
    .run();
  return row;
}

/**
 * POST /api/v1/auth/kinamind/claim  { ticket }
 *
 * Exchanges a single-use login ticket for the annapod bearer token. Keeping
 * the token out of the redirect URL keeps it out of history and Referer.
 */
export async function claimKinamindTicket(request: Request, env: CloudflareEnv) {
  const { ticket } = (await request.json().catch(() => ({}))) as { ticket?: string };
  if (!ticket) return errorResponse("缺少 ticket", 400);

  const row = await takeTicket(env, ticket, "login");
  if (!row) return errorResponse("登录凭证已失效，请重新登录", 400);

  return jsonResponse({ access_token: row.token, token_type: "bearer" });
}

/**
 * POST /api/v1/auth/kinamind/link  { ticket, password }
 *
 * Completes binding to a pre-existing annapod account. The password proves the
 * person actually owns that account — matching emails alone are not enough.
 */
export async function linkKinamindAccount(request: Request, env: CloudflareEnv) {
  const { ticket, password } = (await request.json().catch(() => ({}))) as {
    ticket?: string;
    password?: string;
  };
  if (!ticket || !password) return errorResponse("缺少参数", 400);

  // Read without consuming, so a wrong password can be retried within the TTL.
  const row = await env.DB.prepare(
    `SELECT * FROM sso_tickets WHERE id = ? AND kind = 'link' AND consumed_at IS NULL`
  )
    .bind(ticket)
    .first<any>();
  if (!row || new Date(row.expires_at).getTime() < Date.now()) {
    return errorResponse("绑定凭证已失效，请重新登录", 400);
  }

  const user = await env.DB.prepare(`SELECT * FROM users WHERE id = ?`).bind(row.user_id).first<any>();
  if (!user) return errorResponse("账户不存在", 404);
  if (!user.hashed_password) return errorResponse("该账户没有设置密码，无法通过密码绑定", 400);
  if (!(await verifyPassword(password, user.hashed_password))) {
    return errorResponse("密码不正确", 401);
  }
  if (!user.is_active) return errorResponse("账户已被禁用", 403);

  await env.DB.prepare(`UPDATE sso_tickets SET consumed_at = ? WHERE id = ?`)
    .bind(nowIso(), ticket)
    .run();
  await env.DB.prepare(
    `UPDATE users SET kinamind_sub = ?, kinamind_linked_at = ?, last_login_at = ?, updated_at = ? WHERE id = ?`
  )
    .bind(row.kinamind_sub, nowIso(), nowIso(), nowIso(), user.id)
    .run();

  const token = await signJwt(env, { sub: user.id });
  return jsonResponse({ access_token: token, token_type: "bearer" });
}

/** POST /api/v1/auth/kinamind/unlink — requires a local password to remain. */
export async function unlinkKinamindAccount(request: Request, env: CloudflareEnv) {
  const userId = await getAuthUserId(request, env);
  if (!userId) return errorResponse("Unauthorized", 401);

  const user = await env.DB.prepare(`SELECT hashed_password FROM users WHERE id = ?`)
    .bind(userId)
    .first<any>();
  if (!user) return errorResponse("账户不存在", 404);
  if (!user.hashed_password) {
    return errorResponse("解除绑定前请先设置密码，否则将无法登录", 400);
  }

  await env.DB.prepare(
    `UPDATE users SET kinamind_sub = NULL, kinamind_linked_at = NULL, updated_at = ? WHERE id = ?`
  )
    .bind(nowIso(), userId)
    .run();
  return jsonResponse({ ok: true });
}
