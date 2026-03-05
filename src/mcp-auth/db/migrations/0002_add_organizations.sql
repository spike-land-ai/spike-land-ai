-- Add organization tables for enterprise RBAC

CREATE TABLE IF NOT EXISTS organization (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  plan TEXT DEFAULT 'enterprise',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS org_member (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL REFERENCES organization(id),
  userId TEXT NOT NULL REFERENCES user(id),
  role TEXT DEFAULT 'member',
  createdAt INTEGER NOT NULL,
  updatedAt INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS org_invite (
  id TEXT PRIMARY KEY,
  orgId TEXT NOT NULL REFERENCES organization(id),
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member',
  expiresAt INTEGER NOT NULL,
  createdAt INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_org_member_org ON org_member(orgId);
CREATE INDEX IF NOT EXISTS idx_org_member_user ON org_member(userId);
CREATE INDEX IF NOT EXISTS idx_org_invite_org ON org_invite(orgId);
CREATE INDEX IF NOT EXISTS idx_org_invite_email ON org_invite(email);
