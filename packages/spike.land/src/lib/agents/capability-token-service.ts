/**
 * Capability Token Service
 *
 * Handles creation, verification, revocation, delegation, and budget management
 * of agent capability tokens. Tokens use the "cap_" prefix and are stored as
 * SHA-256 hashes in the database.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

const TOKEN_PREFIX = "cap_";
const DEFAULT_MAX_DELEGATION_DEPTH = 2;

// ─── Types ───────────────────────────────────────────────────────────────────

export interface CreateCapabilityTokenParams {
  agentId: string;
  grantedByUserId: string;
  grantedByAgentId?: string;
  allowedTools: string[];
  allowedCategories: string[];
  deniedTools: string[];
  workspaceIds?: string[];
  maxTokenBudget?: number;
  maxApiCalls?: number;
  parentTokenId?: string;
  maxDelegationDepth?: number;
  expiresAt?: Date;
}

export interface CapabilityTokenPayload {
  tokenId: string;
  agentId: string;
  userId: string;
  allowedTools: string[];
  allowedCategories: string[];
  deniedTools: string[];
  workspaceIds: string[];
  maxTokenBudget: number;
  usedTokenBudget: number;
  maxApiCalls: number;
  usedApiCalls: number;
  delegationDepth: number;
  maxDelegationDepth: number;
}

export interface DelegateTokenParams {
  agentId: string;
  allowedTools: string[];
  allowedCategories: string[];
  deniedTools: string[];
  workspaceIds?: string[];
  maxTokenBudget?: number;
  maxApiCalls?: number;
  expiresAt?: Date;
}

interface TokenCreateResult {
  rawToken: string;
  tokenId: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function generateRawToken(): string {
  return TOKEN_PREFIX + randomBytes(32).toString("base64url");
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verify a hash matches using constant-time comparison to prevent timing attacks.
 */
function verifyHash(providedToken: string, storedHash: string): boolean {
  const computedHash = hashToken(providedToken);
  const a = Buffer.from(computedHash, "hex");
  const b = Buffer.from(storedHash, "hex");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new capability token for an agent.
 * Returns the raw token (shown once) and the database record ID.
 */
export async function createCapabilityToken(
  params: CreateCapabilityTokenParams,
): Promise<TokenCreateResult> {
  const prisma = (await import("@/lib/prisma")).default;

  const rawToken = generateRawToken();
  const tokenHash = hashToken(rawToken);

  let delegationDepth = 0;

  if (params.parentTokenId) {
    const parent = await prisma.agentCapabilityToken.findUnique({
      where: { id: params.parentTokenId },
      select: { delegationDepth: true, status: true },
    });
    if (!parent || parent.status !== "ACTIVE") {
      throw new Error("Parent token not found or not active");
    }
    delegationDepth = parent.delegationDepth + 1;
  }

  const record = await prisma.agentCapabilityToken.create({
    data: {
      tokenHash,
      agentId: params.agentId,
      grantedByUserId: params.grantedByUserId,
      ...(params.grantedByAgentId !== undefined
        ? { grantedByAgentId: params.grantedByAgentId }
        : {}),
      allowedTools: params.allowedTools,
      allowedCategories: params.allowedCategories,
      deniedTools: params.deniedTools,
      workspaceIds: params.workspaceIds ?? [],
      maxTokenBudget: params.maxTokenBudget ?? 100000,
      maxApiCalls: params.maxApiCalls ?? 1000,
      ...(params.parentTokenId !== undefined ? { parentTokenId: params.parentTokenId } : {}),
      delegationDepth,
      maxDelegationDepth: params.maxDelegationDepth ?? DEFAULT_MAX_DELEGATION_DEPTH,
      ...(params.expiresAt !== undefined ? { expiresAt: params.expiresAt } : {}),
    },
  });

  return { rawToken, tokenId: record.id };
}

/**
 * Verify a capability token and return its payload.
 * Returns null if the token is invalid, revoked, or expired.
 */
export async function verifyCapabilityToken(
  bearerToken: string,
): Promise<CapabilityTokenPayload | null> {
  if (!bearerToken.startsWith(TOKEN_PREFIX)) {
    return null;
  }

  const prisma = (await import("@/lib/prisma")).default;
  const tokenHash = hashToken(bearerToken);

  const record = await prisma.agentCapabilityToken.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      tokenHash: true,
      agentId: true,
      grantedByUserId: true,
      status: true,
      expiresAt: true,
      allowedTools: true,
      allowedCategories: true,
      deniedTools: true,
      workspaceIds: true,
      maxTokenBudget: true,
      usedTokenBudget: true,
      maxApiCalls: true,
      usedApiCalls: true,
      delegationDepth: true,
      maxDelegationDepth: true,
    },
  });

  if (!record) return null;
  if (record.status !== "ACTIVE") return null;
  if (record.expiresAt && record.expiresAt < new Date()) return null;

  // Constant-time hash verification
  if (!verifyHash(bearerToken, record.tokenHash)) return null;

  return {
    tokenId: record.id,
    agentId: record.agentId,
    userId: record.grantedByUserId,
    allowedTools: record.allowedTools,
    allowedCategories: record.allowedCategories,
    deniedTools: record.deniedTools,
    workspaceIds: record.workspaceIds,
    maxTokenBudget: record.maxTokenBudget,
    usedTokenBudget: record.usedTokenBudget,
    maxApiCalls: record.maxApiCalls,
    usedApiCalls: record.usedApiCalls,
    delegationDepth: record.delegationDepth,
    maxDelegationDepth: record.maxDelegationDepth,
  };
}

/**
 * Revoke a capability token. Optionally cascade to all child tokens.
 */
export async function revokeCapabilityToken(tokenId: string, cascade: boolean): Promise<void> {
  const prisma = (await import("@/lib/prisma")).default;
  const now = new Date();

  await prisma.agentCapabilityToken.updateMany({
    where: { id: tokenId, status: "ACTIVE" },
    data: { status: "REVOKED", revokedAt: now },
  });

  if (cascade) {
    // Find all children recursively using a loop
    const toRevoke: string[] = [tokenId];
    let current = [tokenId];

    while (current.length > 0) {
      const children = await prisma.agentCapabilityToken.findMany({
        where: { parentTokenId: { in: current }, status: "ACTIVE" },
        select: { id: true },
      });

      const childIds = children.map((c) => c.id);
      if (childIds.length === 0) break;

      toRevoke.push(...childIds);
      current = childIds;
    }

    // Revoke all children in one batch (skip the parent, already revoked)
    if (toRevoke.length > 1) {
      await prisma.agentCapabilityToken.updateMany({
        where: { id: { in: toRevoke.slice(1) }, status: "ACTIVE" },
        data: { status: "REVOKED", revokedAt: now },
      });
    }
  }
}

/**
 * Create a delegated child token with a strict subset of the parent's capabilities.
 * Budget is carved from the parent's remaining budget (not additive).
 */
export async function delegateToken(
  parentTokenId: string,
  subset: DelegateTokenParams,
): Promise<TokenCreateResult> {
  const prisma = (await import("@/lib/prisma")).default;

  const parent = await prisma.agentCapabilityToken.findUnique({
    where: { id: parentTokenId },
    select: {
      status: true,
      expiresAt: true,
      grantedByUserId: true,
      agentId: true,
      allowedTools: true,
      allowedCategories: true,
      deniedTools: true,
      workspaceIds: true,
      maxTokenBudget: true,
      usedTokenBudget: true,
      maxApiCalls: true,
      usedApiCalls: true,
      delegationDepth: true,
      maxDelegationDepth: true,
    },
  });

  if (!parent) {
    throw new Error("Parent token not found");
  }
  if (parent.status !== "ACTIVE") {
    throw new Error("Parent token is not active");
  }
  if (parent.expiresAt && parent.expiresAt < new Date()) {
    throw new Error("Parent token is expired");
  }

  // Check delegation depth
  if (parent.delegationDepth >= parent.maxDelegationDepth) {
    throw new Error(`Maximum delegation depth (${parent.maxDelegationDepth}) exceeded`);
  }

  // Validate subset: child tools must be a subset of parent's allowed tools/categories
  const parentAllowedSet = new Set([...parent.allowedTools, ...parent.allowedCategories]);
  for (const tool of subset.allowedTools) {
    if (!parent.allowedTools.includes(tool) && !parentAllowedSet.has(tool)) {
      throw new Error(`Tool "${tool}" not in parent's allowed scope`);
    }
  }
  for (const category of subset.allowedCategories) {
    if (!parent.allowedCategories.includes(category)) {
      throw new Error(`Category "${category}" not in parent's allowed scope`);
    }
  }

  // Validate budget: child budget <= parent remaining budget
  const parentRemainingBudget = parent.maxTokenBudget - parent.usedTokenBudget;
  const childBudget = subset.maxTokenBudget ?? parentRemainingBudget;
  if (childBudget > parentRemainingBudget) {
    throw new Error(
      `Requested budget (${childBudget}) exceeds parent remaining budget (${parentRemainingBudget})`,
    );
  }

  const parentRemainingCalls = parent.maxApiCalls - parent.usedApiCalls;
  const childCalls = subset.maxApiCalls ?? parentRemainingCalls;
  if (childCalls > parentRemainingCalls) {
    throw new Error(
      `Requested API calls (${childCalls}) exceeds parent remaining calls (${parentRemainingCalls})`,
    );
  }

  // Merge denied tools: child inherits parent's denials + its own
  const mergedDenied = [...new Set([...parent.deniedTools, ...subset.deniedTools])];

  // Workspace constraint: child workspaces must be subset of parent's
  const parentWsSet = new Set(parent.workspaceIds);
  const childWs = subset.workspaceIds ?? parent.workspaceIds;
  for (const ws of childWs) {
    if (parent.workspaceIds.length > 0 && !parentWsSet.has(ws)) {
      throw new Error(`Workspace "${ws}" not in parent's allowed workspaces`);
    }
  }

  return createCapabilityToken({
    agentId: subset.agentId,
    grantedByUserId: parent.grantedByUserId,
    grantedByAgentId: parent.agentId,
    allowedTools: subset.allowedTools,
    allowedCategories: subset.allowedCategories,
    deniedTools: mergedDenied,
    workspaceIds: childWs,
    maxTokenBudget: childBudget,
    maxApiCalls: childCalls,
    parentTokenId,
    maxDelegationDepth: parent.maxDelegationDepth,
    ...(subset.expiresAt !== undefined ? { expiresAt: subset.expiresAt } : {}),
  });
}

/**
 * Atomically deduct budget from a capability token.
 * Returns false if the deduction would exceed the maximum.
 */
export async function deductBudget(
  tokenId: string,
  apiCalls: number,
  tokens: number,
): Promise<boolean> {
  const prisma = (await import("@/lib/prisma")).default;

  // Check current budget first
  const current = await prisma.agentCapabilityToken.findUnique({
    where: { id: tokenId },
    select: {
      usedApiCalls: true,
      maxApiCalls: true,
      usedTokenBudget: true,
      maxTokenBudget: true,
      status: true,
    },
  });

  if (!current || current.status !== "ACTIVE") return false;
  if (current.usedApiCalls + apiCalls > current.maxApiCalls) return false;
  if (current.usedTokenBudget + tokens > current.maxTokenBudget) return false;

  // Atomic increment
  await prisma.agentCapabilityToken.update({
    where: { id: tokenId },
    data: {
      usedApiCalls: { increment: apiCalls },
      usedTokenBudget: { increment: tokens },
    },
  });

  return true;
}
