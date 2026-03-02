/**
 * SpacetimeDB Platform — Types & Helpers
 *
 * Domain types for all 14 tables: User, OAuthLink, ToolEntry, ToolUsage,
 * UserToolPreference, App, AppVersion, AppMessage, Agent, AgentMessage,
 * Task, Page, PageBlock, DirectMessage.
 * Plus analytics/health event types and result helpers.
 */

// ─── User & Auth Types ───

export interface User {
  identity: string;
  handle: string;
  displayName: string;
  email: string;
  online: boolean;
  createdAt: bigint;
  lastSeen: bigint;
}

export interface OAuthLink {
  id: bigint;
  userIdentity: string;
  provider: string;
  providerAccountId: string;
  linkedAt: bigint;
}

// ─── Tool Types ───

export interface ToolEntry {
  name: string;
  description: string;
  category: string;
  inputSchema: string;
  enabled: boolean;
  createdAt: bigint;
}

export interface ToolUsage {
  id: bigint;
  toolName: string;
  userIdentity: string;
  durationMs: number;
  success: boolean;
  timestamp: bigint;
}

export interface UserToolPreference {
  id: bigint;
  userIdentity: string;
  toolName: string;
  enabled: boolean;
  updatedAt: bigint;
}

// ─── App Types ───

export interface App {
  id: bigint;
  ownerIdentity: string;
  slug: string;
  name: string;
  description: string;
  r2CodeKey: string;
  status: string;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface AppVersion {
  id: bigint;
  appId: bigint;
  version: string;
  codeHash: string;
  changeDescription: string;
  createdAt: bigint;
}

export interface AppMessage {
  id: bigint;
  appId: bigint;
  role: string;
  content: string;
  timestamp: bigint;
}

// ─── Content Types ───

export interface Page {
  id: bigint;
  slug: string;
  title: string;
  description: string;
  ownerIdentity: string;
  createdAt: bigint;
  updatedAt: bigint;
}

export interface PageBlock {
  id: bigint;
  pageId: bigint;
  blockType: string;
  contentJson: string;
  sortOrder: number;
  createdAt: bigint;
  updatedAt: bigint;
}

// ─── Messaging Types ───

export interface DirectMessage {
  id: bigint;
  fromIdentity: string;
  toIdentity: string;
  content: string;
  read: boolean;
  timestamp: bigint;
}

// ─── Agent Types (same as spacetimedb-mcp) ───

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

// ─── Analytics Types ───

export interface PlatformEvent {
  id: bigint;
  source: string;
  eventType: string;
  metadataJson: string;
  userIdentity: string | undefined;
  timestamp: bigint;
}

export interface HealthCheck {
  id: bigint;
  service: string;
  status: string;
  latencyMs: number;
  checkedAt: bigint;
}

// ─── Connection State ───

export interface ConnectionState {
  connected: boolean;
  uri: string | null;
  moduleName: string | null;
  identity: string | null;
  token: string | null;
}

// ─── Error Codes ───

export type StdbErrorCode =
  | "NOT_CONNECTED"
  | "CONNECTION_FAILED"
  | "REDUCER_FAILED"
  | "QUERY_FAILED"
  | "NOT_FOUND"
  | "INVALID_INPUT"
  | "ALREADY_CONNECTED"
  | "UNAUTHORIZED"
  | "PERMISSION_DENIED";

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
