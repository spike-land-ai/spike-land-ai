import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, jsonResult, errorResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import { CaddyAdminClient } from "../core-logic/caddy-admin.js";

export function registerSubdomainTools(server: McpServer): void {
  const caddy = new CaddyAdminClient();

  createZodTool(server, {
    name: "docker_compose_register_subdomain",
    description: "Register a subdomain route in Caddy reverse proxy (e.g. api.spike.local -> api:8080)",
    schema: {
      subdomain: z.string().describe("Subdomain prefix (e.g. 'api' for api.spike.local)"),
      upstream: z.string().describe("Upstream container/host name"),
      port: z.number().int().describe("Upstream port"),
    },
    async handler({ subdomain, upstream, port }) {
      const result = await tryCatch(caddy.addRoute(subdomain, upstream, port));
      if (!result.ok) return errorResult("CADDY_ERROR", result.error.message, true);
      return jsonResult({ registered: true, subdomain: `${subdomain}.spike.local`, upstream, port });
    },
  });

  createZodTool(server, {
    name: "docker_compose_list_subdomains",
    description: "List all registered subdomain routes in Caddy reverse proxy",
    schema: {},
    async handler() {
      const result = await tryCatch(caddy.listRoutes());
      if (!result.ok) return errorResult("CADDY_ERROR", result.error.message, true);
      return jsonResult(result.data);
    },
  });
}
