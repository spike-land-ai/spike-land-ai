import { describe, expect, it, vi } from "vitest";

vi.mock("./esbuild-init", () => ({
  ensureEsbuildReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@spike-land-ai/esbuild-wasm", () => ({
  transform: vi.fn().mockResolvedValue({ code: "transpiled output;" }),
}));

describe("transpiler barrel", () => {
  it("should re-export parseTranspileErrors", async () => {
    const mod = await import("./transpiler");
    expect(typeof mod.parseTranspileErrors).toBe("function");
  });

  it("should re-export transpileCode", async () => {
    const mod = await import("./transpiler");
    expect(typeof mod.transpileCode).toBe("function");
  });
});
