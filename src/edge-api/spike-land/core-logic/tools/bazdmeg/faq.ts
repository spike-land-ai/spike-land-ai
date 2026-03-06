/**
 * BAZDMEG FAQ MCP Tools (CF Workers)
 *
 * CRUD operations for BAZDMEG FAQ entries.
 * Ported from spike.land Prisma to Drizzle ORM + D1.
 *
 * Note: The bazdmegFaqEntry table does not exist in the D1 schema yet.
 * These tools proxy to the spike.land API until the table is migrated.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../../lazy-imports/types";
import { freeTool } from "../../../lazy-imports/procedures-index.ts";
import { apiRequest, safeToolCall, textResult } from "../../lib/tool-helpers";
import type { DrizzleDB } from "../../../db/db/db-index.ts";

export function registerBazdmegFaqTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // bazdmeg_faq_list
  registry.registerBuilt(
    t
      .tool("bazdmeg_faq_list", "List BAZDMEG FAQ entries, optionally filtered by category.", {
        category: z
          .string()
          .optional()
          .describe("Filter by category (e.g., 'general', 'methodology', 'testing')."),
        include_unpublished: z
          .boolean()
          .optional()
          .default(false)
          .describe("Include unpublished entries (admin only)."),
      })
      .meta({ category: "bazdmeg", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("bazdmeg_faq_list", async () => {
          const params = new URLSearchParams();
          if (input.category) params.set("category", input.category);
          if (input.include_unpublished) {
            params.set("include_unpublished", "true");
          }

          const entries = await apiRequest<
            Array<{
              id: string;
              question: string;
              answer: string;
              category: string;
              isPublished: boolean;
              helpfulCount: number;
            }>
          >(`/api/bazdmeg/faq?${params.toString()}`);

          if (entries.length === 0) {
            return textResult("No FAQ entries found.");
          }

          const lines = entries.map(
            (e) =>
              `**${e.question}**\n${e.answer}\n*Category: ${e.category} | Published: ${e.isPublished} | Helpful: ${e.helpfulCount} | ID: ${e.id}*`,
          );

          return textResult(
            `**BAZDMEG FAQ** (${entries.length} entries)\n\n${lines.join("\n\n---\n\n")}`,
          );
        });
      }),
  );

  // bazdmeg_faq_create
  registry.registerBuilt(
    t
      .tool("bazdmeg_faq_create", "Create a new BAZDMEG FAQ entry.", {
        question: z.string().min(1).describe("The FAQ question."),
        answer: z.string().min(1).describe("The FAQ answer."),
        category: z.string().optional().default("general").describe("Category for grouping."),
        sort_order: z.number().optional().default(0).describe("Display sort order."),
      })
      .meta({ category: "bazdmeg", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("bazdmeg_faq_create", async () => {
          const entry = await apiRequest<{ id: string; question: string }>("/api/bazdmeg/faq", {
            method: "POST",
            body: JSON.stringify({
              question: input.question,
              answer: input.answer,
              category: input.category,
              sort_order: input.sort_order,
            }),
          });
          return textResult(`FAQ entry created: "${entry.question}" (ID: ${entry.id})`);
        });
      }),
  );

  // bazdmeg_faq_update
  registry.registerBuilt(
    t
      .tool("bazdmeg_faq_update", "Update an existing BAZDMEG FAQ entry.", {
        id: z.string().min(1).describe("FAQ entry ID to update."),
        question: z.string().optional().describe("Updated question text."),
        answer: z.string().optional().describe("Updated answer text."),
        category: z.string().optional().describe("Updated category."),
        sort_order: z.number().optional().describe("Updated sort order."),
        is_published: z.boolean().optional().describe("Whether the entry is published."),
      })
      .meta({ category: "bazdmeg", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("bazdmeg_faq_update", async () => {
          const entry = await apiRequest<{ id: string; question: string }>(
            `/api/bazdmeg/faq/${input.id}`,
            {
              method: "PATCH",
              body: JSON.stringify({
                question: input.question,
                answer: input.answer,
                category: input.category,
                sort_order: input.sort_order,
                is_published: input.is_published,
              }),
            },
          );
          return textResult(`FAQ entry updated: "${entry.question}" (ID: ${entry.id})`);
        });
      }),
  );

  // bazdmeg_faq_delete
  registry.registerBuilt(
    t
      .tool("bazdmeg_faq_delete", "Delete a BAZDMEG FAQ entry by ID.", {
        id: z.string().min(1).describe("FAQ entry ID to delete."),
      })
      .meta({ category: "bazdmeg", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("bazdmeg_faq_delete", async () => {
          await apiRequest(`/api/bazdmeg/faq/${input.id}`, {
            method: "DELETE",
          });
          return textResult(`FAQ entry deleted (ID: ${input.id})`);
        });
      }),
  );
}
