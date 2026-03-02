/**
 * Audit Retention Manager
 *
 * Manages retention policies for audit logs including:
 * - Creating and updating retention policies
 * - Archiving old audit logs
 * - Deleting expired logs
 *
 * Resolves #590: Build comprehensive Audit Log
 */

import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import type { Prisma } from "@prisma/client";

import type { RetentionJobResult, RetentionPolicy, RetentionPolicyConfig } from "./types";
import { logger } from "@/lib/logger";

/**
 * Audit Retention Manager
 */
/**
 * Map a Prisma AuditRetentionPolicy record to RetentionPolicy
 */
/**
 * Map a Prisma AuditRetentionPolicy record to RetentionPolicy
 */
function mapToRetentionPolicy(policy: {
  id: string;
  workspaceId: string | null;
  name: string;
  description: string | null;
  retentionDays: number;
  archiveAfterDays: number | null;
  deleteAfterDays: number | null;
  actionTypes: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}): RetentionPolicy {
  const actionTypes = policy.actionTypes as unknown as import("@prisma/client").AuditAction[];
  return {
    id: policy.id,
    workspaceId: policy.workspaceId,
    name: policy.name,
    description: policy.description,
    retentionDays: policy.retentionDays,
    archiveAfterDays: policy.archiveAfterDays,
    deleteAfterDays: policy.deleteAfterDays,
    actionTypes,
    isActive: policy.isActive,
    createdAt: policy.createdAt,
    updatedAt: policy.updatedAt,
  };
}

export class AuditRetentionManager {
  /**
   * Create a retention policy
   */
  static async createPolicy(
    workspaceId: string | null,
    config: RetentionPolicyConfig,
  ): Promise<RetentionPolicy | null> {
    const { data, error } = await tryCatch(
      prisma.auditRetentionPolicy.create({
        data: {
          workspaceId,
          name: config.name,
          ...(config.description !== undefined ? { description: config.description } : {}),
          retentionDays: config.retentionDays,
          ...(config.archiveAfterDays !== undefined
            ? { archiveAfterDays: config.archiveAfterDays }
            : {}),
          ...(config.deleteAfterDays !== undefined
            ? { deleteAfterDays: config.deleteAfterDays }
            : {}),
          actionTypes: config.actionTypes?.map(String) ?? [],
          isActive: config.isActive,
        },
      }),
    );

    if (error) {
      logger.error("Failed to create retention policy:", error);
      return null;
    }

    return mapToRetentionPolicy(data);
  }

  /**
   * Update a retention policy
   */
  static async updatePolicy(
    policyId: string,
    updates: Partial<RetentionPolicyConfig>,
  ): Promise<RetentionPolicy | null> {
    const updateData: Prisma.AuditRetentionPolicyUpdateInput = {};

    if (updates.name !== undefined) {
      updateData.name = updates.name;
    }
    if (updates.description !== undefined) {
      updateData.description = updates.description;
    }
    if (updates.retentionDays !== undefined) {
      updateData.retentionDays = updates.retentionDays;
    }
    if (updates.archiveAfterDays !== undefined) {
      updateData.archiveAfterDays = updates.archiveAfterDays;
    }
    if (updates.deleteAfterDays !== undefined) {
      updateData.deleteAfterDays = updates.deleteAfterDays;
    }
    if (updates.actionTypes !== undefined) {
      updateData.actionTypes = updates.actionTypes.map(String);
    }
    if (updates.isActive !== undefined) {
      updateData.isActive = updates.isActive;
    }

    const { data, error } = await tryCatch(
      prisma.auditRetentionPolicy.update({
        where: { id: policyId },
        data: updateData,
      }),
    );

    if (error) {
      logger.error("Failed to update retention policy:", error);
      return null;
    }

    return mapToRetentionPolicy(data);
  }

  /**
   * Delete a retention policy
   */
  static async deletePolicy(policyId: string): Promise<boolean> {
    const { error } = await tryCatch(
      prisma.auditRetentionPolicy.delete({
        where: { id: policyId },
      }),
    );

    if (error) {
      logger.error("Failed to delete retention policy:", error);
      return false;
    }

    return true;
  }

  /**
   * Get a retention policy by ID
   */
  static async getPolicy(policyId: string): Promise<RetentionPolicy | null> {
    const policy = await prisma.auditRetentionPolicy.findUnique({
      where: { id: policyId },
    });

    if (!policy) {
      return null;
    }

    return mapToRetentionPolicy(policy);
  }

  /**
   * List retention policies for a workspace (or system-wide if null)
   */
  static async listPolicies(workspaceId: string | null): Promise<RetentionPolicy[]> {
    const policies = await prisma.auditRetentionPolicy.findMany({
      where: { workspaceId },
      orderBy: { createdAt: "desc" },
    });

    return policies.map(mapToRetentionPolicy);
  }

  /**
   * Get effective policy for a workspace (workspace policy or system default)
   */
  static async getEffectivePolicy(workspaceId: string): Promise<RetentionPolicy | null> {
    // First try to get workspace-specific policy
    const workspacePolicy = await prisma.auditRetentionPolicy.findFirst({
      where: {
        workspaceId,
        isActive: true,
      },
    });

    if (workspacePolicy) {
      return mapToRetentionPolicy(workspacePolicy);
    }

    // Fall back to system-wide default policy
    const systemPolicy = await prisma.auditRetentionPolicy.findFirst({
      where: {
        workspaceId: null,
        isActive: true,
      },
    });

    if (systemPolicy) {
      return mapToRetentionPolicy(systemPolicy);
    }

    return null;
  }

  /**
   * Execute retention job for a policy (archive and delete old logs)
   */
  static async executeRetentionJob(policyId: string): Promise<RetentionJobResult> {
    const errors: string[] = [];
    let archivedCount = 0;
    let deletedCount = 0;

    const policy = await this.getPolicy(policyId);

    if (!policy) {
      return {
        archivedCount: 0,
        deletedCount: 0,
        errors: ["Policy not found"],
        executedAt: new Date(),
        policyId,
      };
    }

    if (!policy.isActive) {
      return {
        archivedCount: 0,
        deletedCount: 0,
        errors: ["Policy is not active"],
        executedAt: new Date(),
        policyId,
      };
    }

    const now = new Date();

    // Archive logs older than archiveAfterDays
    if (policy.archiveAfterDays) {
      const archiveThreshold = new Date(now);
      archiveThreshold.setDate(archiveThreshold.getDate() - policy.archiveAfterDays);

      // Build where clause for workspace audit logs
      const archiveWhere: Prisma.WorkspaceAuditLogWhereInput = {
        createdAt: { lt: archiveThreshold },
      };

      if (policy.workspaceId) {
        archiveWhere.workspaceId = policy.workspaceId;
      }

      if (policy.actionTypes && policy.actionTypes.length > 0) {
        archiveWhere.action = { in: policy.actionTypes };
      }

      try {
        // Find logs to archive
        const logsToArchive = await prisma.workspaceAuditLog.findMany({
          where: archiveWhere,
          take: 1000, // Process in batches
        });

        if (logsToArchive.length > 0) {
          // Insert into archive table
          await prisma.archivedAuditLog.createMany({
            data: logsToArchive.map((log) => ({
              originalId: log.id,
              workspaceId: log.workspaceId,
              userId: log.userId,
              action: log.action,
              targetId: log.targetId,
              targetType: log.targetType,
              resourceId: log.resourceId,
              resourceType: log.resourceType,
              ...(log.metadata != null ? { metadata: log.metadata as Prisma.InputJsonValue } : {}),
              ...(log.ipAddress != null ? { ipAddress: log.ipAddress } : {}),
              ...(log.userAgent != null ? { userAgent: log.userAgent } : {}),
              originalCreatedAt: log.createdAt,
              retentionPolicyId: policyId,
              archiveReason: "scheduled",
            })),
          });

          // Delete from main table
          await prisma.workspaceAuditLog.deleteMany({
            where: {
              id: { in: logsToArchive.map((l) => l.id) },
            },
          });

          archivedCount = logsToArchive.length;
        }
      } catch (error) {
        errors.push(`Archive error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    // Delete archived logs older than deleteAfterDays
    if (policy.deleteAfterDays) {
      const deleteThreshold = new Date(now);
      deleteThreshold.setDate(deleteThreshold.getDate() - policy.deleteAfterDays);

      const deleteWhere: Prisma.ArchivedAuditLogWhereInput = {
        originalCreatedAt: { lt: deleteThreshold },
      };

      if (policy.workspaceId) {
        deleteWhere.workspaceId = policy.workspaceId;
      }

      try {
        const deleteResult = await prisma.archivedAuditLog.deleteMany({
          where: deleteWhere,
        });

        deletedCount = deleteResult.count;
      } catch (error) {
        errors.push(`Delete error: ${error instanceof Error ? error.message : String(error)}`);
      }
    }

    return {
      archivedCount,
      deletedCount,
      errors,
      executedAt: new Date(),
      policyId,
    };
  }

  /**
   * Execute retention jobs for all active policies
   */
  static async executeAllRetentionJobs(): Promise<RetentionJobResult[]> {
    const activePolicies = await prisma.auditRetentionPolicy.findMany({
      where: { isActive: true },
    });

    const results: RetentionJobResult[] = [];

    for (const policy of activePolicies) {
      const result = await this.executeRetentionJob(policy.id);
      results.push(result);
    }

    return results;
  }

  /**
   * Get retention statistics for a workspace
   */
  static async getRetentionStats(workspaceId: string): Promise<{
    totalActiveLogs: number;
    totalArchivedLogs: number;
    oldestActiveLog?: Date;
    oldestArchivedLog?: Date;
    effectivePolicy?: RetentionPolicy | null;
  }> {
    const [
      totalActiveLogs,
      totalArchivedLogs,
      oldestActiveLogResult,
      oldestArchivedLogResult,
      effectivePolicy,
    ] = await Promise.all([
      prisma.workspaceAuditLog.count({ where: { workspaceId } }),
      prisma.archivedAuditLog.count({ where: { workspaceId } }),
      prisma.workspaceAuditLog.findFirst({
        where: { workspaceId },
        orderBy: { createdAt: "asc" },
        select: { createdAt: true },
      }),
      prisma.archivedAuditLog.findFirst({
        where: { workspaceId },
        orderBy: { originalCreatedAt: "asc" },
        select: { originalCreatedAt: true },
      }),
      this.getEffectivePolicy(workspaceId),
    ]);

    return {
      totalActiveLogs,
      totalArchivedLogs,
      ...(oldestActiveLogResult?.createdAt !== undefined
        ? { oldestActiveLog: oldestActiveLogResult.createdAt }
        : {}),
      ...(oldestArchivedLogResult?.originalCreatedAt !== undefined
        ? { oldestArchivedLog: oldestArchivedLogResult.originalCreatedAt }
        : {}),
      ...(effectivePolicy !== undefined ? { effectivePolicy } : {}),
    };
  }

  /**
   * Create default system-wide retention policy if none exists
   */
  static async ensureDefaultPolicy(): Promise<RetentionPolicy | null> {
    const existingDefault = await prisma.auditRetentionPolicy.findFirst({
      where: {
        workspaceId: null,
        name: "System Default",
      },
    });

    if (existingDefault) {
      return mapToRetentionPolicy(existingDefault);
    }

    return this.createPolicy(null, {
      name: "System Default",
      description: "Default retention policy for all workspaces",
      retentionDays: 365,
      archiveAfterDays: 90,
      deleteAfterDays: 730, // 2 years
      isActive: true,
    });
  }
}
