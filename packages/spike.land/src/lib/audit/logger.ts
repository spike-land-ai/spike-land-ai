/**
 * Audit Logging Utility
 *
 * Provides typed audit logging for administrative actions.
 * All admin operations (role changes, token adjustments, voucher operations)
 * should be logged for accountability and security auditing.
 */

import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import type { Prisma } from "@prisma/client";
import { AuditAction } from "@prisma/client";
import { logger } from "@/lib/logger";

type JsonValue = Prisma.JsonValue;

/**
 * Metadata for role change actions
 */
interface RoleChangeMetadata {
  oldRole: string;
  newRole: string;
  reason?: string;
}

/**
 * Metadata for token adjustment actions
 */
interface TokenAdjustmentMetadata {
  amount: number;
  balanceAfter: number;
  reason?: string;
}

/**
 * Metadata for voucher operations
 */
interface VoucherMetadata {
  voucherCode: string;
  voucherType?: string;
  value?: number;
  reason?: string;
}

/**
 * Metadata for user deletion actions
 */
interface UserDeleteMetadata {
  userEmail: string | null;
  userName: string | null;
  reason?: string;
  deletedData?: {
    albums?: number;
    images?: number;
    enhancementJobs?: number;
    tokenBalance?: number;
  };
}

/**
 * Union type for all metadata types
 */
type AuditMetadata =
  | RoleChangeMetadata
  | TokenAdjustmentMetadata
  | VoucherMetadata
  | UserDeleteMetadata
  | Record<string, unknown>;

/**
 * Options for creating an audit log entry
 */
interface AuditLogOptions {
  userId: string; // Who performed the action
  action: AuditAction;
  targetId?: string; // Target user/resource ID
  metadata?: AuditMetadata;
  ipAddress?: string;
}

/**
 * Audit Logger class for creating typed audit log entries
 */
export class AuditLogger {
  /**
   * Create a generic audit log entry
   */
  static async log(options: AuditLogOptions): Promise<void> {
    const { error } = await tryCatch(
      prisma.auditLog.create({
        data: {
          userId: options.userId,
          action: options.action,
          ...(options.targetId !== undefined ? { targetId: options.targetId } : {}),
          ...(options.metadata !== undefined ? { metadata: options.metadata as object } : {}),
          ...(options.ipAddress !== undefined ? { ipAddress: options.ipAddress } : {}),
        },
      }),
    );

    // Log but don't throw - audit logging shouldn't break main operations
    if (error) {
      logger.error("Failed to create audit log:", error);
    }
  }

  /**
   * Log a role change action
   */
  static async logRoleChange(
    adminId: string,
    targetUserId: string,
    oldRole: string,
    newRole: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId: adminId,
      action: AuditAction.ROLE_CHANGE,
      targetId: targetUserId,
      metadata: {
        oldRole,
        newRole,
      } as RoleChangeMetadata,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  }

  /**
   * Log a token adjustment action
   */
  static async logTokenAdjustment(
    adminId: string,
    targetUserId: string,
    amount: number,
    balanceAfter: number,
    reason?: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId: adminId,
      action: AuditAction.TOKEN_ADJUSTMENT,
      targetId: targetUserId,
      metadata: {
        amount,
        balanceAfter,
        reason: reason || "Manual admin adjustment",
      } as TokenAdjustmentMetadata,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  }

  /**
   * Log a voucher creation action
   */
  static async logVoucherCreate(
    adminId: string,
    voucherId: string,
    voucherCode: string,
    voucherType: string,
    value: number,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId: adminId,
      action: AuditAction.VOUCHER_CREATE,
      targetId: voucherId,
      metadata: {
        voucherCode,
        voucherType,
        value,
      } as VoucherMetadata,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  }

  /**
   * Log a voucher update action
   */
  static async logVoucherUpdate(
    adminId: string,
    voucherId: string,
    voucherCode: string,
    changes: Record<string, unknown>,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId: adminId,
      action: AuditAction.VOUCHER_UPDATE,
      targetId: voucherId,
      metadata: {
        voucherCode,
        ...changes,
      },
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  }

  /**
   * Log a voucher deletion action
   */
  static async logVoucherDelete(
    adminId: string,
    voucherId: string,
    voucherCode: string,
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId: adminId,
      action: AuditAction.VOUCHER_DELETE,
      targetId: voucherId,
      metadata: {
        voucherCode,
      } as VoucherMetadata,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  }

  /**
   * Log a user deletion action
   */
  static async logUserDelete(
    adminId: string,
    targetUserId: string,
    userEmail: string | null,
    userName: string | null,
    deletedData?: {
      albums?: number;
      images?: number;
      enhancementJobs?: number;
      tokenBalance?: number;
    },
    ipAddress?: string,
  ): Promise<void> {
    await this.log({
      userId: adminId,
      action: AuditAction.USER_DELETE,
      targetId: targetUserId,
      metadata: {
        userEmail,
        userName,
        deletedData,
      } as UserDeleteMetadata,
      ...(ipAddress !== undefined ? { ipAddress } : {}),
    });
  }

  /**
   * Get audit logs for a specific user (as actor)
   */
  static async getLogsByUser(
    userId: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      action: AuditAction;
      targetId: string | null;
      metadata: JsonValue;
      createdAt: Date;
    }>
  > {
    return prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        action: true,
        targetId: true,
        metadata: true,
        createdAt: true,
      },
    });
  }

  /**
   * Get audit logs for a specific target (user/resource)
   */
  static async getLogsByTarget(
    targetId: string,
    limit = 50,
  ): Promise<
    Array<{
      id: string;
      userId: string;
      action: AuditAction;
      metadata: JsonValue;
      createdAt: Date;
      user: { email: string | null; name: string | null };
    }>
  > {
    return prisma.auditLog.findMany({
      where: { targetId },
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        userId: true,
        action: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
  }

  /**
   * Get recent audit logs for admin dashboard
   */
  static async getRecentLogs(limit = 100): Promise<
    Array<{
      id: string;
      userId: string;
      action: AuditAction;
      targetId: string | null;
      metadata: JsonValue;
      createdAt: Date;
      user: { email: string | null; name: string | null };
    }>
  > {
    return prisma.auditLog.findMany({
      orderBy: { createdAt: "desc" },
      take: limit,
      select: {
        id: true,
        userId: true,
        action: true,
        targetId: true,
        metadata: true,
        createdAt: true,
        user: {
          select: {
            email: true,
            name: true,
          },
        },
      },
    });
  }
}
