-- Preserve every failed attempt while allowing one live attempt per scheduled slot.
ALTER TABLE editorial_runs RENAME TO editorial_runs_previous;
CREATE TABLE editorial_runs (
  id TEXT PRIMARY KEY, slot TEXT NOT NULL, topic_id TEXT,
  status TEXT NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  research_key TEXT, draft_key TEXT, review_key TEXT, error_code TEXT,
  revision TEXT, published_urls_json TEXT, model_calls INTEGER NOT NULL DEFAULT 0
);
INSERT INTO editorial_runs SELECT * FROM editorial_runs_previous;
DROP TABLE editorial_runs_previous;
CREATE INDEX editorial_runs_status ON editorial_runs(status, updated_at);
CREATE UNIQUE INDEX editorial_live_slot ON editorial_runs(slot) WHERE status != 'blocked';
ALTER TABLE editorial_topics ADD COLUMN quality_failures INTEGER NOT NULL DEFAULT 0;
