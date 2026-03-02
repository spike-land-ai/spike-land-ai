/**
 * Authentication middleware for Hono MCP API
 *
 * Ported from src/lib/mcp/auth.ts - removes Next.js type dependency.
 * Supports: API keys, OAuth mcp_ tokens, capability tokens (cap_).
 */
import { verifyAccessToken } from "@/lib/mcp/oauth/token-service";
import { tryCatch } from "@/lib/try-catch";
import type { ApiKeyValidationResult } from "@/lib/mcp/api-key-manager";
import { validateApiKey } from "@/lib/mcp/api-key-manager";

export interface AuthResult {
  success: boolean;
  userId?: string;
  apiKeyId?: string;
  oauthClientId?: string;
  agentId?: string;
  capabilityTokenId?: string;
  error?: string;
}

/**
 * Authenticate a request using Bearer token.
 * Works with standard Request (no Next.js dependency).
 */
export async function authenticateRequest(request: Request): Promise<AuthResult> {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return { success: false, error: "Missing Authorization header" };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      error: "Invalid Authorization header format. Expected: Bearer <token>",
    };
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return { success: false, error: "Missing API key or token" };
  }

  // Capability token (cap_ prefix)
  if (token.startsWith("cap_")) {
    const { verifyCapabilityToken } = await import("@/lib/agents/capability-token-service");
    const { data: capResult, error: capError } = await tryCatch(verifyCapabilityToken(token));

    if (capError || !capResult) {
      return { success: false, error: "Invalid or expired capability token" };
    }

    return {
      success: true,
      userId: capResult.userId,
      agentId: capResult.agentId,
      capabilityTokenId: capResult.tokenId,
    };
  }

  // OAuth MCP token (mcp_ prefix)
  if (token.startsWith("mcp_")) {
    const { data: payload, error: oauthError } = await tryCatch(verifyAccessToken(token));

    if (oauthError || !payload) {
      return { success: false, error: "Invalid or expired OAuth token" };
    }

    return {
      success: true,
      userId: payload.userId,
      oauthClientId: payload.clientId,
    };
  }

  // Fall back to API key validation
  const { data: validationResult, error: validationError } = await tryCatch<
    ApiKeyValidationResult,
    Error
  >(validateApiKey(token));

  if (validationError) {
    return {
      success: false,
      error: validationError.message || "API key validation failed",
    };
  }

  if (!validationResult.isValid) {
    return {
      success: false,
      error: validationResult.error || "Invalid API key",
    };
  }

  return {
    success: true,
    userId: validationResult.userId,
    apiKeyId: validationResult.apiKeyId,
  };
}
