import type { NextRequest } from "next/server";
import { logger } from "@/lib/logger";

/**
 * Verify agent API key authentication
 * Uses AGENT_API_KEY environment variable
 */
export function verifyAgentAuth(request: NextRequest): boolean {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return false;

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return false;

  const agentApiKey = process.env.AGENT_API_KEY;
  if (!agentApiKey) {
    logger.error("AGENT_API_KEY not configured");
    return false;
  }

  return token === agentApiKey;
}

/**
 * Extract agent API key from request
 */
export function getAgentApiKey(request: NextRequest): string | null {
  const authHeader = request.headers.get("Authorization");
  if (!authHeader) return null;

  const [type, token] = authHeader.split(" ");
  if (type !== "Bearer" || !token) return null;

  return token;
}
