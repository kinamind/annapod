CREATE TABLE IF NOT EXISTS seeker_profile_caches (
  id TEXT PRIMARY KEY,
  profile_id TEXT NOT NULL,
  system_prompt TEXT NOT NULL,
  complaint_chain TEXT NOT NULL DEFAULT '[]',
  style TEXT NOT NULL DEFAULT '[]',
  situation TEXT NOT NULL DEFAULT '',
  status TEXT NOT NULL DEFAULT '',
  event TEXT NOT NULL DEFAULT '',
  scales TEXT NOT NULL DEFAULT '{}',
  current_emotion TEXT,
  has_long_term_memory INTEGER NOT NULL DEFAULT 1,
  skill_version TEXT,
  source_model TEXT,
  init_trace TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  used_count INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_profile_caches_profile ON seeker_profile_caches(profile_id);
CREATE INDEX IF NOT EXISTS idx_profile_caches_ltm ON seeker_profile_caches(has_long_term_memory);
