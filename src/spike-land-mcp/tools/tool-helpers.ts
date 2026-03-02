/**
 * Tool Helpers for spike-land-mcp
 *
 * Error wrapper, workspace resolution, vault secrets, and API request helpers.
 * Ported from spike.land tool-helpers — no Prisma, no logger, no recording.
 */

import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { tryCatch } from "@spike-land-ai/mcp-server-base";
import { eq, and } from "drizzle-orm";
import type { DrizzleDB } from "../db/index";
import { workspaces, workspaceMembers, vaultSecrets } from "../db/schema";

// ─── MCP Error Types (inline — not exported from @spike-land-ai/shared) ──────

export enum McpErrorCode {
  TIMEOUT = "TIMEOUT",
  CONTENT_POLICY = "CONTENT_POLICY",
  RATE_LIMITED = "RATE_LIMITED",
  AUTH_ERROR = "AUTH_ERROR",
  INVALID_IMAGE = "INVALID_IMAGE",
  INVALID_INPUT = "INVALID_INPUT",
  GEMINI_API_ERROR = "GEMINI_API_ERROR",
  R2_UPLOAD_ERROR = "R2_UPLOAD_ERROR",
  GENERATION_ERROR = "GENERATION_ERROR",
  WORKSPACE_NOT_FOUND = "WORKSPACE_NOT_FOUND",
  APP_NOT_FOUND = "APP_NOT_FOUND",
  PERMISSION_DENIED = "PERMISSION_DENIED",
  INSUFFICIENT_CREDITS = "INSUFFICIENT_CREDITS",
  VALIDATION_ERROR = "VALIDATION_ERROR",
  CONFLICT = "CONFLICT",
  UPSTREAM_SERVICE_ERROR = "UPSTREAM_SERVICE_ERROR",
  UNKNOWN = "UNKNOWN",
}

export const MCP_ERROR_MESSAGES: Record<McpErrorCode, string> = {
  [McpErrorCode.TIMEOUT]: "Generation took too long. Try a lower quality tier.",
  [McpErrorCode.CONTENT_POLICY]: "Your prompt may violate content policies. Please revise.",
  [McpErrorCode.RATE_LIMITED]: "Service temporarily unavailable. Please try again later.",
  [McpErrorCode.AUTH_ERROR]: "API configuration error. Please contact support.",
  [McpErrorCode.INVALID_IMAGE]: "Unable to process the image. Please try a different format.",
  [McpErrorCode.INVALID_INPUT]: "Invalid input parameters. Please check your request.",
  [McpErrorCode.GEMINI_API_ERROR]: "AI service error. Please try again in a moment.",
  [McpErrorCode.R2_UPLOAD_ERROR]: "Failed to save image. Please try again.",
  [McpErrorCode.GENERATION_ERROR]: "Generation failed. Please try again.",
  [McpErrorCode.WORKSPACE_NOT_FOUND]:
    "Workspace not found. Use `workspace_list` to see available workspaces.",
  [McpErrorCode.APP_NOT_FOUND]: "App not found. Use `apps_list` to see your apps.",
  [McpErrorCode.PERMISSION_DENIED]: "You don't have permission for this operation.",
  [McpErrorCode.INSUFFICIENT_CREDITS]:
    "Not enough credits. Check your balance with the token tools.",
  [McpErrorCode.VALIDATION_ERROR]: "Invalid input. Check parameter formats and try again.",
  [McpErrorCode.CONFLICT]: "Resource conflict. The name or identifier is already in use.",
  [McpErrorCode.UPSTREAM_SERVICE_ERROR]:
    "An upstream service returned an error. Try again shortly.",
  [McpErrorCode.UNKNOWN]: "An unexpected error occurred",
};

export const MCP_ERROR_RETRYABLE: Record<McpErrorCode, boolean> = {
  [McpErrorCode.TIMEOUT]: true,
  [McpErrorCode.CONTENT_POLICY]: false,
  [McpErrorCode.RATE_LIMITED]: true,
  [McpErrorCode.AUTH_ERROR]: false,
  [McpErrorCode.INVALID_IMAGE]: false,
  [McpErrorCode.INVALID_INPUT]: false,
  [McpErrorCode.GEMINI_API_ERROR]: true,
  [McpErrorCode.R2_UPLOAD_ERROR]: true,
  [McpErrorCode.GENERATION_ERROR]: true,
  [McpErrorCode.WORKSPACE_NOT_FOUND]: false,
  [McpErrorCode.APP_NOT_FOUND]: false,
  [McpErrorCode.PERMISSION_DENIED]: false,
  [McpErrorCode.INSUFFICIENT_CREDITS]: false,
  [McpErrorCode.VALIDATION_ERROR]: false,
  [McpErrorCode.CONFLICT]: false,
  [McpErrorCode.UPSTREAM_SERVICE_ERROR]: true,
  [McpErrorCode.UNKNOWN]: true,
};

export class McpError extends Error {
  public readonly code: McpErrorCode;
  public readonly retryable: boolean;
  public override readonly cause?: Error;

  constructor(message: string, code: McpErrorCode, retryable?: boolean, cause?: Error) {
    super(message);
    this.name = "McpError";
    this.code = code;
    this.retryable = retryable ?? MCP_ERROR_RETRYABLE[code];
    if (cause !== undefined) {
      this.cause = cause;
    }
  }

  getUserMessage(): string {
    return MCP_ERROR_MESSAGES[this.code];
  }
}

// ─── Error Classification ─────────────────────────────────────────────────────

export interface ClassifiedToolError {
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

  if (
    msgLower.includes("model") &&
    (msgLower.includes("not found") || msgLower.includes("not_found"))
  ) {
    return {
      code: McpErrorCode.UPSTREAM_SERVICE_ERROR,
      message: msg,
      suggestion: "The requested AI model could not be found.",
      retryable: false,
    };
  }

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
    const code = isApp ? McpErrorCode.APP_NOT_FOUND : McpErrorCode.WORKSPACE_NOT_FOUND;
    return {
      code,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[code],
      retryable: false,
    };
  }

  if (
    msgLower.includes("unauthorized") ||
    msgLower.includes("forbidden") ||
    msgLower.includes("403")
  ) {
    return {
      code: McpErrorCode.PERMISSION_DENIED,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[McpErrorCode.PERMISSION_DENIED],
      retryable: false,
    };
  }

  if (
    msgLower.includes("conflict") ||
    msgLower.includes("409") ||
    msgLower.includes("already exists") ||
    msgLower.includes("already taken")
  ) {
    return {
      code: McpErrorCode.CONFLICT,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[McpErrorCode.CONFLICT],
      retryable: false,
    };
  }

  if (msgLower.includes("no matching transition") || msgLower.includes("guard")) {
    return {
      code: McpErrorCode.INVALID_INPUT,
      message: msg,
      suggestion:
        "No transition matched. Add transitions with `sm_add_transition`, then retry with a valid event.",
      retryable: false,
    };
  }

  if (msgLower.includes("validation") || msgLower.includes("invalid") || msgLower.includes("400")) {
    return {
      code: McpErrorCode.VALIDATION_ERROR,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[McpErrorCode.VALIDATION_ERROR],
      retryable: false,
    };
  }

  if (
    msgLower.includes("rate limit") ||
    msgLower.includes("429") ||
    msgLower.includes("too many")
  ) {
    return {
      code: McpErrorCode.RATE_LIMITED,
      message: msg,
      suggestion: MCP_ERROR_MESSAGES[McpErrorCode.RATE_LIMITED],
      retryable: true,
    };
  }

  if (
    msgLower.includes("insufficient") ||
    msgLower.includes("credits") ||
    msgLower.includes("balance")
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

function formatErrorResult(classified: ClassifiedToolError): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text:
          `**Error: ${classified.code}**\n` +
          `${classified.message}\n` +
          `**Suggestion:** ${classified.suggestion}\n` +
          `**Retryable:** ${classified.retryable}`,
      },
    ],
    isError: true,
  };
}

// ─── Safe Tool Call ───────────────────────────────────────────────────────────

export interface SafeToolCallOptions {
  timeoutMs?: number;
}

/**
 * Wrap a tool handler with error classification and structured error responses.
 * Uses `tryCatch` from `@spike-land-ai/mcp-server-base` internally.
 */
export async function safeToolCall(
  toolName: string,
  handler: () => Promise<CallToolResult>,
  options?: SafeToolCallOptions,
): Promise<CallToolResult> {
  const handlerPromise = options?.timeoutMs
    ? Promise.race([
        handler(),
        new Promise<never>((_, reject) =>
          setTimeout(
            () => reject(new Error(`Tool ${toolName} timed out after ${options.timeoutMs}ms`)),
            options.timeoutMs,
          ),
        ),
      ])
    : handler();

  const result = await tryCatch(handlerPromise);
  if (!result.ok) {
    const classified = classifyError(result.error, toolName);
    console.error(`[safeToolCall] ${toolName} failed:`, classified);
    return formatErrorResult(classified);
  }
  return result.data;
}

// ─── Result Helpers ───────────────────────────────────────────────────────────

const MAX_RESPONSE_SIZE = 8192;

export function textResult(text: string): CallToolResult {
  const truncated =
    text.length > MAX_RESPONSE_SIZE
      ? text.slice(0, MAX_RESPONSE_SIZE) + "\n...(truncated, response exceeded 8KB)"
      : text;
  return { content: [{ type: "text", text: truncated }] };
}

export function jsonResult(text: string, data: unknown): CallToolResult {
  return {
    content: [
      { type: "text", text },
      { type: "text", text: JSON.stringify(data, null, 2) },
    ],
  };
}

// ─── API Request Helper ───────────────────────────────────────────────────────

export const SPIKE_LAND_BASE_URL = "https://spike.land";

/**
 * Make an authenticated request to the spike.land API.
 */
export async function apiRequest<T>(
  endpoint: string,
  options: RequestInit = {},
  serviceToken?: string,
): Promise<T> {
  const url = `${SPIKE_LAND_BASE_URL}${endpoint}`;
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (serviceToken) {
    headers.Authorization = `Bearer ${serviceToken}`;
  }

  const response = await fetch(url, {
    ...options,
    headers: { ...headers, ...(options.headers as Record<string, string>) },
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "Unknown error");
    let errorMsg: string;
    try {
      const json = JSON.parse(body) as { error?: string };
      errorMsg = json.error || body;
    } catch {
      errorMsg = body;
    }

    if (response.status === 404) {
      throw new McpError(errorMsg, McpErrorCode.UPSTREAM_SERVICE_ERROR, false);
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

// ─── Workspace Resolution ─────────────────────────────────────────────────────

/**
 * Resolve and validate workspace membership for a user.
 * Returns the workspace or throws an McpError.
 */
export async function resolveWorkspace(
  db: DrizzleDB,
  userId: string,
  slug: string,
): Promise<{ id: string; slug: string; name: string; plan: string }> {
  const result = await db
    .select({
      id: workspaces.id,
      slug: workspaces.slug,
      name: workspaces.name,
      plan: workspaces.plan,
    })
    .from(workspaces)
    .innerJoin(
      workspaceMembers,
      and(eq(workspaceMembers.workspaceId, workspaces.id), eq(workspaceMembers.userId, userId)),
    )
    .where(eq(workspaces.slug, slug))
    .limit(1);

  const workspace = result[0];
  if (!workspace) {
    throw new McpError(
      `Workspace '${slug}' not found or you are not a member.`,
      McpErrorCode.WORKSPACE_NOT_FOUND,
      false,
    );
  }

  return workspace;
}

// ─── Vault Secrets ────────────────────────────────────────────────────────────

/**
 * Resolve and decrypt a secret from the vault using WebCrypto AES-GCM.
 * Returns the plaintext value or undefined if not found.
 *
 * The encryptedValue is stored as: base64(iv:ciphertext:tag) or
 * a JSON string with { iv, data } fields.
 */
export async function getVaultSecret(
  db: DrizzleDB,
  userId: string,
  name: string,
): Promise<string | undefined> {
  const result = await db
    .select({
      encryptedValue: vaultSecrets.encryptedValue,
    })
    .from(vaultSecrets)
    .where(and(eq(vaultSecrets.userId, userId), eq(vaultSecrets.key, name)))
    .limit(1);

  const secret = result[0];
  if (!secret) return undefined;

  try {
    // Encrypted value is stored as base64 JSON: { iv: base64, data: base64, salt: base64 }
    const parsed = JSON.parse(atob(secret.encryptedValue)) as {
      iv: string;
      data: string;
      salt?: string;
    };
    const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
    const data = Uint8Array.from(atob(parsed.data), (c) => c.charCodeAt(0));

    // Derive key from userId + per-secret salt (salt stored in envelope)
    const encoder = new TextEncoder();
    const salt = parsed.salt
      ? Uint8Array.from(atob(parsed.salt), (c) => c.charCodeAt(0))
      : encoder.encode("spike-land-vault"); // legacy fallback for pre-migration data
    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(userId),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const cryptoKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["decrypt"],
    );

    const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error("Failed to decrypt vault secret", { userId, name, error });
    return undefined;
  }
}
