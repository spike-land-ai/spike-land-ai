#!/usr/bin/env tsx
/**
 * Page Builder — Standalone MCP Server
 *
 * Provides tools for dynamic page lifecycle, block CRUD, AI page generation,
 * page review, templates, and SEO management.
 */

import type { AppServerFactory, ServerContext } from "../shared/types";
import { createAppServer } from "../shared/standalone-registry";
import { connectStdio } from "../shared/transport";
import { pageBuilderTools } from "./tools";

const meta = {
  name: "page-builder",
  slug: "page-builder",
  version: "0.1.0",
  toolCount: pageBuilderTools.length,
} as const;

const createServer: AppServerFactory = async (ctx: ServerContext) => {
  return createAppServer(meta.name, meta.version, pageBuilderTools, ctx);
};
createServer.tools = pageBuilderTools;
createServer.meta = meta;

export default createServer;

/* ── Self-running guard ─────────────────────────────────────────────── */

if (import.meta.url === `file://${process.argv[1]}`) {
  const ctx: ServerContext = {
    userId: process.env.USER_ID ?? "anonymous",
    env: process.env as Record<string, string | undefined>,
    calledTools: new Set<string>(),
  };
  createServer(ctx).then((server) => connectStdio(server));
}
