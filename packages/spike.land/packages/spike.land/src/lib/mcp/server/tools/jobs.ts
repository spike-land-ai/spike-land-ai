import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { safeToolCall, textResult } from "./tool-helpers";

const JobIdSchema = z.object({
  jobId: z.string(),
});

const BatchStatusSchema = z.object({
  jobIds: z.array(z.string()).max(50),
});

const MixHistorySchema = z.object({
  limit: z.number().optional().default(20),
  offset: z.number().optional().default(0),
});

export function registerJobsTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "jobs_get",
    description: "Get status and details of a specific job",
    category: "jobs",
    tier: "workspace",
    inputSchema: JobIdSchema.shape,
    handler: async (
      { jobId }: z.infer<typeof JobIdSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("jobs_get", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const job = await prisma.imageEnhancementJob.findUnique({
          where: { id: jobId, userId },
        });
        if (!job) throw new Error("Job not found");
        return textResult(JSON.stringify(job));
      }, { userId, input: { jobId } }),
  });

  registry.register({
    name: "jobs_batch_status",
    description: "Fetch status for multiple job IDs at once",
    category: "jobs",
    tier: "workspace",
    inputSchema: BatchStatusSchema.shape,
    handler: async (
      { jobIds }: z.infer<typeof BatchStatusSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("jobs_batch_status", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const jobs = await prisma.imageEnhancementJob.findMany({
          where: { id: { in: jobIds }, userId },
          select: { id: true, status: true, errorMessage: true },
        });
        return textResult(JSON.stringify({ jobs }));
      }, { userId, input: { jobIds } }),
  });

  registry.register({
    name: "jobs_mix_history",
    description: "Get recent mixing job history",
    category: "jobs",
    tier: "workspace",
    inputSchema: MixHistorySchema.shape,
    handler: async (
      { limit, offset }: z.infer<typeof MixHistorySchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("jobs_mix_history", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const history = await prisma.imageEnhancementJob.findMany({
          where: { userId, enhancementType: "BLEND" },
          orderBy: { createdAt: "desc" },
          take: limit,
          skip: offset,
        });
        return textResult(JSON.stringify(history));
      }, { userId, input: { limit, offset } }),
  });

  registry.register({
    name: "jobs_cancel",
    description: "Cancel a pending job",
    category: "jobs",
    tier: "workspace",
    inputSchema: JobIdSchema.shape,
    handler: async (
      { jobId }: z.infer<typeof JobIdSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("jobs_cancel", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        // Atomic update: only cancel if job belongs to user AND is in a cancellable state
        const result = await prisma.imageEnhancementJob.updateMany({
          where: {
            id: jobId,
            userId,
            status: { in: ["PENDING", "PROCESSING"] },
          },
          data: { status: "CANCELLED" },
        });

        if (result.count === 0) {
          // Determine why: not found or wrong state
          const job = await prisma.imageEnhancementJob.findUnique({
            where: { id: jobId, userId },
            select: { status: true },
          });
          if (!job) throw new Error("Job not found");
          throw new Error(`Job cannot be cancelled in state: ${job.status}`);
        }

        return textResult(JSON.stringify({ jobId, status: "CANCELLED" }));
      }, { userId, input: { jobId } }),
  });
}
