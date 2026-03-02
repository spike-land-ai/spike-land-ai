/**
 * Validation schemas for Claude Code Agent API
 */

import { z } from "zod";

/**
 * Schema for agent connection request
 * Called when an agent starts up and connects to the platform
 */
export const agentConnectSchema = z.object({
  machineId: z
    .string()
    .min(8, "machineId must be at least 8 characters")
    .max(64, "machineId must be at most 64 characters"),
  sessionId: z
    .string()
    .min(8, "sessionId must be at least 8 characters")
    .max(64, "sessionId must be at most 64 characters"),
  displayName: z.string().max(100, "displayName must be at most 100 characters").optional(),
  projectPath: z.string().max(500, "projectPath must be at most 500 characters").optional(),
  workingDirectory: z
    .string()
    .max(500, "workingDirectory must be at most 500 characters")
    .optional(),
});

export type AgentConnectRequest = z.infer<typeof agentConnectSchema>;

/**
 * Schema for agent heartbeat request
 * Called periodically (every 30s) to maintain online status
 */
export const agentHeartbeatSchema = z.object({
  machineId: z.string().min(1, "machineId is required"),
  sessionId: z.string().min(1, "sessionId is required"),
  status: z.enum(["online", "sleeping"]).optional().default("online"),
  currentProject: z.string().optional(),
  workingDirectory: z.string().optional(),
  toolUsage: z.record(z.string(), z.number()).optional(),
  tokensUsed: z.number().int().min(0).optional(),
  activity: z
    .object({
      type: z.string().min(1, "activity type is required"),
      description: z.string().min(1, "activity description is required"),
      metadata: z.record(z.string(), z.unknown()).optional(),
    })
    .optional(),
});

export type AgentHeartbeatRequest = z.infer<typeof agentHeartbeatSchema>;

/**
 * Schema for updating agent details
 */
export const agentUpdateSchema = z.object({
  displayName: z
    .string()
    .min(1, "displayName cannot be empty")
    .max(100, "displayName must be at most 100 characters")
    .optional(),
});

export type AgentUpdateRequest = z.infer<typeof agentUpdateSchema>;

/**
 * Schema for sending a task to an agent
 */
export const sendTaskSchema = z.object({
  prompt: z
    .string()
    .min(1, "Task prompt is required")
    .max(10000, "Task prompt must be at most 10000 characters"),
});

export type SendTaskRequest = z.infer<typeof sendTaskSchema>;

/**
 * Schema for agent list query parameters
 */
export const agentListQuerySchema = z.object({
  status: z.enum(["online", "sleeping", "offline", "all"]).optional().default("all"),
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

export type AgentListQuery = z.infer<typeof agentListQuerySchema>;

/**
 * Response types for API endpoints
 */
export interface AgentResponse {
  id: string;
  userId: string;
  machineId: string;
  sessionId: string;
  displayName: string;
  projectPath: string | null;
  workingDirectory: string | null;
  status: "online" | "sleeping" | "offline";
  createdAt: string;
  updatedAt: string;
  lastSeenAt: string | null;
  totalTokensUsed: number;
  totalTasksCompleted: number;
  totalSessionTime: number;
  recentActivity?: Array<{
    type: string;
    description: string;
    timestamp: number;
    metadata?: Record<string, unknown>;
  }>;
  toolStats?: Record<string, number>;
}

export interface AgentListResponse {
  agents: AgentResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
  stats: {
    online: number;
    sleeping: number;
    offline: number;
    total: number;
  };
}

export interface AgentConnectResponse {
  success: true;
  agentId: string;
  displayName: string;
  message: string;
}

export interface AgentHeartbeatResponse {
  success: true;
  timestamp: string;
  tasks?: Array<{
    id: string;
    prompt: string;
    createdAt: number;
  }>;
  messages?: Array<{
    id: string;
    role: "USER" | "AGENT" | "SYSTEM";
    content: string;
    createdAt: string;
  }>;
}

export interface SendTaskResponse {
  success: true;
  taskId: string;
  message: string;
}

/**
 * Validate agent connect request
 */
export function validateAgentConnect(body: unknown):
  | { success: true; data: AgentConnectRequest }
  | {
      success: false;
      error: string;
    } {
  const result = agentConnectSchema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues;
    const firstIssue = issues[0];
    const path = firstIssue?.path.join(".") || "";
    const message = path ? `${path}: ${firstIssue?.message}` : firstIssue?.message;
    return { success: false, error: message || "Invalid request" };
  }
  return { success: true, data: result.data };
}

/**
 * Validate agent heartbeat request
 */
export function validateAgentHeartbeat(body: unknown):
  | { success: true; data: AgentHeartbeatRequest }
  | {
      success: false;
      error: string;
    } {
  const result = agentHeartbeatSchema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues;
    const firstIssue = issues[0];
    const path = firstIssue?.path.join(".") || "";
    const message = path ? `${path}: ${firstIssue?.message}` : firstIssue?.message;
    return { success: false, error: message || "Invalid request" };
  }
  return { success: true, data: result.data };
}

/**
 * Validate send task request
 */
export function validateSendTask(body: unknown):
  | { success: true; data: SendTaskRequest }
  | {
      success: false;
      error: string;
    } {
  const result = sendTaskSchema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues;
    const firstIssue = issues[0];
    const path = firstIssue?.path.join(".") || "";
    const message = path ? `${path}: ${firstIssue?.message}` : firstIssue?.message;
    return { success: false, error: message || "Invalid request" };
  }
  return { success: true, data: result.data };
}

/**
 * Generate agent ID from machine ID and session ID
 */
export function generateAgentId(machineId: string, sessionId: string): string {
  return `${machineId}:${sessionId}`;
}

/**
 * Parse agent ID into components
 */
export function parseAgentId(agentId: string): { machineId: string; sessionId: string } | null {
  const parts = agentId.split(":");
  if (parts.length !== 2 || !parts[0] || !parts[1]) {
    return null;
  }
  return { machineId: parts[0], sessionId: parts[1] };
}

// =============================================================================
// Browser-Based Connection Flow
// =============================================================================

/**
 * Schema for browser-based connection request registration
 * Called by agent script to register a pending connection
 */
export const connectionRequestSchema = z.object({
  machineId: z
    .string()
    .min(8, "machineId must be at least 8 characters")
    .max(64, "machineId must be at most 64 characters"),
  sessionId: z
    .string()
    .min(8, "sessionId must be at least 8 characters")
    .max(64, "sessionId must be at most 64 characters"),
  displayName: z.string().max(100, "displayName must be at most 100 characters").optional(),
  projectPath: z.string().max(500, "projectPath must be at most 500 characters").optional(),
});

export type ConnectionRequestInput = z.infer<typeof connectionRequestSchema>;

/**
 * Validate connection request
 */
export function validateConnectionRequest(body: unknown):
  | { success: true; data: ConnectionRequestInput }
  | {
      success: false;
      error: string;
    } {
  const result = connectionRequestSchema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues;
    const firstIssue = issues[0];
    const path = firstIssue?.path.join(".") || "";
    const message = path ? `${path}: ${firstIssue?.message}` : firstIssue?.message;
    return { success: false, error: message || "Invalid request" };
  }
  return { success: true, data: result.data };
}

/**
 * Response types for connection API
 */
export interface ConnectionStatusResponse {
  status: "pending" | "connected" | "expired";
  connectId: string;
  agentId?: string;
  displayName?: string;
  expiresAt: string;
}

export interface ConnectionCompleteResponse {
  success: true;
  agentId: string;
  displayName: string;
  message: string;
}

// =============================================================================
// Agent Message (Chat) System
// =============================================================================

/**
 * Schema for sending a message to an agent
 */
export const agentMessageSchema = z.object({
  content: z
    .string()
    .min(1, "Message content is required")
    .max(10000, "Message must be at most 10000 characters"),
  role: z.enum(["USER", "AGENT", "SYSTEM"]).optional().default("USER"),
});

export type AgentMessageInput = z.infer<typeof agentMessageSchema>;

/**
 * Validate agent message
 */
export function validateAgentMessage(body: unknown):
  | { success: true; data: AgentMessageInput }
  | {
      success: false;
      error: string;
    } {
  const result = agentMessageSchema.safeParse(body);
  if (!result.success) {
    const issues = result.error.issues;
    const firstIssue = issues[0];
    const path = firstIssue?.path.join(".") || "";
    const message = path ? `${path}: ${firstIssue?.message}` : firstIssue?.message;
    return { success: false, error: message || "Invalid request" };
  }
  return { success: true, data: result.data };
}

/**
 * Response type for agent messages
 */
export interface AgentMessageResponse {
  id: string;
  agentId: string;
  role: "USER" | "AGENT" | "SYSTEM";
  content: string;
  isRead: boolean;
  metadata?: Record<string, unknown> | null;
  createdAt: string;
}

export interface AgentMessagesListResponse {
  messages: AgentMessageResponse[];
  pagination: {
    total: number;
    limit: number;
    offset: number;
    hasMore: boolean;
  };
}

/**
 * Schema for message list query
 */
export const messageListQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).optional().default(50),
  offset: z.coerce.number().int().min(0).optional().default(0),
  unreadOnly: z.coerce.boolean().optional().default(false),
});
