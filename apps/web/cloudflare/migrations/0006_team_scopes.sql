ALTER TABLE teams ADD COLUMN profile_group_tag TEXT;
ALTER TABLE teams ADD COLUMN profile_difficulty TEXT;
ALTER TABLE teams ADD COLUMN profile_issue_tag TEXT;

ALTER TABLE session_groups ADD COLUMN team_id TEXT;
ALTER TABLE counseling_sessions ADD COLUMN team_id TEXT;

CREATE INDEX IF NOT EXISTS idx_teams_profile_group_tag ON teams(profile_group_tag);
CREATE INDEX IF NOT EXISTS idx_teams_profile_difficulty ON teams(profile_difficulty);
CREATE INDEX IF NOT EXISTS idx_teams_profile_issue_tag ON teams(profile_issue_tag);
CREATE INDEX IF NOT EXISTS idx_session_groups_team ON session_groups(team_id);
CREATE INDEX IF NOT EXISTS idx_sessions_team ON counseling_sessions(team_id);
