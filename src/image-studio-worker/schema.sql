-- Pixel Studio D1 Schema
-- Run: wrangler d1 execute PIXEL_DB --local --file schema.sql

CREATE TABLE IF NOT EXISTS images (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  originalUrl TEXT NOT NULL,
  originalR2Key TEXT NOT NULL,
  originalWidth INTEGER NOT NULL,
  originalHeight INTEGER NOT NULL,
  originalSizeBytes INTEGER NOT NULL,
  originalFormat TEXT NOT NULL,
  isPublic INTEGER NOT NULL DEFAULT 0,
  viewCount INTEGER NOT NULL DEFAULT 0,
  tags TEXT NOT NULL DEFAULT '[]',
  shareToken TEXT,
  thumbnailUrl TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_images_userId ON images(userId);
CREATE INDEX IF NOT EXISTS idx_images_shareToken ON images(shareToken);

CREATE TABLE IF NOT EXISTS enhancement_jobs (
  id TEXT PRIMARY KEY,
  imageId TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  userId TEXT NOT NULL,
  tier TEXT NOT NULL,
  creditsCost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  enhancedUrl TEXT,
  enhancedR2Key TEXT,
  enhancedWidth INTEGER,
  enhancedHeight INTEGER,
  enhancedSizeBytes INTEGER,
  errorMessage TEXT,
  retryCount INTEGER NOT NULL DEFAULT 0,
  processingStartedAt TEXT,
  processingCompletedAt TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_jobs_userId ON enhancement_jobs(userId);
CREATE INDEX IF NOT EXISTS idx_jobs_imageId ON enhancement_jobs(imageId);
CREATE INDEX IF NOT EXISTS idx_jobs_status ON enhancement_jobs(status);

CREATE TABLE IF NOT EXISTS albums (
  id TEXT PRIMARY KEY,
  handle TEXT NOT NULL UNIQUE,
  userId TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  coverImageId TEXT REFERENCES images(id) ON DELETE SET NULL,
  privacy TEXT NOT NULL DEFAULT 'PRIVATE',
  defaultTier TEXT NOT NULL DEFAULT 'FREE',
  shareToken TEXT,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  isDefault INTEGER NOT NULL DEFAULT 0,
  pipelineId TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_albums_userId ON albums(userId);
CREATE INDEX IF NOT EXISTS idx_albums_handle ON albums(handle);
CREATE INDEX IF NOT EXISTS idx_albums_default ON albums(userId, isDefault);

CREATE TABLE IF NOT EXISTS album_images (
  id TEXT PRIMARY KEY,
  albumId TEXT NOT NULL REFERENCES albums(id) ON DELETE CASCADE,
  imageId TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  sortOrder INTEGER NOT NULL DEFAULT 0,
  addedAt TEXT NOT NULL,
  UNIQUE(albumId, imageId)
);
CREATE INDEX IF NOT EXISTS idx_album_images_albumId ON album_images(albumId);

CREATE TABLE IF NOT EXISTS pipelines (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  userId TEXT,
  visibility TEXT NOT NULL DEFAULT 'PRIVATE',
  shareToken TEXT,
  tier TEXT NOT NULL DEFAULT 'FREE',
  analysisConfig TEXT,
  autoCropConfig TEXT,
  promptConfig TEXT,
  generationConfig TEXT,
  usageCount INTEGER NOT NULL DEFAULT 0,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pipelines_userId ON pipelines(userId);

CREATE TABLE IF NOT EXISTS generation_jobs (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  type TEXT NOT NULL,
  tier TEXT NOT NULL,
  creditsCost INTEGER NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDING',
  prompt TEXT NOT NULL,
  inputImageUrl TEXT,
  outputImageUrl TEXT,
  outputWidth INTEGER,
  outputHeight INTEGER,
  outputSizeBytes INTEGER,
  errorMessage TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_gen_jobs_userId ON generation_jobs(userId);

CREATE TABLE IF NOT EXISTS subjects (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  imageId TEXT NOT NULL REFERENCES images(id) ON DELETE CASCADE,
  label TEXT NOT NULL,
  type TEXT NOT NULL,
  description TEXT,
  createdAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_subjects_userId ON subjects(userId);

CREATE TABLE IF NOT EXISTS credits (
  userId TEXT PRIMARY KEY,
  remaining INTEGER NOT NULL DEFAULT 100,
  updatedAt TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS credit_transactions (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  amount INTEGER NOT NULL,
  source TEXT NOT NULL,
  sourceId TEXT,
  createdAt TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS user (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    emailVerified INTEGER NOT NULL,
    image TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS session (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES user(id),
    token TEXT NOT NULL UNIQUE,
    expiresAt INTEGER NOT NULL,
    ipAddress TEXT,
    userAgent TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS account (
    id TEXT PRIMARY KEY,
    userId TEXT NOT NULL REFERENCES user(id),
    accountId TEXT NOT NULL,
    providerId TEXT NOT NULL,
    accessToken TEXT,
    refreshToken TEXT,
    idToken TEXT,
    accessTokenExpiresAt INTEGER,
    refreshTokenExpiresAt INTEGER,
    scope TEXT,
    password TEXT,
    createdAt INTEGER NOT NULL,
    updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS verification (
    id TEXT PRIMARY KEY,
    identifier TEXT NOT NULL,
    value TEXT NOT NULL,
    expiresAt INTEGER NOT NULL,
    createdAt INTEGER,
    updatedAt INTEGER
);

CREATE TABLE IF NOT EXISTS tool_calls (
  id TEXT PRIMARY KEY,
  userId TEXT NOT NULL,
  toolName TEXT NOT NULL,
  args TEXT NOT NULL,
  durationMs INTEGER NOT NULL DEFAULT 0,
  isError INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'COMPLETED',
  result TEXT,
  createdAt TEXT NOT NULL,
  updatedAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tool_calls_createdAt ON tool_calls(createdAt DESC);
