/**
 * Audit Log Module
 *
 * Comprehensive audit logging system including:
 * - System-level audit logging (AuditLogger)
 * - Workspace-level audit logging (WorkspaceAuditLogger)
 * - AI decision logging (AIDecisionLogger)
 * - Export functionality (AuditExportService)
 * - Retention management (AuditRetentionManager)
 *
 * Resolves #590: Build comprehensive Audit Log
 */

export { AIDecisionLogger } from "./ai-decision-logger";
export { AuditExportService } from "./audit-export";
export { AuditLogger } from "./logger";
export { AuditRetentionManager } from "./retention-manager";
export { WorkspaceAuditLogger } from "./workspace-audit-logger";

export type {
  AIDecisionLogEntry,
  AIDecisionMetrics,
  // Base types
  AuditLogEntry,
  AuditLogExportOptions,
  AuditLogExportResult,
  // Metrics
  AuditLogMetrics,
  // Search and pagination
  AuditLogSearchParams,
  CreateAIDecisionLogOptions,
  // Create options
  CreateWorkspaceAuditLogOptions,
  // Export
  ExportFormat,
  PaginatedAuditLogResponse,
  RetentionJobResult,
  RetentionPolicy,
  // Retention
  RetentionPolicyConfig,
  WorkspaceAuditLogEntry,
} from "./types";
