/**
 * Store Install MCP Tools
 *
 * Install, uninstall, and check install status for spike.land app store apps.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import { STORE_APPS } from "@/app/store/data/store-apps";

const SlugSchema = z.object({
  slug: z.string().min(1).describe("The app slug"),
});

const EmptySchema = z.object({});

export function registerStoreInstallTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "store_app_install",
    description: "Install a store app for the current user",
    category: "store-install",
    tier: "free",
    inputSchema: SlugSchema.shape,
    handler: async ({
      slug,
    }: z.infer<typeof SlugSchema>): Promise<CallToolResult> =>
      safeToolCall("store_app_install", async () => {
        if (!userId) {
          return textResult("Authentication required to install apps.");
        }
        const app = STORE_APPS.find(a => a.slug === slug);
        if (!app) return textResult(`App "${slug}" not found.`);
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const { redis } = await import("@/lib/upstash/client");
          const existing = await prisma.storeAppInstall.findUnique({
            where: { appSlug_userId: { appSlug: slug, userId } },
          });
          if (!existing) {
            await prisma.storeAppInstall.create({ data: { appSlug: slug, userId } });
          }
          // Only increment Redis counter for genuinely new installs
          const isNewInstall = !existing;
          let count: number;
          if (isNewInstall) {
            const countKey = `install:count:${slug}`;
            count = await redis.incr(countKey);
            // Set a long TTL on first increment to prevent orphaned keys
            if (count === 1) {
              await redis.expire(countKey, 365 * 24 * 60 * 60); // 1 year
            }
          } else {
            count = (await redis.get<number>(`install:count:${slug}`)) ?? 0;
          }
          return textResult(
            `Installed "${app.name}" successfully. Total installs: ${count}.`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult("App installed (DB pending migration).");
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_app_uninstall",
    description: "Uninstall a store app for the current user",
    category: "store-install",
    tier: "free",
    inputSchema: SlugSchema.shape,
    handler: async ({
      slug,
    }: z.infer<typeof SlugSchema>): Promise<CallToolResult> =>
      safeToolCall("store_app_uninstall", async () => {
        if (!userId) {
          return textResult("Authentication required to uninstall apps.");
        }
        const app = STORE_APPS.find(a => a.slug === slug);
        if (!app) return textResult(`App "${slug}" not found.`);
        try {
          const prisma = (await import("@/lib/prisma")).default;
          await prisma.storeAppInstall.deleteMany({
            where: { appSlug: slug, userId },
          });
          try {
            const { redis } = await import("@/lib/upstash/client");
            await redis.decr(`install:count:${slug}`);
          } catch {
            // ignore redis errors on uninstall
          }
          return textResult(`Uninstalled "${app.name}" successfully.`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult("App uninstalled (DB pending migration).");
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_app_install_status",
    description: "Check install status and count for a store app",
    category: "store-install",
    tier: "free",
    inputSchema: SlugSchema.shape,
    handler: async ({
      slug,
    }: z.infer<typeof SlugSchema>): Promise<CallToolResult> =>
      safeToolCall("store_app_install_status", async () => {
        try {
          const { redis } = await import("@/lib/upstash/client");
          const count = (await redis.get<number>(`install:count:${slug}`)) ?? 0;
          let installed = false;
          if (userId) {
            const prisma = (await import("@/lib/prisma")).default;
            const existing = await prisma.storeAppInstall.findUnique({
              where: { appSlug_userId: { appSlug: slug, userId } },
            });
            installed = !!existing;
          }
          const status = userId
            ? `Installed: ${installed ? "Yes" : "No"}\n`
            : "";
          return textResult(
            `## Install Status: ${slug}\n\nTotal installs: ${count}\n${status}`,
          );
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult(
              `Install status: count unknown (DB pending migration).`,
            );
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_app_install_list",
    description: "List all apps installed by the current user",
    category: "store-install",
    tier: "free",
    inputSchema: EmptySchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("store_app_install_list", async () => {
        if (!userId) return textResult("Authentication required.");
        try {
          const prisma = (await import("@/lib/prisma")).default;
          const installs = await prisma.storeAppInstall.findMany({
            where: { userId },
          });
          const slugs = installs.map((i: { appSlug: string; }) => i.appSlug);
          const apps = STORE_APPS.filter(a => slugs.includes(a.slug));
          if (apps.length === 0) return textResult("No apps installed yet.");
          const list = apps
            .map(a => `- **${a.name}** (/apps/store/${a.slug})`)
            .join("\n");
          return textResult(`## Your Installed Apps\n\n${list}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult(
              "Install list unavailable (DB pending migration).",
            );
          }
          throw err;
        }
      }),
  });

  registry.register({
    name: "store_app_install_count",
    description: "Get the install count for a store app (public, no auth required)",
    category: "store-install",
    tier: "free",
    inputSchema: SlugSchema.shape,
    handler: async ({
      slug,
    }: z.infer<typeof SlugSchema>): Promise<CallToolResult> =>
      safeToolCall("store_app_install_count", async () => {
        try {
          const { redis } = await import("@/lib/upstash/client");
          const count = (await redis.get<number>(`install:count:${slug}`)) ?? 0;
          return textResult(`Install count for "${slug}": ${count}`);
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (
            msg.includes("does not exist") || msg.includes("relation")
            || msg.includes("no such table")
          ) {
            return textResult(
              `Install count for "${slug}": 0 (DB pending migration).`,
            );
          }
          throw err;
        }
      }),
  });
}
