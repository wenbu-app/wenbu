-- Private application data. Never join this database to anonymous traffic identifiers.
CREATE TABLE wb_accounts (
  user_id TEXT PRIMARY KEY REFERENCES user(id) ON DELETE CASCADE,
  created_at INTEGER NOT NULL, locale TEXT NOT NULL, analytics_enabled INTEGER NOT NULL DEFAULT 0,
  is_test INTEGER NOT NULL DEFAULT 0, source TEXT NOT NULL DEFAULT 'unknown',
  cloud_history INTEGER NOT NULL DEFAULT 1, storage_bytes INTEGER NOT NULL DEFAULT 0,
  activated_at INTEGER, status TEXT NOT NULL DEFAULT 'active'
);
CREATE TABLE wb_records (
  owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK(kind IN ('journal','session')), id TEXT NOT NULL,
  content TEXT NOT NULL, hash TEXT NOT NULL, bytes INTEGER NOT NULL,
  revision INTEGER NOT NULL, created_at INTEGER NOT NULL, updated_at INTEGER NOT NULL,
  deleted_at INTEGER, provenance TEXT NOT NULL DEFAULT 'user_data',
  PRIMARY KEY(owner,kind,id)
);
CREATE INDEX wb_records_updated ON wb_records(owner,updated_at,kind,id);
-- One bounded JSON document per message; a long chat is not one giant D1 value.
CREATE TABLE wb_record_parts (
  owner TEXT NOT NULL, kind TEXT NOT NULL, id TEXT NOT NULL,
  position INTEGER NOT NULL, content TEXT NOT NULL,
  PRIMARY KEY(owner,kind,id,position),
  FOREIGN KEY(owner,kind,id) REFERENCES wb_records(owner,kind,id) ON DELETE CASCADE
);
CREATE TABLE wb_mutations (
  owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE, request_id TEXT NOT NULL,
  kind TEXT NOT NULL, record_id TEXT NOT NULL, hash TEXT NOT NULL,
  revision INTEGER NOT NULL, delta INTEGER NOT NULL, applied INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL, PRIMARY KEY(owner,request_id)
);
CREATE TABLE wb_imports (
  owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  source TEXT NOT NULL, original_id TEXT NOT NULL, kind TEXT NOT NULL,
  hash TEXT NOT NULL, record_id TEXT NOT NULL,
  PRIMARY KEY(owner,source,kind,original_id)
);
CREATE TABLE wb_operations (
  owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  operation_id TEXT NOT NULL, kind TEXT NOT NULL, completed_at INTEGER NOT NULL,
  saved_at INTEGER, PRIMARY KEY(owner,operation_id)
);
CREATE TABLE wb_auth_daily (
  day TEXT NOT NULL, event TEXT NOT NULL, locale TEXT NOT NULL, is_test INTEGER NOT NULL,
  count INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(day,event,locale,is_test)
);
