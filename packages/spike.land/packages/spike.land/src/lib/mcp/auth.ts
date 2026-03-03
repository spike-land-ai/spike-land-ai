import { auth } from "@/lib/auth";
import { verifyAccessToken } from "@/lib/mcp/oauth/token-service";
import { tryCatch } from "@/lib/try-catch";
import type { NextRequest } from "next/server";
import type { ApiKeyValidationResult } from "./api-key-manager";
import { validateApiKey } from "./api-key-manager";

export interface McpAuthResult {
  success: boolean;
  userId?: string;
  apiKeyId?: string;
  oauthClientId?: string;
  agentId?: string;
  capabilityTokenId?: string;
  error?: string;
}

/**
 * Authenticates an MCP API request using Bearer token
 *
 * @param request - The incoming Next.js request
 * @returns Authentication result with userId and apiKeyId if successful
 *
 * @example
 * ```typescript
 * export async function POST(request: NextRequest) {
 *   const authResult = await authenticateMcpRequest(request);
 *   if (!authResult.success) {
 *     return NextResponse.json({ error: authResult.error }, { status: 401 });
 *   }
 *
 *   const { userId, apiKeyId } = authResult;
 *   // Continue with authenticated request...
 * }
 * ```
 */
export async function authenticateMcpRequest(
  request: NextRequest,
): Promise<McpAuthResult> {
  // Extract Authorization header
  const authHeader = request.headers.get("Authorization");

  if (!authHeader) {
    return {
      success: false,
      error: "Missing Authorization header",
    };
  }

  if (!authHeader.startsWith("Bearer ")) {
    return {
      success: false,
      error: "Invalid Authorization header format. Expected: Bearer <api_key>",
    };
  }

  // Extract the token
  const token = authHeader.slice(7).trim();

  if (!token) {
    return {
      success: false,
      error: "Missing API key or token",
    };
  }

  // Check if this is an agent capability token (prefixed with "cap_")
  if (token.startsWith("cap_")) {
    const { verifyCapabilityToken } = await import(
      "@/lib/agents/capability-token-service"
    );
    const { data: capResult, error: capError } = await tryCatch(
      verifyCapabilityToken(token),
    );

    if (capError) {
      return {
        success: false,
        error: "Capability token verification failed",
      };
    }

    if (!capResult) {
      return {
        success: false,
        error: "Invalid or expired capability token",
      };
    }

    return {
      success: true,
      userId: capResult.userId,
      agentId: capResult.agentId,
      capabilityTokenId: capResult.tokenId,
    };
  }

  // Check if this is an MCP OAuth token (prefixed with "mcp_")
  if (token.startsWith("mcp_")) {
    const { data: payload, error: oauthError } = await tryCatch(
      verifyAccessToken(token),
    );

    if (oauthError) {
      return {
        success: false,
        error: "OAuth token verification failed",
      };
    }

    if (!payload) {
      return {
        success: false,
        error: "Invalid or expired OAuth token",
      };
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

/**
 * Authenticates an SSE request using a token from the query string
 * Used because EventSource doesn't support custom headers
 */
export async function authenticateSseRequest(
  request: NextRequest,
): Promise<McpAuthResult> {
  const { searchParams } = new URL(request.url);
  const token = searchParams.get("token");

  if (!token) {
    return {
      success: false,
      error: "Missing token query parameter",
    };
  }

  // Check if this is an MCP OAuth token (prefixed with "mcp_")
  if (token.startsWith("mcp_")) {
    const { data: payload, error: oauthError } = await tryCatch(
      verifyAccessToken(token),
    );

    if (oauthError) {
      return {
        success: false,
        error: "OAuth token verification failed",
      };
    }
    if (!payload) {
      return {
        success: false,
        error: "Invalid or expired OAuth token",
      };
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

/**
 * Extracts the API key from a request without validating it
 * Useful for logging or debugging
 */
export function extractApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    return null;
  }

  return authHeader.slice(7).trim() || null;
}

/**
 * Creates a masked version of an API key for logging
 * Security: Only reveal 7 characters to match api-key-manager.ts
 * @example sk_live_abc123... -> sk_live...****
 */
export function maskApiKey(apiKey: string): string {
  if (!apiKey || apiKey.length < 7) {
    return "***";
  }
  return apiKey.slice(0, 7) + "...****";
}

/**
 * Authenticates using either API key (Bearer token) or session auth
 * Useful for endpoints that need to work from both the browser UI and external API clients
 *
 * @param request - The incoming Next.js request
 * @returns Authentication result with userId if successful
 */
export async function authenticateMcpOrSession(
  request: NextRequest,
): Promise<McpAuthResult> {
  // First try API key auth
  const authHeader = request.headers.get("Authorization");

  if (authHeader && authHeader.startsWith("Bearer ")) {
    return authenticateMcpRequest(request);
  }

  // Fall back to session auth
  const { data: session, error: sessionError } = await tryCatch(auth());

  if (sessionError) {
    return {
      success: false,
      error: "Session authentication failed",
    };
  }

  if (session?.user?.id) {
    return {
      success: true,
      userId: session.user.id,
    };
  }

  return {
    success: false,
    error: "Authentication required. Provide an API key or sign in.",
  };
}
