-- Optional, first-party account measurement. No content or visitor/session IDs.
CREATE TABLE wb_trial_cohorts (
  guest_hash TEXT PRIMARY KEY, first_completed_at INTEGER NOT NULL,
  locale TEXT NOT NULL, is_test INTEGER NOT NULL,
  owner TEXT REFERENCES user(id) ON DELETE CASCADE,
  registered_at INTEGER, saved_at INTEGER
);
CREATE INDEX wb_trials_completed ON wb_trial_cohorts(first_completed_at,locale,is_test);
CREATE TABLE wb_instances (
  owner TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  instance TEXT NOT NULL, first_seen_at INTEGER NOT NULL, last_record_read_at INTEGER,
  PRIMARY KEY(owner,instance)
);
ALTER TABLE wb_operations ADD COLUMN cross_instance INTEGER NOT NULL DEFAULT 0;
