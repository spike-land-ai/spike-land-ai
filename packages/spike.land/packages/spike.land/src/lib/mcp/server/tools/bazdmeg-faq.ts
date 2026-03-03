/**
 * BAZDMEG FAQ MCP Tools
 *
 * CRUD operations for BAZDMEG FAQ entries.
 */

import { isAdminByUserId } from "@/lib/auth/admin-middleware";
import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const FaqListSchema = z.object({
  category: z.string().optional().describe(
    "Filter by category (e.g., 'general', 'methodology', 'testing').",
  ),
  include_unpublished: z.boolean().optional().default(false).describe(
    "Include unpublished entries (admin only).",
  ),
});

const FaqCreateSchema = z.object({
  question: z.string().min(1).describe("The FAQ question."),
  answer: z.string().min(1).describe("The FAQ answer."),
  category: z.string().optional().default("general").describe(
    "Category for grouping.",
  ),
  sort_order: z.number().optional().default(0).describe("Display sort order."),
});

const FaqUpdateSchema = z.object({
  id: z.string().min(1).describe("FAQ entry ID to update."),
  question: z.string().optional().describe("Updated question text."),
  answer: z.string().optional().describe("Updated answer text."),
  category: z.string().optional().describe("Updated category."),
  sort_order: z.number().optional().describe("Updated sort order."),
  is_published: z.boolean().optional().describe(
    "Whether the entry is published.",
  ),
});

const FaqDeleteSchema = z.object({
  id: z.string().min(1).describe("FAQ entry ID to delete."),
});

export function registerBazdmegFaqTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "bazdmeg_faq_list",
    description: "List BAZDMEG FAQ entries, optionally filtered by category.",
    category: "bazdmeg",
    tier: "free",
    inputSchema: FaqListSchema.shape,
    handler: async (
      { category, include_unpublished }: z.infer<typeof FaqListSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_faq_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const isUserAdmin = await isAdminByUserId(userId);
        const showUnpublished = include_unpublished && isUserAdmin;
        const entries = await prisma.bazdmegFaqEntry.findMany({
          where: {
            ...(showUnpublished ? {} : { isPublished: true }),
            ...(category ? { category } : {}),
          },
          orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
        });

        if (entries.length === 0) {
          return textResult("No FAQ entries found.");
        }

        const lines = entries.map(
          (
            e: {
              id: string;
              question: string;
              answer: string;
              category: string;
              isPublished: boolean;
              helpfulCount: number;
            },
          ) =>
            `**${e.question}**\n${e.answer}\n*Category: ${e.category} | Published: ${e.isPublished} | Helpful: ${e.helpfulCount} | ID: ${e.id}*`,
        );

        return textResult(
          `**BAZDMEG FAQ** (${entries.length} entries)\n\n${lines.join("\n\n---\n\n")}`,
        );
      }, { userId }),
  });

  registry.register({
    name: "bazdmeg_faq_create",
    description: "Create a new BAZDMEG FAQ entry.",
    category: "bazdmeg",
    tier: "free",
    inputSchema: FaqCreateSchema.shape,
    handler: async (
      { question, answer, category, sort_order }: z.infer<
        typeof FaqCreateSchema
      >,
    ): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_faq_create", async () => {
        const isUserAdmin = await isAdminByUserId(userId);
        if (!isUserAdmin) {
          return textResult("Forbidden: admin access required.");
        }
        const prisma = (await import("@/lib/prisma")).default;
        const entry = await prisma.bazdmegFaqEntry.create({
          data: {
            question,
            answer,
            category: category ?? "general",
            sortOrder: sort_order ?? 0,
          },
        });
        return textResult(
          `FAQ entry created: "${entry.question}" (ID: ${entry.id})`,
        );
      }, { userId }),
  });

  registry.register({
    name: "bazdmeg_faq_update",
    description: "Update an existing BAZDMEG FAQ entry.",
    category: "bazdmeg",
    tier: "free",
    inputSchema: FaqUpdateSchema.shape,
    handler: async (
      { id, question, answer, category, sort_order, is_published }: z.infer<
        typeof FaqUpdateSchema
      >,
    ): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_faq_update", async () => {
        const isUserAdmin = await isAdminByUserId(userId);
        if (!isUserAdmin) {
          return textResult("Forbidden: admin access required.");
        }
        const prisma = (await import("@/lib/prisma")).default;
        const entry = await prisma.bazdmegFaqEntry.update({
          where: { id },
          data: {
            ...(question !== undefined ? { question } : {}),
            ...(answer !== undefined ? { answer } : {}),
            ...(category !== undefined ? { category } : {}),
            ...(sort_order !== undefined ? { sortOrder: sort_order } : {}),
            ...(is_published !== undefined
              ? { isPublished: is_published }
              : {}),
          },
        });
        return textResult(
          `FAQ entry updated: "${entry.question}" (ID: ${entry.id})`,
        );
      }, { userId }),
  });

  registry.register({
    name: "bazdmeg_faq_delete",
    description: "Delete a BAZDMEG FAQ entry by ID.",
    category: "bazdmeg",
    tier: "free",
    inputSchema: FaqDeleteSchema.shape,
    handler: async (
      { id }: z.infer<typeof FaqDeleteSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_faq_delete", async () => {
        const isUserAdmin = await isAdminByUserId(userId);
        if (!isUserAdmin) {
          return textResult("Forbidden: admin access required.");
        }
        const prisma = (await import("@/lib/prisma")).default;
        await prisma.bazdmegFaqEntry.delete({ where: { id } });
        return textResult(`FAQ entry deleted (ID: ${id})`);
      }, { userId }),
  });
}
