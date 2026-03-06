import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { createZodTool, jsonResult, errorResult, tryCatch } from "@spike-land-ai/mcp-server-base";
import { ServiceRegistry } from "../core-logic/service-registry.js";
import { HealthChecker } from "../core-logic/health-checker.js";

export function registerServiceTools(server: McpServer): void {
  const registry = new ServiceRegistry();
  const checker = new HealthChecker();

  createZodTool(server, {
    name: "docker_compose_list_services",
    description: "List all spike.land Docker Compose services with their status, subdomain, port, and type",
    schema: {},
    async handler() {
      const result = await tryCatch(registry.listServices());
      if (!result.ok) return errorResult("DOCKER_ERROR", result.error.message, true);
      return jsonResult(result.data);
    },
  });

  createZodTool(server, {
    name: "docker_compose_service_health",
    description: "Health check a running Docker Compose service by name",
    schema: {
      service: z.string().describe("Service name to health check"),
    },
    async handler({ service }) {
      const servicesResult = await tryCatch(registry.listServices());
      if (!servicesResult.ok) return errorResult("DOCKER_ERROR", servicesResult.error.message, true);

      const svc = servicesResult.data.find(
        (s) => s.name === service || s.subdomain === service,
      );
      if (!svc) return errorResult("NOT_FOUND", `Service "${service}" not found`);
      if (svc.status !== "running") {
        return jsonResult({ service: svc.name, healthy: false, latencyMs: 0, error: `Service is ${svc.status}` });
      }

      const health = await checker.check(svc.name, svc.name, svc.port);
      return jsonResult(health);
    },
  });

  createZodTool(server, {
    name: "docker_compose_start_service",
    description: "Start a Docker Compose service (docker compose up -d <service>)",
    schema: {
      service: z.string().describe("Service name to start"),
    },
    async handler({ service }) {
      const result = await tryCatch(registry.execCompose("up", service));
      if (!result.ok) return errorResult("COMPOSE_ERROR", result.error.message, true);
      return jsonResult({ action: "start", service, output: result.data });
    },
  });

  createZodTool(server, {
    name: "docker_compose_stop_service",
    description: "Stop a Docker Compose service",
    schema: {
      service: z.string().describe("Service name to stop"),
    },
    async handler({ service }) {
      const result = await tryCatch(registry.execCompose("stop", service));
      if (!result.ok) return errorResult("COMPOSE_ERROR", result.error.message, true);
      return jsonResult({ action: "stop", service, output: result.data });
    },
  });

  createZodTool(server, {
    name: "docker_compose_restart_service",
    description: "Restart a Docker Compose service",
    schema: {
      service: z.string().describe("Service name to restart"),
    },
    async handler({ service }) {
      const result = await tryCatch(registry.execCompose("restart", service));
      if (!result.ok) return errorResult("COMPOSE_ERROR", result.error.message, true);
      return jsonResult({ action: "restart", service, output: result.data });
    },
  });

  createZodTool(server, {
    name: "docker_compose_service_logs",
    description: "Get recent logs from a Docker Compose service",
    schema: {
      service: z.string().describe("Service name to get logs for"),
      tail: z.number().int().min(1).max(1000).default(100).describe("Number of lines from the end"),
      since: z.string().optional().describe("Show logs since timestamp (e.g. '10m', '1h')"),
    },
    async handler({ service, tail, since }) {
      const result = await tryCatch(registry.getLogs(service, tail, since));
      if (!result.ok) return errorResult("COMPOSE_ERROR", result.error.message, true);
      return { content: [{ type: "text" as const, text: result.data }] };
    },
  });
}
