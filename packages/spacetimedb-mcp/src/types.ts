/**
 * SpacetimeDB MCP Server — Types & Helpers
 */

// ─── Agent Types ───

export interface Agent {
  identity: string;
  displayName: string;
  capabilities: string[];
  online: boolean;
  lastSeen: bigint;
}

export interface AgentMessage {
  id: bigint;
  fromAgent: string;
  toAgent: string;
  content: string;
  timestamp: bigint;
  delivered: boolean;
}

export interface RegisteredTool {
  id: bigint;
  name: string;
  description: string;
  inputSchema: string;
  providerIdentity: string;
  category: string;
  createdAt: bigint;
}

export interface McpTask {
  id: bigint;
  toolName: string;
  argumentsJson: string;
  requesterIdentity: string;
  providerIdentity?: string;
  status: string; // "pending", "claimed", "completed", "failed"
  resultJson?: string;
  error?: string;
  createdAt: bigint;
  completedAt?: bigint;
}

// ─── Connection State ───

export interface ConnectionState {
  connected: boolean;
  uri: string | null;
  moduleName: string | null;
  identity: string | null;
  token: string | null;
}

export interface Task {
  id: bigint;
  description: string;
  assignedTo: string | undefined;
  status: string;
  priority: number;
  context: string;
  createdBy: string;
  createdAt: bigint;
}

// ─── Error Codes ───

export type StdbErrorCode =
  | "NOT_CONNECTED"
  | "CONNECTION_FAILED"
  | "REDUCER_FAILED"
  | "QUERY_FAILED"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "ALREADY_CONNECTED";

// ─── Result Helpers ───

export interface CallToolResult {
  [key: string]: unknown;
  content: Array<{ type: "text"; text: string }>;
  isError?: boolean;
}

export function jsonResult(data: unknown): CallToolResult {
  return { content: [{ type: "text", text: JSON.stringify(data, null, 2) }] };
}

export function errorResult(
  code: StdbErrorCode,
  message: string,
  retryable = false,
): CallToolResult {
  return {
    content: [
      {
        type: "text",
        text: JSON.stringify({ error: code, message, retryable }),
      },
    ],
    isError: true,
  };
}
