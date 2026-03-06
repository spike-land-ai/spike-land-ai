/**
 * Store Install MCP Tools (CF Workers)
 *
 * Install, uninstall, and check install status for spike.land app store apps.
 * Proxies to spike.land API for install operations.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../../lazy-imports/types";
import { freeTool } from "../../../lazy-imports/procedures-index.ts";
import { apiRequest, safeToolCall, textResult } from "../../lib/tool-helpers";
import type { DrizzleDB } from "../../../db/db/db-index.ts";

export function registerStoreInstallTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // store_app_install
  registry.registerBuilt(
    t
      .tool("store_app_install", "Install a store app for the current user.", {
        slug: z.string().min(1).describe("The app slug"),
      })
      .meta({ category: "store-install", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_install", async () => {
          const result = await apiRequest<{
            appName: string;
            count: number;
          }>("/api/store/install", {
            method: "POST",
            body: JSON.stringify({ slug: input.slug }),
          });
          return textResult(
            `Installed "${result.appName}" successfully. Total installs: ${result.count}.`,
          );
        });
      }),
  );

  // store_app_uninstall
  registry.registerBuilt(
    t
      .tool("store_app_uninstall", "Uninstall a store app for the current user.", {
        slug: z.string().min(1).describe("The app slug"),
      })
      .meta({ category: "store-install", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_uninstall", async () => {
          const result = await apiRequest<{ appName: string }>(`/api/store/install/${input.slug}`, {
            method: "DELETE",
          });
          return textResult(`Uninstalled "${result.appName}" successfully.`);
        });
      }),
  );

  // store_app_install_status
  registry.registerBuilt(
    t
      .tool("store_app_install_status", "Check install status and count for a store app.", {
        slug: z.string().min(1).describe("The app slug"),
      })
      .meta({ category: "store-install", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_install_status", async () => {
          const result = await apiRequest<{
            count: number;
            installed: boolean;
          }>(`/api/store/install/${input.slug}/status`);

          return textResult(
            `## Install Status: ${input.slug}\n\nTotal installs: ${result.count}\nInstalled: ${
              result.installed ? "Yes" : "No"
            }`,
          );
        });
      }),
  );

  // store_app_install_list
  registry.registerBuilt(
    t
      .tool("store_app_install_list", "List all apps installed by the current user.", {})
      .meta({ category: "store-install", tier: "free" })
      .handler(async () => {
        return safeToolCall("store_app_install_list", async () => {
          const apps =
            await apiRequest<Array<{ name: string; slug: string }>>("/api/store/install/my");

          if (apps.length === 0) return textResult("No apps installed yet.");
          const list = apps.map((a) => `- **${a.name}** (/apps/store/${a.slug})`).join("\n");
          return textResult(`## Your Installed Apps\n\n${list}`);
        });
      }),
  );

  // store_app_install_count
  registry.registerBuilt(
    t
      .tool(
        "store_app_install_count",
        "Get the install count for a store app (public, no auth required).",
        {
          slug: z.string().min(1).describe("The app slug"),
        },
      )
      .meta({ category: "store-install", tier: "free" })
      .handler(async ({ input }) => {
        return safeToolCall("store_app_install_count", async () => {
          const result = await apiRequest<{ count: number }>(
            `/api/store/install/${input.slug}/count`,
          );
          return textResult(`Install count for "${input.slug}": ${result.count}`);
        });
      }),
  );
}
