/**
 * Admin Jobs Business Logic
 *
 * Unified job querying, transformation, and pagination across
 * EnhancementJob and McpGenerationJob tables.
 */

import type { PaginationParams } from "@/lib/admin/filters";
import { paginateArray } from "@/lib/admin/filters";
import type { JobSource, UnifiedJob } from "@/types/admin-jobs";
import type { JobStatus } from "@prisma/client";

export const VALID_STATUSES: JobStatus[] = [
  "PENDING",
  "PROCESSING",
  "COMPLETED",
  "FAILED",
  "REFUNDED",
  "CANCELLED",
];

export const VALID_TYPES: Array<JobSource | "all"> = [
  "all",
  "enhancement",
  "mcp",
];

/**
 * Transform enhancement job to unified format (list view - lightweight)
 */
export function transformEnhancementJob(job: {
  id: string;
  status: JobStatus;
  tier: string;
  creditsCost: number;
  enhancedUrl: string | null;
  enhancedWidth: number | null;
  enhancedHeight: number | null;
  enhancedSizeBytes: number | null;
  errorMessage: string | null;
  userId: string;
  createdAt: Date;
  updatedAt: Date;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  retryCount: number;
  maxRetries: number;
  geminiPrompt: string | null;
  geminiModel: string | null;
  geminiTemp: number | null;
  workflowRunId: string | null;
  imageId: string;
  currentStage: string | null;
  image: { name: string; originalUrl: string; };
  user: { email: string | null; name: string | null; };
}): UnifiedJob {
  return {
    id: job.id,
    source: "enhancement" as JobSource,
    status: job.status,
    tier: job.tier as UnifiedJob["tier"],
    creditsCost: job.creditsCost,
    prompt: job.geminiPrompt?.slice(0, 500) ?? null,
    inputUrl: job.image.originalUrl,
    outputUrl: job.enhancedUrl,
    outputWidth: job.enhancedWidth,
    outputHeight: job.enhancedHeight,
    outputSizeBytes: job.enhancedSizeBytes,
    errorMessage: job.errorMessage?.slice(0, 500) ?? null,
    userId: job.userId,
    userEmail: job.user.email ?? "Unknown",
    userName: job.user.name,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    processingStartedAt: job.processingStartedAt?.toISOString() ?? null,
    processingCompletedAt: job.processingCompletedAt?.toISOString() ?? null,
    imageId: job.imageId,
    imageName: job.image.name,
    retryCount: job.retryCount,
    maxRetries: job.maxRetries,
    geminiModel: job.geminiModel,
    geminiTemp: job.geminiTemp,
    workflowRunId: job.workflowRunId,
    currentStage: job.currentStage,
  };
}

/**
 * Transform MCP job to unified format
 */
export function transformMcpJob(job: {
  id: string;
  status: JobStatus;
  tier: string;
  creditsCost: number;
  type: string;
  prompt: string;
  inputImageUrl: string | null;
  inputImageR2Key: string | null;
  outputImageUrl: string | null;
  outputImageR2Key: string | null;
  outputWidth: number | null;
  outputHeight: number | null;
  outputSizeBytes: number | null;
  errorMessage: string | null;
  userId: string;
  apiKeyId: string | null;
  geminiModel: string | null;
  createdAt: Date;
  updatedAt: Date;
  processingStartedAt: Date | null;
  processingCompletedAt: Date | null;
  user: { email: string | null; name: string | null; };
  apiKey: { name: string; } | null;
}): UnifiedJob {
  return {
    id: job.id,
    source: "mcp" as JobSource,
    status: job.status,
    tier: job.tier as UnifiedJob["tier"],
    creditsCost: job.creditsCost,
    prompt: job.prompt?.slice(0, 500) ?? null,
    inputUrl: job.inputImageUrl,
    outputUrl: job.outputImageUrl,
    outputWidth: job.outputWidth,
    outputHeight: job.outputHeight,
    outputSizeBytes: job.outputSizeBytes,
    errorMessage: job.errorMessage?.slice(0, 500) ?? null,
    userId: job.userId,
    userEmail: job.user.email ?? "Unknown",
    userName: job.user.name,
    createdAt: job.createdAt.toISOString(),
    updatedAt: job.updatedAt.toISOString(),
    processingStartedAt: job.processingStartedAt?.toISOString() ?? null,
    processingCompletedAt: job.processingCompletedAt?.toISOString() ?? null,
    mcpJobType: job.type as "GENERATE" | "MODIFY",
    apiKeyId: job.apiKeyId,
    apiKeyName: job.apiKey?.name ?? null,
    inputR2Key: job.inputImageR2Key,
    outputR2Key: job.outputImageR2Key,
    geminiModel: job.geminiModel,
  };
}

export interface GetUnifiedJobsParams {
  status?: JobStatus | null;
  type?: JobSource | "all";
  page?: number;
  limit?: number;
  search?: string;
}

export interface GetUnifiedJobsResult {
  jobs: UnifiedJob[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Record<string, number>;
  typeCounts: { all: number; enhancement: number; mcp: number; };
}

/**
 * Fetch, merge, sort, and paginate jobs from both EnhancementJob and McpGenerationJob tables.
 */
export async function getUnifiedJobs(
  params: GetUnifiedJobsParams,
): Promise<GetUnifiedJobsResult> {
  const prisma = (await import("@/lib/prisma")).default;

  const {
    status = null,
    type = "all",
    page = 1,
    limit = 20,
    search = "",
  } = params;

  // Build where clause for enhancement jobs
  const enhancementWhere: {
    status?: JobStatus;
    OR?: Array<
      | { id: { contains: string; }; }
      | { user: { email: { contains: string; mode: "insensitive"; }; }; }
    >;
  } = {};

  // Build where clause for MCP jobs
  const mcpWhere: {
    status?: JobStatus;
    OR?: Array<
      | { id: { contains: string; }; }
      | { user: { email: { contains: string; mode: "insensitive"; }; }; }
    >;
  } = {};

  if (status) {
    enhancementWhere.status = status;
    mcpWhere.status = status;
  }

  if (search) {
    const searchClause = [
      { id: { contains: search } },
      { user: { email: { contains: search, mode: "insensitive" as const } } },
    ];
    enhancementWhere.OR = searchClause;
    mcpWhere.OR = searchClause;
  }

  // Fetch jobs based on type
  const includeEnhancement = type === "all" || type === "enhancement";
  const includeMcp = type === "all" || type === "mcp";

  const [
    enhancementJobs,
    mcpJobs,
    enhancementStatusCounts,
    mcpStatusCounts,
    enhancementTotal,
    mcpTotal,
  ] = await Promise.all([
    // Enhancement jobs (with currentStage for progress tracking)
    includeEnhancement
      ? prisma.imageEnhancementJob.findMany({
        where: enhancementWhere,
        include: {
          image: { select: { name: true, originalUrl: true } },
          user: { select: { email: true, name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      : Promise.resolve([]),
    // MCP jobs
    includeMcp
      ? prisma.mcpGenerationJob.findMany({
        where: mcpWhere,
        include: {
          user: { select: { email: true, name: true } },
          apiKey: { select: { name: true } },
        },
        orderBy: { createdAt: "desc" },
      })
      : Promise.resolve([]),
    // Status counts for enhancement jobs
    prisma.imageEnhancementJob.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    // Status counts for MCP jobs
    prisma.mcpGenerationJob.groupBy({
      by: ["status"],
      _count: { status: true },
    }),
    // Total counts by type
    prisma.imageEnhancementJob.count(),
    prisma.mcpGenerationJob.count(),
  ]);

  // Transform and merge jobs
  const allJobs: UnifiedJob[] = [
    ...enhancementJobs.map(transformEnhancementJob),
    ...mcpJobs.map(transformMcpJob),
  ];

  // Sort by createdAt descending
  allJobs.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  // Apply pagination
  const paginationParams: PaginationParams = { page, limit };
  const paginated = paginateArray(allJobs, paginationParams);

  // Merge status counts
  const statusCountsMap: Record<string, number> = {};
  for (const item of enhancementStatusCounts) {
    statusCountsMap[item.status] = (statusCountsMap[item.status] || 0)
      + item._count.status;
  }
  for (const item of mcpStatusCounts) {
    statusCountsMap[item.status] = (statusCountsMap[item.status] || 0)
      + item._count.status;
  }

  // Calculate total count across all statuses
  const totalAll = Object.values(statusCountsMap).reduce(
    (sum, count) => sum + count,
    0,
  );

  return {
    jobs: paginated.data,
    pagination: paginated.pagination,
    statusCounts: {
      ALL: totalAll,
      ...statusCountsMap,
    },
    typeCounts: {
      all: enhancementTotal + mcpTotal,
      enhancement: enhancementTotal,
      mcp: mcpTotal,
    },
  };
}
