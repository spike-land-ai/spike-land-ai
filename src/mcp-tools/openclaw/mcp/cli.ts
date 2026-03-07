#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createMcpBridge } from "../core-logic/bridge.js";
import type { GatewayTransport } from "../core-logic/types.js";
import { createErrorShipper } from "@spike-land-ai/mcp-server-base";

const shipper = createErrorShipper();
process.on('uncaughtException', (err) => shipper.shipError({ service_name: "openclaw-mcp", message: err.message, stack_trace: err.stack, severity: "high" }));
process.on('unhandledRejection', (err: unknown) => shipper.shipError({ service_name: "openclaw-mcp", message: err instanceof Error ? err.message : String(err), stack_trace: err instanceof Error ? err.stack : undefined, severity: "high" }));

type CliPayload = { text?: string };

type CliResponse = {
  result?: { payloads?: CliPayload[] };
  error?: string;
};

function runCli(
  bin: string,
  args: string[],
  opts: { timeout?: number; maxBuffer?: number },
): Promise<{ stdout: string; stderr: string }> {
  return new Promise((resolve, reject) => {
    execFile(bin, args, { ...opts, encoding: "utf8" }, (error, stdout, stderr) => {
      if (error) {
        const enriched = error as Error & { stderr?: string };
        enriched.stderr = stderr;
        reject(enriched);
        return;
      }
      resolve({ stdout: stdout ?? "", stderr: stderr ?? "" });
    });
  });
}

export class CliTransport implements GatewayTransport {
  private readonly bin: string;

  constructor(bin = "openclaw") {
    this.bin = bin;
  }

  async request<T = Record<string, unknown>>(
    method: string,
    params?: unknown,
    _opts?: { expectFinal?: boolean },
  ): Promise<T> {
    if (method === "chat.send") {
      return this.chatSend(params) as Promise<T>;
    }

    if (method === "tools.list") {
      return { tools: [], sessionKey: "cli" } as T;
    }

    throw new Error(`Unsupported method: ${method}`);
  }

  private async chatSend(params: unknown): Promise<Record<string, unknown>> {
    const { sessionKey, message } = (params ?? {}) as {
      sessionKey?: string;
      message?: string;
    };

    if (!message) {
      throw new Error("message is required");
    }

    const args = ["agent", "--agent", "main", "--message", message, "--json", "--timeout", "30"];

    if (sessionKey) {
      args.push("--session-id", sessionKey);
    }

    const { stdout } = await runCli(this.bin, args, {
      timeout: 35_000,
      maxBuffer: 10 * 1024 * 1024,
    });

    const parsed = JSON.parse(stdout) as CliResponse;
    if (parsed.error) {
      throw new Error(`OpenClaw: ${parsed.error}`);
    }

    const text = parsed.result?.payloads?.[0]?.text ?? "(no response)";
    return {
      message: { content: [{ type: "text", text }] },
    };
  }
}

export async function main() {
  const transport = new CliTransport();
  const bridge = createMcpBridge({
    transport,
    serverInfo: { name: "openclaw-mcp", version: "0.1.0" },
    verbose: true,
  });

  await bridge.loadGatewayTools();
  await bridge.serve();
}

/* c8 ignore start */
const isDirectRun = process.argv[1]?.endsWith("/cli.ts") || process.argv[1]?.endsWith("/cli.js");
if (isDirectRun) {
  main().catch((err: unknown) => {
    process.stderr.write(`Fatal: ${err}\n`);
    process.exit(1);
  });
}
/* c8 ignore stop */
