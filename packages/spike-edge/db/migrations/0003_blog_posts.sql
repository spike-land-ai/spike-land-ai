-- Blog posts table (seeded from MDX source files via scripts/seed-blog.ts)
CREATE TABLE IF NOT EXISTS blog_posts (
  slug       TEXT PRIMARY KEY,
  title      TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  primer     TEXT NOT NULL DEFAULT '',
  date       TEXT NOT NULL,
  author     TEXT NOT NULL DEFAULT '',
  category   TEXT NOT NULL DEFAULT '',
  tags       TEXT NOT NULL DEFAULT '[]',
  featured   INTEGER NOT NULL DEFAULT 0,
  hero_image TEXT,
  content    TEXT NOT NULL,
  created_at INTEGER NOT NULL DEFAULT (unixepoch()),
  updated_at INTEGER NOT NULL DEFAULT (unixepoch())
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_date ON blog_posts(date DESC);
CREATE INDEX IF NOT EXISTS idx_blog_posts_featured ON blog_posts(featured, date DESC);
