/**
 * Build From GitHub MCP Tools (CF Workers)
 *
 * Trigger esbuild compilation from GitHub repository sources.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import type { DrizzleDB } from "../db/index";
import { freeTool } from "../procedures/index";
import { textResult } from "./tool-helpers";

export function registerBuildFromGithubTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "build_from_github",
        "Build a JavaScript/TypeScript package from a GitHub repository using esbuild.",
        {
          repo: z.string().describe("GitHub repository (owner/repo)"),
          branch: z.string().optional().default("main").describe("Branch to build"),
          entry: z.string().optional().describe("Entry file path (defaults to package.json main)"),
          format: z
            .enum(["esm", "cjs", "iife"])
            .optional()
            .default("esm")
            .describe("Output module format"),
        },
      )
      .meta({ category: "esbuild", tier: "workspace" })
      .handler(async ({ input: _input, ctx: _ctx }) => {
        return textResult(
          "build_from_github is not yet fully implemented in CF Workers mode. " +
            "Use the esbuild tools to build from local source instead.",
        );
      }),
  );
}
