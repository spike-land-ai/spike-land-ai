/**
 * Store App A/B Testing MCP Tools
 *
 * Create and manage store app deployments with A/B variant testing,
 * hash-based visitor assignment, impression/error tracking, and winner declaration.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import { STORE_APPS } from "@/app/store/data/store-apps";

const DeploySchema = z.object({
  app_slug: z.string().min(1).describe("Store app slug."),
  base_codespace_id: z.string().min(1).describe(
    "Base codespace ID for the deployment.",
  ),
});

const AddVariantSchema = z.object({
  deployment_id: z.string().min(1).describe("Deployment ID."),
  variant_label: z.string().min(1).describe(
    "Human-readable label for the variant.",
  ),
  codespace_id: z.string().min(1).describe("Codespace ID for this variant."),
  dimension: z.enum(["layout", "theme", "interaction", "mobile", "minimal"])
    .describe("Dimension being tested."),
});

const AssignVisitorSchema = z.object({
  deployment_id: z.string().min(1).describe("Deployment ID."),
  visitor_id: z.string().min(1).describe("Visitor ID to assign."),
});

const RecordImpressionSchema = z.object({
  variant_id: z.string().min(1).describe(
    "Variant ID to record impression for.",
  ),
});

const RecordErrorSchema = z.object({
  variant_id: z.string().min(1).describe("Variant ID to record error for."),
});

const GetResultsSchema = z.object({
  deployment_id: z.string().min(1).describe("Deployment ID."),
});

const DeclareWinnerSchema = z.object({
  deployment_id: z.string().min(1).describe("Deployment ID."),
  variant_id: z.string().min(1).describe("ID of the winning variant."),
});

const CleanupSchema = z.object({
  deployment_id: z.string().min(1).describe("Deployment ID to clean up."),
});

export function registerStoreAbTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // Suppress unused variable warning - userId reserved for future access control
  void userId;

  registry.register({
    name: "store_app_deploy",
    description: "Create a store app deployment record with DRAFT status.",
    category: "store-ab",
    tier: "free",
    inputSchema: DeploySchema.shape,
    handler: async (
      args: z.infer<typeof DeploySchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("store_app_deploy", async () => {
        const app = STORE_APPS.find(a => a.slug === args.app_slug);
        if (!app) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nApp slug '${args.app_slug}' not found in store.\n**Retryable:** false`,
          );
        }

        const prisma = (await import("@/lib/prisma")).default;

        const deployment = await prisma.storeAppDeployment.create({
          data: {
            appSlug: args.app_slug,
            baseCodespaceId: args.base_codespace_id,
            status: "DRAFT",
          },
        });

        let text = `**Deployment Created**\n\n`;
        text += `**Deployment ID:** \`${deployment.id}\`\n`;
        text += `**App Slug:** \`${args.app_slug}\`\n`;
        text += `**Base Codespace:** \`${args.base_codespace_id}\`\n`;
        text += `**Status:** DRAFT\n`;
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "store_app_add_variant",
    description: "Add an A/B test variant to a store app deployment.",
    category: "store-ab",
    tier: "free",
    inputSchema: AddVariantSchema.shape,
    handler: async (
      args: z.infer<typeof AddVariantSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("store_app_add_variant", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const variant = await prisma.storeAppVariant.create({
          data: {
            deploymentId: args.deployment_id,
            variantLabel: args.variant_label,
            codespaceId: args.codespace_id,
            dimension: args.dimension,
          },
        });

        let text = `**Variant Added**\n\n`;
        text += `**Variant ID:** \`${variant.id}\`\n`;
        text += `**Deployment:** \`${args.deployment_id}\`\n`;
        text += `**Label:** ${args.variant_label}\n`;
        text += `**Dimension:** ${args.dimension}\n`;
        text += `**Codespace:** \`${args.codespace_id}\`\n`;
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "store_app_assign_visitor",
    description: "Assign a visitor to a deployment variant using hash-based consistent assignment.",
    category: "store-ab",
    tier: "free",
    inputSchema: AssignVisitorSchema.shape,
    handler: async (
      args: z.infer<typeof AssignVisitorSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("store_app_assign_visitor", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const variants = await prisma.storeAppVariant.findMany({
          where: { deploymentId: args.deployment_id },
          orderBy: { createdAt: "asc" },
        });

        if (variants.length === 0) {
          return textResult(
            "**Error: VALIDATION_ERROR**\nNo variants configured for this deployment.\n**Retryable:** false",
          );
        }

        // Hash-based consistent assignment
        const hash = args.visitor_id.split("").reduce(
          (acc, c) => acc + c.charCodeAt(0),
          0,
        );
        const variantIndex = hash % variants.length;
        const assigned = variants[variantIndex]!;

        let text = `**Visitor Assigned**\n\n`;
        text += `**Deployment:** \`${args.deployment_id}\`\n`;
        text += `**Visitor:** ${args.visitor_id}\n`;
        text += `**Variant:** \`${assigned.id}\`\n`;
        text += `**Codespace:** \`${assigned.codespaceId}\`\n`;
        text += `**Label:** ${assigned.variantLabel}\n`;
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "store_app_record_impression",
    description: "Atomically increment the impression counter for a store app variant.",
    category: "store-ab",
    tier: "free",
    inputSchema: RecordImpressionSchema.shape,
    handler: async (
      args: z.infer<typeof RecordImpressionSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("store_app_record_impression", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const variant = await prisma.storeAppVariant.update({
          where: { id: args.variant_id },
          data: { impressions: { increment: 1 } },
        });

        return textResult(
          `**Impression Recorded**\n\n`
            + `**Variant:** \`${args.variant_id}\`\n`
            + `**Total Impressions:** ${variant.impressions}\n`,
        );
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "store_app_record_error",
    description: "Atomically increment the error counter for a store app variant.",
    category: "store-ab",
    tier: "free",
    inputSchema: RecordErrorSchema.shape,
    handler: async (
      args: z.infer<typeof RecordErrorSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("store_app_record_error", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const variant = await prisma.storeAppVariant.update({
          where: { id: args.variant_id },
          data: { errorCount: { increment: 1 } },
        });

        return textResult(
          `**Error Recorded**\n\n`
            + `**Variant:** \`${args.variant_id}\`\n`
            + `**Total Errors:** ${variant.errorCount}\n`,
        );
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "store_app_get_results",
    description:
      "Get metrics for all variants of a store app deployment including impressions, engagements, errors, and winner status.",
    category: "store-ab",
    tier: "free",
    inputSchema: GetResultsSchema.shape,
    annotations: { readOnlyHint: true },
    handler: async (
      args: z.infer<typeof GetResultsSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("store_app_get_results", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const deployment = await prisma.storeAppDeployment.findFirst({
          where: { id: args.deployment_id },
          include: {
            variants: {
              orderBy: { createdAt: "asc" },
            },
          },
        });

        if (!deployment) {
          return textResult(
            "**Error: NOT_FOUND**\nDeployment not found.\n**Retryable:** false",
          );
        }

        let text = `**Deployment Results**\n\n`;
        text += `**Deployment ID:** \`${deployment.id}\`\n`;
        text += `**App Slug:** \`${deployment.appSlug}\`\n`;
        text += `**Status:** ${deployment.status}\n\n`;
        text += `| Variant | Label | Dimension | Impressions | Engagements | Errors | Winner |\n`;
        text += `|---------|-------|-----------|-------------|-------------|--------|--------|\n`;

        for (const v of deployment.variants) {
          text +=
            `| \`${v.id}\` | ${v.variantLabel} | ${v.dimension} | ${v.impressions} | ${v.engagements} | ${v.errorCount} | ${
              v.isWinner ? "Yes" : "No"
            } |\n`;
        }
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "store_app_declare_winner",
    description:
      "Declare a winning variant for a store app deployment and set the deployment status to LIVE.",
    category: "store-ab",
    tier: "free",
    inputSchema: DeclareWinnerSchema.shape,
    handler: async (
      args: z.infer<typeof DeclareWinnerSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("store_app_declare_winner", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const deployment = await prisma.storeAppDeployment.findFirst({
          where: { id: args.deployment_id },
        });

        if (!deployment) {
          return textResult(
            "**Error: NOT_FOUND**\nDeployment not found.\n**Retryable:** false",
          );
        }

        await prisma.storeAppVariant.update({
          where: { id: args.variant_id },
          data: { isWinner: true },
        });

        await prisma.storeAppDeployment.update({
          where: { id: args.deployment_id },
          data: { status: "LIVE" },
        });

        let text = `**Winner Declared**\n\n`;
        text += `**Deployment ID:** \`${args.deployment_id}\`\n`;
        text += `**Winner Variant:** \`${args.variant_id}\`\n`;
        text += `**Status:** LIVE\n`;
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });

  registry.register({
    name: "store_app_cleanup",
    description: "Remove a failed or archived store app deployment and all its variants.",
    category: "store-ab",
    tier: "free",
    inputSchema: CleanupSchema.shape,
    handler: async (
      args: z.infer<typeof CleanupSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("store_app_cleanup", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const deployment = await prisma.storeAppDeployment.findFirst({
          where: { id: args.deployment_id },
        });

        if (!deployment) {
          return textResult(
            "**Error: NOT_FOUND**\nDeployment not found.\n**Retryable:** false",
          );
        }

        if (
          deployment.status !== "FAILED" && deployment.status !== "ARCHIVED"
        ) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nCan only clean up deployments with FAILED or ARCHIVED status. Current status: ${deployment.status}\n**Retryable:** false`,
          );
        }

        // Variants are cascade-deleted via the relation, but explicitly delete for clarity
        await prisma.storeAppVariant.deleteMany({
          where: { deploymentId: args.deployment_id },
        });

        await prisma.storeAppDeployment.delete({
          where: { id: args.deployment_id },
        });

        let text = `**Deployment Cleaned Up**\n\n`;
        text += `**Deployment ID:** \`${args.deployment_id}\`\n`;
        text += `**Previous Status:** ${deployment.status}\n`;
        text += `Deployment and all variants have been removed.\n`;
        return textResult(text);
      }, { timeoutMs: 30_000 }),
  });
}
