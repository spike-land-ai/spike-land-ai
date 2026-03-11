import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { ConfigWatcher } from "../../../../src/cli/spike-cli/node-sys/watcher.js";
import type { ResolvedConfig } from "../../../../src/cli/spike-cli/core-logic/config/types.js";

// mockFsWatch must be hoisted so it can be referenced inside vi.mock factory
const mockFsWatch = vi.hoisted(() => vi.fn());

vi.mock("node:fs", () => ({
  watch: mockFsWatch,
}));

// mockWatcher captures the last watcher created by mockFsWatch
const mockWatcher = {
  close: vi.fn(),
  _callback: null as (() => void) | null,
};

vi.mock("../../../../src/cli/spike-cli/node-sys/discovery.js", () => ({
  discoverConfig: vi.fn().mockResolvedValue({
    servers: { newServer: { command: "node", args: ["new.js"] } },
  }),
}));

describe("ConfigWatcher", () => {
  const onChange = vi.fn<(newConfig: ResolvedConfig) => void>();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockFsWatch.mockImplementation((_path: string, callback: () => void) => {
      mockWatcher._callback = callback;
      return mockWatcher;
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("creates watchers for all config paths", async () => {
    const { watch } = await import("node:fs");
    const watcher = new ConfigWatcher({
      configPaths: ["/path/a.json", "/path/b.json"],
      discoveryOptions: {},
      onChange,
    });

    watcher.start();
    expect(watch).toHaveBeenCalledTimes(2);
    watcher.stop();
  });

  it("stops all watchers", () => {
    const watcher = new ConfigWatcher({
      configPaths: ["/path/a.json"],
      discoveryOptions: {},
      onChange,
    });

    watcher.start();
    watcher.stop();
    expect(mockWatcher.close).toHaveBeenCalled();
  });

  it("warns but continues when watch() throws an Error for a path", () => {
    mockFsWatch.mockImplementationOnce(() => {
      throw new Error("ENOENT: no such file");
    });

    const watcher = new ConfigWatcher({
      configPaths: ["/nonexistent/a.json", "/path/b.json"],
      discoveryOptions: {},
      onChange,
    });

    // Should not throw even when watch fails for a path
    expect(() => watcher.start()).not.toThrow();
    watcher.stop();
  });

  it("warns but continues when watch() throws a non-Error for a path", () => {
    mockFsWatch.mockImplementationOnce(() => {
      // Throw a non-Error value to exercise String(err) fallback in catch
      const nonError: unknown = { message: "not-an-error-object" };
      throw nonError;
    });

    const watcher = new ConfigWatcher({
      configPaths: ["/nonexistent/a.json"],
      discoveryOptions: {},
      onChange,
    });

    expect(() => watcher.start()).not.toThrow();
    watcher.stop();
  });

  it("warns but does not throw when config reload fails with non-Error", async () => {
    const { discoverConfig } = await import("../../../../src/cli/spike-cli/node-sys/discovery.js");
    // Reject with a non-Error value to hit the String(err) fallback path
    const nonError: unknown = { message: "not-an-error" };
    vi.mocked(discoverConfig).mockRejectedValueOnce(nonError);

    const watcher = new ConfigWatcher({
      configPaths: ["/path/a.json"],
      discoveryOptions: {},
      onChange,
      debounceMs: 50,
    });

    watcher.start();
    const callback = mockWatcher._callback ?? (() => {});
    callback();

    await expect(vi.advanceTimersByTimeAsync(100)).resolves.not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
    watcher.stop();
  });

  it("warns but does not throw when config reload fails", async () => {
    const { discoverConfig } = await import("../../../../src/cli/spike-cli/node-sys/discovery.js");
    vi.mocked(discoverConfig).mockRejectedValueOnce(new Error("reload failed"));

    const watcher = new ConfigWatcher({
      configPaths: ["/path/a.json"],
      discoveryOptions: {},
      onChange,
      debounceMs: 50,
    });

    watcher.start();
    const callback = mockWatcher._callback ?? (() => {});
    callback();

    // Should not throw during reload failure
    await expect(vi.advanceTimersByTimeAsync(100)).resolves.not.toThrow();
    expect(onChange).not.toHaveBeenCalled();
    watcher.stop();
  });

  it("debounces rapid changes", async () => {
    const watcher = new ConfigWatcher({
      configPaths: ["/path/a.json"],
      discoveryOptions: {},
      onChange,
      debounceMs: 100,
    });

    watcher.start();

    // Simulate rapid file changes
    const callback = mockWatcher._callback ?? (() => {});
    callback();
    callback();
    callback();

    // Before debounce expires
    expect(onChange).not.toHaveBeenCalled();

    // After debounce
    await vi.advanceTimersByTimeAsync(150);

    // Should have called onChange only once
    expect(onChange).toHaveBeenCalledTimes(1);
    watcher.stop();
  });
});
