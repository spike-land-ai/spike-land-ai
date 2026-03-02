/**
 * CLI-based transport for OpenClaw gateway.
 *
 * The gateway uses WebSocket with device-identity handshake, so we delegate
 * to the `openclaw` CLI which handles all of that.
 */

import { execFile } from "node:child_process";

export interface GatewayTransport {
  request<T = Record<string, unknown>>(
    method: string,
    params?: unknown,
    opts?: { expectFinal?: boolean },
  ): Promise<T>;
}

type CliPayload = {
  text?: string;
};

type CliResponse = {
  result?: {
    payloads?: CliPayload[];
  };
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

export class CliGatewayTransport implements GatewayTransport {
  private readonly cliBin: string;

  constructor(cliBin = "openclaw") {
    this.cliBin = cliBin;
  }

  async request<T = Record<string, unknown>>(
    method: string,
    params?: unknown,
    _opts?: { expectFinal?: boolean },
  ): Promise<T> {
    if (method !== "chat.send") {
      throw new Error(`CliGatewayTransport only supports chat.send, got: ${method}`);
    }

    const { sessionKey, message } = (params ?? {}) as {
      sessionKey?: string;
      message?: string;
    };

    if (!message) {
      throw new Error("message is required for chat.send");
    }

    const args = ["agent", "--agent", "main", "--message", message, "--json", "--timeout", "30"];

    if (sessionKey) {
      args.push("--session-id", sessionKey);
    }

    let stdout: string;
    try {
      const result = await runCli(this.cliBin, args, {
        timeout: 35_000,
        maxBuffer: 10 * 1024 * 1024,
      });
      stdout = result.stdout;
    } catch (err: unknown) {
      const execErr = err as {
        code?: string;
        stderr?: string;
        message?: string;
      };
      if (execErr.code === "ENOENT") {
        throw new Error(`openclaw CLI not found at: ${this.cliBin}`);
      }
      throw new Error(`openclaw CLI failed: ${execErr.stderr || execErr.message || String(err)}`);
    }

    let parsed: CliResponse;
    try {
      parsed = JSON.parse(stdout) as CliResponse;
    } catch {
      throw new Error(`Invalid JSON from openclaw CLI: ${stdout.slice(0, 200)}`);
    }

    if (parsed.error) {
      throw new Error(`OpenClaw error: ${parsed.error}`);
    }

    const text = parsed.result?.payloads?.[0]?.text ?? "(no response)";

    return {
      message: {
        content: [{ type: "text", text }],
      },
    } as T;
  }
}

export function isGatewayConfigured(): boolean {
  return !!process.env.OPENCLAW_GATEWAY_URL;
}

export function createGatewayTransport(): CliGatewayTransport {
  if (!process.env.OPENCLAW_GATEWAY_URL) {
    throw new Error("Missing required environment variable: OPENCLAW_GATEWAY_URL");
  }

  return new CliGatewayTransport();
}
