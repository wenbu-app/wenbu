-- Search operations contain public canonical URLs and operator receipts, never visitor context.
ALTER TABLE indexnow_state ADD COLUMN last_scanned INTEGER;
UPDATE indexnow_state SET last_scanned = (SELECT MAX(submitted_at) FROM indexnow_submissions);

CREATE TABLE search_console_queue (
  id TEXT PRIMARY KEY, url TEXT NOT NULL, revision TEXT NOT NULL,
  kind TEXT NOT NULL CHECK(kind IN ('core','article')), priority INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK(status IN ('pending','requesting','requested','deferred','uncertain','superseded')),
  created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL, retry_at INTEGER NOT NULL DEFAULT 0,
  requested_at INTEGER, evidence_json TEXT,
  UNIQUE(url,revision)
);
CREATE INDEX search_console_queue_due ON search_console_queue(status,retry_at,priority,created_at);
CREATE TABLE search_console_events (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL, at INTEGER NOT NULL, action TEXT NOT NULL, evidence_json TEXT
);
CREATE INDEX search_console_events_job ON search_console_events(job_id,at);
CREATE TABLE search_console_state (
  id INTEGER PRIMARY KEY CHECK(id=1), retry_at INTEGER NOT NULL DEFAULT 0,
  reason TEXT, updated_at INTEGER
);
INSERT INTO search_console_state(id) VALUES(1);
