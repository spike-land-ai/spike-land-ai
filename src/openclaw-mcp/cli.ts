#!/usr/bin/env node

import { execFile } from "node:child_process";
import { createMcpBridge } from "./bridge.js";
import type { GatewayTransport } from "./types.js";

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

async function main() {
  const transport = new CliTransport();
  const bridge = createMcpBridge({
    transport,
    serverInfo: { name: "openclaw-mcp", version: "0.1.0" },
    verbose: true,
  });

  await bridge.loadGatewayTools();
  await bridge.serve();
}

main().catch((err: unknown) => {
  process.stderr.write(`Fatal: ${err}\n`);
  process.exit(1);
});
