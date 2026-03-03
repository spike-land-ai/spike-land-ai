/**
 * Capability Evaluator
 *
 * Runtime permission check for agent capability tokens.
 * Called before every tool handler to enforce access control.
 *
 * 3-tier evaluation: DENY > ALLOW > ASK
 */

export interface EvaluationResult {
  allowed: boolean;
  reason?: string;
  action?: "deny" | "request_permission";
}

export async function evaluateCapability(
  tokenId: string,
  toolName: string,
  toolCategory: string,
): Promise<EvaluationResult> {
  const prisma = (await import("@/lib/prisma")).default;

  const token = await prisma.agentCapabilityToken.findUnique({
    where: { id: tokenId },
    select: {
      status: true,
      expiresAt: true,
      allowedTools: true,
      allowedCategories: true,
      deniedTools: true,
      usedApiCalls: true,
      maxApiCalls: true,
      usedTokenBudget: true,
      maxTokenBudget: true,
    },
  });

  if (!token) {
    return {
      allowed: false,
      reason: "Capability token not found",
      action: "deny",
    };
  }

  if (token.status !== "ACTIVE") {
    return {
      allowed: false,
      reason: `Token status: ${token.status}`,
      action: "deny",
    };
  }

  if (token.expiresAt && token.expiresAt < new Date()) {
    return { allowed: false, reason: "Token expired", action: "deny" };
  }

  if (token.usedApiCalls >= token.maxApiCalls) {
    return {
      allowed: false,
      reason: "API call budget exceeded",
      action: "deny",
    };
  }

  if (token.usedTokenBudget >= token.maxTokenBudget) {
    return { allowed: false, reason: "Token budget exceeded", action: "deny" };
  }

  // Tier 1: DENY - tool explicitly denied (takes precedence over allow)
  if (token.deniedTools.includes(toolName)) {
    return {
      allowed: false,
      reason: "Tool explicitly denied: " + toolName,
      action: "deny",
    };
  }

  // Tier 2: ALLOW - tool or category explicitly allowed
  if (
    token.allowedTools?.includes(toolName)
    || token.allowedCategories?.includes(toolCategory)
  ) {
    return { allowed: true };
  }

  // Tier 3: ASK - not covered by allow or deny lists
  return {
    allowed: false,
    reason: "Tool not in allowed scope: " + toolName,
    action: "request_permission",
  };
}

export async function createPermissionRequest(
  agentId: string,
  userId: string,
  toolName: string,
  toolCategory: string,
  input: Record<string, unknown>,
  fallbackBehavior: "QUEUE" | "SKIP" | "FAIL",
): Promise<string> {
  const prisma = (await import("@/lib/prisma")).default;

  const request = await prisma.permissionRequest.create({
    data: {
      agentId,
      userId,
      requestType: "tool_access",
      requestPayload: {
        toolName,
        toolCategory,
        input: redactSecrets(input),
      } as Record<
        string,
        unknown
      > as import("@prisma/client").Prisma.InputJsonValue,
      fallbackBehavior,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24h expiry
    },
  });

  return request.id;
}

function redactSecrets(
  input: Record<string, unknown> | null | undefined,
): Record<string, unknown> {
  if (!input) return {};
  const sensitiveKeys = [
    "password",
    "secret",
    "token",
    "key",
    "apikey",
    "api_key",
  ];
  const redacted: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(input)) {
    if (sensitiveKeys.some(s => k.toLowerCase().includes(s))) {
      redacted[k] = "[REDACTED]";
    } else {
      redacted[k] = v;
    }
  }
  return redacted;
}
