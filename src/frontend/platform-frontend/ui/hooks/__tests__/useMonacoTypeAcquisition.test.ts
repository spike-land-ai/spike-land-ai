// @vitest-environment happy-dom
import { renderHook, act, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// Track delegate callbacks so tests can invoke them manually
let capturedDelegate: Record<string, (...args: unknown[]) => void> = {};
let capturedFetcher: (req: RequestInfo | URL, init?: RequestInit) => Promise<Response>;

const setupTypeAcquisitionMock = vi.fn().mockImplementation((opts) => {
  capturedDelegate = opts.delegate;
  capturedFetcher = opts.fetcher;
  return vi.fn(); // the ata() function itself
});

vi.mock("@typescript/ata", () => ({
  setupTypeAcquisition: setupTypeAcquisitionMock,
}));

vi.mock("typescript", () => ({
  default: {},
}));

vi.mock("../../../core-logic/ata-cache", () => ({
  getTypeCache: vi.fn().mockResolvedValue(null),
  setTypeCache: vi.fn().mockResolvedValue(undefined),
}));

function createMockMonaco() {
  return {
    languages: {
      typescript: {
        typescriptDefaults: {
          setDiagnosticsOptions: vi.fn(),
          setCompilerOptions: vi.fn(),
          setEagerModelSync: vi.fn(),
          addExtraLib: vi.fn(),
          setExtraLibs: vi.fn(),
        },
        ScriptTarget: { Latest: 99 },
        ModuleKind: { ESNext: 99 },
        ModuleResolutionKind: { NodeJs: 2 },
        JsxEmit: { ReactJSX: 4 },
      },
    },
  };
}

import { useMonacoTypeAcquisition } from "../useMonacoTypeAcquisition";

// Helper: render hook with monaco and wait for async initializeAta() to complete
async function renderWithMonaco(code = "") {
  const monaco = createMockMonaco();
  const hookResult = renderHook(() =>
    useMonacoTypeAcquisition({
      monaco: monaco as unknown as typeof import("monaco-editor"),
      code,
    }),
  );

  // Wait for the async initializeAta() Promise.all to resolve
  await waitFor(() => {
    expect(setupTypeAcquisitionMock).toHaveBeenCalled();
  });

  return { monaco, ...hookResult };
}

describe("useMonacoTypeAcquisition", () => {
  beforeEach(() => {
    capturedDelegate = {};
    setupTypeAcquisitionMock.mockClear();
  });

  it("does not initialize ATA when monaco is null", () => {
    const { result } = renderHook(() =>
      useMonacoTypeAcquisition({ monaco: null, code: "" }),
    );
    expect(result.current.typesReady).toBe(false);
    expect(setupTypeAcquisitionMock).not.toHaveBeenCalled();
  });

  it("initializes ATA when monaco is provided", async () => {
    await renderWithMonaco("const x = 1;");
    expect(setupTypeAcquisitionMock).toHaveBeenCalled();
  });

  it("sets typesReady true when ATA finishes", async () => {
    const { result } = await renderWithMonaco("const x = 1;");

    expect(result.current.typesReady).toBe(false);

    act(() => {
      capturedDelegate.started?.();
    });
    expect(result.current.typesReady).toBe(false);

    act(() => {
      capturedDelegate.finished?.([]);
    });
    expect(result.current.typesReady).toBe(true);
    expect(result.current.typeErrors).toBe(0);
  });

  it("applies types progressively via addExtraLib", async () => {
    const { monaco } = await renderWithMonaco("");

    act(() => {
      capturedDelegate.receivedFile?.("declare module 'react' {}", "node_modules/@types/react/index.d.ts");
    });

    expect(monaco.languages.typescript.typescriptDefaults.addExtraLib).toHaveBeenCalledWith(
      "declare module 'react' {}",
      "node_modules/@types/react/index.d.ts",
    );
  });

  it("times out after 30s and sets typesReady", async () => {
    vi.useFakeTimers();
    try {
      const monaco = createMockMonaco();
      const { result } = renderHook(() =>
        useMonacoTypeAcquisition({
          monaco: monaco as unknown as typeof import("monaco-editor"),
          code: "",
        }),
      );

      // Flush async initializeAta — advance timers to let microtasks resolve
      await act(async () => {
        await vi.advanceTimersByTimeAsync(0);
      });

      // Trigger started — sets typesReady false and starts 30s timeout
      act(() => {
        capturedDelegate.started?.();
      });
      expect(result.current.typesReady).toBe(false);

      // Advance 30s without calling finished
      act(() => {
        vi.advanceTimersByTime(30_000);
      });

      expect(result.current.typesReady).toBe(true);
    } finally {
      vi.useRealTimers();
    }
  });

  it("tracks fetch errors in typeErrors count", async () => {
    const { result } = await renderWithMonaco("");

    act(() => {
      capturedDelegate.started?.();
    });

    // Simulate fetch errors via the fetcher
    const originalFetch = globalThis.fetch;
    globalThis.fetch = vi.fn().mockRejectedValue(new Error("Network error"));

    await act(async () => {
      await capturedFetcher("https://unpkg.com/@types/react/index.d.ts");
      await capturedFetcher("https://unpkg.com/@types/react-dom/index.d.ts");
    });

    globalThis.fetch = originalFetch;

    act(() => {
      capturedDelegate.finished?.([]);
    });

    expect(result.current.typeErrors).toBe(2);
  });

  it("configures diagnostics on Monaco", async () => {
    const { monaco } = await renderWithMonaco("");

    expect(monaco.languages.typescript.typescriptDefaults.setDiagnosticsOptions).toHaveBeenCalledWith(
      expect.objectContaining({
        noSemanticValidation: false,
        noSyntaxValidation: false,
        diagnosticCodesToIgnore: [2307, 7016],
      }),
    );
  });
});
