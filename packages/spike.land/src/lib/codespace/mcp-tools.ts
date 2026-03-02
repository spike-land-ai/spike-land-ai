/**
 * MCP (Model Context Protocol) Tool Definitions and Execution
 *
 * Ported from the Cloudflare Worker backend to run inside Next.js.
 * Uses session-service (PostgreSQL + Redis) instead of Cloudflare Durable Objects.
 *
 * This module is a thin aggregator. Implementation details live in:
 *   - tools/types.ts       — Protocol types and result interfaces
 *   - tools/definitions.ts — Tool schemas, allTools, WRITE_TOOL_NAMES
 *   - tools/line-edits.ts  — applyLineEdits, safeRegExp
 *   - tools/executors.ts   — execute* functions for each tool
 */

import { getOrCreateSession } from "@/lib/codespace/session-service";
import logger from "@/lib/logger";

import { allTools } from "./tools/definitions";
import {
  executeEditCode,
  executeFindLines,
  executeReadCode,
  executeReadHtml,
  executeReadSession,
  executeSearchAndReplace,
  executeUpdateCode,
} from "./tools/executors";
import type { LineEdit, McpRequest, McpResponse } from "./tools/types";

// ---------------------------------------------------------------------------
// Re-exports (public API consumed by route handler and others)
// ---------------------------------------------------------------------------

export { allTools, WRITE_TOOL_NAMES } from "./tools/definitions";
export { applyLineEdits } from "./tools/line-edits";
export type {
  EditCodeResult,
  FindLinesResult,
  LineEdit,
  LineMatch,
  McpRequest,
  McpResponse,
  McpTool,
  ReadCodeResult,
  ReadHtmlResult,
  ReadSessionResult,
  SearchReplaceResult,
  UpdateCodeResult,
} from "./tools/types";

// ---------------------------------------------------------------------------
// Main Request Handler
// ---------------------------------------------------------------------------

/**
 * Handle an MCP JSON-RPC request for a given codeSpace.
 *
 * Dispatches `initialize`, `tools/list`, and `tools/call` methods.
 */
export async function handleMcpRequest(
  request: McpRequest,
  codeSpace: string,
  origin: string = "https://spike.land",
): Promise<McpResponse> {
  const { method, params, id } = request;

  try {
    switch (method) {
      case "initialize":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            protocolVersion: "2024-11-05",
            capabilities: {
              tools: { listChanged: true },
            },
            serverInfo: {
              name: "spike.land-mcp-server",
              version: "1.0.1",
            },
          },
        };

      case "tools/list":
        return {
          jsonrpc: "2.0",
          id,
          result: {
            tools: allTools,
          },
        };

      case "tools/call": {
        if (!params?.name || typeof params.name !== "string") {
          throw new Error("Tool name is required and must be a string");
        }
        const result = await executeTool(
          params.name,
          (params.arguments as Record<string, unknown>) || {},
          codeSpace,
          origin,
        );
        return {
          jsonrpc: "2.0",
          id,
          result: {
            content: [
              {
                type: "text",
                text: typeof result === "string" ? result : JSON.stringify(result, null, 2),
              },
            ],
          },
        };
      }

      case "notifications/initialized":
        // JSON-RPC notifications should not receive a response,
        // but return an empty success to avoid breaking clients
        return { jsonrpc: "2.0", id, result: {} };

      default:
        return {
          jsonrpc: "2.0",
          id,
          error: {
            code: -32601,
            message: "Method not found",
            data: `Unknown method: ${method}`,
          },
        };
    }
  } catch (error) {
    return {
      jsonrpc: "2.0",
      id,
      error: {
        code: -32603,
        message: "Internal error",
        data: error instanceof Error ? error.message : String(error),
      },
    };
  }
}

// ---------------------------------------------------------------------------
// Tool Dispatcher
// ---------------------------------------------------------------------------

async function executeTool(
  toolName: string,
  args: Record<string, unknown>,
  codeSpace: string,
  origin: string,
): Promise<Record<string, unknown>> {
  // Always use the codeSpace from the URL route parameter.
  // Do NOT allow args.codeSpace to override it — this prevents cross-codespace access.
  const effectiveCodeSpace = codeSpace;

  const session = await getOrCreateSession(effectiveCodeSpace);

  logger.info(`[MCP] Tool '${toolName}' executing for codeSpace: ${effectiveCodeSpace}`);

  switch (toolName) {
    case "read_code":
      return executeReadCode(session, effectiveCodeSpace);

    case "read_html":
      return executeReadHtml(session, effectiveCodeSpace);

    case "read_session":
      return executeReadSession(session, effectiveCodeSpace);

    case "update_code": {
      if (!args.code || typeof args.code !== "string") {
        throw new Error("Code parameter is required and must be a string");
      }
      return executeUpdateCode(session, effectiveCodeSpace, args.code, origin);
    }

    case "edit_code": {
      if (!args.edits || !Array.isArray(args.edits)) {
        throw new Error("Edits parameter is required and must be an array");
      }
      return executeEditCode(session, effectiveCodeSpace, args.edits as LineEdit[], origin);
    }

    case "find_lines": {
      if (!args.pattern || typeof args.pattern !== "string") {
        throw new Error("Pattern parameter is required and must be a string");
      }
      return executeFindLines(session, effectiveCodeSpace, args.pattern, args.isRegex === true);
    }

    case "search_and_replace": {
      if (!args.search || typeof args.search !== "string") {
        throw new Error("Search parameter is required and must be a string");
      }
      if (typeof args.replace !== "string") {
        throw new Error("Replace parameter is required and must be a string");
      }
      return executeSearchAndReplace(
        session,
        effectiveCodeSpace,
        args.search,
        args.replace,
        args.isRegex === true,
        args.global !== false,
        origin,
      );
    }

    default:
      throw new Error(`Unknown tool: ${toolName}`);
  }
}
