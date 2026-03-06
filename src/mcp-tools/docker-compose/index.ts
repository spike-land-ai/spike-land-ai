#!/usr/bin/env node
import { createMcpServer, startMcpServer, wrapServerWithLogging, registerFeedbackTool, createErrorShipper } from "@spike-land-ai/mcp-server-base";
import { registerServiceTools } from "./mcp/services.js";
import { registerSubdomainTools } from "./mcp/subdomains.js";

const server = createMcpServer({ name: "docker-compose-mcp", version: "0.1.0" });

const shipper = createErrorShipper();
process.on('uncaughtException', (err) => shipper.shipError({ service_name: "docker-compose-mcp", message: err.message, stack_trace: err.stack, severity: "high" }));
process.on('unhandledRejection', (err: unknown) => shipper.shipError({ service_name: "docker-compose-mcp", message: err instanceof Error ? err.message : String(err), stack_trace: err instanceof Error ? err.stack : undefined, severity: "high" }));

wrapServerWithLogging(server, "docker-compose-mcp");
registerServiceTools(server);
registerSubdomainTools(server);
registerFeedbackTool(server, { serviceName: "docker-compose-mcp", toolName: "docker_compose_feedback" });

export { server };
export default server;

// When run directly (not imported by HTTP bridge), connect to stdio
const isDirectRun = process.argv[1]?.endsWith("docker-compose/index.ts") ||
  process.argv[1]?.endsWith("docker-compose/index.js");
if (isDirectRun) {
  await startMcpServer(server);
}
