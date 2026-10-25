-- Deployed public blog fingerprints, separate from provider receipts and pauses.
CREATE TABLE search_static_blog_state (
  id INTEGER PRIMARY KEY CHECK(id=1), initialized_at INTEGER NOT NULL
);
CREATE TABLE search_static_blog_revisions (
  url TEXT PRIMARY KEY, revision TEXT NOT NULL, updated_at INTEGER NOT NULL
);
