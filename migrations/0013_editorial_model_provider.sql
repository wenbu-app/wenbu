CREATE TABLE IF NOT EXISTS editorial_model_provider (
  id INTEGER PRIMARY KEY CHECK(id = 1),
  status TEXT NOT NULL DEFAULT 'available' CHECK(status IN ('available','blocked')),
  reason TEXT,
  http_status INTEGER,
  checked_at INTEGER NOT NULL DEFAULT 0,
  next_check_at INTEGER NOT NULL DEFAULT 0,
  lease_owner TEXT NOT NULL DEFAULT '',
  lease_until INTEGER NOT NULL DEFAULT 0
);
INSERT OR IGNORE INTO editorial_model_provider(id) VALUES(1);
