CREATE TABLE IF NOT EXISTS feed_items (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  feed_url TEXT NOT NULL,
  guid TEXT NOT NULL,
  title TEXT,
  summary TEXT,
  link TEXT,
  pub_date DATETIME,
  read BOOLEAN DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(feed_url, guid)
);

CREATE TABLE IF NOT EXISTS messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  role TEXT NOT NULL CHECK(role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_feed_items_pub_date ON feed_items(pub_date DESC);
CREATE INDEX IF NOT EXISTS idx_feed_items_read ON feed_items(read);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON messages(created_at DESC);
