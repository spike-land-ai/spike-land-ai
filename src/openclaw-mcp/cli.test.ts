import { describe, expect, it, vi } from "vitest";
import { execFile } from "node:child_process";
import { CliTransport } from "./cli.js";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

describe("CliTransport", () => {
  it("should return empty tools list", async () => {
    const transport = new CliTransport();
    const result = await transport.request("tools.list");
    expect(result).toEqual({ tools: [], sessionKey: "cli" });
  });

  it("should throw for unsupported method", async () => {
    const transport = new CliTransport();
    await expect(transport.request("invalid")).rejects.toThrow("Unsupported method");
  });

  it("should throw if message is missing in chat.send", async () => {
    const transport = new CliTransport();
    await expect(transport.request("chat.send", {})).rejects.toThrow("message is required");
  });

  it("should send chat message via CLI", async () => {
    const transport = new CliTransport("custom-bin");
    const mockOutput = {
      result: { payloads: [{ text: "hello from cli" }] },
    };

    vi.mocked(execFile).mockImplementation((_bin, _args, _opts, cb) => {
      (cb as Parameters<typeof execFile>[3])(null, JSON.stringify(mockOutput), "");
      return {} as ReturnType<typeof execFile>;
    });

    const result = (await transport.request("chat.send", {
      message: "hi",
      sessionKey: "sess1",
    })) as { message: { content: Array<{ type: string; text: string }> } };
    expect(result.message.content[0]?.text).toBe("hello from cli");
    expect(execFile).toHaveBeenCalledWith(
      "custom-bin",
      expect.arrayContaining(["--message", "hi", "--session-id", "sess1"]),
      expect.any(Object),
      expect.any(Function),
    );
  });

  it("should handle CLI error response", async () => {
    const transport = new CliTransport();
    vi.mocked(execFile).mockImplementation((_bin, _args, _opts, cb) => {
      (cb as Parameters<typeof execFile>[3])(null, JSON.stringify({ error: "CLI Crashed" }), "");
      return {} as ReturnType<typeof execFile>;
    });

    await expect(transport.request("chat.send", { message: "hi" })).rejects.toThrow(
      "OpenClaw: CLI Crashed",
    );
  });

  it("should handle execFile error", async () => {
    const transport = new CliTransport();
    vi.mocked(execFile).mockImplementation((_bin, _args, _opts, cb) => {
      (cb as Parameters<typeof execFile>[3])(new Error("Spawn error"), "", "some stderr");
      return {} as ReturnType<typeof execFile>;
    });

    await expect(transport.request("chat.send", { message: "hi" })).rejects.toThrow("Spawn error");
  });

  it("should handle empty payloads response", async () => {
    const transport = new CliTransport();
    vi.mocked(execFile).mockImplementation((_bin, _args, _opts, cb) => {
      (cb as Parameters<typeof execFile>[3])(
        null,
        JSON.stringify({ result: { payloads: [] } }),
        "",
      );
      return {} as ReturnType<typeof execFile>;
    });

    const result = (await transport.request("chat.send", { message: "hi" })) as {
      message: { content: Array<{ type: string; text: string }> };
    };
    expect(result.message.content[0]?.text).toBe("(no response)");
  });
});
