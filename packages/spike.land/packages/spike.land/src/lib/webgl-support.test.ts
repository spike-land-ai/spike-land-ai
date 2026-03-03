import { afterEach, describe, expect, it, vi } from "vitest";
import { hasWebGLSupport, isWebGLContextError } from "./webgl-support";

describe("hasWebGLSupport", () => {
  const originalDocument = globalThis.document;

  afterEach(() => {
    vi.restoreAllMocks();
    // Restore document if it was deleted
    if (!globalThis.document && originalDocument) {
      Object.defineProperty(globalThis, "document", {
        value: originalDocument,
        writable: true,
        configurable: true,
      });
    }
  });

  it("returns true when WebGL2 is available", () => {
    const mockCanvas = {
      getContext: vi.fn((contextId: string) => {
        if (contextId === "webgl2") return {} as WebGL2RenderingContext;
        return null;
      }),
    };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockCanvas as unknown as HTMLCanvasElement,
    );

    expect(hasWebGLSupport()).toBe(true);
    expect(mockCanvas.getContext).toHaveBeenCalledWith("webgl2");
  });

  it("returns true when only WebGL1 is available", () => {
    const mockCanvas = {
      getContext: vi.fn((contextId: string) => {
        if (contextId === "webgl") return {} as WebGLRenderingContext;
        return null;
      }),
    };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockCanvas as unknown as HTMLCanvasElement,
    );

    expect(hasWebGLSupport()).toBe(true);
  });

  it("returns false when neither WebGL2 nor WebGL1 is available", () => {
    const mockCanvas = {
      getContext: vi.fn(() => null),
    };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockCanvas as unknown as HTMLCanvasElement,
    );

    expect(hasWebGLSupport()).toBe(false);
  });

  it("returns false when canvas.getContext throws", () => {
    const mockCanvas = {
      getContext: vi.fn(() => {
        throw new Error("GPU process crashed");
      }),
    };
    vi.spyOn(document, "createElement").mockReturnValue(
      mockCanvas as unknown as HTMLCanvasElement,
    );

    expect(hasWebGLSupport()).toBe(false);
  });

  it("returns false when document is undefined (SSR)", () => {
    const doc = globalThis.document;
    // @ts-expect-error - simulating SSR where document is undefined
    delete globalThis.document;

    expect(hasWebGLSupport()).toBe(false);

    // Restore
    Object.defineProperty(globalThis, "document", {
      value: doc,
      writable: true,
      configurable: true,
    });
  });
});

describe("isWebGLContextError", () => {
  it("returns true for WebGL context creation error", () => {
    const error = new Error(
      "THREE.WebGLRenderer: Error creating WebGL context.",
    );
    expect(isWebGLContextError(error)).toBe(true);
  });

  it("returns true for context could not be created error", () => {
    const error = new Error("A WebGL context could not be created.");
    expect(isWebGLContextError(error)).toBe(true);
  });

  it("returns true for WebGL2 error", () => {
    const error = new Error("Failed to initialize WebGL2 rendering context");
    expect(isWebGLContextError(error)).toBe(true);
  });

  it("returns false for unrelated errors", () => {
    const error = new Error("Cannot read property 'x' of undefined");
    expect(isWebGLContextError(error)).toBe(false);
  });

  it("returns false for non-Error values", () => {
    expect(isWebGLContextError("string error")).toBe(false);
    expect(isWebGLContextError(null)).toBe(false);
    expect(isWebGLContextError(undefined)).toBe(false);
    expect(isWebGLContextError(42)).toBe(false);
  });
});
