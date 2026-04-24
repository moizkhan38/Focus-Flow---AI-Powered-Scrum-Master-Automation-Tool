-- Focus Flow — initial schema
-- Run via: node backend/scripts/migrate.js

CREATE TABLE IF NOT EXISTS projects (
  id              TEXT PRIMARY KEY,
  name            TEXT NOT NULL,
  description     TEXT,
  status          TEXT NOT NULL DEFAULT 'draft',
  jira_project_key TEXT,
  jira_board_id   INTEGER,
  jira_sprint_id  INTEGER,
  deadline        JSONB,
  sprint_count    INTEGER DEFAULT 1,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  raw             JSONB
);

CREATE INDEX IF NOT EXISTS idx_projects_status ON projects(status);
CREATE INDEX IF NOT EXISTS idx_projects_jira_key ON projects(jira_project_key);

CREATE TABLE IF NOT EXISTS developers (
  username           TEXT PRIMARY KEY,
  jira_username      TEXT,
  avatar_url         TEXT,
  primary_expertise  TEXT,
  experience_level   TEXT,
  top_skills         TEXT[],
  analysis           JSONB,
  availability       JSONB,
  added_at           TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS standups (
  id                SERIAL PRIMARY KEY,
  user_id           TEXT NOT NULL,
  project_key       TEXT,
  timestamp         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  yesterday         TEXT,
  today             TEXT,
  blocker           TEXT,
  is_blocker        BOOLEAN DEFAULT FALSE,
  blocker_details   JSONB,
  sentiment         TEXT,
  finished_tickets  TEXT[],
  today_tickets     TEXT[],
  full_text         TEXT,
  raw_analysis      JSONB
);

CREATE INDEX IF NOT EXISTS idx_standups_user ON standups(user_id);
CREATE INDEX IF NOT EXISTS idx_standups_project ON standups(project_key);
CREATE INDEX IF NOT EXISTS idx_standups_timestamp ON standups(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_standups_blocker ON standups(is_blocker) WHERE is_blocker = TRUE;

CREATE TABLE IF NOT EXISTS retrospectives (
  id          SERIAL PRIMARY KEY,
  project_id  TEXT REFERENCES projects(id) ON DELETE CASCADE,
  sprint_id   INTEGER,
  sprint_name TEXT,
  went_well   TEXT[],
  went_wrong  TEXT[],
  actions     TEXT[],
  created_by  TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_retrospectives_project ON retrospectives(project_id);
CREATE INDEX IF NOT EXISTS idx_retrospectives_sprint ON retrospectives(sprint_id);

CREATE TABLE IF NOT EXISTS assignments (
  id                   SERIAL PRIMARY KEY,
  project_id           TEXT REFERENCES projects(id) ON DELETE CASCADE,
  epic_id              TEXT,
  epic_title           TEXT,
  story_id             TEXT,
  story_title          TEXT,
  story_points         INTEGER,
  developer_username   TEXT,
  score                NUMERIC,
  confidence           TEXT,
  jira_key             TEXT,
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_assignments_project ON assignments(project_id);
CREATE INDEX IF NOT EXISTS idx_assignments_dev ON assignments(developer_username);

CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS projects_touch ON projects;
CREATE TRIGGER projects_touch BEFORE UPDATE ON projects
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();

DROP TRIGGER IF EXISTS developers_touch ON developers;
CREATE TRIGGER developers_touch BEFORE UPDATE ON developers
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
