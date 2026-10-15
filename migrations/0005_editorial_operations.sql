CREATE TABLE IF NOT EXISTS editorial_topics (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL, category TEXT NOT NULL,
  definition_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ready',
  priority INTEGER NOT NULL DEFAULT 70, created_at INTEGER NOT NULL,
  last_published_at INTEGER, last_attempt_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
  UNIQUE(category, slug)
);
CREATE TABLE IF NOT EXISTS editorial_runs (
  id TEXT PRIMARY KEY, slot TEXT NOT NULL UNIQUE, topic_id TEXT,
  status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  research_key TEXT, draft_key TEXT, review_key TEXT, error_code TEXT,
  revision TEXT, published_urls_json TEXT, model_calls INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS editorial_publications (
  path TEXT PRIMARY KEY, topic_id TEXT NOT NULL, revision TEXT NOT NULL,
  document_json TEXT NOT NULL, published_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  run_id TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS editorial_revisions (
  revision TEXT PRIMARY KEY, path TEXT NOT NULL, document_json TEXT NOT NULL,
  run_id TEXT NOT NULL, published_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS editorial_observations (
  id TEXT PRIMARY KEY, kind TEXT NOT NULL, checked_at INTEGER NOT NULL,
  period_start TEXT, period_end TEXT, status TEXT NOT NULL, evidence_json TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS editorial_runs_status ON editorial_runs(status, updated_at);
CREATE INDEX IF NOT EXISTS editorial_observations_kind ON editorial_observations(kind, checked_at);
CREATE TABLE IF NOT EXISTS editorial_state (
  id INTEGER PRIMARY KEY CHECK(id = 1), lease_owner TEXT NOT NULL DEFAULT '',
  lease_until INTEGER NOT NULL DEFAULT 0, last_content_at INTEGER, last_health_at INTEGER,
  last_planning_at INTEGER
);
INSERT OR IGNORE INTO editorial_state(id) VALUES(1);

ALTER TABLE indexnow_submissions ADD COLUMN retry_after_ms INTEGER;
ALTER TABLE indexnow_submissions ADD COLUMN endpoint_host TEXT;
ALTER TABLE indexnow_submissions ADD COLUMN response_request_id TEXT;
ALTER TABLE indexnow_submissions ADD COLUMN failure_streak INTEGER;
