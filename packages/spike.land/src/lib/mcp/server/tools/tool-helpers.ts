/**
 * Shared Tool Helpers
 *
 * Error wrapper, workspace resolution, and API request helpers
 * used across all MCP tool modules.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import logger from "@/lib/logger";
import {
  MCP_ERROR_MESSAGES,
  MCP_ERROR_RETRYABLE,
  McpError,
  McpErrorCode,
} from "../../errors";

export const SPIKE_LAND_BASE_URL = process.env.NEXT_PUBLIC_APP_URL
  || "https://spike.land";

/**
 * Classify an error into an McpErrorCode with a suggestion for the agent.
 */
interface ClassifiedToolError {
  code: McpErrorCode;
  message: string;
  suggestion: string;
  retryable: boolean;
}

function classifyError(error: unknown, toolName: string): ClassifiedToolError {
  if (error instanceof McpError) {
    return {
      code: error.code,
      message: error.message,
      suggestion: MCP_ERROR_MESSAGES[error.code],
      retryable: error.retryable,
    };
  }

  const msg = error instanceof Error ? error.message : "Unknown error";
  const msgLower = msg.toLowerCase();

  // Match model not found errors explicitly to avoid generic 404 fallback
  if (
    msgLower.includes("model") && (msgLower.includes("not found") || msgLower.includes("not_found"))
  ) {
    return {
      code: McpErrorCode.UPSTREAM_SERVICE_ERROR,
      message: msg,
      suggestion: "The requested AI model could not be found.",
      retryable: false,
    };
  }

  // Match common patterns
  if (msgLower.includes("not found") || msgLower.includes("404")) {
    const isApp = toolName.startsWith("apps_");
    const isStateMachine = toolName.startsWith("sm_");
    if (isStateMachine) {
      return {
        code: McpErrorCode.INVALID_INPUT,
        message: msg,
        suggestion: "Machine not found. Use `sm_list` to see available machines.",
        retryable: false,
      };
    }
    const code = isApp
      ? McpErrorCode.APP_NOT_FOUND
      : McpErrorCode.WORKSPACE_NOT_FOUND;
    return {
      code,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[code],
      retryable: false,
    };
  }

  if (
    msgLower.includes("unauthorized") || msgLower.includes("forbidden")
    || msgLower.includes("403")
  ) {
    return {
      code: McpErrorCode.PERMISSION_DENIED,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[McpErrorCode.PERMISSION_DENIED],
      retryable: false,
    };
  }

  if (
    msgLower.includes("conflict") || msgLower.includes("409")
    || msgLower.includes("already exists") || msgLower.includes("already taken")
  ) {
    return {
      code: McpErrorCode.CONFLICT,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[McpErrorCode.CONFLICT],
      retryable: false,
    };
  }

  if (
    msgLower.includes("no matching transition") || msgLower.includes("guard")
  ) {
    return {
      code: McpErrorCode.INVALID_INPUT,
      message: msg,
      suggestion:
        "No transition matched. Add transitions with `sm_add_transition`, then retry with a valid event.",
      retryable: false,
    };
  }

  if (
    msgLower.includes("validation") || msgLower.includes("invalid")
    || msgLower.includes("400")
  ) {
    return {
      code: McpErrorCode.VALIDATION_ERROR,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[McpErrorCode.VALIDATION_ERROR],
      retryable: false,
    };
  }

  if (
    msgLower.includes("rate limit") || msgLower.includes("429")
    || msgLower.includes("too many")
  ) {
    return {
      code: McpErrorCode.RATE_LIMITED,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[McpErrorCode.RATE_LIMITED],
      retryable: true,
    };
  }

  if (
    msgLower.includes("insufficient") || msgLower.includes("credits")
    || msgLower.includes("balance")
  ) {
    return {
      code: McpErrorCode.INSUFFICIENT_CREDITS,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[McpErrorCode.INSUFFICIENT_CREDITS],
      retryable: false,
    };
  }

  return {
    code: McpErrorCode.UNKNOWN,
    message: msg,
    suggestion: "Try again, or use a different approach.",
    retryable: MCP_ERROR_RETRYABLE[McpErrorCode.UNKNOWN],
  };
}

/**
 * Format a classified error into an MCP CallToolResult with structured suggestion.
 */
function formatErrorResult(classified: ClassifiedToolError): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: `**Error: ${classified.code}**\n`
          + `${classified.message}\n`
          + `**Suggestion:** ${classified.suggestion}\n`
          + `**Retryable:** ${classified.retryable}`,
      },
    ],
    isError: true,
  };
}

/**
 * Options for tool invocation recording.
 */
export interface SafeToolCallOptions {
  userId?: string;
  sessionId?: string;
  input?: Record<string, unknown>;
  parentInvocationId?: string;
  timeoutMs?: number;
}

/**
 * Wrap a tool handler with error classification and structured error responses.
 * Every tool should use this wrapper.
 *
 * When `options.userId` is provided, the invocation is recorded to the database
 * for replay/debugging. Recording is fire-and-forget and never blocks the response.
 */
export async function safeToolCall(
  toolName: string,
  handler: () => Promise<CallToolResult>,
  options?: SafeToolCallOptions,
): Promise<CallToolResult> {
  const startTime = Date.now();
  try {
    const handlerPromise = handler();
    const result = options?.timeoutMs
      ? await Promise.race([
        handlerPromise,
        new Promise<never>((_, reject) =>
          setTimeout(() =>
            reject(
              new Error(
                `Tool ${toolName} timed out after ${options.timeoutMs}ms`,
              ),
            ), options.timeoutMs)
        ),
      ])
      : await handlerPromise;

    // Record successful invocation (fire-and-forget)
    if (options?.userId) {
      recordInvocation({
        userId: options.userId,
        ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
        tool: toolName,
        input: options.input ?? {},
        output: result.content,
        durationMs: Date.now() - startTime,
        isError: false,
        ...(options.parentInvocationId !== undefined ? { parentInvocationId: options.parentInvocationId } : {}),
      }).catch((err: unknown) => logger.error("Failed to record tool invocation", { error: err }));

      // Fire matching reactions (fire-and-forget)
      fireReactions({
        userId: options.userId,
        sourceTool: toolName,
        sourceEvent: "success",
      }).catch((err: unknown) => logger.error("Failed to fire reactions", { error: err }));
    }

    return result;
  } catch (error) {
    const classified = classifyError(error, toolName);

    // Record failed invocation (fire-and-forget)
    if (options?.userId) {
      recordInvocation({
        userId: options.userId,
        ...(options.sessionId !== undefined ? { sessionId: options.sessionId } : {}),
        tool: toolName,
        input: options.input ?? {},
        output: null,
        durationMs: Date.now() - startTime,
        isError: true,
        error: classified.message,
        ...(options.parentInvocationId !== undefined ? { parentInvocationId: options.parentInvocationId } : {}),
      }).catch((err: unknown) => logger.error("Failed to record tool invocation", { error: err }));

      // Fire matching reactions on error (fire-and-forget)
      fireReactions({
        userId: options.userId,
        sourceTool: toolName,
        sourceEvent: "error",
      }).catch((err: unknown) => logger.error("Failed to fire reactions", { error: err }));
    }

    return formatErrorResult(classified);
  }
}

async function recordInvocation(data: {
  userId: string;
  sessionId?: string;
  tool: string;
  input: Record<string, unknown> | unknown;
  output: unknown;
  durationMs: number;
  isError: boolean;
  error?: string;
  parentInvocationId?: string;
}): Promise<void> {
  const prisma = (await import("@/lib/prisma")).default;
  await prisma.toolInvocation.create({
    data: {
      userId: data.userId,
      sessionId: data.sessionId ?? null,
      tool: data.tool,
      input: data.input as import("@/generated/prisma").Prisma.InputJsonValue,
      ...(data.output != null ? { output: data.output as import("@/generated/prisma").Prisma.InputJsonValue } : {}),
      durationMs: data.durationMs,
      isError: data.isError,
      error: data.error ?? null,
      parentInvocationId: data.parentInvocationId ?? null,
    },
  });
}

/**
 * Fire matching tool reactions for a completed tool invocation.
 * Looks up enabled ToolReaction rules matching the source tool+event,
 * logs execution, and invokes target tools. Fire-and-forget — never blocks.
 */
export async function fireReactions(data: {
  userId: string;
  sourceTool: string;
  sourceEvent: string;
}): Promise<void> {
  const prisma = (await import("@/lib/prisma")).default;
  const reactions = await prisma.toolReaction.findMany({
    where: {
      userId: data.userId,
      sourceTool: data.sourceTool,
      sourceEvent: data.sourceEvent,
      enabled: true,
    },
  });

  for (const reaction of reactions) {
    const startTime = Date.now();
    try {
      // Log the reaction execution (target invocation is informational only —
      // actual tool dispatch requires the MCP server context which is not
      // available here. The log records intent so agents can replay.)
      await prisma.reactionLog.create({
        data: {
          reactionId: reaction.id,
          userId: data.userId,
          sourceTool: data.sourceTool,
          sourceEvent: data.sourceEvent,
          targetTool: reaction.targetTool,
          targetInput: reaction
            .targetInput as import("@/generated/prisma").Prisma.InputJsonValue,
          durationMs: Date.now() - startTime,
          isError: false,
        },
      });
    } catch (err) {
      logger.error("Failed to log reaction execution", {
        reactionId: reaction.id,
        error: err,
      });
      // Best-effort log for failed reaction
      await prisma.reactionLog.create({
        data: {
          reactionId: reaction.id,
          userId: data.userId,
          sourceTool: data.sourceTool,
          sourceEvent: data.sourceEvent,
          targetTool: reaction.targetTool,
          targetInput: reaction
            .targetInput as import("@/generated/prisma").Prisma.InputJsonValue,
          durationMs: Date.now() - startTime,
          isError: true,
          error: err instanceof Error ? err.message : "Unknown error",
        },
      }).catch(() => {/* swallow — truly best-effort */});
    }
  }
}

import { type SubscriptionTier } from "@prisma/client";

/**
 * Verify that a user has ADMIN or SUPER_ADMIN role.
 * Throws McpError with PERMISSION_DENIED if not.
 */
export async function requireAdminRole(userId: string): Promise<void> {
  const prisma = (await import("@/lib/prisma")).default;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { role: true },
  });
  if (!user || (user.role !== "ADMIN" && user.role !== "SUPER_ADMIN")) {
    throw new McpError(
      "Admin access required.",
      McpErrorCode.PERMISSION_DENIED,
      false,
    );
  }
}

/**
 * Resolve and validate workspace membership for a user.
 * Returns the workspace or throws an McpError.
 */
export async function resolveWorkspace(
  userId: string,
  slug: string,
): Promise<
  { id: string; slug: string; name: string; subscriptionTier: SubscriptionTier; }
> {
  const prisma = (await import("@/lib/prisma")).default;

  const workspace = await prisma.workspace.findFirst({
    where: {
      slug,
      members: { some: { userId } },
    },
    select: { id: true, slug: true, name: true, subscriptionTier: true },
  });

  if (!workspace) {
    throw new McpError(
      `Workspace '${slug}' not found or you are not a member.`,
      McpErrorCode.WORKSPACE_NOT_FOUND,
      false,
    );
  }

  return workspace as {
    id: string;
    slug: string;
    name: string;
    subscriptionTier: SubscriptionTier;
  };
}

/**
 * Make an authenticated request to the spike.land API.
 * Used by tools that call internal API routes.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
): Promise<T> {
  const serviceToken = process.env.SPIKE_LAND_SERVICE_TOKEN
    || process.env.SPIKE_LAND_API_KEY
    || "";

  const url = `${SPIKE_LAND_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (serviceToken) {
    headers.Authorization = `Bearer ${serviceToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...options.headers as Record<string, string> },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    let errorMsg: string;
    try {
      const json = JSON.parse(body) as { error?: string; };
      errorMsg = json.error || body;
    } catch {
      errorMsg = body;
    }

    if (response.status === 404) {
      throw new McpError(errorMsg, McpErrorCode.APP_NOT_FOUND, false);
    }
    if (response.status === 403 || response.status === 401) {
      throw new McpError(errorMsg, McpErrorCode.PERMISSION_DENIED, false);
    }
    if (response.status === 409) {
      throw new McpError(errorMsg, McpErrorCode.CONFLICT, false);
    }
    if (response.status === 429) {
      throw new McpError(errorMsg, McpErrorCode.RATE_LIMITED, true);
    }
    if (response.status === 400) {
      throw new McpError(errorMsg, McpErrorCode.VALIDATION_ERROR, false);
    }
    throw new McpError(errorMsg, McpErrorCode.UPSTREAM_SERVICE_ERROR, true);
  }

  return response.json() as Promise<T>;
}

/**
 * Resolve and decrypt a secret from the vault.
 * Returns the plaintext value or undefined if not found/approved.
 */
export async function getVaultSecret(
  userId: string,
  name: string,
): Promise<string | undefined> {
  const prisma = (await import("@/lib/prisma")).default;
  const { decryptSecret } = await import("../crypto/vault");

  const secret = await prisma.vaultSecret.findFirst({
    where: { userId, name, status: "APPROVED" },
  });

  if (!secret) return undefined;

  try {
    return decryptSecret(userId, secret.encryptedValue, secret.iv, secret.tag);
  } catch (error) {
    logger.error("Failed to decrypt vault secret", { userId, name, error });
    return undefined;
  }
}

const MAX_RESPONSE_SIZE = 8192;

export function textResult(text: string): CallToolResult {
  const truncated = text.length > MAX_RESPONSE_SIZE
    ? text.slice(0, MAX_RESPONSE_SIZE)
      + "\n...(truncated, response exceeded 8KB)"
    : text;
  return { content: [{ type: "text", text: truncated }] };
}

/**
 * Result helper for sending text with associated JSON data.
 */
export function jsonResult(text: string, data: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text },
      { type: "text", text: JSON.stringify(data, null, 2) },
    ],
  };
}
