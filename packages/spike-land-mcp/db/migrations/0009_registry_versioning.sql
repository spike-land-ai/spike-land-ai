ALTER TABLE registered_tools ADD COLUMN version TEXT NOT NULL DEFAULT '1.0.0';
ALTER TABLE registered_tools ADD COLUMN stability TEXT NOT NULL DEFAULT 'stable';