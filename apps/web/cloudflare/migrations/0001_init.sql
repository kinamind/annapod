CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  hashed_password TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  experience_level TEXT NOT NULL DEFAULT 'beginner',
  specialization TEXT,
  is_active INTEGER NOT NULL DEFAULT 1,
  is_admin INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT
);

CREATE TABLE IF NOT EXISTS seeker_profiles (
  id TEXT PRIMARY KEY,
  age TEXT NOT NULL,
  gender TEXT NOT NULL,
  occupation TEXT NOT NULL,
  marital_status TEXT NOT NULL,
  symptoms TEXT NOT NULL,
  group_tag TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  issue_tags TEXT,
  report TEXT NOT NULL DEFAULT '{}',
  conversation TEXT NOT NULL DEFAULT '[]',
  portrait_raw TEXT NOT NULL DEFAULT '{}',
  source_id TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS session_groups (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  session_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS counseling_sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  session_group_id TEXT,
  has_long_term_memory INTEGER NOT NULL DEFAULT 1,
  session_number INTEGER NOT NULL DEFAULT 1,
  parent_session_id TEXT,
  messages TEXT NOT NULL DEFAULT '[]',
  chain_index INTEGER NOT NULL DEFAULT 1,
  runtime_state TEXT NOT NULL DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'active',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  duration_seconds INTEGER,
  evaluation TEXT,
  score REAL
);

CREATE TABLE IF NOT EXISTS performance_records (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  overall_score REAL NOT NULL DEFAULT 0,
  dimension_scores TEXT NOT NULL DEFAULT '{}',
  mistakes TEXT NOT NULL DEFAULT '[]',
  strengths TEXT NOT NULL DEFAULT '[]',
  feedback TEXT NOT NULL DEFAULT '',
  tips TEXT NOT NULL DEFAULT '[]',
  difficulty TEXT NOT NULL DEFAULT 'intermediate',
  issue_type TEXT,
  school_type TEXT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS knowledge_items (
  id TEXT PRIMARY KEY,
  school TEXT NOT NULL,
  issue TEXT NOT NULL,
  difficulty TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  summary TEXT,
  source_type TEXT NOT NULL,
  source_ref TEXT,
  tags TEXT NOT NULL DEFAULT '[]',
  extra_info TEXT NOT NULL DEFAULT '{}',
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS learning_recommendations (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT NOT NULL,
  recommendation_type TEXT NOT NULL,
  knowledge_item_id TEXT,
  profile_id TEXT,
  priority INTEGER NOT NULL DEFAULT 5,
  reason TEXT NOT NULL DEFAULT '',
  is_read INTEGER NOT NULL DEFAULT 0,
  is_completed INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS long_term_memory_chunks (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id TEXT NOT NULL,
  session_id TEXT NOT NULL,
  turn_index INTEGER NOT NULL,
  role TEXT NOT NULL,
  content TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_profiles_group ON seeker_profiles(group_tag);
CREATE INDEX IF NOT EXISTS idx_profiles_difficulty ON seeker_profiles(difficulty);
CREATE INDEX IF NOT EXISTS idx_sessions_user ON counseling_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_profile ON counseling_sessions(profile_id);
CREATE INDEX IF NOT EXISTS idx_records_user ON performance_records(user_id);
CREATE INDEX IF NOT EXISTS idx_records_session ON performance_records(session_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_school ON knowledge_items(school);
CREATE INDEX IF NOT EXISTS idx_knowledge_issue ON knowledge_items(issue);
CREATE INDEX IF NOT EXISTS idx_knowledge_difficulty ON knowledge_items(difficulty);
