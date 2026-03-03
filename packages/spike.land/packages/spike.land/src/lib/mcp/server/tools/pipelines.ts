/**
 * Enhancement Pipelines MCP Tools
 *
 * Create, fork, update, and manage image processing pipelines.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Prisma } from "@/generated/prisma";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const ListPipelinesSchema = z.object({
  limit: z.number().int().min(1).max(100).optional().describe(
    "Max results (default 50).",
  ),
});

const CreatePipelineSchema = z.object({
  name: z.string().min(1).max(100).describe("Pipeline name."),
  description: z.string().optional().describe("Pipeline description."),
  configs: z.object({
    analysis: z.record(z.string(), z.unknown()).optional().describe(
      "Analysis configuration.",
    ),
    autoCrop: z.record(z.string(), z.unknown()).optional().describe(
      "Auto-crop configuration.",
    ),
    prompt: z.record(z.string(), z.unknown()).optional().describe(
      "Prompt configuration.",
    ),
    generation: z.record(z.string(), z.unknown()).optional().describe(
      "Generation configuration.",
    ),
  }).optional().describe("Pipeline configuration objects."),
});

const GetPipelineSchema = z.object({
  pipeline_id: z.string().min(1).describe("Pipeline ID."),
});

const UpdatePipelineSchema = z.object({
  pipeline_id: z.string().min(1).describe("Pipeline ID to update."),
  name: z.string().min(1).max(100).optional().describe("New name."),
  description: z.string().optional().describe("New description."),
  configs: z.object({
    analysis: z.record(z.string(), z.unknown()).optional().describe(
      "Analysis configuration.",
    ),
    autoCrop: z.record(z.string(), z.unknown()).optional().describe(
      "Auto-crop configuration.",
    ),
    prompt: z.record(z.string(), z.unknown()).optional().describe(
      "Prompt configuration.",
    ),
    generation: z.record(z.string(), z.unknown()).optional().describe(
      "Generation configuration.",
    ),
  }).optional().describe("Updated pipeline configuration objects."),
});

const DeletePipelineSchema = z.object({
  pipeline_id: z.string().min(1).describe("Pipeline ID to delete."),
});

const ForkPipelineSchema = z.object({
  pipeline_id: z.string().min(1).describe("Pipeline ID to fork."),
});

export function registerPipelinesTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "pipelines_list",
    description:
      "List enhancement pipelines accessible to user (own pipelines, public, and system defaults).",
    category: "pipelines",
    tier: "free",
    inputSchema: ListPipelinesSchema.shape,
    handler: async (
      { limit = 50 }: z.infer<typeof ListPipelinesSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("pipelines_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const pipelines = await prisma.enhancementPipeline.findMany({
          where: {
            OR: [
              { userId },
              { visibility: "PUBLIC" },
              { userId: null },
            ],
          },
          select: {
            id: true,
            name: true,
            description: true,
            userId: true,
            visibility: true,
            tier: true,
            usageCount: true,
            createdAt: true,
          },
          take: limit,
          orderBy: [{ usageCount: "desc" }, { createdAt: "desc" }],
        });

        if (pipelines.length === 0) return textResult("No pipelines found.");

        let text = `**Pipelines (${pipelines.length}):**\n\n`;
        for (const p of pipelines) {
          const ownerTag = p.userId === null
            ? "[System]"
            : p.userId === userId
            ? "[Own]"
            : "[Public]";
          text += `- **${p.name}** ${ownerTag} [${p.visibility}] — ${p.usageCount} uses\n  ${
            p.description || "(no description)"
          }\n  ID: ${p.id}\n\n`;
        }
        return textResult(text);
      }),
  });

  registry.register({
    name: "pipelines_create",
    description:
      "Create a new enhancement pipeline with optional analysis, auto-crop, prompt, and generation configs.",
    category: "pipelines",
    tier: "free",
    inputSchema: CreatePipelineSchema.shape,
    handler: async (
      { name, description, configs }: z.infer<typeof CreatePipelineSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("pipelines_create", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const pipeline = await prisma.enhancementPipeline.create({
          data: {
            name: name.trim(),
            description: description?.trim() || null,
            userId,
            ...(configs?.analysis
              ? { analysisConfig: configs.analysis as Prisma.InputJsonValue }
              : {}),
            ...(configs?.autoCrop
              ? { autoCropConfig: configs.autoCrop as Prisma.InputJsonValue }
              : {}),
            ...(configs?.prompt
              ? { promptConfig: configs.prompt as Prisma.InputJsonValue }
              : {}),
            ...(configs?.generation
              ? {
                generationConfig: configs.generation as Prisma.InputJsonValue,
              }
              : {}),
          },
          select: { id: true, name: true, description: true },
        });

        return textResult(
          `**Pipeline Created!**\n\n`
            + `**ID:** ${pipeline.id}\n`
            + `**Name:** ${pipeline.name}`
            + (pipeline.description
              ? `\n**Description:** ${pipeline.description}`
              : ""),
        );
      }),
  });

  registry.register({
    name: "pipelines_get",
    description: "Get detailed information about a specific pipeline.",
    category: "pipelines",
    tier: "free",
    inputSchema: GetPipelineSchema.shape,
    handler: async (
      { pipeline_id }: z.infer<typeof GetPipelineSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("pipelines_get", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const pipeline = await prisma.enhancementPipeline.findUnique({
          where: { id: pipeline_id },
          select: {
            id: true,
            name: true,
            description: true,
            userId: true,
            visibility: true,
            tier: true,
            usageCount: true,
            analysisConfig: true,
            autoCropConfig: true,
            promptConfig: true,
            generationConfig: true,
            createdAt: true,
            updatedAt: true,
            _count: { select: { albums: true, jobs: true } },
          },
        });

        if (!pipeline) {
          return textResult(
            "**Error: NOT_FOUND**\nPipeline not found.\n**Retryable:** false",
          );
        }

        const isOwner = pipeline.userId === userId;
        const isSystem = pipeline.userId === null;
        const isPublic = pipeline.visibility === "PUBLIC";

        if (!isOwner && !isSystem && !isPublic) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nAccess denied to this pipeline.\n**Retryable:** false",
          );
        }

        return textResult(
          `**Pipeline**\n\n`
            + `**ID:** ${pipeline.id}\n`
            + `**Name:** ${pipeline.name}\n`
            + `**Description:** ${pipeline.description || "(none)"}\n`
            + `**Visibility:** ${pipeline.visibility}\n`
            + `**Tier:** ${pipeline.tier}\n`
            + `**Usage Count:** ${pipeline.usageCount}\n`
            + `**Albums:** ${pipeline._count.albums}\n`
            + `**Jobs:** ${pipeline._count.jobs}\n`
            + `**Owner:** ${isSystem ? "System" : isOwner ? "You" : "Other"}\n`
            + `**Configs:** analysis=${pipeline.analysisConfig ? "set" : "default"}, autoCrop=${
              pipeline.autoCropConfig ? "set" : "default"
            }, prompt=${pipeline.promptConfig ? "set" : "default"}, generation=${
              pipeline.generationConfig ? "set" : "default"
            }\n`
            + `**Created:** ${pipeline.createdAt.toISOString()}\n`
            + `**Updated:** ${pipeline.updatedAt.toISOString()}`,
        );
      }),
  });

  registry.register({
    name: "pipelines_update",
    description:
      "Update a pipeline's name, description, or configuration. Only the owner can update.",
    category: "pipelines",
    tier: "free",
    inputSchema: UpdatePipelineSchema.shape,
    handler: async (
      { pipeline_id, name, description, configs }: z.infer<
        typeof UpdatePipelineSchema
      >,
    ): Promise<CallToolResult> =>
      safeToolCall("pipelines_update", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        // Verify ownership
        const existing = await prisma.enhancementPipeline.findUnique({
          where: { id: pipeline_id },
          select: { userId: true },
        });

        if (!existing) {
          return textResult(
            "**Error: NOT_FOUND**\nPipeline not found.\n**Retryable:** false",
          );
        }
        if (existing.userId !== userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nOnly the owner can update this pipeline.\n**Retryable:** false",
          );
        }

        const pipeline = await prisma.enhancementPipeline.update({
          where: { id: pipeline_id },
          data: {
            ...(name !== undefined ? { name: name.trim() } : {}),
            ...(description !== undefined
              ? { description: description?.trim() || null }
              : {}),
            ...(configs?.analysis !== undefined
              ? { analysisConfig: configs.analysis as Prisma.InputJsonValue }
              : {}),
            ...(configs?.autoCrop !== undefined
              ? { autoCropConfig: configs.autoCrop as Prisma.InputJsonValue }
              : {}),
            ...(configs?.prompt !== undefined
              ? { promptConfig: configs.prompt as Prisma.InputJsonValue }
              : {}),
            ...(configs?.generation !== undefined
              ? {
                generationConfig: configs.generation as Prisma.InputJsonValue,
              }
              : {}),
          },
          select: { id: true, name: true },
        });

        return textResult(
          `**Pipeline Updated!** ${pipeline.name} (ID: ${pipeline.id})`,
        );
      }),
  });

  registry.register({
    name: "pipelines_delete",
    description:
      "Delete a pipeline. Only the owner can delete. Fails if pipeline is used by albums.",
    category: "pipelines",
    tier: "free",
    inputSchema: DeletePipelineSchema.shape,
    handler: async (
      { pipeline_id }: z.infer<typeof DeletePipelineSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("pipelines_delete", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const existing = await prisma.enhancementPipeline.findUnique({
          where: { id: pipeline_id },
          select: { userId: true, _count: { select: { albums: true } } },
        });

        if (!existing) {
          return textResult(
            "**Error: NOT_FOUND**\nPipeline not found.\n**Retryable:** false",
          );
        }
        if (existing.userId !== userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nOnly the owner can delete this pipeline.\n**Retryable:** false",
          );
        }
        if (existing._count.albums > 0) {
          return textResult(
            `**Error: CONFLICT**\nCannot delete: pipeline is used by ${existing._count.albums} album(s). Remove from albums first.\n**Retryable:** false`,
          );
        }

        await prisma.enhancementPipeline.delete({ where: { id: pipeline_id } });
        return textResult(`**Pipeline Deleted!** ID: ${pipeline_id}`);
      }),
  });

  registry.register({
    name: "pipelines_fork",
    description:
      "Fork (copy) a pipeline to your account. Works on own, public, or system default pipelines.",
    category: "pipelines",
    tier: "free",
    inputSchema: ForkPipelineSchema.shape,
    handler: async (
      { pipeline_id }: z.infer<typeof ForkPipelineSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("pipelines_fork", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const source = await prisma.enhancementPipeline.findUnique({
          where: { id: pipeline_id },
          select: {
            id: true,
            name: true,
            description: true,
            userId: true,
            visibility: true,
            tier: true,
            analysisConfig: true,
            autoCropConfig: true,
            promptConfig: true,
            generationConfig: true,
          },
        });

        if (!source) {
          return textResult(
            "**Error: NOT_FOUND**\nPipeline not found.\n**Retryable:** false",
          );
        }

        const isOwner = source.userId === userId;
        const isSystem = source.userId === null;
        const isPublic = source.visibility === "PUBLIC";

        if (!isOwner && !isSystem && !isPublic) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nAccess denied to this pipeline.\n**Retryable:** false",
          );
        }

        const forked = await prisma.enhancementPipeline.create({
          data: {
            name: `${source.name} (copy)`,
            description: source.description,
            userId,
            tier: source.tier,
            visibility: "PRIVATE",
            analysisConfig: source.analysisConfig ?? undefined,
            autoCropConfig: source.autoCropConfig ?? undefined,
            promptConfig: source.promptConfig ?? undefined,
            generationConfig: source.generationConfig ?? undefined,
          },
          select: { id: true, name: true },
        });

        return textResult(
          `**Pipeline Forked!**\n\n`
            + `**New ID:** ${forked.id}\n`
            + `**Name:** ${forked.name}\n`
            + `**Forked From:** ${source.id}`,
        );
      }),
  });
}
