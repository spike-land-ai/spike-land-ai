import { afterEach, describe, expect, it, vi } from "vitest";

const mockExecFile = vi.hoisted(() => vi.fn());

vi.mock("node:child_process", async importOriginal => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const mocked = { ...actual, execFile: mockExecFile };
  return { ...mocked, default: mocked };
});

import {
  CliGatewayTransport,
  createGatewayTransport,
  isGatewayConfigured,
} from "./http-transport";

afterEach(() => {
  mockExecFile.mockReset();
  vi.unstubAllEnvs();
});

type ExecCallback = (
  error: (Error & { code?: string; stderr?: string; }) | null,
  stdout: string,
  stderr: string,
) => void;

function mockCliSuccess(output: unknown): void {
  mockExecFile.mockImplementation(
    (
      _bin: string,
      _args: string[],
      _opts: Record<string, unknown>,
      callback: ExecCallback,
    ) => {
      callback(null, JSON.stringify(output), "");
    },
  );
}

function mockCliError(
  error: Error & { code?: string; stderr?: string; },
): void {
  mockExecFile.mockImplementation(
    (
      _bin: string,
      _args: string[],
      _opts: Record<string, unknown>,
      callback: ExecCallback,
    ) => {
      callback(error, "", "");
    },
  );
}

describe("CliGatewayTransport", () => {
  it("calls openclaw CLI with correct arguments", async () => {
    mockCliSuccess({ result: { payloads: [{ text: "hello" }] } });

    const transport = new CliGatewayTransport();
    await transport.request("chat.send", {
      sessionKey: "test-session",
      message: "ping",
    });

    expect(mockExecFile).toHaveBeenCalledOnce();
    const [bin, args] = mockExecFile.mock.calls[0] as [string, string[]];
    expect(bin).toBe("openclaw");
    expect(args).toEqual([
      "agent",
      "--agent",
      "main",
      "--message",
      "ping",
      "--json",
      "--timeout",
      "30",
      "--session-id",
      "test-session",
    ]);
  });

  it("parses CLI JSON response and extracts text", async () => {
    mockCliSuccess({ result: { payloads: [{ text: "world" }] } });

    const transport = new CliGatewayTransport();
    const result = await transport.request<{
      message: { content: Array<{ type: string; text: string; }>; };
    }>("chat.send", { message: "hello" });

    expect(result).toEqual({
      message: {
        content: [{ type: "text", text: "world" }],
      },
    });
  });

  it("returns (no response) when payloads are empty", async () => {
    mockCliSuccess({ result: { payloads: [] } });

    const transport = new CliGatewayTransport();
    const result = await transport.request<{
      message: { content: Array<{ type: string; text: string; }>; };
    }>("chat.send", { message: "hello" });

    expect(result.message.content[0]!.text).toBe("(no response)");
  });

  it("returns (no response) when result is missing", async () => {
    mockCliSuccess({});

    const transport = new CliGatewayTransport();
    const result = await transport.request<{
      message: { content: Array<{ type: string; text: string; }>; };
    }>("chat.send", { message: "hello" });

    expect(result.message.content[0]!.text).toBe("(no response)");
  });

  it("throws for unsupported methods", async () => {
    const transport = new CliGatewayTransport();
    await expect(transport.request("tools.list")).rejects.toThrow(
      "CliGatewayTransport only supports chat.send",
    );
  });

  it("throws when message is missing", async () => {
    const transport = new CliGatewayTransport();
    await expect(
      transport.request("chat.send", { sessionKey: "s1" }),
    ).rejects.toThrow("message is required for chat.send");
  });

  it("throws when CLI binary is not found (ENOENT)", async () => {
    const err = Object.assign(new Error("spawn openclaw ENOENT"), {
      code: "ENOENT",
    });
    mockCliError(err);

    const transport = new CliGatewayTransport();
    await expect(
      transport.request("chat.send", { message: "hello" }),
    ).rejects.toThrow("openclaw CLI not found at: openclaw");
  });

  it("throws on non-zero exit with stderr", async () => {
    mockExecFile.mockImplementation(
      (
        _bin: string,
        _args: string[],
        _opts: Record<string, unknown>,
        callback: ExecCallback,
      ) => {
        const err = new Error("exit code 1");
        callback(err, "", "agent not found");
      },
    );

    const transport = new CliGatewayTransport();
    await expect(
      transport.request("chat.send", { message: "hello" }),
    ).rejects.toThrow("openclaw CLI failed: agent not found");
  });

  it("throws on invalid JSON output", async () => {
    mockExecFile.mockImplementation(
      (
        _bin: string,
        _args: string[],
        _opts: Record<string, unknown>,
        callback: ExecCallback,
      ) => {
        callback(null, "not-json-at-all", "");
      },
    );

    const transport = new CliGatewayTransport();
    await expect(
      transport.request("chat.send", { message: "hello" }),
    ).rejects.toThrow("Invalid JSON from openclaw CLI");
  });

  it("throws when CLI response contains error field", async () => {
    mockCliSuccess({ error: "session expired" });

    const transport = new CliGatewayTransport();
    await expect(
      transport.request("chat.send", { message: "hello" }),
    ).rejects.toThrow("OpenClaw error: session expired");
  });

  it("uses custom CLI binary path", async () => {
    mockCliSuccess({ result: { payloads: [{ text: "ok" }] } });

    const transport = new CliGatewayTransport("/usr/local/bin/openclaw");
    await transport.request("chat.send", { message: "test" });

    expect(mockExecFile.mock.calls[0]![0]).toBe("/usr/local/bin/openclaw");
  });
});

describe("isGatewayConfigured", () => {
  it("returns true when OPENCLAW_GATEWAY_URL is set", () => {
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789");
    expect(isGatewayConfigured()).toBe(true);
  });

  it("returns false when OPENCLAW_GATEWAY_URL is missing", () => {
    expect(isGatewayConfigured()).toBe(false);
  });

  it("returns false when OPENCLAW_GATEWAY_URL is empty", () => {
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "");
    expect(isGatewayConfigured()).toBe(false);
  });
});

describe("createGatewayTransport", () => {
  it("creates a transport when OPENCLAW_GATEWAY_URL is set", () => {
    vi.stubEnv("OPENCLAW_GATEWAY_URL", "ws://127.0.0.1:18789");

    const transport = createGatewayTransport();
    expect(transport).toBeInstanceOf(CliGatewayTransport);
  });

  it("throws when OPENCLAW_GATEWAY_URL is missing", () => {
    expect(() => createGatewayTransport()).toThrow(
      "Missing required environment variable: OPENCLAW_GATEWAY_URL",
    );
  });
});
