import * as esbuildWasm from "esbuild-wasm";
import { readFile } from "node:fs/promises";

export interface WasmInitOptions {
  wasmURL?: string | undefined;
  wasmModule?: string | undefined;
  worker?: boolean | undefined;
}

export interface WasmState {
  status: "uninitialized" | "initializing" | "ready" | "error";
  version: string | null;
  options: WasmInitOptions | null;
  error: string | null;
  initializedAt: string | null;
}

let state: WasmState = {
  status: "uninitialized",
  version: null,
  options: null,
  error: null,
  initializedAt: null,
};

let initialized = false;
let initPromise: Promise<void> | null = null;

export async function initializeWasm(opts: WasmInitOptions = {}): Promise<WasmState> {
  // Support re-initialization
  if (initialized) {
    // esbuild-wasm doesn't expose a "stop" for WASM mode, but we can re-initialize
    initialized = false;
    initPromise = null;
    state = {
      status: "uninitialized",
      version: null,
      options: null,
      error: null,
      initializedAt: null,
    };
  }

  if (initPromise !== null && state.status === "initializing") {
    await initPromise;
    return { ...state };
  }

  state.status = "initializing";
  state.options = { ...opts };

  initPromise = (async (): Promise<void> => {
    try {
      const initOpts: esbuildWasm.InitializeOptions = {
        worker: opts.worker ?? false,
      };

      if (opts.wasmURL) {
        initOpts.wasmURL = opts.wasmURL;
      } else if (opts.wasmModule) {
        const wasmBytes = await readFile(opts.wasmModule);
        initOpts.wasmModule = await WebAssembly.compile(wasmBytes);
      }

      await esbuildWasm.initialize(initOpts);

      initialized = true;
      state.status = "ready";
      state.version = esbuildWasm.version;
      state.error = null;
      state.initializedAt = new Date().toISOString();
    } catch (err) {
      state.status = "error";
      state.error = String(err);
      initPromise = null; // Allow retry on error
      throw err;
    }
  })();

  await initPromise;

  return { ...state };
}

export function getState(): WasmState {
  return { ...state };
}

export async function getEsbuildWasm(): Promise<typeof esbuildWasm> {
  if (!initialized) {
    await initializeWasm();
  }
  return esbuildWasm;
}
