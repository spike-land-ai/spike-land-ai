import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, jsonResult } from "@spike-land-ai/mcp-server-base";
import { readPackagesYaml } from "../../../../scripts/reorganize/utils.js";

export function registerStatusTool(server: McpServer): void {
  createZodTool(server, {
    name: "reorganize_status",
    description:
      "Show the current packages.yaml manifest with package names and their kind/category assignments.",
    schema: {},
    handler: async () => {
      const packagesYaml = await readPackagesYaml();

      const packages = Object.entries(packagesYaml).map(([name, meta]) => ({
        name,
        kind: meta.kind ?? "unspecified",
      }));

      return jsonResult({
        packageCount: packages.length,
        packages: packages.sort((a, b) => a.name.localeCompare(b.name)),
      });
    },
  });
}
