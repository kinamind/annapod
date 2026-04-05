import type { CloudflareEnv } from "./types";

const encoder = new TextEncoder();

function getJwtSecret(env: CloudflareEnv) {
  const secret = env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error("Missing Pages secret: JWT_SECRET");
  }
  return secret;
}

function bytesToBase64Url(bytes: Uint8Array) {
  const binary = Array.from(bytes, (b) => String.fromCharCode(b)).join("");
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

function stringToBase64Url(value: string) {
  return bytesToBase64Url(encoder.encode(value));
}

function base64UrlToString(value: string) {
  const normalized = value.replace(/-/g, "+").replace(/_/g, "/");
  const padded = normalized + "=".repeat((4 - (normalized.length % 4 || 4)) % 4);
  return atob(padded);
}

async function hmacSign(secret: string, value: string) {
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(value));
  return bytesToBase64Url(new Uint8Array(signature));
}

export async function hashPassword(password: string) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations: 120000 },
    key,
    256
  );
  return `pbkdf2$120000$${bytesToBase64Url(salt)}$${bytesToBase64Url(new Uint8Array(bits))}`;
}

export async function verifyPassword(password: string, hashed: string) {
  const [scheme, rawIterations, rawSalt, expected] = hashed.split("$");
  if (scheme !== "pbkdf2" || !rawIterations || !rawSalt || !expected) return false;
  const iterations = Number(rawIterations);
  const salt = Uint8Array.from(base64UrlToString(rawSalt), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey("raw", encoder.encode(password), "PBKDF2", false, ["deriveBits"]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", hash: "SHA-256", salt, iterations },
    key,
    256
  );
  const actual = bytesToBase64Url(new Uint8Array(bits));
  return actual === expected;
}

export async function signJwt(env: CloudflareEnv, payload: Record<string, unknown>) {
  const header = stringToBase64Url(JSON.stringify({ alg: "HS256", typ: "JWT" }));
  const body = stringToBase64Url(
    JSON.stringify({
      ...payload,
      exp: Math.floor(Date.now() / 1000) + 60 * 60 * 24,
    })
  );
  const signature = await hmacSign(getJwtSecret(env), `${header}.${body}`);
  return `${header}.${body}.${signature}`;
}

export async function verifyJwt(env: CloudflareEnv, token: string) {
  const [header, payload, signature] = token.split(".");
  if (!header || !payload || !signature) return null;
  const expected = await hmacSign(getJwtSecret(env), `${header}.${payload}`);
  if (expected !== signature) return null;

  try {
    const json = JSON.parse(base64UrlToString(payload)) as { sub?: string; exp?: number };
    if (!json.sub || !json.exp || json.exp < Math.floor(Date.now() / 1000)) {
      return null;
    }
    return json;
  } catch {
    return null;
  }
}

export async function getAuthUserId(request: Request, env: CloudflareEnv) {
  const auth = request.headers.get("Authorization") || "";
  const token = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  if (!token) return null;
  const payload = await verifyJwt(env, token);
  return payload?.sub || null;
}
