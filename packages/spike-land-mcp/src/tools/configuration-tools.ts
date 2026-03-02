/**
 * Configuration MCP Tools (CF Workers)
 *
 * Environment and runtime configuration tools.
 * Note: registerSettingsTools lives in settings.ts (API key management).
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import type { DrizzleDB } from "../db/index";
import { freeTool } from "../procedures/index";

export function registerEnvironmentTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool("get_environment", "Get current platform environment and runtime information.", {})
      .meta({ category: "env", tier: "free" })
      .handler(async ({ input: _input, ctx: _ctx }) => {
        const info = {
          platform: "Cloudflare Workers",
          runtime: "Edge",
          region: "Global",
          mcpVersion: "1.0.0",
        };
        return {
          content: [
            {
              type: "text" as const,
              text: `**Environment:**\n\`\`\`json\n${JSON.stringify(info, null, 2)}\n\`\`\``,
            },
          ],
        };
      }),
  );

  registry.registerBuilt(
    t
      .tool("get_feature_flags", "Get enabled feature flags for the current user.", {
        category: z.string().optional().describe("Filter flags by category"),
      })
      .meta({ category: "env", tier: "free" })
      .handler(async ({ input: _input, ctx: _ctx }) => {
        return {
          content: [
            {
              type: "text" as const,
              text: "**Feature Flags:** All features enabled by default in CF Workers deployment.",
            },
          ],
        };
      }),
  );
}
