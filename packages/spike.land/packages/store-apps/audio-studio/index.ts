#!/usr/bin/env tsx
/**
 * Audio Studio — Standalone MCP Server
 *
 * Provides 13 tools for audio project & track lifecycle management,
 * effects processing, waveform visualization, and mix export.
 */

import type { AppServerFactory, ServerContext } from "../shared/types";
import { createAppServer } from "../shared/standalone-registry";
import { connectStdio } from "../shared/transport";
import { audioStudioTools } from "./tools";

const meta = {
  name: "audio-studio",
  slug: "audio-studio",
  version: "0.1.0",
  toolCount: audioStudioTools.length,
} as const;

const createServer: AppServerFactory = async (ctx: ServerContext) => {
  return createAppServer(meta.name, meta.version, audioStudioTools, ctx);
};
createServer.tools = audioStudioTools;
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
