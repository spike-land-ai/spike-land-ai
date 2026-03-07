-- Add draft column to blog_posts (0 = published, 1 = draft)
ALTER TABLE blog_posts ADD COLUMN draft INTEGER NOT NULL DEFAULT 0;
