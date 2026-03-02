/**
 * Codespace Standalone Tools — Tests
 */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockContext, createMockRegistry } from "../shared/test-utils";
import { _resetFilesystems, codespaceTools, getFilesystem } from "./tools";

// Mock dynamic imports
vi.mock("@/lib/codespace/session-service", () => ({
  getOrCreateSession: vi.fn().mockResolvedValue({
    codeSpace: "test-cs",
    code: "export default function App() { return null; }",
    transpiled: "",
    hash: "abc123",
    messages: [],
  }),
  getSession: vi.fn().mockResolvedValue({
    codeSpace: "test-cs",
    code: 'import React from "react";\nexport default function App() { return null; }',
    transpiled: "",
    hash: "abc123",
    messages: [],
  }),
  upsertSession: vi.fn().mockResolvedValue({
    codeSpace: "test-cs",
    code: "",
    transpiled: "",
    hash: "def456",
    messages: [],
  }),
}));

vi.mock("@/lib/codespace/transpile", () => ({
  transpileCode: vi.fn().mockResolvedValue("transpiled-code"),
}));

describe("codespace standalone tools", () => {
  const registry = createMockRegistry(codespaceTools);
  const ctx = createMockContext({
    env: {
      SPIKE_LAND_SERVICE_TOKEN: "test-token",
    },
  });

  beforeEach(() => {
    _resetFilesystems();
  });

  it("exports expected tool count", () => {
    // 9 codespace + 8 filesystem + 4 template = 21
    expect(registry.getToolNames().length).toBe(21);
  });

  it("has codespace category tools", () => {
    const csTools = registry.getToolsByCategory("codespace");
    expect(csTools.length).toBeGreaterThanOrEqual(9);
  });

  it("has filesystem category tools", () => {
    const fsTools = registry.getToolsByCategory("filesystem");
    expect(fsTools.length).toBe(8);
  });

  it("has codespace-templates category tools", () => {
    const tplTools = registry.getToolsByCategory("codespace-templates");
    expect(tplTools.length).toBe(4);
  });

  describe("codespace_update", () => {
    it("updates a codespace", async () => {
      const result = await registry.call(
        "codespace_update",
        { codespace_id: "test-cs", code: "const x = 1;", run: true },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("CodeSpace Updated");
    });
  });

  describe("codespace_run", () => {
    it("transpiles without updating code", async () => {
      const result = await registry.call("codespace_run", { codespace_id: "test-cs" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Transpiled");
    });
  });

  describe("codespace_get", () => {
    it("returns session data", async () => {
      const result = await registry.call("codespace_get", { codespace_id: "test-cs" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("CodeSpace Details");
    });
  });

  describe("codespace_run_tests", () => {
    it("finds test files in filesystem", async () => {
      const fs = getFilesystem("test-cs");
      fs.set("/src/app.test.ts", "test('works', () => {});");

      const result = await registry.call("codespace_run_tests", { codespace_id: "test-cs" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Test files (1)");
    });

    it("returns error when no files exist", async () => {
      const result = await registry.call("codespace_run_tests", { codespace_id: "empty-cs" }, ctx);
      expect(result.isError).toBe(true);
    });
  });

  describe("codespace_generate_variant", () => {
    it("returns stub variant IDs", async () => {
      const result = await registry.call(
        "codespace_generate_variant",
        { codespace_id: "test-cs", count: 2 },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("test-cs-v1");
      expect(text).toContain("test-cs-v2");
    });
  });

  describe("codespace_regenerate", () => {
    it("returns error when no test files exist", async () => {
      const result = await registry.call("codespace_regenerate", { codespace_id: "regen-cs" }, ctx);
      expect(result.isError).toBe(true);
    });

    it("handles version restore request", async () => {
      const result = await registry.call(
        "codespace_regenerate",
        { codespace_id: "test-cs", from_version: 1 },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Version restore requested");
    });
  });

  describe("fs_write + fs_read", () => {
    it("writes and reads a file", async () => {
      await registry.call(
        "fs_write",
        {
          codespace_id: "test-cs",
          file_path: "/src/utils.ts",
          content: "export const x = 1;\nexport const y = 2;",
        },
        ctx,
      );

      const result = await registry.call(
        "fs_read",
        { codespace_id: "test-cs", file_path: "/src/utils.ts" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("export const x = 1;");
    });
  });

  describe("fs_edit", () => {
    it("performs exact string replacement", async () => {
      const fs = getFilesystem("edit-cs");
      fs.set("/src/App.tsx", "const a = 1;\nconst b = 2;");

      const result = await registry.call(
        "fs_edit",
        {
          codespace_id: "edit-cs",
          file_path: "/src/App.tsx",
          old_text: "const a = 1;",
          new_text: "const a = 42;",
        },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      expect(fs.get("/src/App.tsx")).toContain("const a = 42;");
    });
  });

  describe("fs_glob", () => {
    it("finds files by pattern", async () => {
      const fs = getFilesystem("glob-cs");
      fs.set("/src/app.ts", "");
      fs.set("/src/app.test.ts", "");
      fs.set("/src/utils.ts", "");

      const result = await registry.call(
        "fs_glob",
        { codespace_id: "glob-cs", pattern: "**/*.test.*" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("1 file(s)");
      expect(text).toContain("app.test.ts");
    });
  });

  describe("fs_ls", () => {
    it("lists directory contents", async () => {
      const fs = getFilesystem("ls-cs");
      fs.set("/src/app.ts", "");
      fs.set("/src/utils.ts", "");

      const result = await registry.call("fs_ls", { codespace_id: "ls-cs", path: "/" }, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("src/");
    });
  });

  describe("fs_rm", () => {
    it("removes a file", async () => {
      const fs = getFilesystem("rm-cs");
      fs.set("/src/temp.ts", "");
      expect(fs.size).toBe(1);

      const result = await registry.call(
        "fs_rm",
        { codespace_id: "rm-cs", file_path: "/src/temp.ts" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      expect(fs.size).toBe(0);
    });

    it("protects entry point", async () => {
      const fs = getFilesystem("protect-cs");
      fs.set("/src/App.tsx", "code");

      const result = await registry.call(
        "fs_rm",
        { codespace_id: "protect-cs", file_path: "/src/App.tsx" },
        ctx,
      );
      expect(result.isError).toBe(true);
    });
  });

  describe("codespace_list_templates", () => {
    it("lists all templates", async () => {
      const result = await registry.call("codespace_list_templates", {}, ctx);
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Available Templates");
      expect(text).toContain("blank");
      expect(text).toContain("react-counter");
    });

    it("filters by category", async () => {
      const result = await registry.call(
        "codespace_list_templates",
        { category: "dashboard" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("dashboard-stats");
    });
  });

  describe("codespace_create_from_template", () => {
    it("creates from blank template", async () => {
      const result = await registry.call(
        "codespace_create_from_template",
        { template_id: "blank", name: "my-cs" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      expect(text).toContain("Codespace Created from Template");
    });

    it("returns error for unknown template", async () => {
      const result = await registry.call(
        "codespace_create_from_template",
        { template_id: "nonexistent", name: "my-cs" },
        ctx,
      );
      expect(result.isError).toBe(true);
    });
  });

  describe("codespace_get_dependencies", () => {
    it("detects import dependencies", async () => {
      const result = await registry.call(
        "codespace_get_dependencies",
        { codespace_id: "test-cs" },
        ctx,
      );
      expect(result.isError).toBeFalsy();
      const text = (result.content[0] as { text: string }).text;
      // The mocked session code imports React which is excluded
      expect(text).toContain("Dependencies for codespace");
    });
  });
});
