import { beforeEach, describe, expect, it, vi } from "vitest";

// Must use vi.hoisted() for variables used inside vi.mock() factories (vitest 4+, pool: "forks")
const mockGetSession = vi.hoisted(() => vi.fn());
const mockGetOrCreateSession = vi.hoisted(() => vi.fn());
const mockUpsertSession = vi.hoisted(() => vi.fn());
const mockTranspileCode = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock("@/lib/codespace/session-service", () => ({
  SessionService: {
    getSession: (...args: unknown[]) => mockGetSession(...args),
    getOrCreateSession: (...args: unknown[]) => mockGetOrCreateSession(...args),
    upsertSession: (...args: unknown[]) => mockUpsertSession(...args),
  },
  getSession: (...args: unknown[]) => mockGetSession(...args),
  getOrCreateSession: (...args: unknown[]) => mockGetOrCreateSession(...args),
  upsertSession: (...args: unknown[]) => mockUpsertSession(...args),
}));

vi.mock("@/lib/codespace/transpile", () => ({
  transpileCode: (...args: unknown[]) => mockTranspileCode(...args),
}));

vi.stubGlobal("fetch", mockFetch);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerCodeSpaceTools } from "./codespace";
import { _resetFilesystems, getFilesystem } from "./filesystem";

describe("codespace tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.resetAllMocks();
    _resetFilesystems();
    registry = createMockRegistry();
    registerCodeSpaceTools(registry, userId);
  });

  it("should register 9 codespace tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(9);
    expect(registry.handlers.has("codespace_update")).toBe(true);
    expect(registry.handlers.has("codespace_run")).toBe(true);
    expect(registry.handlers.has("codespace_screenshot")).toBe(true);
    expect(registry.handlers.has("codespace_get")).toBe(true);
    expect(registry.handlers.has("codespace_link_app")).toBe(true);
    expect(registry.handlers.has("codespace_list_my_apps")).toBe(true);
    expect(registry.handlers.has("codespace_run_tests")).toBe(true);
    expect(registry.handlers.has("codespace_generate_variant")).toBe(true);
    expect(registry.handlers.has("codespace_regenerate")).toBe(true);
  });

  describe("validateCodeSpaceId", () => {
    it("should throw on invalid codespace ID", async () => {
      const handler = registry.handlers.get("codespace_update")!;
      await expect(handler({ codespace_id: "bad id!@#", code: "hello" }))
        .rejects.toThrow("Invalid codespace ID format");
    });

    it("should throw on codespace ID with spaces", async () => {
      const handler = registry.handlers.get("codespace_run")!;
      await expect(handler({ codespace_id: "bad space" })).rejects.toThrow(
        "Invalid codespace ID format",
      );
    });

    it("should throw on codespace ID with special chars", async () => {
      const handler = registry.handlers.get("codespace_get")!;
      await expect(handler({ codespace_id: "../../etc/passwd" })).rejects
        .toThrow("Invalid codespace ID format");
    });
  });

  describe("codespace_update", () => {
    it("should update codespace via SessionService", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        codeSpace: "test-app",
        code: "old",
        transpiled: "old-t",
        html: "",
        css: "",
        messages: [],
        hash: "old-hash",
      });
      mockTranspileCode.mockResolvedValue("transpiled-code");
      mockUpsertSession.mockResolvedValue({
        codeSpace: "test-app",
        hash: "abc123",
        code: "new code",
        transpiled: "transpiled-code",
        html: "",
        css: "",
        messages: [],
      });

      const handler = registry.handlers.get("codespace_update")!;
      const result = await handler({
        codespace_id: "test-app",
        code: "export default () => <div>Hello</div>",
      });
      expect(getText(result)).toContain("CodeSpace Updated");
      expect(getText(result)).toContain("test-app");
      expect(mockGetOrCreateSession).toHaveBeenCalledWith("test-app");
      expect(mockTranspileCode).toHaveBeenCalled();
      expect(mockUpsertSession).toHaveBeenCalled();
    });

    it("should return error on SessionService failure", async () => {
      mockGetOrCreateSession.mockRejectedValue(new Error("DB error"));

      const handler = registry.handlers.get("codespace_update")!;
      const result = await handler({
        codespace_id: "test-app",
        code: "bad code",
      });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("DB error");
    });

    it("should return error on transpilation failure", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        codeSpace: "test-app",
        code: "",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockTranspileCode.mockRejectedValue(new Error("Syntax error"));

      const handler = registry.handlers.get("codespace_update")!;
      const result = await handler({
        codespace_id: "test-app",
        code: "bad syntax",
      });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Syntax error");
    });

    it("should handle non-Error thrown values", async () => {
      mockGetOrCreateSession.mockRejectedValue("raw string error");

      const handler = registry.handlers.get("codespace_update")!;
      const result = await handler({ codespace_id: "test-app", code: "code" });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Unknown error");
    });
  });

  describe("codespace_run", () => {
    it("should transpile codespace", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "test-app",
        code: "export default () => <div/>",
        transpiled: "old",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockTranspileCode.mockResolvedValue("new-transpiled");
      mockUpsertSession.mockResolvedValue({
        codeSpace: "test-app",
        hash: "abc123",
        code: "export default () => <div/>",
        transpiled: "new-transpiled",
        html: "",
        css: "",
        messages: [],
      });

      const handler = registry.handlers.get("codespace_run")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("Transpiled");
    });

    it("should return error when codespace not found", async () => {
      mockGetSession.mockResolvedValue(null);

      const handler = registry.handlers.get("codespace_run")!;
      const result = await handler({ codespace_id: "missing" });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("not found");
    });

    it("should return error on transpile failure", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "test-app",
        code: "code",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockTranspileCode.mockRejectedValue(new Error("Failed"));

      const handler = registry.handlers.get("codespace_run")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("Error");
    });

    it("should handle non-Error thrown values", async () => {
      mockGetSession.mockRejectedValue("raw string error");

      const handler = registry.handlers.get("codespace_run")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Unknown error");
    });
  });

  describe("codespace_screenshot", () => {
    it("should return screenshot image via HTTP fetch", async () => {
      const imageBuffer = new Uint8Array([0xff, 0xd8, 0xff, 0xe0]).buffer;
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        arrayBuffer: () => Promise.resolve(imageBuffer),
      });
      const handler = registry.handlers.get("codespace_screenshot")!;
      const result = await handler({ codespace_id: "test-app" });
      const content = (result as {
        content: Array<
          { type: string; text?: string; data?: string; mimeType?: string; }
        >;
      }).content;
      expect(content[0]!.text).toContain("Screenshot of test-app");
      expect(content[1]!.type).toBe("image");
      expect(content[1]!.mimeType).toBe("image/jpeg");
    });

    it("should return error on screenshot failure", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
      });
      const handler = registry.handlers.get("codespace_screenshot")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("Error");
    });

    it("should return error on fetch exception", async () => {
      mockFetch.mockRejectedValue(new Error("Network timeout"));

      const handler = registry.handlers.get("codespace_screenshot")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Network timeout");
    });

    it("should handle non-Error thrown in screenshot catch", async () => {
      mockFetch.mockRejectedValue("raw string error");

      const handler = registry.handlers.get("codespace_screenshot")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Unknown error");
    });
  });

  describe("codespace_get", () => {
    it("should return codespace details from SessionService", async () => {
      mockGetSession.mockResolvedValue({
        codeSpace: "test-app",
        hash: "abc123",
        code: "export default () => <div>Hi</div>",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
      });
      const handler = registry.handlers.get("codespace_get")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("CodeSpace Details");
      expect(getText(result)).toContain("Source Code");
    });

    it("should return error when codespace not found", async () => {
      mockGetSession.mockResolvedValue(null);

      const handler = registry.handlers.get("codespace_get")!;
      const result = await handler({ codespace_id: "missing" });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("not found");
    });

    it("should return error on service failure", async () => {
      mockGetSession.mockRejectedValue(new Error("DB down"));

      const handler = registry.handlers.get("codespace_get")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("Error");
    });

    it("should handle non-Error thrown in codespace_get catch", async () => {
      mockGetSession.mockRejectedValue("raw string error");

      const handler = registry.handlers.get("codespace_get")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Unknown error");
    });
  });

  describe("codespace_link_app", () => {
    it("should link app with app_id", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "app-1", name: "My App" }),
      });
      const handler = registry.handlers.get("codespace_link_app")!;
      const result = await handler({
        codespace_id: "test-app",
        app_id: "app-1",
      });
      expect(getText(result)).toContain("Linked");
    });

    it("should create app with app_name", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ id: "app-2", name: "New App" }),
      });
      const handler = registry.handlers.get("codespace_link_app")!;
      const result = await handler({
        codespace_id: "test-app",
        app_name: "New App",
        app_description: "Description of app",
      });
      expect(getText(result)).toContain("App Created");
    });

    it("should error without app_id or app_name", async () => {
      const handler = registry.handlers.get("codespace_link_app")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("app_id or app_name required");
    });

    it("should return error when PATCH fails for app_id", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        json: () => Promise.resolve({ error: "App not found" }),
      });
      const handler = registry.handlers.get("codespace_link_app")!;
      const result = await handler({
        codespace_id: "test-app",
        app_id: "bad-id",
      });
      expect(getText(result)).toContain("Error");
    });

    it("should return error when POST fails for app_name", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        json: () => Promise.resolve({ error: "Validation failed" }),
      });
      const handler = registry.handlers.get("codespace_link_app")!;
      const result = await handler({
        codespace_id: "test-app",
        app_name: "Bad App",
      });
      expect(getText(result)).toContain("Error");
    });
  });

  describe("codespace_list_my_apps", () => {
    it("should list apps", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            {
              id: "app-1",
              name: "App 1",
              status: "ACTIVE",
              codespaceId: "cs-1",
            },
          ]),
      });
      const handler = registry.handlers.get("codespace_list_my_apps")!;
      const result = await handler({});
      expect(getText(result)).toContain("My Apps");
      expect(getText(result)).toContain("App 1");
    });

    it("should show empty message", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve([]),
      });
      const handler = registry.handlers.get("codespace_list_my_apps")!;
      const result = await handler({});
      expect(getText(result)).toContain("No apps found");
    });

    it("should return error on fetch failure", async () => {
      mockFetch.mockRejectedValue(new Error("Service unavailable"));
      const handler = registry.handlers.get("codespace_list_my_apps")!;
      const result = await handler({});
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Service unavailable");
    });

    it("should list apps without codespaceId", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () =>
          Promise.resolve([
            { id: "app-1", name: "App No CS", status: "ACTIVE" },
          ]),
      });
      const handler = registry.handlers.get("codespace_list_my_apps")!;
      const result = await handler({});
      expect(getText(result)).toContain("App No CS");
      expect(getText(result)).not.toContain("Codespace:");
    });

    it("should handle non-Error thrown from spikeLandRequest", async () => {
      mockFetch.mockRejectedValue("string error");
      const handler = registry.handlers.get("codespace_list_my_apps")!;
      const result = await handler({});
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("Unknown error");
    });

    it("should handle API error without error field in response", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        json: () => Promise.resolve({}),
      });
      const handler = registry.handlers.get("codespace_list_my_apps")!;
      const result = await handler({});
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("API error: 500");
    });

    it("should handle null data by defaulting to empty array", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        status: 200,
        json: () => Promise.resolve(null),
      });
      const handler = registry.handlers.get("codespace_list_my_apps")!;
      const result = await handler({});
      expect(getText(result)).toContain("My Apps (0)");
      expect(getText(result)).toContain("No apps found");
    });
  });

  describe("codespace_run_tests", () => {
    it("should find test files in filesystem", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");
      fs.set(
        "/src/App.test.tsx",
        "import { test } from 'vitest';\ntest('renders', () => {});",
      );
      fs.set(
        "/src/utils.spec.ts",
        "import { test } from 'vitest';\ntest('util', () => {});",
      );

      const handler = registry.handlers.get("codespace_run_tests")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Test files (2)");
      expect(getText(result)).toContain("App.test.tsx");
      expect(getText(result)).toContain("utils.spec.ts");
    });

    it("should return error when no test files found", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");

      const handler = registry.handlers.get("codespace_run_tests")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("No test files found");
    });

    it("should find specific test file by test_path", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");
      fs.set("/src/App.test.tsx", "test('renders', () => {});");
      fs.set("/src/utils.spec.ts", "test('util', () => {});");

      const handler = registry.handlers.get("codespace_run_tests")!;
      const result = await handler({
        codespace_id: "test-app",
        test_path: "/src/App.test.tsx",
      });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Test files (1)");
      expect(getText(result)).toContain("App.test.tsx");
      expect(getText(result)).not.toContain("utils.spec.ts");
    });

    it("should normalize test_path without leading slash", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.test.tsx", "test('renders', () => {});");

      const handler = registry.handlers.get("codespace_run_tests")!;
      const result = await handler({
        codespace_id: "test-app",
        test_path: "src/App.test.tsx",
      });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Test files (1)");
    });

    it("should return error when codespace has no files", async () => {
      const handler = registry.handlers.get("codespace_run_tests")!;
      const result = await handler({ codespace_id: "empty-cs" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("No files in codespace");
    });

    it("should throw on invalid codespace ID", async () => {
      const handler = registry.handlers.get("codespace_run_tests")!;
      await expect(handler({ codespace_id: "bad id!@#" })).rejects.toThrow(
        "Invalid codespace ID format",
      );
    });

    it("should normalize stored paths without leading slash when using test_path", async () => {
      const fs = getFilesystem("test-app");
      fs.set("src/App.test.tsx", "test('renders', () => {});");

      const handler = registry.handlers.get("codespace_run_tests")!;
      const result = await handler({
        codespace_id: "test-app",
        test_path: "/src/App.test.tsx",
      });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Test files (1)");
    });

    it("should handle empty file content in test listing", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/empty.test.ts", "");

      const handler = registry.handlers.get("codespace_run_tests")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("empty.test.ts");
      expect(getText(result)).toContain("1 lines");
    });

    it("should report line count for test files", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.test.tsx", "line1\nline2\nline3");

      const handler = registry.handlers.get("codespace_run_tests")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("3 lines");
    });

    it("should return error when specific test_path not found", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");

      const handler = registry.handlers.get("codespace_run_tests")!;
      const result = await handler({
        codespace_id: "test-app",
        test_path: "/src/missing.test.tsx",
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("No test files found");
      expect(getText(result)).toContain("missing.test.tsx");
    });
  });

  describe("codespace_generate_variant", () => {
    it("should accept generation request with spec", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");
      fs.set("/src/App.test.tsx", "test('renders', () => {});");

      const handler = registry.handlers.get("codespace_generate_variant")!;
      const result = await handler({
        codespace_id: "test-app",
        spec: "Add a button",
      });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Generation request accepted");
      expect(getText(result)).toContain("test-app");
      expect(getText(result)).toContain("Add a button");
      expect(getText(result)).toContain("**Entry point:** found");
    });

    it("should use custom count parameter", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");

      const handler = registry.handlers.get("codespace_generate_variant")!;
      const result = await handler({ codespace_id: "test-app", count: 5 });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("test-app-v1");
      expect(getText(result)).toContain("test-app-v5");
    });

    it("should default to 3 variants when count omitted", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");

      const handler = registry.handlers.get("codespace_generate_variant")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("test-app-v1");
      expect(getText(result)).toContain("test-app-v3");
      expect(getText(result)).not.toContain("test-app-v4");
    });

    it("should report no test files when codespace is empty", async () => {
      const handler = registry.handlers.get("codespace_generate_variant")!;
      const result = await handler({ codespace_id: "empty-cs" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("**Test files:** none");
      expect(getText(result)).toContain("**Entry point:** missing");
    });

    it("should report spec as none when omitted", async () => {
      const handler = registry.handlers.get("codespace_generate_variant")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(getText(result)).toContain("**Spec:** (none)");
    });

    it("should throw on invalid codespace ID", async () => {
      const handler = registry.handlers.get("codespace_generate_variant")!;
      await expect(handler({ codespace_id: "bad id!@#" })).rejects.toThrow(
        "Invalid codespace ID format",
      );
    });
  });

  describe("codespace_regenerate", () => {
    it("should accept regeneration from tests", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");
      fs.set("/src/App.test.tsx", "test('renders', () => {});");

      const handler = registry.handlers.get("codespace_regenerate")!;
      const result = await handler({
        codespace_id: "test-app",
        from_tests: true,
      });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Regeneration request accepted");
      expect(getText(result)).toContain("from tests");
      expect(getText(result)).toContain("App.test.tsx");
    });

    it("should auto-detect tests when from_tests not specified", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");
      fs.set("/src/App.test.tsx", "test('renders', () => {});");

      const handler = registry.handlers.get("codespace_regenerate")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Regeneration request accepted");
      expect(getText(result)).toContain("auto (tests found)");
    });

    it("should accept version restore request", async () => {
      const handler = registry.handlers.get("codespace_regenerate")!;
      const result = await handler({
        codespace_id: "test-app",
        from_version: 42,
      });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Version restore requested");
      expect(getText(result)).toContain("**Version:** 42");
    });

    it("should error when no test files found and from_tests is true", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");

      const handler = registry.handlers.get("codespace_regenerate")!;
      const result = await handler({
        codespace_id: "test-app",
        from_tests: true,
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("No test files found");
    });

    it("should error when no test files found and from_tests is undefined", async () => {
      const fs = getFilesystem("test-app");
      fs.set("/src/App.tsx", "export default () => <div/>");

      const handler = registry.handlers.get("codespace_regenerate")!;
      const result = await handler({ codespace_id: "test-app" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("No test files found");
    });

    it("should throw on invalid codespace ID", async () => {
      const handler = registry.handlers.get("codespace_regenerate")!;
      await expect(handler({ codespace_id: "bad id!@#" })).rejects.toThrow(
        "Invalid codespace ID format",
      );
    });
  });
});
