/**
 * AI Decision Logger
 *
 * Logs all AI decisions including inputs, outputs, and reasoning
 * for transparency, debugging, and compliance.
 *
 * Resolves #590: Build comprehensive Audit Log
 */

import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import type { Prisma } from "@prisma/client";
import { logger } from "@/lib/logger";

import type {
  AIDecisionLogEntry,
  AIDecisionMetrics,
  CreateAIDecisionLogOptions,
  PaginatedAuditLogResponse,
} from "./types";

/**
 * AI Decision Logger class for logging and querying AI decisions
 */
export class AIDecisionLogger {
  /**
   * Create an AI decision log entry
   */
  static async log(options: CreateAIDecisionLogOptions): Promise<string | null> {
    const { data, error } = await tryCatch(
      prisma.aIDecisionLog.create({
        data: {
          ...(options.workspaceId !== undefined ? { workspaceId: options.workspaceId } : {}),
          ...(options.userId !== undefined ? { userId: options.userId } : {}),
          requestType: options.requestType,
          ...(options.inputPrompt !== undefined ? { inputPrompt: options.inputPrompt } : {}),
          ...(options.inputContext !== undefined
            ? { inputContext: options.inputContext as object }
            : {}),
          ...(options.outputResult !== undefined ? { outputResult: options.outputResult } : {}),
          ...(options.outputMetadata !== undefined
            ? { outputMetadata: options.outputMetadata as object }
            : {}),
          ...(options.modelId !== undefined ? { modelId: options.modelId } : {}),
          ...(options.modelVersion !== undefined ? { modelVersion: options.modelVersion } : {}),
          ...(options.tokensUsed !== undefined ? { tokensUsed: options.tokensUsed } : {}),
          ...(options.latencyMs !== undefined ? { latencyMs: options.latencyMs } : {}),
          status: options.status,
          ...(options.errorMessage !== undefined ? { errorMessage: options.errorMessage } : {}),
        },
      }),
    );

    if (error) {
      logger.error("Failed to create AI decision log:", error);
      return null;
    }

    return data.id;
  }

  /**
   * Log a draft generation decision
   */
  static async logDraftGeneration(
    workspaceId: string,
    userId: string,
    inputContext: Record<string, unknown>,
    outputResult: string,
    modelInfo: {
      modelId: string;
      modelVersion?: string;
      tokensUsed?: number;
      latencyMs?: number;
    },
    status: "success" | "error" | "timeout" = "success",
    errorMessage?: string,
  ): Promise<string | null> {
    return this.log({
      workspaceId,
      userId,
      requestType: "draft_generation",
      inputContext,
      outputResult,
      outputMetadata: modelInfo,
      modelId: modelInfo.modelId,
      ...(modelInfo.modelVersion !== undefined ? { modelVersion: modelInfo.modelVersion } : {}),
      ...(modelInfo.tokensUsed !== undefined ? { tokensUsed: modelInfo.tokensUsed } : {}),
      ...(modelInfo.latencyMs !== undefined ? { latencyMs: modelInfo.latencyMs } : {}),
      status,
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    });
  }

  /**
   * Log a content analysis decision
   */
  static async logContentAnalysis(
    workspaceId: string,
    userId: string,
    content: string,
    analysisResult: Record<string, unknown>,
    modelInfo: {
      modelId: string;
      modelVersion?: string;
      tokensUsed?: number;
      latencyMs?: number;
    },
    status: "success" | "error" | "timeout" = "success",
    errorMessage?: string,
  ): Promise<string | null> {
    return this.log({
      workspaceId,
      userId,
      requestType: "content_analysis",
      inputPrompt: content,
      outputMetadata: analysisResult,
      modelId: modelInfo.modelId,
      ...(modelInfo.modelVersion !== undefined ? { modelVersion: modelInfo.modelVersion } : {}),
      ...(modelInfo.tokensUsed !== undefined ? { tokensUsed: modelInfo.tokensUsed } : {}),
      ...(modelInfo.latencyMs !== undefined ? { latencyMs: modelInfo.latencyMs } : {}),
      status,
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    });
  }

  /**
   * Log a recommendation decision
   */
  static async logRecommendation(
    workspaceId: string,
    userId: string,
    requestType: string,
    inputContext: Record<string, unknown>,
    recommendations: Record<string, unknown>,
    modelInfo: {
      modelId: string;
      modelVersion?: string;
      tokensUsed?: number;
      latencyMs?: number;
    },
    status: "success" | "error" | "timeout" = "success",
    errorMessage?: string,
  ): Promise<string | null> {
    return this.log({
      workspaceId,
      userId,
      requestType: `recommendation_${requestType}`,
      inputContext,
      outputMetadata: recommendations,
      modelId: modelInfo.modelId,
      ...(modelInfo.modelVersion !== undefined ? { modelVersion: modelInfo.modelVersion } : {}),
      ...(modelInfo.tokensUsed !== undefined ? { tokensUsed: modelInfo.tokensUsed } : {}),
      ...(modelInfo.latencyMs !== undefined ? { latencyMs: modelInfo.latencyMs } : {}),
      status,
      ...(errorMessage !== undefined ? { errorMessage } : {}),
    });
  }

  /**
   * Search AI decision logs
   */
  static async search(params: {
    workspaceId?: string;
    userId?: string;
    requestTypes?: string[];
    statuses?: string[];
    startDate?: Date;
    endDate?: Date;
    limit?: number;
    offset?: number;
  }): Promise<PaginatedAuditLogResponse<AIDecisionLogEntry>> {
    const limit = Math.min(params.limit || 50, 1000);
    const offset = params.offset || 0;

    // Build where clause
    const where: Prisma.AIDecisionLogWhereInput = {};

    if (params.workspaceId) {
      where.workspaceId = params.workspaceId;
    }

    if (params.userId) {
      where.userId = params.userId;
    }

    if (params.requestTypes && params.requestTypes.length > 0) {
      where.requestType = { in: params.requestTypes };
    }

    if (params.statuses && params.statuses.length > 0) {
      where.status = { in: params.statuses };
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

    // Execute queries
    const [logs, total] = await Promise.all([
      prisma.aIDecisionLog.findMany({
        where,
        orderBy: { createdAt: "desc" },
        take: limit,
        skip: offset,
      }),
      prisma.aIDecisionLog.count({ where }),
    ]);

    return {
      data: logs.map((log) => ({
        id: log.id,
        workspaceId: log.workspaceId,
        userId: log.userId,
        requestType: log.requestType,
        inputPrompt: log.inputPrompt,
        inputContext: log.inputContext as Record<string, unknown> | null,
        outputResult: log.outputResult,
        outputMetadata: log.outputMetadata as Record<string, unknown> | null,
        modelId: log.modelId,
        modelVersion: log.modelVersion,
        tokensUsed: log.tokensUsed,
        latencyMs: log.latencyMs,
        status: log.status as "success" | "error" | "timeout",
        errorMessage: log.errorMessage,
        createdAt: log.createdAt,
      })),
      total,
      limit,
      offset,
      hasMore: offset + logs.length < total,
    };
  }

  /**
   * Get AI decision metrics for a workspace
   */
  static async getMetrics(
    workspaceId?: string,
    startDate?: Date,
    endDate?: Date,
  ): Promise<AIDecisionMetrics> {
    const where: Prisma.AIDecisionLogWhereInput = {};

    if (workspaceId) {
      where.workspaceId = workspaceId;
    }

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
    const totalDecisions = await prisma.aIDecisionLog.count({ where });

    // Get decisions by type
    const typeCounts = await prisma.aIDecisionLog.groupBy({
      by: ["requestType"],
      where,
      _count: { requestType: true },
    });

    const decisionsByType: Record<string, number> = {};
    for (const item of typeCounts) {
      decisionsByType[item.requestType] = item._count.requestType;
    }

    // Get decisions by status
    const statusCounts = await prisma.aIDecisionLog.groupBy({
      by: ["status"],
      where,
      _count: { status: true },
    });

    const decisionsByStatus: Record<string, number> = {};
    for (const item of statusCounts) {
      decisionsByStatus[item.status] = item._count.status;
    }

    // Get aggregate stats
    const aggregates = await prisma.aIDecisionLog.aggregate({
      where,
      _avg: {
        latencyMs: true,
      },
      _sum: {
        tokensUsed: true,
      },
    });

    // Calculate success rate
    const successCount = decisionsByStatus.success || 0;
    const successRate = totalDecisions > 0 ? (successCount / totalDecisions) * 100 : 0;

    return {
      totalDecisions,
      decisionsByType,
      decisionsByStatus,
      averageLatencyMs: aggregates._avg.latencyMs || 0,
      totalTokensUsed: aggregates._sum.tokensUsed || 0,
      successRate,
    };
  }

  /**
   * Get a single AI decision log by ID
   */
  static async getById(id: string): Promise<AIDecisionLogEntry | null> {
    const log = await prisma.aIDecisionLog.findUnique({
      where: { id },
    });

    if (!log) {
      return null;
    }

    return {
      id: log.id,
      workspaceId: log.workspaceId,
      userId: log.userId,
      requestType: log.requestType,
      inputPrompt: log.inputPrompt,
      inputContext: log.inputContext as Record<string, unknown> | null,
      outputResult: log.outputResult,
      outputMetadata: log.outputMetadata as Record<string, unknown> | null,
      modelId: log.modelId,
      modelVersion: log.modelVersion,
      tokensUsed: log.tokensUsed,
      latencyMs: log.latencyMs,
      status: log.status as "success" | "error" | "timeout",
      errorMessage: log.errorMessage,
      createdAt: log.createdAt,
    };
  }
}
