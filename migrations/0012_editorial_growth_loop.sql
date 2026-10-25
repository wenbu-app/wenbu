-- A canonical page can receive multiple separately reviewed additions over time.
-- IDs and immutable revisions retain all earlier tasks and failure receipts.
ALTER TABLE editorial_topics RENAME TO editorial_topics_before_growth;
CREATE TABLE editorial_topics (
  id TEXT PRIMARY KEY, slug TEXT NOT NULL, category TEXT NOT NULL,
  definition_json TEXT NOT NULL, status TEXT NOT NULL DEFAULT 'ready',
  priority INTEGER NOT NULL DEFAULT 70, created_at INTEGER NOT NULL,
  last_published_at INTEGER, last_attempt_at INTEGER, attempts INTEGER NOT NULL DEFAULT 0,
  quality_failures INTEGER NOT NULL DEFAULT 0
);
INSERT INTO editorial_topics SELECT * FROM editorial_topics_before_growth;
DROP TABLE editorial_topics_before_growth;
CREATE INDEX editorial_topics_owner ON editorial_topics(category,slug,status);
CREATE TABLE editorial_daily_budgets (
  day TEXT PRIMARY KEY, model_calls INTEGER NOT NULL DEFAULT 0,
  planning_calls INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE editorial_source_health (
  id TEXT PRIMARY KEY, url TEXT NOT NULL, checked_at INTEGER NOT NULL,
  status TEXT NOT NULL, error_code TEXT, characters INTEGER NOT NULL DEFAULT 0
);
