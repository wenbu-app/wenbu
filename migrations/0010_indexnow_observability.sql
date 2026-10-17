-- Operational metadata for the exact public ownership file, never visitor identities.
CREATE TABLE IF NOT EXISTS indexnow_verification_hours (
  hour INTEGER PRIMARY KEY,
  requests INTEGER NOT NULL DEFAULT 0,
  ok INTEGER NOT NULL DEFAULT 0,
  first_seen INTEGER NOT NULL,
  last_seen INTEGER NOT NULL,
  samples_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS indexnow_diagnostics (
  id TEXT PRIMARY KEY,
  checked_at INTEGER NOT NULL,
  result_json TEXT NOT NULL
);
