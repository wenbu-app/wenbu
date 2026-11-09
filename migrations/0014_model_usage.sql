CREATE TABLE IF NOT EXISTS model_usage (
  id TEXT PRIMARY KEY,
  scene TEXT NOT NULL,
  run_id TEXT,
  round INTEGER,
  context_version TEXT,
  started_at INTEGER NOT NULL,
  finished_at INTEGER NOT NULL,
  requested_model TEXT NOT NULL,
  served_model TEXT,
  http_status INTEGER,
  outcome TEXT NOT NULL,
  request_bytes INTEGER,
  prompt_tokens INTEGER,
  completion_tokens INTEGER,
  cache_hit_tokens INTEGER,
  cache_miss_tokens INTEGER,
  reasoning_tokens INTEGER,
  cost_cny_nanos INTEGER,
  pricing_version TEXT,
  rate_band TEXT
);
CREATE INDEX IF NOT EXISTS model_usage_day ON model_usage(started_at, scene);
CREATE INDEX IF NOT EXISTS model_usage_run ON model_usage(run_id, scene);
