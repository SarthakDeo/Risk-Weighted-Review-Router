CREATE TABLE IF NOT EXISTS files (
  file_path TEXT PRIMARY KEY,
  commit_count INTEGER NOT NULL DEFAULT 0,
  lines_added INTEGER NOT NULL DEFAULT 0,
  lines_deleted INTEGER NOT NULL DEFAULT 0,
  churn INTEGER NOT NULL DEFAULT 0,
  revert_count INTEGER NOT NULL DEFAULT 0,
  hotfix_count INTEGER NOT NULL DEFAULT 0,
  bug_fix_count INTEGER NOT NULL DEFAULT 0,
  bug_fix_ratio DOUBLE PRECISION NOT NULL DEFAULT 0,
  last_modified_at TIMESTAMPTZ,
  incident_count INTEGER NOT NULL DEFAULT 0,
  recent_incident_count INTEGER NOT NULL DEFAULT 0,
  sensitivity_tags TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  blast_radius INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS incident_files (
  incident_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  PRIMARY KEY (incident_id, file_path)
);

CREATE TABLE IF NOT EXISTS refresh_runs (
  id SERIAL PRIMARY KEY,
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'running',
  notes TEXT
);

CREATE INDEX IF NOT EXISTS idx_files_path ON files (file_path);
CREATE INDEX IF NOT EXISTS idx_incident_files_incident_id ON incident_files (incident_id);
CREATE INDEX IF NOT EXISTS idx_incident_files_file_path ON incident_files (file_path);
CREATE INDEX IF NOT EXISTS idx_files_updated_at ON files (updated_at);
