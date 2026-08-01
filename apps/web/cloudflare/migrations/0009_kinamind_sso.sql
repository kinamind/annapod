-- Link annapod accounts to the KinaMind identity provider (kinamind.org).
--
-- `kinamind_sub` is the `sub` claim from the id_token — stable for the life of
-- the KinaMind account, independent of the person's email or display name.
--
-- Linking is never automatic on email alone. annapod has no email verification,
-- so an attacker could otherwise register an annapod account under a victim's
-- address and later have it silently absorbed (or absorb theirs). Claiming an
-- existing annapod account always requires proving its password.

ALTER TABLE users ADD COLUMN kinamind_sub TEXT;
ALTER TABLE users ADD COLUMN kinamind_linked_at TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS idx_users_kinamind_sub
  ON users(kinamind_sub) WHERE kinamind_sub IS NOT NULL;

-- Short-lived handoff records for the SSO redirect.
--
-- The worker cannot hand the browser an annapod JWT via the URL without it
-- landing in history, logs and the Referer header, so it redirects with a
-- single-use ticket that the SPA immediately exchanges for the real token.
CREATE TABLE IF NOT EXISTS sso_tickets (
  id           TEXT PRIMARY KEY,
  user_id      TEXT,
  -- 'login'  -> `token` is ready to be claimed
  -- 'link'   -> the address matches an existing account; password required
  kind         TEXT NOT NULL,
  token        TEXT,
  -- Pending-link details, retained only until the ticket expires.
  kinamind_sub TEXT,
  email        TEXT,
  display_name TEXT,
  avatar_url   TEXT,
  expires_at   TEXT NOT NULL,
  consumed_at  TEXT,
  created_at   TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_sso_tickets_expires ON sso_tickets(expires_at);

-- OAuth `state` for CSRF protection on the authorization request.
CREATE TABLE IF NOT EXISTS sso_states (
  state         TEXT PRIMARY KEY,
  nonce         TEXT NOT NULL,
  code_verifier TEXT NOT NULL,
  -- Set when an already-signed-in user is linking rather than signing in.
  link_user_id  TEXT,
  return_to     TEXT,
  expires_at    TEXT NOT NULL,
  created_at    TEXT NOT NULL
);
