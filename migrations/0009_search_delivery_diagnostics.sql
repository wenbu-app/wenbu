-- Public delivery diagnostics and provider observations only; no visitor context or credentials.
ALTER TABLE indexnow_submissions ADD COLUMN diagnostics_json TEXT;
ALTER TABLE indexnow_state ADD COLUMN pending_count INTEGER;

CREATE TABLE search_console_inspections (
  job_id TEXT NOT NULL, provider TEXT NOT NULL CHECK(provider IN ('google','bing')),
  status TEXT NOT NULL DEFAULT 'unknown' CHECK(status IN ('unknown','indexed','not_indexed','unavailable')),
  checked_at INTEGER, next_check_at INTEGER NOT NULL,
  last_crawl_at INTEGER, declared_canonical TEXT, indexed_canonical TEXT, evidence_json TEXT,
  PRIMARY KEY(job_id,provider)
);
CREATE INDEX search_console_inspections_due ON search_console_inspections(next_check_at);
CREATE TABLE search_console_inspection_events (
  id TEXT PRIMARY KEY, job_id TEXT NOT NULL, provider TEXT NOT NULL, checked_at INTEGER NOT NULL,
  status TEXT NOT NULL, evidence_json TEXT NOT NULL,
  UNIQUE(job_id,provider,checked_at)
);
INSERT INTO search_console_inspections(job_id,provider,next_check_at)
SELECT q.id,p.provider,COALESCE(q.requested_at,q.created_at)+86400000
FROM search_console_queue q CROSS JOIN (SELECT 'google' AS provider UNION ALL SELECT 'bing') p
WHERE q.status!='superseded';
