/**
 * Shared tool execution utilities used by spike-chat and chat routes.
 */

import { type ToolCatalogItem, searchToolCatalog, callMcpTool } from "./mcp-tools.js";

export function normalizeToolArgs(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function safeJsonParse<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

export function serializeToolContent(value: unknown): string {
  if (typeof value === "string") return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

export interface BrowserResultRow {
  tool_call_id: string;
  status: string;
  result_json: string | null;
}

const BROWSER_RESULT_TIMEOUT_MS = 15_000;
const BROWSER_RESULT_POLL_MS = 250;

/**
 * Polls a D1 table for a browser tool result until status='done' or timeout.
 * @param tableName - The D1 table to poll (spike_chat_browser_results or chat_browser_results)
 * @param contextIdColumn - The column name for the context identifier (session_id or thread_id)
 */
export async function waitForBrowserResult(
  db: D1Database,
  contextId: string,
  toolCallId: string,
  userId: string,
  tableName: string,
  contextIdColumn: string,
): Promise<unknown> {
  const deadline = Date.now() + BROWSER_RESULT_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const row = await db
      .prepare(
        `SELECT tool_call_id, status, result_json
         FROM ${tableName}
         WHERE tool_call_id = ? AND ${contextIdColumn} = ? AND user_id = ?
         LIMIT 1`,
      )
      .bind(toolCallId, contextId, userId)
      .first<BrowserResultRow>();

    if (row?.status === "done" && row.result_json) {
      return safeJsonParse<unknown>(row.result_json, row.result_json);
    }

    await new Promise((resolve) => setTimeout(resolve, BROWSER_RESULT_POLL_MS));
  }

  return {
    success: false,
    error: "Timed out waiting for the browser result.",
  };
}

export type ToolExecutionResult = {
  transport: "browser" | "mcp";
  result: string;
  status: "done" | "error";
};

/**
 * Execute a tool call, routing to MCP search, MCP call, or browser tool handler.
 */
export async function executeAgentTool(params: {
  mcpService: Fetcher;
  db: D1Database;
  requestId: string;
  contextId: string;
  userId: string | undefined;
  toolCallId: string;
  toolName: string;
  toolArgs: Record<string, unknown>;
  toolCatalog: ToolCatalogItem[];
  tableName: string;
  contextIdColumn: string;
  maxSearchResults?: number;
  onBrowserInsert?: (
    toolCallId: string,
    toolName: string,
    toolArgs: Record<string, unknown>,
  ) => Promise<void>;
  /** Optional DO-based callback to replace D1 polling for browser results. */
  waitViaCallback?: (toolCallId: string) => Promise<unknown>;
}): Promise<ToolExecutionResult> {
  const {
    mcpService,
    db,
    requestId,
    contextId,
    userId,
    toolCallId,
    toolName,
    toolArgs,
    toolCatalog,
    tableName,
    contextIdColumn,
    maxSearchResults,
    onBrowserInsert,
    waitViaCallback,
  } = params;

  if (toolName.startsWith("browser_")) {
    if (!userId) {
      return {
        transport: "browser",
        result: "Browser tools require a signed-in spike.land session.",
        status: "error",
      };
    }

    const now = Date.now();
    await db
      .prepare(
        `INSERT INTO ${tableName} (
          tool_call_id,
          ${contextIdColumn},
          user_id,
          tool_name,
          args_json,
          status,
          result_json,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, ?, 'pending', NULL, ?, ?)
        ON CONFLICT(tool_call_id) DO UPDATE SET
          args_json = excluded.args_json,
          status = 'pending',
          result_json = NULL,
          updated_at = excluded.updated_at`,
      )
      .bind(toolCallId, contextId, userId, toolName, JSON.stringify(toolArgs), now, now)
      .run();

    if (onBrowserInsert) {
      await onBrowserInsert(toolCallId, toolName, toolArgs);
    }

    // Prefer DO callback (zero-polling) over D1 polling
    const browserResult = waitViaCallback
      ? await waitViaCallback(toolCallId)
      : await waitForBrowserResult(db, contextId, toolCallId, userId, tableName, contextIdColumn);

    return {
      transport: "browser",
      result: serializeToolContent(browserResult),
      status:
        typeof browserResult === "object" &&
        browserResult !== null &&
        "success" in browserResult &&
        browserResult.success === false
          ? "error"
          : "done",
    };
  }

  if (toolName === "mcp_tool_search") {
    const query = typeof toolArgs["query"] === "string" ? toolArgs["query"].trim() : "";
    if (!query) {
      return { transport: "mcp", result: "Search query is required.", status: "error" };
    }

    return {
      transport: "mcp",
      result: JSON.stringify(
        { matches: searchToolCatalog(query, toolCatalog, maxSearchResults) },
        null,
        2,
      ),
      status: "done",
    };
  }

  if (toolName === "mcp_tool_call") {
    const targetName = typeof toolArgs["name"] === "string" ? toolArgs["name"].trim() : "";
    if (!targetName) {
      return { transport: "mcp", result: "Tool name is required.", status: "error" };
    }

    if (targetName === "mcp_tool_search" || targetName === "mcp_tool_call") {
      return {
        transport: "mcp",
        result: "Recursive agent tool calls are not allowed.",
        status: "error",
      };
    }

    if (targetName.startsWith("browser_")) {
      return {
        transport: "mcp",
        result: "Browser tools must be called directly, not through mcp_tool_call.",
        status: "error",
      };
    }

    if (!toolCatalog.some((tool) => tool.name === targetName)) {
      return { transport: "mcp", result: `Unknown MCP tool: ${targetName}`, status: "error" };
    }

    try {
      const result = await callMcpTool(
        mcpService,
        requestId,
        targetName,
        normalizeToolArgs(toolArgs["arguments"]),
      );

      return { transport: "mcp", result, status: "done" };
    } catch (error) {
      return {
        transport: "mcp",
        result: `Tool error: ${error instanceof Error ? error.message : "unknown"}`,
        status: "error",
      };
    }
  }

  return { transport: "mcp", result: `Unknown tool: ${toolName}`, status: "error" };
}
