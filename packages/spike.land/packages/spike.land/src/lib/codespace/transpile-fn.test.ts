import { describe, expect, it, vi } from "vitest";

const mockTransform = vi.fn().mockResolvedValue({ code: "transpiled output;" });

vi.mock("./esbuild-init", () => ({
  ensureEsbuildReady: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@spike-land-ai/esbuild-wasm", () => ({
  transform: (...args: unknown[]) => mockTransform(...args),
}));

import { transpileCode, transpileCodeWorkerDom } from "./transpile";

describe("transpileCode", () => {
  it("should call esbuild transform with correct options", async () => {
    mockTransform.mockResolvedValue({ code: "const x = 1;\n" });

    const result = await transpileCode("const x: number = 1;");
    expect(result).toBe("const x = 1;\n");
    expect(mockTransform).toHaveBeenCalledWith(
      "const x: number = 1;",
      expect.objectContaining({
        loader: "tsx",
        format: "esm",
        platform: "browser",
        target: "es2024",
        tsconfigRaw: expect.objectContaining({
          compilerOptions: expect.objectContaining({
            jsxImportSource: "@emotion/react",
          }),
        }),
      }),
    );
  });

  it("should pass through tree-shaking and charset options", async () => {
    mockTransform.mockResolvedValue({ code: "" });
    await transpileCode("test");
    expect(mockTransform).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        treeShaking: true,
        charset: "utf8",
        keepNames: true,
        minify: false,
      }),
    );
  });
});

describe("transpileCodeWorkerDom", () => {
  it("should use react-ts-worker/react as JSX source", async () => {
    mockTransform.mockResolvedValue({ code: "worker output;" });

    const result = await transpileCodeWorkerDom("const x = <div/>;");
    expect(result).toBe("worker output;");
    expect(mockTransform).toHaveBeenCalledWith(
      "const x = <div/>;",
      expect.objectContaining({
        loader: "tsx",
        tsconfigRaw: expect.objectContaining({
          compilerOptions: expect.objectContaining({
            jsxImportSource: "react-ts-worker/react",
          }),
        }),
      }),
    );
  });

  it("should use same base options as transpileCode", async () => {
    mockTransform.mockResolvedValue({ code: "" });
    await transpileCodeWorkerDom("test");
    expect(mockTransform).toHaveBeenCalledWith(
      "test",
      expect.objectContaining({
        format: "esm",
        platform: "browser",
        target: "es2024",
        treeShaking: true,
      }),
    );
  });
});
