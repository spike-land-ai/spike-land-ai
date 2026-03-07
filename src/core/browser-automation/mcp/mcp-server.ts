#!/usr/bin/env node

/**
 * QA Studio Web Reader MCP Server
 *
 * Exposes websites as screen-reader-style narrated text via 10 MCP tools.
 * Usage: node mcp-server.js [--visible] [--http] [--port <port>] [--host <host>]
 */

import {
  createMcpServer,
  startMcpServer,
} from "@spike-land-ai/mcp-server-base";

import { setBrowserConfig, cleanup } from "../core-logic/browser-session.js";
import { registerWebTools } from "./tools.js";
import { startHttpServer } from "../lazy-imports/http-server.js";

const args = process.argv.slice(2);
const visible = args.includes("--visible");
const isHttp = args.includes("--http");

const portArgIndex = args.indexOf("--port");
const port = portArgIndex !== -1 ? parseInt(args[portArgIndex + 1] || "3100", 10) : 3100;

const hostArgIndex = args.indexOf("--host");
const host = hostArgIndex !== -1 ? args[hostArgIndex + 1] || "127.0.0.1" : "127.0.0.1";

if (visible) {
  setBrowserConfig({ headless: false });
}

const server = createMcpServer({
  name: "qa-studio-web-reader",
  version: "0.1.0",
});

registerWebTools(server);

process.on("SIGINT", () => {
  void cleanup().then(() => process.exit(0));
});

process.on("SIGTERM", () => {
  void cleanup().then(() => process.exit(0));
});

if (isHttp) {
  startHttpServer(server, port, host);
} else {
  startMcpServer(server).catch(console.error);
}
