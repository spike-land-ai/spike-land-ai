import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRegistry, getText, isError } from "../__test-utils__";
import {
  detectTechStack,
  getExtension,
  parseGitHubUrl,
  parseImports,
  registerContextArchitectTools,
  repoIndex,
  repoKey,
  scoreFile,
} from "./context-architect";

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

describe("context-architect tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    repoIndex.clear();
    registry = createMockRegistry();
    registerContextArchitectTools(registry, userId);
  });

  afterEach(() => {
    repoIndex.clear();
  });

  it("should register 3 context-architect tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
  });

  // --- Unit tests for helper functions ---

  describe("parseGitHubUrl", () => {
    it("should parse standard GitHub URLs", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("should strip .git suffix", () => {
      const result = parseGitHubUrl("https://github.com/owner/repo.git");
      expect(result).toEqual({ owner: "owner", repo: "repo" });
    });

    it("should return null for non-GitHub URLs", () => {
      expect(parseGitHubUrl("https://gitlab.com/owner/repo")).toBeNull();
    });

    it("should return null for invalid URLs", () => {
      expect(parseGitHubUrl("not-a-url")).toBeNull();
    });
  });

  describe("getExtension", () => {
    it("should return file extension", () => {
      expect(getExtension("src/file.ts")).toBe("ts");
    });

    it("should return lowercase extension", () => {
      expect(getExtension("README.MD")).toBe("md");
    });

    it("should return empty string for no extension", () => {
      expect(getExtension("Dockerfile")).toBe("");
    });

    it("should handle nested dots", () => {
      expect(getExtension("src/file.test.ts")).toBe("ts");
    });

    it("should return empty when dot is before last slash (directory dot)", () => {
      expect(getExtension("some.dir/filename")).toBe("");
    });
  });

  describe("detectTechStack", () => {
    it("should detect TypeScript", () => {
      const files = [{ path: "src/index.ts", size: 100, type: "ts" }];
      expect(detectTechStack(files)).toContain("TypeScript");
    });

    it("should detect Next.js via config file", () => {
      const files = [
        { path: "next.config.ts", size: 50, type: "ts" },
        { path: "package.json", size: 200, type: "json" },
      ];
      const stack = detectTechStack(files);
      expect(stack).toContain("Next.js");
      expect(stack).toContain("Node.js");
    });

    it("should detect Docker", () => {
      const files = [{ path: "Dockerfile", size: 100, type: "" }];
      expect(detectTechStack(files)).toContain("Docker");
    });

    it("should return empty array for unknown stack", () => {
      const files = [{ path: "data.csv", size: 100, type: "csv" }];
      expect(detectTechStack(files)).toEqual([]);
    });

    it("should detect JavaScript (js/jsx)", () => {
      const files = [
        { path: "src/app.js", size: 100, type: "js" },
        { path: "src/component.jsx", size: 100, type: "jsx" },
      ];
      const stack = detectTechStack(files);
      expect(stack).toContain("JavaScript");
    });

    it("should detect Python", () => {
      const files = [{ path: "main.py", size: 100, type: "py" }];
      expect(detectTechStack(files)).toContain("Python");
    });

    it("should detect Rust", () => {
      const files = [{ path: "main.rs", size: 100, type: "rs" }];
      expect(detectTechStack(files)).toContain("Rust");
    });

    it("should detect Go", () => {
      const files = [{ path: "main.go", size: 100, type: "go" }];
      expect(detectTechStack(files)).toContain("Go");
    });

    it("should detect Java", () => {
      const files = [{ path: "Main.java", size: 100, type: "java" }];
      expect(detectTechStack(files)).toContain("Java");
    });

    it("should detect Ruby", () => {
      const files = [{ path: "app.rb", size: 100, type: "rb" }];
      expect(detectTechStack(files)).toContain("Ruby");
    });

    it("should detect PHP", () => {
      const files = [{ path: "index.php", size: 100, type: "php" }];
      expect(detectTechStack(files)).toContain("PHP");
    });

    it("should detect C#", () => {
      const files = [{ path: "Program.cs", size: 100, type: "cs" }];
      expect(detectTechStack(files)).toContain("C#");
    });

    it("should detect Swift", () => {
      const files = [{ path: "App.swift", size: 100, type: "swift" }];
      expect(detectTechStack(files)).toContain("Swift");
    });

    it("should detect Kotlin", () => {
      const files = [{ path: "Main.kt", size: 100, type: "kt" }];
      expect(detectTechStack(files)).toContain("Kotlin");
    });

    it("should detect Vite via config file", () => {
      const files = [{ path: "vite.config.ts", size: 50, type: "ts" }];
      expect(detectTechStack(files)).toContain("Vite");
    });

    it("should detect Rust/Cargo via Cargo.toml", () => {
      const files = [{ path: "Cargo.toml", size: 50, type: "toml" }];
      expect(detectTechStack(files)).toContain("Rust/Cargo");
    });

    it("should detect Go Modules via go.mod", () => {
      const files = [{ path: "go.mod", size: 50, type: "mod" }];
      expect(detectTechStack(files)).toContain("Go Modules");
    });

    it("should detect Python via pyproject.toml", () => {
      const files = [{ path: "pyproject.toml", size: 50, type: "toml" }];
      expect(detectTechStack(files)).toContain("Python");
    });

    it("should detect Tailwind CSS via config", () => {
      const files = [{ path: "tailwind.config.ts", size: 50, type: "ts" }];
      expect(detectTechStack(files)).toContain("Tailwind CSS");
    });

    it("should detect Docker via docker-compose.yml", () => {
      const files = [{ path: "docker-compose.yml", size: 50, type: "yml" }];
      expect(detectTechStack(files)).toContain("Docker");
    });

    it("should detect Next.js via next.config.js", () => {
      const files = [{ path: "next.config.js", size: 50, type: "js" }];
      expect(detectTechStack(files)).toContain("Next.js");
    });

    it("should detect Next.js via next.config.mjs", () => {
      const files = [{ path: "next.config.mjs", size: 50, type: "mjs" }];
      expect(detectTechStack(files)).toContain("Next.js");
    });

    it("should detect Vite via vite.config.js", () => {
      const files = [{ path: "vite.config.js", size: 50, type: "js" }];
      expect(detectTechStack(files)).toContain("Vite");
    });

    it("should detect Tailwind CSS via tailwind.config.js", () => {
      const files = [{ path: "tailwind.config.js", size: 50, type: "js" }];
      expect(detectTechStack(files)).toContain("Tailwind CSS");
    });

    it("should detect TypeScript via tsx extension", () => {
      const files = [{ path: "App.tsx", size: 100, type: "tsx" }];
      expect(detectTechStack(files)).toContain("TypeScript");
    });
  });

  describe("scoreFile", () => {
    it("should score higher for keyword matches", () => {
      const file = { path: "src/auth/login.ts", size: 100, type: "ts" };
      const score = scoreFile(file, ["auth", "login"]);
      expect(score).toBeGreaterThan(0);
    });

    it("should boost source directory files", () => {
      const srcFile = { path: "src/utils/helper.ts", size: 100, type: "ts" };
      const rootFile = { path: "helper.ts", size: 100, type: "ts" };
      const srcScore = scoreFile(srcFile, ["helper"]);
      const rootScore = scoreFile(rootFile, ["helper"]);
      expect(srcScore).toBeGreaterThan(rootScore);
    });

    it("should penalize test files", () => {
      const testFile = {
        path: "src/utils/helper.test.ts",
        size: 100,
        type: "ts",
      };
      const score = scoreFile(testFile, ["helper"]);
      // The penalty should lower the score significantly
      expect(score).toBeLessThan(
        scoreFile({ path: "src/utils/helper.ts", size: 100, type: "ts" }, [
          "helper",
        ]),
      );
    });

    it("should return 0 for no keyword matches in non-source dirs", () => {
      const file = { path: "docs/readme.md", size: 100, type: "md" };
      const score = scoreFile(file, ["authentication"]);
      expect(score).toBe(0);
    });

    it("should add +1 for code extension files", () => {
      const tsFile = { path: "data/file.ts", size: 100, type: "ts" };
      const mdFile = { path: "data/file.md", size: 100, type: "md" };
      // Both match keyword "file", both in non-source dir, no penalty
      const tsScore = scoreFile(tsFile, ["data"]);
      const mdScore = scoreFile(mdFile, ["data"]);
      expect(tsScore).toBeGreaterThan(mdScore);
    });

    it("should handle empty keywords array", () => {
      const file = { path: "src/index.ts", size: 100, type: "ts" };
      const score = scoreFile(file, []);
      // No keyword match (+0), source dir (+2), code ext (+1) = 3
      expect(score).toBe(3);
    });
  });

  describe("parseImports", () => {
    it("should parse ES module imports", () => {
      const content = `import { foo } from "./foo";
import bar from "../bar";`;
      const imports = parseImports(content);
      expect(imports).toContain("./foo");
      expect(imports).toContain("../bar");
    });

    it("should parse default imports", () => {
      const content = `import React from "react";`;
      const imports = parseImports(content);
      expect(imports).toContain("react");
    });

    it("should return empty for no imports", () => {
      const content = `const x = 1;\nconst y = 2;`;
      expect(parseImports(content)).toEqual([]);
    });

    it("should parse Python-style from...import syntax", () => {
      const content = `from "some-module" import something;`;
      const imports = parseImports(content);
      expect(imports).toContain("some-module");
    });
  });

  describe("repoKey", () => {
    it("should combine userId and repoUrl", () => {
      expect(repoKey("user1", "https://github.com/a/b")).toBe(
        "user1:https://github.com/a/b",
      );
    });
  });

  // --- Integration tests for tool handlers ---

  describe("context_index_repo", () => {
    it("should index a repository successfully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: "abc123",
          url: "https://api.github.com/...",
          tree: [
            { path: "src/index.ts", type: "blob", size: 500 },
            { path: "src/utils/helper.ts", type: "blob", size: 200 },
            { path: "package.json", type: "blob", size: 300 },
            { path: "src", type: "tree" },
          ],
          truncated: false,
        }),
      });

      const handler = registry.handlers.get("context_index_repo")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        branch: "main",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Indexed 3 files");
      expect(text).toContain("test/repo@main");
      expect(text).toContain("src/");
    });

    it("should detect tech stack in indexed repo", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: "abc",
          url: "",
          tree: [
            { path: "package.json", type: "blob", size: 100 },
            { path: "next.config.ts", type: "blob", size: 50 },
            { path: "src/app/page.tsx", type: "blob", size: 300 },
          ],
          truncated: false,
        }),
      });

      const handler = registry.handlers.get("context_index_repo")!;
      const result = await handler({
        repo_url: "https://github.com/test/nextapp",
        branch: "main",
      });

      const text = getText(result);
      expect(text).toContain("Next.js");
      expect(text).toContain("Node.js");
      expect(text).toContain("TypeScript");
    });

    it("should return error for invalid GitHub URL", async () => {
      const handler = registry.handlers.get("context_index_repo")!;
      const result = await handler({
        repo_url: "https://gitlab.com/test/repo",
        branch: "main",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Invalid GitHub URL");
    });

    it("should return error for 404 response", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: "Not Found",
      });

      const handler = registry.handlers.get("context_index_repo")!;
      const result = await handler({
        repo_url: "https://github.com/test/nonexistent",
        branch: "main",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });

    it("should return error for other API errors", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: "Internal Server Error",
      });

      const handler = registry.handlers.get("context_index_repo")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        branch: "main",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("GitHub API error: 500");
    });

    it("should show truncation warning for large repos", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: "abc",
          url: "",
          tree: [{ path: "file.ts", type: "blob", size: 100 }],
          truncated: true,
        }),
      });

      const handler = registry.handlers.get("context_index_repo")!;
      const result = await handler({
        repo_url: "https://github.com/test/huge-repo",
        branch: "main",
      });

      expect(getText(result)).toContain("truncated");
    });

    it("should handle files with no size (undefined)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: "abc",
          url: "",
          tree: [
            { path: "src/file.ts", type: "blob" }, // no size field
          ],
          truncated: false,
        }),
      });

      const handler = registry.handlers.get("context_index_repo")!;
      const result = await handler({
        repo_url: "https://github.com/test/nosize",
        branch: "main",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Indexed 1 files");
    });

    it("should not show tech stack section when none detected", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: "abc",
          url: "",
          tree: [
            { path: "data.csv", type: "blob", size: 100 },
          ],
          truncated: false,
        }),
      });

      const handler = registry.handlers.get("context_index_repo")!;
      const result = await handler({
        repo_url: "https://github.com/test/notech",
        branch: "main",
      });

      const text = getText(result);
      expect(text).not.toContain("Detected tech stack");
    });

    it("should sort top directories even when file counts are equal", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: "abc",
          url: "",
          tree: [
            { path: "alpha/file1.ts", type: "blob", size: 100 },
            { path: "alpha/file2.ts", type: "blob", size: 100 },
            { path: "beta/file1.ts", type: "blob", size: 100 },
            { path: "beta/file2.ts", type: "blob", size: 100 },
            { path: "gamma/file1.ts", type: "blob", size: 100 },
            { path: "gamma/file2.ts", type: "blob", size: 100 },
          ],
          truncated: false,
        }),
      });

      const handler = registry.handlers.get("context_index_repo")!;
      const result = await handler({
        repo_url: "https://github.com/test/equal-dirs",
        branch: "main",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      // All three directories should appear with equal counts
      expect(text).toContain("alpha/ (2 files)");
      expect(text).toContain("beta/ (2 files)");
      expect(text).toContain("gamma/ (2 files)");
    });

    it("should store index in repoIndex map", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          sha: "abc",
          url: "",
          tree: [{ path: "index.ts", type: "blob", size: 100 }],
          truncated: false,
        }),
      });

      const handler = registry.handlers.get("context_index_repo")!;
      await handler({
        repo_url: "https://github.com/test/repo",
        branch: "dev",
      });

      const key = repoKey(userId, "https://github.com/test/repo");
      const stored = repoIndex.get(key);
      expect(stored).toBeDefined();
      expect(stored!.branch).toBe("dev");
      expect(stored!.files).toHaveLength(1);
    });
  });

  describe("context_pack", () => {
    beforeEach(() => {
      // Pre-populate the index
      const key = repoKey(userId, "https://github.com/test/repo");
      repoIndex.set(key, {
        url: "https://github.com/test/repo",
        branch: "main",
        files: [
          { path: "src/auth/login.ts", size: 500, type: "ts" },
          { path: "src/auth/register.ts", size: 400, type: "ts" },
          { path: "src/utils/helper.ts", size: 200, type: "ts" },
          { path: "src/auth/login.test.ts", size: 300, type: "ts" },
          { path: "package.json", size: 100, type: "json" },
          { path: "README.md", size: 1000, type: "md" },
        ],
        indexedAt: new Date(),
      });
    });

    it("should return relevant files for a task", async () => {
      const handler = registry.handlers.get("context_pack")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        task_description: "Fix the auth login flow",
        max_files: 20,
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("relevant file(s)");
      expect(text).toContain("login");
    });

    it("should return error for non-indexed repo", async () => {
      const handler = registry.handlers.get("context_pack")!;
      const result = await handler({
        repo_url: "https://github.com/unknown/repo",
        task_description: "Fix something",
        max_files: 20,
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not indexed");
    });

    it("should return error for empty keywords", async () => {
      const handler = registry.handlers.get("context_pack")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        task_description: "it is",
        max_files: 20,
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("no meaningful keywords");
    });

    it("should return no results message when nothing matches", async () => {
      // Set up an index with files that won't match
      const key = repoKey(userId, "https://github.com/test/empty");
      repoIndex.set(key, {
        url: "https://github.com/test/empty",
        branch: "main",
        files: [{ path: "data.csv", size: 100, type: "csv" }],
        indexedAt: new Date(),
      });

      const handler = registry.handlers.get("context_pack")!;
      const result = await handler({
        repo_url: "https://github.com/test/empty",
        task_description: "authentication module refactoring",
        max_files: 20,
      });

      const text = getText(result);
      expect(text).toContain("No relevant files found");
    });

    it("should respect max_files limit", async () => {
      const handler = registry.handlers.get("context_pack")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        task_description: "auth login register helper",
        max_files: 2,
      });

      const text = getText(result);
      // Count table rows (lines starting with |, excluding header)
      const dataRows = text.split("\n").filter((l: string) => l.match(/^\| \d/));
      expect(dataRows.length).toBeLessThanOrEqual(2);
    });

    it("should format sizes as KB for files > 1024 bytes", async () => {
      const key = repoKey(userId, "https://github.com/test/sizes");
      repoIndex.set(key, {
        url: "https://github.com/test/sizes",
        branch: "main",
        files: [
          { path: "src/big.ts", size: 2048, type: "ts" },
          { path: "src/small.ts", size: 512, type: "ts" },
        ],
        indexedAt: new Date(),
      });

      const handler = registry.handlers.get("context_pack")!;
      const result = await handler({
        repo_url: "https://github.com/test/sizes",
        task_description: "big small files source",
        max_files: 20,
      });

      const text = getText(result);
      expect(text).toContain("KB");
      expect(text).toContain("B");
    });

    it("should rank source files higher than test files", async () => {
      const handler = registry.handlers.get("context_pack")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        task_description: "login authentication",
        max_files: 20,
      });

      const text = getText(result);
      // The src file should appear before the test file
      const srcIdx = text.indexOf("src/auth/login.ts");
      const testIdx = text.indexOf("src/auth/login.test.ts");
      if (srcIdx !== -1 && testIdx !== -1) {
        expect(srcIdx).toBeLessThan(testIdx);
      }
    });
  });

  describe("context_get_deps", () => {
    beforeEach(() => {
      const key = repoKey(userId, "https://github.com/test/repo");
      repoIndex.set(key, {
        url: "https://github.com/test/repo",
        branch: "main",
        files: [
          { path: "src/auth/login.ts", size: 500, type: "ts" },
          { path: "src/auth/register.ts", size: 400, type: "ts" },
          { path: "src/auth/index.ts", size: 100, type: "ts" },
          { path: "src/utils/helper.ts", size: 200, type: "ts" },
        ],
        indexedAt: new Date(),
      });
    });

    it("should return dependencies for a file", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `import { helper } from "../utils/helper";\nimport { z } from "zod";`,
      });

      const handler = registry.handlers.get("context_get_deps")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        file_path: "src/auth/login.ts",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Dependencies for");
      expect(text).toContain("../utils/helper");
      expect(text).toContain("zod");
    });

    it("should show sibling files", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `const x = 1;`,
      });

      const handler = registry.handlers.get("context_get_deps")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        file_path: "src/auth/login.ts",
      });

      const text = getText(result);
      expect(text).toContain("Sibling files");
      expect(text).toContain("src/auth/register.ts");
      expect(text).toContain("src/auth/index.ts");
    });

    it("should return error for non-indexed repo", async () => {
      const handler = registry.handlers.get("context_get_deps")!;
      const result = await handler({
        repo_url: "https://github.com/unknown/repo",
        file_path: "src/index.ts",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not indexed");
    });

    it("should return error for file not in index", async () => {
      const handler = registry.handlers.get("context_get_deps")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        file_path: "src/nonexistent.ts",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("File not found in index");
    });

    it("should handle fetch failure gracefully", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 404,
      });

      const handler = registry.handlers.get("context_get_deps")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        file_path: "src/auth/login.ts",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Direct imports:** None found");
    });

    it("should handle file with no imports", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `export const VERSION = "1.0.0";`,
      });

      const handler = registry.handlers.get("context_get_deps")!;
      const result = await handler({
        repo_url: "https://github.com/test/repo",
        file_path: "src/utils/helper.ts",
      });

      const text = getText(result);
      expect(text).toContain("Direct imports:** None found");
      // helper.ts is alone in its directory
      expect(text).toContain("Sibling files (same directory, 0)");
    });

    it("should truncate sibling list when more than 20 siblings", async () => {
      // Create index with > 20 sibling files
      const files = [{ path: "src/many/target.ts", size: 100, type: "ts" }];
      for (let i = 0; i < 25; i++) {
        files.push({ path: `src/many/file${i}.ts`, size: 100, type: "ts" });
      }
      const key = repoKey(userId, "https://github.com/test/many");
      repoIndex.set(key, {
        url: "https://github.com/test/many",
        branch: "main",
        files,
        indexedAt: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `const x = 1;`,
      });

      const handler = registry.handlers.get("context_get_deps")!;
      const result = await handler({
        repo_url: "https://github.com/test/many",
        file_path: "src/many/target.ts",
      });

      const text = getText(result);
      expect(text).toContain("...and");
      expect(text).toContain("more");
    });

    it("should return invalid GitHub URL when repo_url is not a GitHub URL after successful index", async () => {
      // Manually put a non-GitHub URL into the repo index to simulate
      // a scenario where the index exists but the URL fails parseGitHubUrl
      const fakeUrl = "https://gitlab.com/test/repo";
      const key = repoKey(userId, fakeUrl);
      repoIndex.set(key, {
        url: fakeUrl,
        branch: "main",
        files: [
          { path: "src/index.ts", size: 100, type: "ts" },
        ],
        indexedAt: new Date(),
      });

      const handler = registry.handlers.get("context_get_deps")!;
      const result = await handler({
        repo_url: fakeUrl,
        file_path: "src/index.ts",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Invalid GitHub URL");
    });

    it("should show no sibling files when directory has only non-code files", async () => {
      const key = repoKey(userId, "https://github.com/test/nocode");
      repoIndex.set(key, {
        url: "https://github.com/test/nocode",
        branch: "main",
        files: [
          { path: "docs/readme.ts", size: 100, type: "ts" },
          { path: "docs/image.png", size: 500, type: "png" },
          { path: "docs/data.csv", size: 200, type: "csv" },
        ],
        indexedAt: new Date(),
      });

      mockFetch.mockResolvedValueOnce({
        ok: true,
        text: async () => `export const x = 1;`,
      });

      const handler = registry.handlers.get("context_get_deps")!;
      const result = await handler({
        repo_url: "https://github.com/test/nocode",
        file_path: "docs/readme.ts",
      });

      const text = getText(result);
      // No code siblings (png and csv are not code extensions)
      expect(text).toContain("Sibling files (same directory, 0)");
      expect(text).toContain("None");
    });
  });
});
