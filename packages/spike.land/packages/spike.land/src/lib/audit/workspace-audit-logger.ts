/**
 * Workspace Audit Logger
 *
 * Provides workspace-level audit logging for multi-tenant compliance.
 * Tracks all user actions within a workspace context.
 *
 * Resolves #590: Build comprehensive Audit Log
 */

import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import type { AuditAction, Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

import type {
  AuditLogMetrics,
  AuditLogSearchParams,
  CreateWorkspaceAuditLogOptions,
  PaginatedAuditLogResponse,
  WorkspaceAuditLogEntry,
} from "./types";

/**
 * Workspace Audit Logger class for creating and querying workspace audit logs
 */
export class WorkspaceAuditLogger {
  /**
   * Create a workspace audit log entry
   */
  static async log(
    options: CreateWorkspaceAuditLogOptions,
  ): Promise<string | null> {
    const { data, error } = await tryCatch(
      prisma.workspaceAuditLog.create({
        data: {
          workspaceId: options.workspaceId,
          userId: options.userId,
          action: options.action,
          targetId: options.targetId,
          targetType: options.targetType,
          resourceId: options.resourceId,
          resourceType: options.resourceType,
          oldValue: options.oldValue as object | undefined,
          newValue: options.newValue as object | undefined,
          metadata: options.metadata as object | undefined,
          ipAddress: options.ipAddress,
          userAgent: options.userAgent,
        },
      }),
    );

    if (error) {
      logger.error("Failed to create workspace audit log:", error);
      return null;
    }

    return data.id;
  }

  /**
   * Log a relay draft action
   */
  static async logRelayDraftAction(
    workspaceId: string,
    userId: string,
    action:
      | "RELAY_DRAFT_CREATE"
      | "RELAY_DRAFT_APPROVE"
      | "RELAY_DRAFT_REJECT"
      | "RELAY_DRAFT_EDIT"
      | "RELAY_DRAFT_SEND",
    draftId: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string | null> {
    return this.log({
      workspaceId,
      userId,
      action: action as AuditAction,
      targetId: draftId,
      targetType: "relay_draft",
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a workspace settings change
   */
  static async logSettingsChange(
    workspaceId: string,
    userId: string,
    oldSettings: Record<string, unknown>,
    newSettings: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string | null> {
    return this.log({
      workspaceId,
      userId,
      action: "WORKSPACE_SETTINGS_CHANGE" as AuditAction,
      targetId: workspaceId,
      targetType: "workspace",
      oldValue: oldSettings,
      newValue: newSettings,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log a content action (create, update, publish, etc.)
   */
  static async logContentAction(
    workspaceId: string,
    userId: string,
    action:
      | "CONTENT_CREATE"
      | "CONTENT_UPDATE"
      | "CONTENT_DELETE"
      | "CONTENT_PUBLISH"
      | "CONTENT_UNPUBLISH"
      | "CONTENT_SCHEDULE",
    contentId: string,
    contentType: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string | null> {
    return this.log({
      workspaceId,
      userId,
      action: action as AuditAction,
      targetId: contentId,
      targetType: contentType,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log an AI action
   */
  static async logAIAction(
    workspaceId: string,
    userId: string,
    action:
      | "AI_GENERATION_REQUEST"
      | "AI_GENERATION_COMPLETE"
      | "AI_APPROVAL"
      | "AI_REJECTION"
      | "AI_FEEDBACK",
    resourceId: string,
    resourceType: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string | null> {
    return this.log({
      workspaceId,
      userId,
      action: action as AuditAction,
      targetId: resourceId,
      targetType: resourceType,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Log an integration action
   */
  static async logIntegrationAction(
    workspaceId: string,
    userId: string,
    action:
      | "INTEGRATION_CONNECT"
      | "INTEGRATION_DISCONNECT"
      | "INTEGRATION_SYNC",
    integrationId: string,
    integrationType: string,
    metadata?: Record<string, unknown>,
    ipAddress?: string,
    userAgent?: string,
  ): Promise<string | null> {
    return this.log({
      workspaceId,
      userId,
      action: action as AuditAction,
      targetId: integrationId,
      targetType: integrationType,
      metadata,
      ipAddress,
      userAgent,
    });
  }

  /**
   * Search workspace audit logs with filters
   */
  static async search(
    params: AuditLogSearchParams,
  ): Promise<PaginatedAuditLogResponse<WorkspaceAuditLogEntry>> {
    const limit = Math.min(params.limit || 50, 1000);
    const offset = params.offset || 0;

    // Build where clause
    const where: Prisma.WorkspaceAuditLogWhereInput = {};

    if (params.workspaceId) {
      where.workspaceId = params.workspaceId;
    }

    if (params.userId) {
      where.userId = params.userId;
    }

    if (params.actions && params.actions.length > 0) {
      where.action = { in: params.actions };
    }

    if (params.targetId) {
      where.targetId = params.targetId;
    }

    if (params.targetType) {
      where.targetType = params.targetType;
    }

    if (params.resourceId) {
      where.resourceId = params.resourceId;
    }

    if (params.resourceType) {
      where.resourceType = params.resourceType;
    }

    if (params.startDate || params.endDate) {
      where.createdAt = {};
      if (params.startDate) {
        where.createdAt.gte = params.startDate;
      }
      if (params.endDate) {
        where.createdAt.lte = params.endDate;
      }
    }

    // Build order by
    const orderBy: Prisma.WorkspaceAuditLogOrderByWithRelationInput = {};
    const sortBy = params.sortBy || "createdAt";
    const sortOrder = params.sortOrder || "desc";
    orderBy[sortBy] = sortOrder;

    // Execute queries
    const [logs, total] = await Promise.all([
      prisma.workspaceAuditLog.findMany({
        where,
        orderBy,
        take: limit,
        skip: offset,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
            },
          },
        },
      }),
      prisma.workspaceAuditLog.count({ where }),
    ]);

    return {
      data: logs.map(log => ({
        id: log.id,
        workspaceId: log.workspaceId,
        userId: log.userId,
        action: log.action,
        targetId: log.targetId,
        targetType: log.targetType,
        resourceId: log.resourceId,
        resourceType: log.resourceType,
        oldValue: log.oldValue as Record<string, unknown> | null,
        newValue: log.newValue as Record<string, unknown> | null,
        metadata: log.metadata as Record<string, unknown> | null,
        ipAddress: log.ipAddress,
        userAgent: log.userAgent,
        createdAt: log.createdAt,
      })),
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total,
    };
  }

  /**
   * Get a single audit log entry by ID
   */
  static async getById(
    id: string,
    workspaceId?: string,
  ): Promise<WorkspaceAuditLogEntry | null> {
    const where: Prisma.WorkspaceAuditLogWhereInput = { id };
    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

    const log = await prisma.workspaceAuditLog.findFirst({
      where,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
    });

    if (!log) {
      return null;
    }

    return {
      id: log.id,
      workspaceId: log.workspaceId,
      userId: log.userId,
      action: log.action,
      targetId: log.targetId,
      targetType: log.targetType,
      resourceId: log.resourceId,
      resourceType: log.resourceType,
      oldValue: log.oldValue as Record<string, unknown> | null,
      newValue: log.newValue as Record<string, unknown> | null,
      metadata: log.metadata as Record<string, unknown> | null,
      ipAddress: log.ipAddress,
      userAgent: log.userAgent,
      createdAt: log.createdAt,
    };
  }

  /**
   * Get audit log metrics for a workspace
   */
  static async getMetrics(
    workspaceId: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AuditLogMetrics> {
    const where: Prisma.WorkspaceAuditLogWhereInput = { workspaceId };

    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) {
        where.createdAt.gte = startDate;
      }
      if (endDate) {
        where.createdAt.lte = endDate;
      }
    }

    // Get total count
    const totalLogs = await prisma.workspaceAuditLog.count({ where });

    // Get logs by action
    const actionCounts = await prisma.workspaceAuditLog.groupBy({
      by: ["action"],
      where,
      _count: { action: true },
    });

    const logsByAction: Record<string, number> = {};
    for (const item of actionCounts) {
      logsByAction[item.action] = item._count.action;
    }

    // Get logs by user
    const userCounts = await prisma.workspaceAuditLog.groupBy({
      by: ["userId"],
      where,
      _count: { userId: true },
      orderBy: { _count: { userId: "desc" } },
      take: 10,
    });

    // Get user names
    const userIds = userCounts.map(u => u.userId);
    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, name: true },
    });

    const userMap = new Map(users.map(u => [u.id, u.name]));
    const logsByUser = userCounts.map(item => ({
      userId: item.userId,
      userName: userMap.get(item.userId) || undefined,
      count: item._count.userId,
    }));

    // Get logs by day (last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const dailyLogs = await prisma.$queryRaw<
      Array<{ date: Date; count: bigint; }>
    >`
      SELECT DATE(created_at) as date, COUNT(*) as count
      FROM workspace_audit_logs
      WHERE workspace_id = ${workspaceId}
        AND created_at >= ${startDate || thirtyDaysAgo}
        ${
      endDate
        ? prisma.$queryRaw`AND created_at <= ${endDate}`
        : prisma.$queryRaw``
    }
      GROUP BY DATE(created_at)
      ORDER BY date DESC
    `.catch(() => []);

    const logsByDay = dailyLogs.map(item => ({
      date: item.date.toISOString().split("T")[0] ?? "",
      count: Number(item.count),
    }));

    // Calculate average logs per day
    const dayCount = logsByDay.length || 1;
    const averageLogsPerDay = totalLogs / dayCount;

    // Get oldest and newest logs
    const [oldestLog, newestLog] = await Promise.all([
      prisma.workspaceAuditLog.findFirst({
        where,
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.workspaceAuditLog.findFirst({
        where,
        orderBy: { createdAt: "desc" },
        select: { createdAt: true },
      }),
    ]);

    return {
      totalLogs,
      logsByAction,
      logsByUser,
      logsByDay,
      averageLogsPerDay,
      oldestLog: oldestLog?.createdAt,
      newestLog: newestLog?.createdAt,
    };
  }

  /**
   * Get all logs for export (without pagination limits)
   */
  static async getAllForExport(
    params: AuditLogSearchParams,
    maxRecords = 10000,
  ): Promise<WorkspaceAuditLogEntry[]> {
    const searchResult = await this.search({
      ...params,
      limit: maxRecords,
      offset: 0,
    });

    return searchResult.data;
  }
}
