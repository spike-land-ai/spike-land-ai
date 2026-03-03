import { beforeEach, describe, expect, it, vi } from "vitest";

const mockTransform = vi.fn();
const mockBundleCodespace = vi.fn();
const mockEnsureEsbuildReady = vi.fn().mockResolvedValue(undefined);

vi.mock("@/lib/prisma", () => ({
  default: {
    toolInvocation: { create: vi.fn() },
  },
}));

vi.mock("@spike-land-ai/esbuild-wasm", () => ({
  transform: mockTransform,
  version: "0.24.2",
}));

vi.mock("@/lib/codespace/esbuild-init", () => ({
  ensureEsbuildReady: mockEnsureEsbuildReady,
}));

vi.mock("@/lib/codespace/bundler", () => ({
  bundleCodespace: mockBundleCodespace,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerEsbuildTools } from "./esbuild";

function getJson(result: unknown): unknown {
  const r = result as { content: Array<{ type: string; text?: string; }>; };
  const jsonBlock = r.content.find((c, i) => i > 0 && c.type === "text");
  return jsonBlock?.text ? JSON.parse(jsonBlock.text) : null;
}

describe("esbuild tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerEsbuildTools(registry, userId);
  });

  it("should register 5 esbuild tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
  });

  describe("esbuild_transpile", () => {
    it("should transpile code with defaults", async () => {
      mockTransform.mockResolvedValue({
        code: "import { jsx } from \"@emotion/react/jsx-runtime\";\n",
        warnings: [],
      });
      const handler = registry.handlers.get("esbuild_transpile")!;
      const result = await handler({ code: "const x = <div/>;" });
      expect(getText(result)).toContain("Transpiled");
      expect(getText(result)).toContain("tsx → esm");
      expect(getText(result)).toContain("target=es2024");
      expect(mockTransform).toHaveBeenCalledWith(
        "const x = <div/>;",
        expect.objectContaining({
          loader: "tsx",
          format: "esm",
          minify: false,
          target: "es2024",
        }),
      );
    });

    it("should transpile with custom loader and target", async () => {
      mockTransform.mockResolvedValue({ code: "var x = 1;\n", warnings: [] });
      const handler = registry.handlers.get("esbuild_transpile")!;
      const result = await handler({
        code: "const x: number = 1;",
        loader: "ts",
        target: "es2020",
        minify: true,
        jsx_import_source: "react",
      });
      expect(getText(result)).toContain("ts → esm");
      expect(getText(result)).toContain("target=es2020");
      expect(getText(result)).toContain("minify=true");
      expect(mockTransform).toHaveBeenCalledWith(
        "const x: number = 1;",
        expect.objectContaining({
          loader: "ts",
          target: "es2020",
          minify: true,
        }),
      );
    });

    it("should include warnings in output", async () => {
      mockTransform.mockResolvedValue({
        code: "var x = 1;\n",
        warnings: [{ text: "Unreachable code" }],
      });
      const handler = registry.handlers.get("esbuild_transpile")!;
      const result = await handler({ code: "const x = 1;" });
      expect(getText(result)).toContain("Warnings (1)");
      expect(getText(result)).toContain("Unreachable code");
    });

    it("should handle transform errors via safeToolCall", async () => {
      mockTransform.mockRejectedValue(new Error("Unexpected token"));
      const handler = registry.handlers.get("esbuild_transpile")!;
      const result = await handler({ code: "invalid{{{" });
      expect(getText(result)).toContain("Error");
    });
  });

  describe("esbuild_bundle", () => {
    it("should bundle a codespace successfully", async () => {
      mockBundleCodespace.mockResolvedValue({
        js: "var app=function(){};",
        css: "body{margin:0}",
      });
      const handler = registry.handlers.get("esbuild_bundle")!;
      const result = await handler({ codespace_id: "my-space" });
      expect(getText(result)).toContain("Bundled");
      expect(getText(result)).toContain("my-space");
      expect(mockBundleCodespace).toHaveBeenCalledWith(
        expect.objectContaining({ codeSpace: "my-space" }),
      );
    });

    it("should report zero CSS when bundle has none", async () => {
      mockBundleCodespace.mockResolvedValue({ js: "var x=1;", css: "" });
      const handler = registry.handlers.get("esbuild_bundle")!;
      const result = await handler({ codespace_id: "no-css" });
      const json = getJson(result) as { has_css: boolean; };
      expect(json.has_css).toBe(false);
    });

    it("should handle bundle errors via safeToolCall", async () => {
      mockBundleCodespace.mockRejectedValue(
        new Error("Bundle failed for bad-space: fetch error"),
      );
      const handler = registry.handlers.get("esbuild_bundle")!;
      const result = await handler({ codespace_id: "bad-space" });
      expect(getText(result)).toContain("Error");
    });
  });

  describe("esbuild_validate", () => {
    it("should return valid for correct code", async () => {
      mockTransform.mockResolvedValue({ code: "", warnings: [] });
      const handler = registry.handlers.get("esbuild_validate")!;
      const result = await handler({ code: "const x = 1;" });
      expect(getText(result)).toContain("Valid");
    });

    it("should return structured errors for invalid code", async () => {
      mockTransform.mockRejectedValue(
        new Error("<stdin>:1:5: error: Unexpected token\n1 error(s)"),
      );
      const handler = registry.handlers.get("esbuild_validate")!;
      const result = await handler({ code: "const =" });
      expect(getText(result)).toContain("Invalid");
      const json = getJson(result) as Array<{ line?: number; message: string; }>;
      expect(json.length).toBeGreaterThan(0);
      expect(json[0]!.message).toContain("Unexpected token");
    });

    it("should handle non-Error thrown in validate catch", async () => {
      mockTransform.mockRejectedValue("string syntax error");
      const handler = registry.handlers.get("esbuild_validate")!;
      const result = await handler({ code: "bad code" });
      expect(getText(result)).toContain("Invalid");
      const json = getJson(result) as Array<{ message: string; }>;
      expect(json.length).toBeGreaterThan(0);
    });

    it("should use custom loader", async () => {
      mockTransform.mockResolvedValue({ code: "", warnings: [] });
      const handler = registry.handlers.get("esbuild_validate")!;
      await handler({ code: "const x = 1;", loader: "ts" });
      expect(mockTransform).toHaveBeenCalledWith(
        "const x = 1;",
        expect.objectContaining({ loader: "ts" }),
      );
    });
  });

  describe("esbuild_parse_errors", () => {
    it("should parse multi-error text", async () => {
      const handler = registry.handlers.get("esbuild_parse_errors")!;
      const result = await handler({
        error_text:
          "<stdin>:3:10: error: Expected semicolon\n<stdin>:7:2: error: Unexpected end of file\n2 error(s)",
      });
      expect(getText(result)).toContain("Parsed");
      const json = getJson(result) as Array<
        { line?: number; column?: number; message: string; }
      >;
      expect(json.length).toBe(2);
      expect(json[0]!.line).toBe(3);
      expect(json[0]!.column).toBe(10);
      expect(json[1]!.line).toBe(7);
    });

    it("should handle plain error message", async () => {
      const handler = registry.handlers.get("esbuild_parse_errors")!;
      const result = await handler({ error_text: "Something went wrong" });
      const json = getJson(result) as Array<{ message: string; }>;
      expect(json.length).toBe(1);
      expect(json[0]!.message).toBe("Something went wrong");
    });
  });

  describe("esbuild_info", () => {
    it("should return version and status", async () => {
      const handler = registry.handlers.get("esbuild_info")!;
      const result = await handler({});
      expect(getText(result)).toContain("esbuild-wasm");
      expect(getText(result)).toContain("0.24.2");
      expect(getText(result)).toContain("ready");
      const json = getJson(result) as {
        version: string;
        status: string;
        supported_loaders: string[];
      };
      expect(json.version).toBe("0.24.2");
      expect(json.status).toBe("ready");
      expect(json.supported_loaders).toContain("tsx");
    });

    it("should report init_failed when initialization fails", async () => {
      mockEnsureEsbuildReady.mockRejectedValueOnce(
        new Error("WASM load failed"),
      );
      const handler = registry.handlers.get("esbuild_info")!;
      const result = await handler({});
      expect(getText(result)).toContain("init_failed");
    });
  });
});
