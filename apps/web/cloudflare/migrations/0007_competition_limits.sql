ALTER TABLE teams ADD COLUMN session_time_limit_minutes INTEGER;
ALTER TABLE teams ADD COLUMN max_sessions_per_user INTEGER;

ALTER TABLE counseling_sessions ADD COLUMN time_limit_seconds INTEGER;

CREATE INDEX IF NOT EXISTS idx_teams_time_limit ON teams(session_time_limit_minutes);
CREATE INDEX IF NOT EXISTS idx_teams_max_sessions ON teams(max_sessions_per_user);
