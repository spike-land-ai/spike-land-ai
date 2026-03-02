import { describe, it, expect, vi, beforeEach } from "vitest";
import { runCommand, hasScript } from "./shell.js";
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";

vi.mock("node:child_process", () => ({
  execFile: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: vi.fn(),
}));

describe("shell helper", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("runCommand", () => {
    it("returns ok: true when command succeeds", async () => {
      // @ts-ignore
      vi.mocked(execFile).mockImplementation((cmd, args, options, callback) => {
        callback(null, "success", "");
      });

      const result = await runCommand("echo", ["hi"], "/tmp");
      expect(result.ok).toBe(true);
      expect(result.stdout).toBe("success");
      expect(result.code).toBe(0);
    });

    it("returns ok: false when command fails", async () => {
      // @ts-ignore
      vi.mocked(execFile).mockImplementation((cmd, args, options, callback) => {
        const err = new Error("fail");
        (err as any).code = 127;
        callback(err, "", "not found");
      });

      const result = await runCommand("invalid", [], "/tmp");
      expect(result.ok).toBe(false);
      expect(result.stderr).toBe("not found");
      expect(result.code).toBe(127);
    });

    it("handles errors without code", async () => {
      // @ts-ignore
      vi.mocked(execFile).mockImplementation((cmd, args, options, callback) => {
        callback(new Error("no code"), "", "err");
      });

      const result = await runCommand("cmd", [], "/tmp");
      expect(result.ok).toBe(false);
      expect(result.code).toBe(1);
    });
  });

  describe("hasScript", () => {
    it("returns true if script exists", async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        scripts: { test: "vitest" }
      }));

      const result = await hasScript("/pkg", "test");
      expect(result).toBe(true);
    });

    it("returns false if script missing", async () => {
      vi.mocked(readFile).mockResolvedValue(JSON.stringify({
        scripts: { build: "tsc" }
      }));

      const result = await hasScript("/pkg", "test");
      expect(result).toBe(false);
    });

    it("returns false if package.json missing or invalid", async () => {
      vi.mocked(readFile).mockRejectedValue(new Error("ENOENT"));

      const result = await hasScript("/pkg", "test");
      expect(result).toBe(false);
    });
  });
});
