import chokidar, { type FSWatcher } from "chokidar";
import { existsSync, mkdirSync } from "fs";
import { readFile, writeFile } from "fs/promises";
import path from "path";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { pullCode, pushCode, withRetry } from "../sync.js";
import * as watcher from "../watcher.js";

// Mock dependencies
vi.mock("fs");
vi.mock("fs/promises");
vi.mock("chokidar");
vi.mock("../sync");

describe("Watcher Module", () => {
  const mockWatcher: Pick<FSWatcher, "on" | "close"> = {
    on: vi.fn(),
    close: vi.fn(),
  };

  beforeEach(() => {
    vi.resetAllMocks();
    vi.mocked(chokidar.watch).mockReturnValue(mockWatcher as FSWatcher);
    vi.mocked(withRetry).mockImplementation(async (fn: () => Promise<unknown>) => fn());
    vi.mocked(mockWatcher.close).mockResolvedValue(undefined as never);
  });

  describe("getLiveDir", () => {
    it("should return live directory path", () => {
      const dir = watcher.getLiveDir();
      expect(dir).toBe(path.join(process.cwd(), "live"));
    });
  });

  describe("getLocalPath", () => {
    it("should return local file path", () => {
      const filePath = watcher.getLocalPath("test-code");
      expect(filePath).toBe(path.join(process.cwd(), "live", "test-code.tsx"));
    });

    it("should sanitize codespace id", () => {
      const filePath = watcher.getLocalPath("test/code");
      expect(filePath).toBe(path.join(process.cwd(), "live", "test-code.tsx"));
    });
  });

  describe("ensureLiveDir", () => {
    it("should create directory if it does not exist", () => {
      vi.mocked(existsSync).mockReturnValue(false);
      watcher.ensureLiveDir();
      expect(mkdirSync).toHaveBeenCalledWith(expect.stringContaining("live"), {
        recursive: true,
      });
    });

    it("should not create directory if it exists", () => {
      vi.mocked(existsSync).mockReturnValue(true);
      watcher.ensureLiveDir();
      expect(mkdirSync).not.toHaveBeenCalled();
    });
  });

  describe("downloadToLocal", () => {
    it("should download code and save to file", async () => {
      vi.mocked(pullCode).mockResolvedValue("code content");
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await watcher.downloadToLocal("code1");

      expect(result).toContain("code1.tsx");
      expect(pullCode).toHaveBeenCalledWith("code1");
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("code1.tsx"),
        "code content",
        "utf-8",
      );
      expect(writeFile).toHaveBeenCalledWith(
        expect.stringContaining("code1.meta.json"),
        expect.any(String),
        "utf-8",
      );
    });

    it("should propagate pullCode errors", async () => {
      vi.mocked(pullCode).mockRejectedValue(new Error("fetch failed"));
      vi.mocked(existsSync).mockReturnValue(true);

      await expect(watcher.downloadToLocal("code1")).rejects.toThrow("fetch failed");
    });

    it("should write valid JSON metadata with correct fields", async () => {
      vi.mocked(pullCode).mockResolvedValue("hello code");
      vi.mocked(existsSync).mockReturnValue(true);

      await watcher.downloadToLocal("space-x");

      const metaCall = vi
        .mocked(writeFile)
        .mock.calls.find(([p]) => String(p).includes(".meta.json"));
      expect(metaCall).toBeDefined();
      const meta = JSON.parse(String(metaCall![1]));
      expect(meta.codespaceId).toBe("space-x");
      expect(meta.originalLength).toBe(10);
      expect(meta.downloadedAt).toBeTruthy();
    });
  });

  describe("watchCodespace", () => {
    it("should start watching file", () => {
      const w = watcher.watchCodespace("code1");

      expect(w.codespaceId).toBe("code1");
      expect(w.watcher).toBe(mockWatcher);
      expect(mockWatcher.on).toHaveBeenCalledWith("change", expect.any(Function));
      expect(mockWatcher.on).toHaveBeenCalledWith("error", expect.any(Function));
    });

    it("should sync changes when file changes", async () => {
      vi.useFakeTimers();
      watcher.watchCodespace("code1", { debounceMs: 100 });

      const changeHandler = vi
        .mocked(mockWatcher.on)
        .mock.calls.find((call) => call[0] === "change")![1];

      vi.mocked(readFile).mockResolvedValue("new code");
      changeHandler();
      await vi.advanceTimersByTimeAsync(100);

      expect(readFile).toHaveBeenCalled();
      expect(pushCode).toHaveBeenCalledWith("code1", "new code");
      vi.useRealTimers();
    });

    it("should call onSync callback after successful sync", async () => {
      vi.useFakeTimers();
      const onSync = vi.fn();
      watcher.watchCodespace("code1", { debounceMs: 50, onSync });

      const changeHandler = vi
        .mocked(mockWatcher.on)
        .mock.calls.find((call) => call[0] === "change")![1];

      vi.mocked(readFile).mockResolvedValue("synced code");
      vi.mocked(pushCode).mockResolvedValue({} as never);
      changeHandler();
      await vi.advanceTimersByTimeAsync(50);

      expect(onSync).toHaveBeenCalledWith("code1");
      vi.useRealTimers();
    });

    it("should call onError callback when sync fails", async () => {
      vi.useFakeTimers();
      const onError = vi.fn();
      watcher.watchCodespace("code1", { debounceMs: 50, onError });

      const changeHandler = vi
        .mocked(mockWatcher.on)
        .mock.calls.find((call) => call[0] === "change")![1];

      vi.mocked(readFile).mockResolvedValue("code");
      vi.mocked(withRetry).mockRejectedValue(new Error("push failed"));
      changeHandler();
      await vi.advanceTimersByTimeAsync(50);

      expect(onError).toHaveBeenCalledWith("code1", expect.any(Error));
      vi.useRealTimers();
    });

    it("should handle non-Error objects thrown during sync", async () => {
      vi.useFakeTimers();
      const onError = vi.fn();
      watcher.watchCodespace("code1", { debounceMs: 50, onError });

      const changeHandler = vi
        .mocked(mockWatcher.on)
        .mock.calls.find((call) => call[0] === "change")![1];

      vi.mocked(readFile).mockResolvedValue("code");
      vi.mocked(withRetry).mockRejectedValue("string error");
      changeHandler();
      await vi.advanceTimersByTimeAsync(50);

      expect(onError).toHaveBeenCalledWith(
        "code1",
        expect.objectContaining({ message: "string error" }),
      );
      vi.useRealTimers();
    });

    it("should debounce multiple rapid changes", async () => {
      vi.useFakeTimers();
      watcher.watchCodespace("code1", { debounceMs: 100 });

      const changeHandler = vi
        .mocked(mockWatcher.on)
        .mock.calls.find((call) => call[0] === "change")![1];

      vi.mocked(readFile).mockResolvedValue("code");
      vi.mocked(pushCode).mockResolvedValue({} as never);

      // Fire three times rapidly — debounce should collapse to one sync
      changeHandler();
      await vi.advanceTimersByTimeAsync(50);
      changeHandler();
      await vi.advanceTimersByTimeAsync(50);
      changeHandler();
      await vi.advanceTimersByTimeAsync(100);

      expect(pushCode).toHaveBeenCalledTimes(1);
      vi.useRealTimers();
    });

    it("should call onError from watcher error event", () => {
      const onError = vi.fn();
      watcher.watchCodespace("code1", { onError });

      const errorHandler = vi
        .mocked(mockWatcher.on)
        .mock.calls.find((call) => call[0] === "error")![1];

      errorHandler(new Error("fs error"));
      expect(onError).toHaveBeenCalledWith("code1", expect.any(Error));
    });

    it("should wrap non-Error in watcher error event", () => {
      const onError = vi.fn();
      watcher.watchCodespace("code1", { onError });

      const errorHandler = vi
        .mocked(mockWatcher.on)
        .mock.calls.find((call) => call[0] === "error")![1];

      errorHandler("plain string error");
      expect(onError).toHaveBeenCalledWith(
        "code1",
        expect.objectContaining({ message: "plain string error" }),
      );
    });

    it("stop() closes watcher and clears pending debounce timer", async () => {
      vi.useFakeTimers();
      const w = watcher.watchCodespace("code1", { debounceMs: 200 });

      const changeHandler = vi
        .mocked(mockWatcher.on)
        .mock.calls.find((call) => call[0] === "change")![1];

      vi.mocked(readFile).mockResolvedValue("code");
      changeHandler();

      // Stop before timer fires
      await w.stop();

      // Advance past debounce — push should NOT be called
      await vi.advanceTimersByTimeAsync(200);

      expect(mockWatcher.close).toHaveBeenCalled();
      expect(pushCode).not.toHaveBeenCalled();
      vi.useRealTimers();
    });

    it("stop() works even when no debounce timer is pending", async () => {
      const w = watcher.watchCodespace("code1");
      await w.stop();
      expect(mockWatcher.close).toHaveBeenCalled();
    });
  });

  describe("startDevMode", () => {
    it("should download all codespaces and return watchers", async () => {
      vi.mocked(pullCode).mockResolvedValue("some code");
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await watcher.startDevMode(["code1", "code2"]);

      expect(result.watchers).toHaveLength(2);
      expect(pullCode).toHaveBeenCalledTimes(2);
      expect(pullCode).toHaveBeenCalledWith("code1");
      expect(pullCode).toHaveBeenCalledWith("code2");
    });

    it("stop() stops all watchers", async () => {
      vi.mocked(pullCode).mockResolvedValue("code");
      vi.mocked(existsSync).mockReturnValue(true);

      const result = await watcher.startDevMode(["code1", "code2"]);
      await result.stop();

      expect(mockWatcher.close).toHaveBeenCalledTimes(2);
    });

    it("propagates download error when a codespace fails", async () => {
      vi.mocked(pullCode).mockRejectedValue(new Error("network error"));
      vi.mocked(existsSync).mockReturnValue(true);

      await expect(watcher.startDevMode(["bad-code"])).rejects.toThrow("network error");
    });

    it("should handle empty codespace list", async () => {
      const result = await watcher.startDevMode([]);
      expect(result.watchers).toHaveLength(0);
      await result.stop();
    });
  });
});
