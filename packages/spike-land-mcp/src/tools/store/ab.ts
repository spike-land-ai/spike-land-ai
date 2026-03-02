/**
 * Store App A/B Testing MCP Tools (CF Workers)
 *
 * Create and manage store app deployments with A/B variant testing,
 * hash-based visitor assignment, impression/error tracking, and winner declaration.
 * Proxies to spike.land API for deployment operations.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../types";
import { freeTool } from "../../procedures/index";
import { textResult, safeToolCall, apiRequest } from "../tool-helpers";
import type { DrizzleDB } from "../../db/index";

export function registerStoreAbTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // store_app_deploy
  registry.registerBuilt(
    t
      .tool("store_app_deploy", "Create a store app deployment record with DRAFT status.", {
        app_slug: z.string().min(1).describe("Store app slug."),
        base_codespace_id: z.string().min(1).describe("Base codespace ID for the deployment."),
      })
      .meta({ category: "store-ab", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_deploy", async () => {
          const deployment = await apiRequest<{
            id: string;
          }>("/api/store/deployments", {
            method: "POST",
            body: JSON.stringify({
              appSlug: input.app_slug,
              baseCodespaceId: input.base_codespace_id,
            }),
          });

          let text = `**Deployment Created**\n\n`;
          text += `**Deployment ID:** \`${deployment.id}\`\n`;
          text += `**App Slug:** \`${input.app_slug}\`\n`;
          text += `**Base Codespace:** \`${input.base_codespace_id}\`\n`;
          text += `**Status:** DRAFT\n`;
          return textResult(text);
        });
      }),
  );

  // store_app_add_variant
  registry.registerBuilt(
    t
      .tool("store_app_add_variant", "Add an A/B test variant to a store app deployment.", {
        deployment_id: z.string().min(1).describe("Deployment ID."),
        variant_label: z.string().min(1).describe("Human-readable label for the variant."),
        codespace_id: z.string().min(1).describe("Codespace ID for this variant."),
        dimension: z
          .enum(["layout", "theme", "interaction", "mobile", "minimal"])
          .describe("Dimension being tested."),
      })
      .meta({ category: "store-ab", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_add_variant", async () => {
          const variant = await apiRequest<{ id: string }>(
            `/api/store/deployments/${input.deployment_id}/variants`,
            {
              method: "POST",
              body: JSON.stringify({
                variantLabel: input.variant_label,
                codespaceId: input.codespace_id,
                dimension: input.dimension,
              }),
            },
          );

          let text = `**Variant Added**\n\n`;
          text += `**Variant ID:** \`${variant.id}\`\n`;
          text += `**Deployment:** \`${input.deployment_id}\`\n`;
          text += `**Label:** ${input.variant_label}\n`;
          text += `**Dimension:** ${input.dimension}\n`;
          text += `**Codespace:** \`${input.codespace_id}\`\n`;
          return textResult(text);
        });
      }),
  );

  // store_app_assign_visitor
  registry.registerBuilt(
    t
      .tool(
        "store_app_assign_visitor",
        "Assign a visitor to a deployment variant using hash-based consistent assignment.",
        {
          deployment_id: z.string().min(1).describe("Deployment ID."),
          visitor_id: z.string().min(1).describe("Visitor ID to assign."),
        },
      )
      .meta({ category: "store-ab", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_assign_visitor", async () => {
          const result = await apiRequest<{
            variantId: string;
            codespaceId: string;
            variantLabel: string;
          }>(`/api/store/deployments/${input.deployment_id}/assign`, {
            method: "POST",
            body: JSON.stringify({ visitorId: input.visitor_id }),
          });

          let text = `**Visitor Assigned**\n\n`;
          text += `**Deployment:** \`${input.deployment_id}\`\n`;
          text += `**Visitor:** ${input.visitor_id}\n`;
          text += `**Variant:** \`${result.variantId}\`\n`;
          text += `**Codespace:** \`${result.codespaceId}\`\n`;
          text += `**Label:** ${result.variantLabel}\n`;
          return textResult(text);
        });
      }),
  );

  // store_app_record_impression
  registry.registerBuilt(
    t
      .tool(
        "store_app_record_impression",
        "Atomically increment the impression counter for a store app variant.",
        {
          variant_id: z.string().min(1).describe("Variant ID to record impression for."),
        },
      )
      .meta({ category: "store-ab", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_record_impression", async () => {
          const result = await apiRequest<{ impressions: number }>(
            `/api/store/variants/${input.variant_id}/impression`,
            {
              method: "POST",
            },
          );

          return textResult(
            `**Impression Recorded**\n\n` +
              `**Variant:** \`${input.variant_id}\`\n` +
              `**Total Impressions:** ${result.impressions}\n`,
          );
        });
      }),
  );

  // store_app_record_error
  registry.registerBuilt(
    t
      .tool(
        "store_app_record_error",
        "Atomically increment the error counter for a store app variant.",
        {
          variant_id: z.string().min(1).describe("Variant ID to record error for."),
        },
      )
      .meta({ category: "store-ab", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_record_error", async () => {
          const result = await apiRequest<{ errorCount: number }>(
            `/api/store/variants/${input.variant_id}/error`,
            {
              method: "POST",
            },
          );

          return textResult(
            `**Error Recorded**\n\n` +
              `**Variant:** \`${input.variant_id}\`\n` +
              `**Total Errors:** ${result.errorCount}\n`,
          );
        });
      }),
  );

  // store_app_get_results
  registry.registerBuilt(
    t
      .tool(
        "store_app_get_results",
        "Get metrics for all variants of a store app deployment including impressions, engagements, errors, and winner status.",
        {
          deployment_id: z.string().min(1).describe("Deployment ID."),
        },
      )
      .meta({ category: "store-ab", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_get_results", async () => {
          const deployment = await apiRequest<{
            id: string;
            appSlug: string;
            status: string;
            variants: Array<{
              id: string;
              variantLabel: string;
              dimension: string;
              impressions: number;
              engagements: number;
              errorCount: number;
              isWinner: boolean;
            }>;
          } | null>(`/api/store/deployments/${input.deployment_id}/results`);

          if (!deployment) {
            return textResult("**Error: NOT_FOUND**\nDeployment not found.\n**Retryable:** false");
          }

          let text = `**Deployment Results**\n\n`;
          text += `**Deployment ID:** \`${deployment.id}\`\n`;
          text += `**App Slug:** \`${deployment.appSlug}\`\n`;
          text += `**Status:** ${deployment.status}\n\n`;
          text += `| Variant | Label | Dimension | Impressions | Engagements | Errors | Winner |\n`;
          text += `|---------|-------|-----------|-------------|-------------|--------|--------|\n`;

          for (const v of deployment.variants) {
            text += `| \`${v.id}\` | ${v.variantLabel} | ${v.dimension} | ${v.impressions} | ${v.engagements} | ${v.errorCount} | ${v.isWinner ? "Yes" : "No"} |\n`;
          }
          return textResult(text);
        });
      }),
  );

  // store_app_declare_winner
  registry.registerBuilt(
    t
      .tool(
        "store_app_declare_winner",
        "Declare a winning variant for a store app deployment and set the deployment status to LIVE.",
        {
          deployment_id: z.string().min(1).describe("Deployment ID."),
          variant_id: z.string().min(1).describe("ID of the winning variant."),
        },
      )
      .meta({ category: "store-ab", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_declare_winner", async () => {
          await apiRequest(`/api/store/deployments/${input.deployment_id}/winner`, {
            method: "POST",
            body: JSON.stringify({ variantId: input.variant_id }),
          });

          let text = `**Winner Declared**\n\n`;
          text += `**Deployment ID:** \`${input.deployment_id}\`\n`;
          text += `**Winner Variant:** \`${input.variant_id}\`\n`;
          text += `**Status:** LIVE\n`;
          return textResult(text);
        });
      }),
  );

  // store_app_cleanup
  registry.registerBuilt(
    t
      .tool(
        "store_app_cleanup",
        "Remove a failed or archived store app deployment and all its variants.",
        {
          deployment_id: z.string().min(1).describe("Deployment ID to clean up."),
        },
      )
      .meta({ category: "store-ab", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_cleanup", async () => {
          await apiRequest(`/api/store/deployments/${input.deployment_id}`, {
            method: "DELETE",
          });

          let text = `**Deployment Cleaned Up**\n\n`;
          text += `**Deployment ID:** \`${input.deployment_id}\`\n`;
          text += `Deployment and all variants have been removed.\n`;
          return textResult(text);
        });
      }),
  );
}
