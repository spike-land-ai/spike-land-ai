import { z } from "zod";

export const ServiceInfoSchema = z.object({
  name: z.string().describe("Service name from docker-compose"),
  subdomain: z.string().describe("Assigned subdomain (e.g. 'api' for api.spike.local)"),
  port: z.number().int().describe("Container port"),
  type: z.enum(["worker", "frontend", "mcp", "backend", "database", "proxy"]).describe("Service type"),
  status: z.enum(["running", "stopped", "restarting", "exited", "created"]).describe("Container status"),
  containerId: z.string().optional().describe("Docker container ID"),
});

export type ServiceInfo = z.infer<typeof ServiceInfoSchema>;

export const SubdomainMappingSchema = z.object({
  subdomain: z.string().describe("Subdomain prefix (e.g. 'api')"),
  upstream: z.string().describe("Upstream container/host name"),
  port: z.number().int().describe("Upstream port"),
});

export type SubdomainMapping = z.infer<typeof SubdomainMappingSchema>;

export const HealthResultSchema = z.object({
  service: z.string().describe("Service name"),
  healthy: z.boolean().describe("Whether the service is healthy"),
  statusCode: z.number().int().optional().describe("HTTP status code from health check"),
  latencyMs: z.number().describe("Health check latency in milliseconds"),
  error: z.string().optional().describe("Error message if unhealthy"),
});

export type HealthResult = z.infer<typeof HealthResultSchema>;

export const ServiceLogsParamsSchema = z.object({
  service: z.string().describe("Service name to get logs for"),
  tail: z.number().int().min(1).max(1000).default(100).describe("Number of lines from the end"),
  since: z.string().optional().describe("Show logs since timestamp (e.g. '10m', '1h', '2024-01-01')"),
});

export type ServiceLogsParams = z.infer<typeof ServiceLogsParamsSchema>;
