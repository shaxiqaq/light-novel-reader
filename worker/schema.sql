CREATE TABLE IF NOT EXISTS reading_progress (
  sync_key TEXT NOT NULL,
  book_id TEXT NOT NULL,
  book_title TEXT DEFAULT '',
  volume_id TEXT NOT NULL,
  volume_title TEXT DEFAULT '',
  anchor_id TEXT DEFAULT '',
  anchor_offset INTEGER DEFAULT 0,
  scroll_y INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (sync_key, book_id)
);

CREATE INDEX IF NOT EXISTS idx_reading_progress_sync_updated
ON reading_progress (sync_key, updated_at DESC);
