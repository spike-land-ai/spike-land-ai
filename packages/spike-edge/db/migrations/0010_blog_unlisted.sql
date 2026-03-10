-- Add unlisted column to blog_posts (0 = public, 1 = directly addressable only)
ALTER TABLE blog_posts ADD COLUMN unlisted INTEGER NOT NULL DEFAULT 0;
