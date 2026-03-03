// @vitest-environment node
import { afterEach, describe, expect, it, vi } from "vitest";
import path from "path";

const mockInitialize = vi.fn();

vi.mock("@spike-land-ai/esbuild-wasm", () => ({
  initialize: mockInitialize,
}));

vi.mock("fs", () => ({
  default: { existsSync: vi.fn(() => false) },
  existsSync: vi.fn(() => false),
}));

import fs from "fs";
import { ensureEsbuildReady, resetEsbuild, resolveEsbuildBinary } from "./esbuild-init";

describe("esbuild-init", () => {
  afterEach(() => {
    resetEsbuild();
    vi.clearAllMocks();
    delete process.env.ESBUILD_BINARY_PATH;
  });

  it("should call initialize once", async () => {
    mockInitialize.mockResolvedValue(undefined);
    await ensureEsbuildReady();
    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it("should not call initialize twice", async () => {
    mockInitialize.mockResolvedValue(undefined);
    await ensureEsbuildReady();
    await ensureEsbuildReady();
    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  it("should handle already-initialized error gracefully", async () => {
    mockInitialize.mockRejectedValue(
      new Error("Cannot call \"initialize\" more than once"),
    );
    await expect(ensureEsbuildReady()).resolves.toBeUndefined();
  });

  it("should rethrow non-initialize errors", async () => {
    mockInitialize.mockRejectedValue(new Error("WASM load failed"));
    await expect(ensureEsbuildReady()).rejects.toThrow("WASM load failed");
  });

  it("should allow retry after non-initialize error", async () => {
    mockInitialize.mockRejectedValueOnce(new Error("Network failure"));
    await expect(ensureEsbuildReady()).rejects.toThrow("Network failure");

    resetEsbuild();
    mockInitialize.mockResolvedValue(undefined);
    await expect(ensureEsbuildReady()).resolves.toBeUndefined();
    expect(mockInitialize).toHaveBeenCalledTimes(2);
  });

  it("should reuse the same promise for concurrent calls", async () => {
    mockInitialize.mockResolvedValue(undefined);

    const p1 = ensureEsbuildReady();
    const p2 = ensureEsbuildReady();
    await Promise.all([p1, p2]);

    expect(mockInitialize).toHaveBeenCalledTimes(1);
  });

  describe("resetEsbuild", () => {
    it("should allow re-initialization after reset", async () => {
      mockInitialize.mockResolvedValue(undefined);
      await ensureEsbuildReady();

      resetEsbuild();
      vi.clearAllMocks();
      mockInitialize.mockResolvedValue(undefined);
      await ensureEsbuildReady();
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });
  });

  describe("resolveEsbuildBinary", () => {
    it("should return path when binary exists at node_modules/ location", () => {
      const nmPath = path.join(
        process.cwd(),
        "node_modules",
        "@spike-land-ai",
        "esbuild-wasm",
        "bin",
        "esbuild",
      );
      vi.mocked(fs.existsSync).mockImplementation(p => p === nmPath);

      expect(resolveEsbuildBinary()).toBe(nmPath);
    });

    it("should return null when binary not found at any location", () => {
      vi.mocked(fs.existsSync).mockReturnValue(false);
      expect(resolveEsbuildBinary()).toBeNull();
    });

    it("should return null when existsSync throws", () => {
      vi.mocked(fs.existsSync).mockImplementation(() => {
        throw new Error("permission denied");
      });
      expect(resolveEsbuildBinary()).toBeNull();
    });
  });

  describe("ESBUILD_BINARY_PATH env var", () => {
    it("should set ESBUILD_BINARY_PATH when binary is found on server", async () => {
      const expected = path.join(
        process.cwd(),
        "node_modules",
        "@spike-land-ai",
        "esbuild-wasm",
        "bin",
        "esbuild",
      );
      vi.mocked(fs.existsSync).mockImplementation(p => p === expected);
      mockInitialize.mockResolvedValue(undefined);

      await ensureEsbuildReady();

      expect(process.env.ESBUILD_BINARY_PATH).toBe(expected);
    });

    it("should NOT override existing ESBUILD_BINARY_PATH", async () => {
      process.env.ESBUILD_BINARY_PATH = "/custom/path/to/esbuild";
      vi.mocked(fs.existsSync).mockReturnValue(true);
      mockInitialize.mockResolvedValue(undefined);

      await ensureEsbuildReady();

      expect(process.env.ESBUILD_BINARY_PATH).toBe("/custom/path/to/esbuild");
    });
  });
});
