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

CREATE TABLE IF NOT EXISTS "user" (
  id TEXT PRIMARY KEY NOT NULL,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  emailVerified INTEGER NOT NULL DEFAULT 0,
  image TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS "session" (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  expiresAt INTEGER NOT NULL,
  ipAddress TEXT,
  userAgent TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_session_user_id ON "session" (userId);

CREATE TABLE IF NOT EXISTS account (
  id TEXT PRIMARY KEY NOT NULL,
  userId TEXT NOT NULL,
  accountId TEXT NOT NULL,
  providerId TEXT NOT NULL,
  accessToken TEXT,
  refreshToken TEXT,
  accessTokenExpiresAt INTEGER,
  refreshTokenExpiresAt INTEGER,
  scope TEXT,
  idToken TEXT,
  password TEXT,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL,
  FOREIGN KEY (userId) REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_account_user_id ON account (userId);
CREATE UNIQUE INDEX IF NOT EXISTS idx_account_provider ON account (providerId, accountId);

CREATE TABLE IF NOT EXISTS verification (
  id TEXT PRIMARY KEY NOT NULL,
  identifier TEXT NOT NULL,
  value TEXT NOT NULL,
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_verification_identifier ON verification (identifier);

CREATE TABLE IF NOT EXISTS user_reading_progress (
  user_id TEXT NOT NULL,
  book_id TEXT NOT NULL,
  book_title TEXT DEFAULT '',
  volume_id TEXT NOT NULL,
  volume_title TEXT DEFAULT '',
  anchor_id TEXT DEFAULT '',
  anchor_offset INTEGER DEFAULT 0,
  scroll_y INTEGER DEFAULT 0,
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, book_id),
  FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_progress_updated
ON user_reading_progress (user_id, updated_at DESC);

CREATE TABLE IF NOT EXISTS user_favorites (
  user_id TEXT NOT NULL,
  content_type TEXT NOT NULL,
  path_word TEXT NOT NULL,
  title TEXT NOT NULL,
  cover TEXT DEFAULT '',
  authors TEXT DEFAULT '',
  updated_at TEXT NOT NULL,
  PRIMARY KEY (user_id, content_type, path_word),
  FOREIGN KEY (user_id) REFERENCES "user" (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_user_favorites_updated
ON user_favorites (user_id, updated_at DESC);
