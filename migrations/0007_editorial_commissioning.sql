CREATE TABLE IF NOT EXISTS editorial_commissioning_runs (
  id TEXT PRIMARY KEY, policy_version INTEGER NOT NULL, status TEXT NOT NULL,
  started_at INTEGER NOT NULL, finished_at INTEGER, error_code TEXT, receipt_json TEXT
);
CREATE INDEX IF NOT EXISTS editorial_commissioning_started
  ON editorial_commissioning_runs(started_at DESC);
