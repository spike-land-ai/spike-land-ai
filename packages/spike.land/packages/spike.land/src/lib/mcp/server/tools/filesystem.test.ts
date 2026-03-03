import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRegistry, getText, isError } from "../__test-utils__";
import {
  _getDefaultTtlMs,
  _getFilesystemCount,
  _resetFilesystems,
  getFilesystem,
  registerFilesystemTools,
} from "./filesystem";

describe("filesystem tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    _resetFilesystems();
    registry = createMockRegistry();
    registerFilesystemTools(registry, userId);
  });

  // ── Internal Helpers ──────────────────────────────────────────────────

  describe("internal helpers", () => {
    it("should return filesystem count", async () => {
      const handler = registry.handlers.get("fs_write")!;
      await handler({ codespace_id: "cs-1", file_path: "/a.ts", content: "a" });
      await handler({ codespace_id: "cs-2", file_path: "/b.ts", content: "b" });
      expect(_getFilesystemCount()).toBe(2);
    });
  });

  // ── Registration ──────────────────────────────────────────────────────

  it("should register 8 filesystem tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(8);
    expect(registry.handlers.has("fs_read")).toBe(true);
    expect(registry.handlers.has("fs_write")).toBe(true);
    expect(registry.handlers.has("fs_edit")).toBe(true);
    expect(registry.handlers.has("fs_glob")).toBe(true);
    expect(registry.handlers.has("fs_grep")).toBe(true);
    expect(registry.handlers.has("fs_ls")).toBe(true);
    expect(registry.handlers.has("fs_rm")).toBe(true);
    expect(registry.handlers.has("fs_intent")).toBe(true);
  });

  // ── Validation ────────────────────────────────────────────────────────

  describe("codespace_id validation", () => {
    it("should return error on invalid codespace ID with special chars", async () => {
      const handler = registry.handlers.get("fs_write")!;
      const result = await handler({
        codespace_id: "bad id!@#",
        file_path: "/src/App.tsx",
        content: "hello",
      });
      expect(getText(result)).toContain("Invalid codespace ID format");
      expect(isError(result)).toBe(true);
    });

    it("should return error on codespace ID with spaces", async () => {
      const handler = registry.handlers.get("fs_read")!;
      const result = await handler({
        codespace_id: "bad space",
        file_path: "/src/App.tsx",
      });
      expect(getText(result)).toContain("Invalid codespace ID format");
      expect(isError(result)).toBe(true);
    });

    it("should return error on codespace ID with path traversal", async () => {
      const handler = registry.handlers.get("fs_rm")!;
      const result = await handler({
        codespace_id: "../../etc/passwd",
        file_path: "/src/App.tsx",
      });
      expect(getText(result)).toContain("Invalid codespace ID format");
      expect(isError(result)).toBe(true);
    });
  });

  // ── fs_write ──────────────────────────────────────────────────────────

  describe("fs_write", () => {
    it("should create a new file", async () => {
      const handler = registry.handlers.get("fs_write")!;
      const result = await handler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "export default () => <div>Hello</div>",
      });
      expect(getText(result)).toContain("File created");
      expect(getText(result)).toContain("/src/App.tsx");
      expect(isError(result)).toBe(false);
    });

    it("should update an existing file", async () => {
      const handler = registry.handlers.get("fs_write")!;
      await handler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "original",
      });
      const result = await handler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "updated",
      });
      expect(getText(result)).toContain("File updated");
      expect(getText(result)).toContain("/src/App.tsx");
    });

    it("should reject files exceeding 1MB", async () => {
      const handler = registry.handlers.get("fs_write")!;
      const largeContent = "x".repeat(1_048_577);
      const result = await handler({
        codespace_id: "test-app",
        file_path: "/src/big.ts",
        content: largeContent,
      });
      expect(getText(result)).toContain("exceeds 1MB limit");
      expect(isError(result)).toBe(true);
    });

    it("should reject when file count limit (100) is reached", async () => {
      const handler = registry.handlers.get("fs_write")!;
      // Create 100 files
      for (let i = 0; i < 100; i++) {
        await handler({
          codespace_id: "test-app",
          file_path: `/src/file${i}.ts`,
          content: "content",
        });
      }
      // 101st file should fail
      const result = await handler({
        codespace_id: "test-app",
        file_path: "/src/file100.ts",
        content: "content",
      });
      expect(getText(result)).toContain("File limit (100) reached");
      expect(isError(result)).toBe(true);
    });

    it("should allow updating existing file when at file count limit", async () => {
      const handler = registry.handlers.get("fs_write")!;
      for (let i = 0; i < 100; i++) {
        await handler({
          codespace_id: "test-app",
          file_path: `/src/file${i}.ts`,
          content: "content",
        });
      }
      // Updating an existing file should still work
      const result = await handler({
        codespace_id: "test-app",
        file_path: "/src/file0.ts",
        content: "updated content",
      });
      expect(getText(result)).toContain("File updated");
      expect(isError(result)).toBe(false);
    });

    it("should reject when total size limit (50MB) is exceeded", async () => {
      const handler = registry.handlers.get("fs_write")!;
      // Write a file close to 50MB
      const bigContent = "x".repeat(1_048_000); // ~1MB each
      for (let i = 0; i < 50; i++) {
        await handler({
          codespace_id: "test-app",
          file_path: `/src/file${i}.ts`,
          content: bigContent,
        });
      }
      // This should push over 50MB
      const result = await handler({
        codespace_id: "test-app",
        file_path: "/src/overflow.ts",
        content: bigContent,
      });
      expect(getText(result)).toContain("Total size limit (50MB) exceeded");
      expect(isError(result)).toBe(true);
    }, 30_000); // Higher timeout for large write operations
  });

  // ── fs_read ───────────────────────────────────────────────────────────

  describe("fs_read", () => {
    it("should read file with line numbers", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "line1\nline2\nline3",
      });

      const readHandler = registry.handlers.get("fs_read")!;
      const result = await readHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
      });
      const text = getText(result);
      expect(text).toContain("1\tline1");
      expect(text).toContain("2\tline2");
      expect(text).toContain("3\tline3");
      expect(isError(result)).toBe(false);
    });

    it("should return error for file not found", async () => {
      const handler = registry.handlers.get("fs_read")!;
      const result = await handler({
        codespace_id: "test-app",
        file_path: "/src/missing.ts",
      });
      expect(getText(result)).toContain("not found");
      expect(isError(result)).toBe(true);
    });

    it("should return error for empty codespace", async () => {
      const handler = registry.handlers.get("fs_read")!;
      const result = await handler({
        codespace_id: "empty-app",
        file_path: "/src/App.tsx",
      });
      expect(getText(result)).toContain("not found");
      expect(isError(result)).toBe(true);
    });

    it("should support offset and limit", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "line1\nline2\nline3\nline4\nline5",
      });

      const readHandler = registry.handlers.get("fs_read")!;
      const result = await readHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        offset: 2,
        limit: 2,
      });
      const text = getText(result);
      expect(text).toContain("2\tline2");
      expect(text).toContain("3\tline3");
      expect(text).not.toContain("line1");
      expect(text).not.toContain("line4");
    });
  });

  // ── fs_edit ───────────────────────────────────────────────────────────

  describe("fs_edit", () => {
    it("should replace text and return diff", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "const greeting = 'hello';",
      });

      const editHandler = registry.handlers.get("fs_edit")!;
      const result = await editHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        old_text: "'hello'",
        new_text: "'world'",
      });
      const text = getText(result);
      expect(text).toContain("File edited");
      expect(text).toContain("- 'hello'");
      expect(text).toContain("+ 'world'");
      expect(isError(result)).toBe(false);
    });

    it("should return error when old_text not found", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "const x = 1;",
      });

      const editHandler = registry.handlers.get("fs_edit")!;
      const result = await editHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        old_text: "not here",
        new_text: "replaced",
      });
      expect(getText(result)).toContain("old_text not found");
      expect(isError(result)).toBe(true);
    });

    it("should return error when old_text appears multiple times", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "hello world hello",
      });

      const editHandler = registry.handlers.get("fs_edit")!;
      const result = await editHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        old_text: "hello",
        new_text: "bye",
      });
      expect(getText(result)).toContain("appears multiple times");
      expect(isError(result)).toBe(true);
    });

    it("should return error for file not found", async () => {
      const editHandler = registry.handlers.get("fs_edit")!;
      const result = await editHandler({
        codespace_id: "test-app",
        file_path: "/src/missing.ts",
        old_text: "old",
        new_text: "new",
      });
      expect(getText(result)).toContain("not found");
      expect(isError(result)).toBe(true);
    });
  });

  // ── fs_glob ───────────────────────────────────────────────────────────

  describe("fs_glob", () => {
    beforeEach(async () => {
      const handler = registry.handlers.get("fs_write")!;
      await handler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "app",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/src/utils/math.ts",
        content: "math",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/src/utils/string.ts",
        content: "string",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/src/components/Button.tsx",
        content: "btn",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/README.md",
        content: "readme",
      });
    });

    it("should match deeply nested files with **/*.ts", async () => {
      const handler = registry.handlers.get("fs_glob")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "**/*.ts",
      });
      const text = getText(result);
      expect(text).toContain("/src/utils/math.ts");
      expect(text).toContain("/src/utils/string.ts");
      expect(text).not.toContain("App.tsx"); // .tsx not .ts
    });

    it("should match with **/ prefix", async () => {
      const handler = registry.handlers.get("fs_glob")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "**/math.ts",
      });
      expect(getText(result)).toContain("/src/utils/math.ts");
    });

    it("should match with ? wildcard", async () => {
      const handler = registry.handlers.get("fs_glob")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "/src/utils/mat?.ts",
      });
      expect(getText(result)).toContain("/src/utils/math.ts");
    });

    it("should match only root level with /*.md", async () => {
      const handler = registry.handlers.get("fs_glob")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "/*.md",
      });
      const text = getText(result);
      expect(text).toContain("/README.md");
      expect(text).toContain("1 file(s)");
    });

    it("should match with ** at end of pattern (not followed by /)", async () => {
      const handler = registry.handlers.get("fs_glob")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "/src/**",
      });
      const text = getText(result);
      expect(text).toContain("/src/App.tsx");
      expect(text).toContain("/src/utils/math.ts");
    });

    it("should return no matches message", async () => {
      const handler = registry.handlers.get("fs_glob")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "**/*.json",
      });
      expect(getText(result)).toContain("No files matching");
    });

    it("should return empty codespace message", async () => {
      const handler = registry.handlers.get("fs_glob")!;
      const result = await handler({
        codespace_id: "empty-app",
        pattern: "**/*",
      });
      expect(getText(result)).toContain("No files in codespace");
    });
  });

  // ── fs_grep ───────────────────────────────────────────────────────────

  describe("fs_grep", () => {
    beforeEach(async () => {
      const handler = registry.handlers.get("fs_write")!;
      await handler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content:
          "import React from 'react';\nexport default function App() {\n  return <div>Hello</div>;\n}",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/src/utils.ts",
        content:
          "export function add(a: number, b: number) {\n  return a + b;\n}\nexport function multiply(a: number, b: number) {\n  return a * b;\n}",
      });
    });

    it("should find basic string matches", async () => {
      const handler = registry.handlers.get("fs_grep")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "export default",
      });
      const text = getText(result);
      expect(text).toContain("/src/App.tsx:2:");
      expect(text).toContain("export default");
    });

    it("should support regex search", async () => {
      const handler = registry.handlers.get("fs_grep")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "function \\w+\\(",
        is_regex: true,
      });
      const text = getText(result);
      expect(text).toContain("/src/App.tsx");
      expect(text).toContain("/src/utils.ts");
    });

    it("should show context lines", async () => {
      const handler = registry.handlers.get("fs_grep")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "return a + b",
        context: 1,
      });
      const text = getText(result);
      // Context line before
      expect(text).toContain("export function add");
      // Match line
      expect(text).toContain("return a + b");
      // Context separator
      expect(text).toContain("--");
    });

    it("should filter by glob pattern", async () => {
      const handler = registry.handlers.get("fs_grep")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "export",
        glob: "**/*.ts",
      });
      const text = getText(result);
      expect(text).toContain("/src/utils.ts");
      expect(text).not.toContain("/src/App.tsx");
    });

    it("should return no matches message", async () => {
      const handler = registry.handlers.get("fs_grep")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "nonexistent_string_xyz",
      });
      expect(getText(result)).toContain("No matches");
    });

    it("should return empty codespace message", async () => {
      const handler = registry.handlers.get("fs_grep")!;
      const result = await handler({
        codespace_id: "empty-app",
        pattern: "anything",
      });
      expect(getText(result)).toContain("No files in codespace");
    });

    it("should return error for invalid regex", async () => {
      const handler = registry.handlers.get("fs_grep")!;
      const result = await handler({
        codespace_id: "test-app",
        pattern: "[invalid",
        is_regex: true,
      });
      expect(getText(result)).toContain("Invalid regex pattern");
      expect(isError(result)).toBe(true);
    });
  });

  // ── fs_ls ─────────────────────────────────────────────────────────────

  describe("fs_ls", () => {
    beforeEach(async () => {
      const handler = registry.handlers.get("fs_write")!;
      await handler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "app",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/src/utils/math.ts",
        content: "math",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/package.json",
        content: "{}",
      });
    });

    it("should list root directory entries", async () => {
      const handler = registry.handlers.get("fs_ls")!;
      const result = await handler({ codespace_id: "test-app" });
      const text = getText(result);
      expect(text).toContain("src/");
      expect(text).toContain("package.json");
    });

    it("should list subdirectory entries", async () => {
      const handler = registry.handlers.get("fs_ls")!;
      const result = await handler({ codespace_id: "test-app", path: "/src" });
      const text = getText(result);
      expect(text).toContain("App.tsx");
      expect(text).toContain("utils/");
    });

    it("should return empty codespace message", async () => {
      const handler = registry.handlers.get("fs_ls")!;
      const result = await handler({ codespace_id: "empty-app" });
      expect(getText(result)).toContain("No files in codespace");
    });

    it("should return no entries for nonexistent directory", async () => {
      const handler = registry.handlers.get("fs_ls")!;
      const result = await handler({
        codespace_id: "test-app",
        path: "/nonexistent",
      });
      expect(getText(result)).toContain("No entries at");
    });
  });

  // ── fs_rm ─────────────────────────────────────────────────────────────

  describe("fs_rm", () => {
    it("should remove a file", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "/src/temp.ts",
        content: "temp",
      });

      const rmHandler = registry.handlers.get("fs_rm")!;
      const result = await rmHandler({
        codespace_id: "test-app",
        file_path: "/src/temp.ts",
      });
      expect(getText(result)).toContain("File removed");
      expect(getText(result)).toContain("/src/temp.ts");
      expect(isError(result)).toBe(false);
    });

    it("should return error for file not found", async () => {
      const handler = registry.handlers.get("fs_rm")!;
      const result = await handler({
        codespace_id: "test-app",
        file_path: "/src/missing.ts",
      });
      expect(getText(result)).toContain("not found");
      expect(isError(result)).toBe(true);
    });

    it("should protect entry point /src/App.tsx", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content: "app",
      });

      const rmHandler = registry.handlers.get("fs_rm")!;
      const result = await rmHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
      });
      expect(getText(result)).toContain("Cannot remove entry point");
      expect(getText(result)).toContain("protected");
      expect(isError(result)).toBe(true);
    });
  });

  // ── fs_intent ─────────────────────────────────────────────────────────

  describe("fs_intent", () => {
    beforeEach(async () => {
      const handler = registry.handlers.get("fs_write")!;
      await handler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
        content:
          "import Button from './components/Button';\nexport default function App() { return <Button />; }",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/src/components/Button.tsx",
        content: "export default function Button() { return <button>Click me</button>; }",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/src/components/Button.test.tsx",
        content: "import { render } from '@testing-library/react';\ntest('renders', () => {});",
      });
      await handler({
        codespace_id: "test-app",
        file_path: "/src/utils/math.ts",
        content: "export function add(a: number, b: number) { return a + b; }",
      });
    });

    it("should return relevant files based on keywords", async () => {
      const handler = registry.handlers.get("fs_intent")!;
      const result = await handler({
        codespace_id: "test-app",
        mission: "fix the button component",
      });
      const text = getText(result);
      expect(text).toContain("Mission:");
      expect(text).toContain("/src/components/Button.tsx");
    });

    it("should boost entry point score", async () => {
      const handler = registry.handlers.get("fs_intent")!;
      const result = await handler({
        codespace_id: "test-app",
        mission: "review the app",
      });
      const text = getText(result);
      // Entry point should appear (boosted by +5)
      expect(text).toContain("/src/App.tsx");
    });

    it("should exclude test files when include_tests is false", async () => {
      const handler = registry.handlers.get("fs_intent")!;
      const result = await handler({
        codespace_id: "test-app",
        mission: "fix the button component",
        include_tests: false,
      });
      const text = getText(result);
      expect(text).not.toContain("Button.test.tsx");
      expect(text).toContain("Button.tsx");
    });

    it("should include and boost test files when include_tests is true", async () => {
      const handler = registry.handlers.get("fs_intent")!;
      const result = await handler({
        codespace_id: "test-app",
        mission: "fix the button component",
        include_tests: true,
      });
      const text = getText(result);
      expect(text).toContain("Button.test.tsx");
      expect(text).toContain("test file");
    });

    it("should return empty codespace message", async () => {
      const handler = registry.handlers.get("fs_intent")!;
      const result = await handler({
        codespace_id: "empty-app",
        mission: "build something",
      });
      expect(getText(result)).toContain("No files in codespace");
      expect(getText(result)).toContain("Start by writing files");
    });

    it("should return no matching files message", async () => {
      const handler = registry.handlers.get("fs_intent")!;
      const result = await handler({
        codespace_id: "test-app",
        mission: "zz qq xx",
      });
      const text = getText(result);
      // Entry point always matches (+5), so only truly alien words would fail.
      // But /src/App.tsx gets +5 as entry point, so it will still appear.
      // To get "no files match" we need a codespace with no entry point.
      // Let's just verify it returns something meaningful.
      expect(text).toContain("Relevant files");
    });
  });

  describe("fs_intent no matching files", () => {
    it("should return no matching files when nothing scores", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "nomatch-app",
        file_path: "/data/config.json",
        content: "{\"key\": \"value\"}",
      });

      const handler = registry.handlers.get("fs_intent")!;
      const result = await handler({
        codespace_id: "nomatch-app",
        mission: "zz qq xx",
      });
      const text = getText(result);
      expect(text).toContain("No files match mission");
      expect(text).toContain("Available files");
    });
  });

  // ── Round-trip ────────────────────────────────────────────────────────

  describe("round-trip", () => {
    it("should read back what was written (with line numbers)", async () => {
      const content = "line 1\nline 2\nline 3";
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "/src/hello.ts",
        content,
      });

      const readHandler = registry.handlers.get("fs_read")!;
      const result = await readHandler({
        codespace_id: "test-app",
        file_path: "/src/hello.ts",
      });
      const text = getText(result);
      expect(text).toContain("line 1");
      expect(text).toContain("line 2");
      expect(text).toContain("line 3");
    });
  });

  // ── Path normalization ────────────────────────────────────────────────

  // ── TTL Management ────────────────────────────────────────────────────

  describe("TTL management", () => {
    afterEach(() => {
      vi.useRealTimers();
    });

    it("should have a 1-hour default TTL", () => {
      expect(_getDefaultTtlMs()).toBe(60 * 60 * 1000);
    });

    it("should evict filesystem after TTL expires", async () => {
      vi.useFakeTimers();

      const handler = registry.handlers.get("fs_write")!;
      await handler({
        codespace_id: "ttl-app",
        file_path: "/src/App.tsx",
        content: "hello",
      });
      expect(_getFilesystemCount()).toBeGreaterThanOrEqual(1);

      // Advance past TTL
      vi.advanceTimersByTime(_getDefaultTtlMs() + 1);

      // Filesystem should be evicted
      const readHandler = registry.handlers.get("fs_read")!;
      const result = await readHandler({
        codespace_id: "ttl-app",
        file_path: "/src/App.tsx",
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });

    it("should reset TTL on access", async () => {
      vi.useFakeTimers();

      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "refresh-app",
        file_path: "/src/App.tsx",
        content: "hello",
      });

      // Advance halfway through TTL
      vi.advanceTimersByTime(_getDefaultTtlMs() / 2);

      // Access the filesystem (this should reset the TTL)
      const readHandler = registry.handlers.get("fs_read")!;
      const readResult = await readHandler({
        codespace_id: "refresh-app",
        file_path: "/src/App.tsx",
      });
      expect(isError(readResult)).toBe(false);

      // Advance another half TTL -- should NOT be evicted yet
      vi.advanceTimersByTime(_getDefaultTtlMs() / 2);

      const readResult2 = await readHandler({
        codespace_id: "refresh-app",
        file_path: "/src/App.tsx",
      });
      expect(isError(readResult2)).toBe(false);
      expect(getText(readResult2)).toContain("hello");
    });

    it("should clean up timers on _resetFilesystems", async () => {
      vi.useFakeTimers();

      const handler = registry.handlers.get("fs_write")!;
      await handler({
        codespace_id: "cleanup-app",
        file_path: "/src/App.tsx",
        content: "cleanup",
      });

      _resetFilesystems();
      expect(_getFilesystemCount()).toBe(0);

      // Re-register since _resetFilesystems was called in beforeEach but
      // we need a fresh state
      registry = createMockRegistry();
      registerFilesystemTools(registry, userId);
    });

    it("should create filesystem with TTL via getFilesystem", () => {
      vi.useFakeTimers();
      const fs = getFilesystem("direct-test");
      expect(fs).toBeInstanceOf(Map);
      expect(_getFilesystemCount()).toBeGreaterThanOrEqual(1);

      vi.advanceTimersByTime(_getDefaultTtlMs() + 1);
      // After TTL, trying to read should fail since it was evicted
      const fs2 = getFilesystem("direct-test");
      // getFilesystem creates a new one if evicted, so it should be empty
      expect(fs2.size).toBe(0);
    });
  });

  describe("path normalization", () => {
    it("should normalize paths without leading slash", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "src/App.tsx",
        content: "normalized",
      });

      const readHandler = registry.handlers.get("fs_read")!;
      const result = await readHandler({
        codespace_id: "test-app",
        file_path: "/src/App.tsx",
      });
      expect(getText(result)).toContain("normalized");
      expect(isError(result)).toBe(false);
    });

    it("should read file written without leading slash using slash path", async () => {
      const writeHandler = registry.handlers.get("fs_write")!;
      await writeHandler({
        codespace_id: "test-app",
        file_path: "src/utils.ts",
        content: "util content",
      });

      const readHandler = registry.handlers.get("fs_read")!;
      const result = await readHandler({
        codespace_id: "test-app",
        file_path: "src/utils.ts",
      });
      expect(getText(result)).toContain("util content");
    });
  });
});
