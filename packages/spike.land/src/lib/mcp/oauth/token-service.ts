/**
 * OAuth Token Service
 *
 * Handles generation, verification, and revocation of OAuth access/refresh tokens
 * for the remote MCP server. Tokens are stored as SHA-256 hashes in the database.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000; // 1 hour
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days
const AUTH_CODE_TTL_MS = 10 * 60 * 1000; // 10 minutes
const TOKEN_PREFIX = "mcp_";

interface TokenPayload {
  userId: string;
  clientId: string;
  scope: string;
}

interface TokenPair {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  tokenType: string;
  scope: string;
}

function generateToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function getPrisma() {
  return (await import("@/lib/prisma")).default;
}

/**
 * Ensure the OAuthClient row exists for a given clientId.
 * Uses upsert so the first token-generation call auto-creates the client
 * instead of throwing a P2003 foreign-key constraint error.
 */
async function ensureOAuthClient(clientId: string): Promise<void> {
  const prisma = await getPrisma();
  await prisma.oAuthClient.upsert({
    where: { clientId },
    update: {},
    create: {
      clientId,
      clientName: clientId,
      redirectUris: [],
      tokenEndpointAuthMethod: "none",
    },
  });
}

/**
 * Generate an access + refresh token pair for a user.
 * Handles P2002 (unique constraint) and P2003 (foreign key) race conditions.
 */
export async function generateTokenPair(
  userId: string,
  clientId: string,
  scope: string,
  resource?: string,
  ttlMs: number = ACCESS_TOKEN_TTL_MS,
): Promise<TokenPair> {
  const prisma = await getPrisma();

  // Ensure the referenced OAuthClient exists before inserting tokens
  await ensureOAuthClient(clientId);

  const createTokenPair = async (accessTok: string, refreshTok: string) => {
    const now = new Date();
    const refreshRecord = await prisma.oAuthAccessToken.create({
      data: {
        tokenHash: hashToken(refreshTok),
        tokenType: "REFRESH",
        clientId,
        userId,
        scope,
        resource: resource ?? null,
        expiresAt: new Date(now.getTime() + REFRESH_TOKEN_TTL_MS),
      },
    });

    await prisma.oAuthAccessToken.create({
      data: {
        tokenHash: hashToken(accessTok),
        tokenType: "ACCESS",
        clientId,
        userId,
        scope,
        resource: resource ?? null,
        expiresAt: new Date(now.getTime() + ttlMs),
        refreshTokenId: refreshRecord.id,
      },
    });
  };

  let accessToken = generateToken();
  let refreshToken = generateToken();

  try {
    await createTokenPair(accessToken, refreshToken);
  } catch (err: unknown) {
    const code = (err as { code?: string }).code;
    if (code === "P2002") {
      // Unique constraint violation on tokenHash — regenerate tokens and retry
      accessToken = generateToken();
      refreshToken = generateToken();
      await createTokenPair(accessToken, refreshToken);
    } else if (code === "P2003") {
      // Foreign key constraint failed — re-ensure client and retry once
      await ensureOAuthClient(clientId);
      await createTokenPair(accessToken, refreshToken);
    } else {
      throw err;
    }
  }

  return {
    accessToken,
    refreshToken,
    expiresIn: Math.floor(ttlMs / 1000),
    tokenType: "Bearer",
    scope,
  };
}

/**
 * Verify an access token and return the associated user/client info
 */
export async function verifyAccessToken(token: string): Promise<TokenPayload | null> {
  if (!token.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  const prisma = await getPrisma();
  const tokenRecord = await prisma.oAuthAccessToken.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      userId: true,
      clientId: true,
      scope: true,
      tokenType: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!tokenRecord) return null;
  if (tokenRecord.tokenType !== "ACCESS") return null;
  if (tokenRecord.revokedAt) return null;
  if (tokenRecord.expiresAt < new Date()) return null;

  return {
    userId: tokenRecord.userId,
    clientId: tokenRecord.clientId,
    scope: tokenRecord.scope,
  };
}

/**
 * Exchange a refresh token for a new access token
 */
export async function refreshAccessToken(
  refreshToken: string,
  clientId: string,
): Promise<TokenPair | null> {
  if (!refreshToken.startsWith(TOKEN_PREFIX)) return null;

  const prisma = await getPrisma();
  const refreshRecord = await prisma.oAuthAccessToken.findUnique({
    where: { tokenHash: hashToken(refreshToken) },
    select: {
      id: true,
      userId: true,
      clientId: true,
      scope: true,
      resource: true,
      tokenType: true,
      expiresAt: true,
      revokedAt: true,
    },
  });

  if (!refreshRecord) return null;
  if (refreshRecord.tokenType !== "REFRESH") return null;
  if (refreshRecord.revokedAt) return null;
  if (refreshRecord.expiresAt < new Date()) return null;
  if (refreshRecord.clientId !== clientId) return null;

  // Generate new access token
  const newAccessToken = generateToken();
  const now = new Date();

  await prisma.oAuthAccessToken.create({
    data: {
      tokenHash: hashToken(newAccessToken),
      tokenType: "ACCESS",
      clientId: refreshRecord.clientId,
      userId: refreshRecord.userId,
      scope: refreshRecord.scope,
      resource: refreshRecord.resource,
      expiresAt: new Date(now.getTime() + ACCESS_TOKEN_TTL_MS),
      refreshTokenId: refreshRecord.id,
    },
  });

  return {
    accessToken: newAccessToken,
    refreshToken, // Return same refresh token
    expiresIn: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    tokenType: "Bearer",
    scope: refreshRecord.scope,
  };
}

/**
 * Revoke a token (access or refresh)
 */
export async function revokeToken(token: string): Promise<boolean> {
  if (!token.startsWith(TOKEN_PREFIX)) return false;

  const prisma = await getPrisma();
  const result = await prisma.oAuthAccessToken.updateMany({
    where: {
      tokenHash: hashToken(token),
      revokedAt: null,
    },
    data: { revokedAt: new Date() },
  });

  return result.count > 0;
}

// ========================================
// Authorization Code Management
// ========================================

/**
 * Generate an authorization code
 */
export async function generateAuthorizationCode(params: {
  clientId: string;
  userId: string;
  redirectUri: string;
  codeChallenge: string;
  codeChallengeMethod?: string;
  scope?: string;
  state?: string;
  resource?: string;
}): Promise<string> {
  const prisma = await getPrisma();
  const code = randomBytes(32).toString("base64url");

  await prisma.oAuthAuthorizationCode.create({
    data: {
      code,
      clientId: params.clientId,
      userId: params.userId,
      redirectUri: params.redirectUri,
      codeChallenge: params.codeChallenge,
      codeChallengeMethod: params.codeChallengeMethod || "S256",
      scope: params.scope || "mcp",
      state: params.state ?? null,
      resource: params.resource ?? null,
      expiresAt: new Date(Date.now() + AUTH_CODE_TTL_MS),
    },
  });

  return code;
}

/**
 * Exchange an authorization code for tokens
 */
export async function exchangeAuthorizationCode(
  code: string,
  clientId: string,
  codeVerifier: string,
  redirectUri: string,
): Promise<TokenPair | null> {
  const prisma = await getPrisma();

  // Atomically mark the code as used to prevent TOCTOU race conditions.
  // updateMany with usedAt: null ensures only one concurrent request can succeed.
  const updated = await prisma.oAuthAuthorizationCode.updateMany({
    where: { code, usedAt: null },
    data: { usedAt: new Date() },
  });

  // If no rows were updated, the code was already used, doesn't exist, or is invalid
  if (updated.count === 0) return null;

  // Now fetch the code details for validation
  const authCode = await prisma.oAuthAuthorizationCode.findUnique({
    where: { code },
    select: {
      clientId: true,
      userId: true,
      redirectUri: true,
      codeChallenge: true,
      codeChallengeMethod: true,
      scope: true,
      resource: true,
      expiresAt: true,
    },
  });

  if (!authCode) return null;
  if (authCode.expiresAt < new Date()) return null;
  if (authCode.clientId !== clientId) return null;
  if (authCode.redirectUri !== redirectUri) return null;

  // Verify PKCE
  if (!verifyPkce(codeVerifier, authCode.codeChallenge)) {
    return null;
  }

  // Generate tokens
  return generateTokenPair(
    authCode.userId,
    authCode.clientId,
    authCode.scope,
    authCode.resource ?? undefined,
  );
}

// ========================================
// PKCE Verification
// ========================================

/**
 * Verify PKCE code_verifier against stored code_challenge (S256 only)
 */
export function verifyPkce(codeVerifier: string, codeChallenge: string): boolean {
  const computed = createHash("sha256").update(codeVerifier).digest("base64url");
  // Use timing-safe comparison to prevent side-channel attacks
  const a = Buffer.from(computed);
  const b = Buffer.from(codeChallenge);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
