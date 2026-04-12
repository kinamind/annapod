ALTER TABLE users ADD COLUMN accepted_terms_version TEXT;
ALTER TABLE users ADD COLUMN accepted_terms_at TEXT;
ALTER TABLE users ADD COLUMN research_consent INTEGER NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS teams (
  id TEXT PRIMARY KEY,
  kind TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  theme TEXT,
  training_start_at TEXT,
  training_end_at TEXT,
  owner_user_id TEXT NOT NULL,
  join_code TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'active',
  agreement_title TEXT,
  agreement_text TEXT,
  agreement_version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS team_members (
  id TEXT PRIMARY KEY,
  team_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  role TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  accepted_agreement_version INTEGER,
  accepted_agreement_at TEXT,
  joined_at TEXT NOT NULL,
  UNIQUE(team_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_teams_owner ON teams(owner_user_id);
CREATE INDEX IF NOT EXISTS idx_teams_kind ON teams(kind);
CREATE INDEX IF NOT EXISTS idx_team_members_team ON team_members(team_id);
CREATE INDEX IF NOT EXISTS idx_team_members_user ON team_members(user_id);
