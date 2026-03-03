/**
 * Comprehensive Audit Log Types
 *
 * Type definitions for the audit logging system including:
 * - Workspace audit logs
 * - AI decision logs
 * - Search/filter parameters
 * - Export options
 * - Retention policies
 *
 * Resolves #590: Build comprehensive Audit Log
 */

import type { AuditAction } from "@prisma/client";

/**
 * Base audit log entry
 */
export interface AuditLogEntry {
  id: string;
  userId: string;
  action: AuditAction;
  targetId?: string | null;
  targetType?: string | null;
  resourceId?: string | null;
  resourceType?: string | null;
  metadata?: Record<string, unknown> | null;
  ipAddress?: string | null;
  userAgent?: string | null;
  createdAt: Date;
}

/**
 * Workspace audit log entry with additional context
 */
export interface WorkspaceAuditLogEntry extends AuditLogEntry {
  workspaceId: string;
  oldValue?: Record<string, unknown> | null;
  newValue?: Record<string, unknown> | null;
}

/**
 * AI decision log entry
 */
export interface AIDecisionLogEntry {
  id: string;
  workspaceId?: string | null;
  userId?: string | null;
  requestType: string;
  inputPrompt?: string | null;
  inputContext?: Record<string, unknown> | null;
  outputResult?: string | null;
  outputMetadata?: Record<string, unknown> | null;
  modelId?: string | null;
  modelVersion?: string | null;
  tokensUsed?: number | null;
  latencyMs?: number | null;
  status: "success" | "error" | "timeout";
  errorMessage?: string | null;
  createdAt: Date;
}

/**
 * Options for creating a workspace audit log
 */
export interface CreateWorkspaceAuditLogOptions {
  workspaceId: string;
  userId: string;
  action: AuditAction;
  targetId?: string;
  targetType?: string;
  resourceId?: string;
  resourceType?: string;
  oldValue?: Record<string, unknown>;
  newValue?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Options for creating an AI decision log
 */
export interface CreateAIDecisionLogOptions {
  workspaceId?: string;
  userId?: string;
  requestType: string;
  inputPrompt?: string;
  inputContext?: Record<string, unknown>;
  outputResult?: string;
  outputMetadata?: Record<string, unknown>;
  modelId?: string;
  modelVersion?: string;
  tokensUsed?: number;
  latencyMs?: number;
  status: "success" | "error" | "timeout";
  errorMessage?: string;
}

/**
 * Search/filter parameters for audit logs
 */
export interface AuditLogSearchParams {
  workspaceId?: string;
  userId?: string;
  actions?: AuditAction[];
  targetId?: string;
  targetType?: string;
  resourceId?: string;
  resourceType?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string; // Search in metadata
  limit?: number;
  offset?: number;
  sortBy?: "createdAt" | "action" | "userId";
  sortOrder?: "asc" | "desc";
}

/**
 * Paginated audit log response
 */
export interface PaginatedAuditLogResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
  hasMore: boolean;
}

/**
 * Export format options
 */
export type ExportFormat = "csv" | "json" | "pdf";

/**
 * Export options
 */
export interface AuditLogExportOptions {
  format: ExportFormat;
  searchParams: AuditLogSearchParams;
  includeMetadata?: boolean;
  filename?: string;
}

/**
 * Export result
 */
export interface AuditLogExportResult {
  format: ExportFormat;
  filename: string;
  data: string | Buffer;
  mimeType: string;
  recordCount: number;
}

/**
 * Retention policy configuration
 */
export interface RetentionPolicyConfig {
  name: string;
  description?: string | null;
  retentionDays: number;
  archiveAfterDays?: number | null;
  deleteAfterDays?: number | null;
  actionTypes?: AuditAction[]; // Empty = all actions
  isActive: boolean;
}

/**
 * Retention policy with ID
 */
export interface RetentionPolicy extends RetentionPolicyConfig {
  id: string;
  workspaceId: string | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Retention job result
 */
export interface RetentionJobResult {
  archivedCount: number;
  deletedCount: number;
  errors: string[];
  executedAt: Date;
  policyId: string;
}

/**
 * Audit log metrics
 */
export interface AuditLogMetrics {
  totalLogs: number;
  logsByAction: Record<string, number>;
  logsByUser: Array<{ userId: string; userName?: string; count: number; }>;
  logsByDay: Array<{ date: string; count: number; }>;
  averageLogsPerDay: number;
  oldestLog?: Date;
  newestLog?: Date;
}

/**
 * AI decision metrics
 */
export interface AIDecisionMetrics {
  totalDecisions: number;
  decisionsByType: Record<string, number>;
  decisionsByStatus: Record<string, number>;
  averageLatencyMs: number;
  totalTokensUsed: number;
  successRate: number;
}
