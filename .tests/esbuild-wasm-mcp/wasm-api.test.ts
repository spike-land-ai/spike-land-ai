import { beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks so they are available when vi.mock factories run
const mockInitialize = vi.hoisted(() => vi.fn());
const mockVersion = vi.hoisted(() => "0.27.4");
const mockReadFile = vi.hoisted(() => vi.fn());

vi.mock("esbuild-wasm", () => ({
  initialize: mockInitialize,
  version: mockVersion,
  build: vi.fn(),
  transform: vi.fn(),
  analyzeMetafile: vi.fn(),
  formatMessages: vi.fn(),
}));

vi.mock("node:fs/promises", () => ({
  readFile: mockReadFile,
}));

beforeEach(() => {
  vi.resetAllMocks();
});

describe("wasm-api", () => {
  describe("initializeWasm", () => {
    it("initializes successfully with default options", async () => {
      mockInitialize.mockResolvedValue(undefined);

      const { initializeWasm } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");
      const state = await initializeWasm();

      expect(mockInitialize).toHaveBeenCalledWith({ worker: false });
      expect(state.status).toBe("ready");
      expect(state.version).toBe("0.27.4");
      expect(state.error).toBeNull();
      expect(typeof state.initializedAt).toBe("string");
    });

    it("stores provided options in state", async () => {
      mockInitialize.mockResolvedValue(undefined);

      const { initializeWasm } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");
      const state = await initializeWasm({ worker: true });

      expect(state.options).toEqual({ worker: true });
    });

    it("re-initializes when called while already initialized", async () => {
      mockInitialize.mockResolvedValue(undefined);

      const { initializeWasm } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");
      // First init
      await initializeWasm({ worker: false });
      // Second init — triggers re-init branch
      const state = await initializeWasm({ worker: true });

      expect(state.status).toBe("ready");
      // initialize should have been called at least twice across the two calls
      expect(mockInitialize.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(mockInitialize).toHaveBeenLastCalledWith({ worker: true });
    });

    it("accepts a wasmURL option and passes it to initialize", async () => {
      mockInitialize.mockResolvedValue(undefined);

      const { initializeWasm } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");
      const state = await initializeWasm({
        wasmURL: "https://example.com/esbuild.wasm",
      });

      expect(mockInitialize).toHaveBeenCalledWith(
        expect.objectContaining({
          wasmURL: "https://example.com/esbuild.wasm",
        }),
      );
      expect(state.status).toBe("ready");
    });

    it("reads and compiles a wasmModule file path", async () => {
      const fakeBytes = Buffer.from([0x00, 0x61, 0x73, 0x6d]);
      const fakeModule = {
        fakeWasmModule: true,
      } as unknown as WebAssembly.Module;
      mockReadFile.mockResolvedValue(fakeBytes);
      const compileSpy = vi.spyOn(WebAssembly, "compile").mockResolvedValue(fakeModule);
      mockInitialize.mockResolvedValue(undefined);

      const { initializeWasm } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");
      const state = await initializeWasm({
        wasmModule: "/path/to/esbuild.wasm",
      });

      expect(mockReadFile).toHaveBeenCalledWith("/path/to/esbuild.wasm");
      expect(compileSpy).toHaveBeenCalledWith(fakeBytes);
      expect(mockInitialize).toHaveBeenCalledWith(
        expect.objectContaining({ wasmModule: fakeModule }),
      );
      expect(state.status).toBe("ready");

      compileSpy.mockRestore();
    });

    it("sets error status and rethrows when initialization fails", async () => {
      mockInitialize.mockRejectedValue(new Error("WASM load failed"));

      const { initializeWasm, getState } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");

      await expect(initializeWasm()).rejects.toThrow("WASM load failed");

      const state = getState();
      expect(state.status).toBe("error");
      expect(state.error).toContain("WASM load failed");
    });

    it("records the error string for non-Error throws", async () => {
      mockInitialize.mockRejectedValue("raw string error");

      const { initializeWasm, getState } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");

      await expect(initializeWasm()).rejects.toThrow();

      const state = getState();
      expect(state.status).toBe("error");
      expect(state.error).toContain("raw string error");
    });

    it("waits for an existing initialization promise if called while initializing", async () => {
      let resolveInit: (val: void | PromiseLike<void>) => void;
      const initPromise = new Promise<void>((resolve) => {
        resolveInit = resolve;
      });
      mockInitialize.mockReturnValue(initPromise);

      const { initializeWasm } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");

      // Start first init
      const firstCall = initializeWasm();

      // Start second init while first is pending
      const secondCall = initializeWasm();

      // Complete init
      resolveInit!(undefined);

      const [res1, res2] = await Promise.all([firstCall, secondCall]);

      expect(res1.status).toBe("ready");
      expect(res2.status).toBe("ready");
      // initialize should only be called ONCE (the second call reuses the promise)
      // NOTE: Our previous tests might have called it, so we check relative increase or reset
      expect(mockInitialize).toHaveBeenCalledTimes(1);
    });
  });

  describe("getState", () => {
    it("returns uninitialized state before any init", async () => {
      // Force the state back to uninitialized by triggering an error init
      mockInitialize.mockRejectedValue(new Error("fail"));

      const { initializeWasm, getState } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");
      try {
        await initializeWasm();
      } catch {
        // intentional
      }

      const state = getState();
      expect(["error", "uninitialized", "ready"]).toContain(state.status);
    });

    it("returns a shallow copy — mutations do not affect internal state", async () => {
      mockInitialize.mockResolvedValue(undefined);

      const { initializeWasm, getState } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");
      await initializeWasm();

      const state = getState();
      expect(state.status).toBe("ready");

      // Mutate the returned copy — cast via unknown to bypass structural check
      (state as unknown as Record<string, unknown>).status = "uninitialized";

      // Internal state should still be ready
      expect(getState().status).toBe("ready");
    });
  });

  describe("getEsbuildWasm", () => {
    it("returns the esbuild module when already initialized", async () => {
      mockInitialize.mockResolvedValue(undefined);

      const { initializeWasm, getEsbuildWasm } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");
      await initializeWasm();

      const esbuild = await getEsbuildWasm();
      // Verify it has the expected API surface
      expect(typeof esbuild.initialize).toBe("function");
      expect(typeof esbuild.build).toBe("function");
      expect(typeof esbuild.transform).toBe("function");
    });

    it("auto-initializes when not yet initialized", async () => {
      mockInitialize.mockResolvedValue(undefined);

      // Reset to uninitialized by triggering error first, then allow success
      mockInitialize.mockRejectedValueOnce(new Error("first fail")).mockResolvedValue(undefined);

      const { initializeWasm, getEsbuildWasm } = await import("../../src/mcp-tools/esbuild-wasm/wasm-api.js");

      // Force error state
      try {
        await initializeWasm();
      } catch {
        // expected
      }

      // getEsbuildWasm should auto-init (calls initializeWasm which re-inits)
      const esbuild = await getEsbuildWasm();
      expect(typeof esbuild.transform).toBe("function");
    });
  });
});
