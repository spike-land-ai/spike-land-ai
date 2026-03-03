import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock node:child_process
const mockExecSync = vi.fn();
vi.mock("node:child_process", async importOriginal => {
  const actual = await importOriginal<typeof import("node:child_process")>();
  const mocked = {
    ...actual,
    execSync: (...args: unknown[]) => mockExecSync(...args),
  };
  return { ...mocked, default: mocked };
});

import { createMockRegistry, getText } from "../__test-utils__";
import { registerPipelineTools } from "./pipeline";

describe("pipeline tools", () => {
  const userId = "test-user";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerPipelineTools(registry, userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("should register 5 pipeline tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("pipeline_run_tests")).toBe(true);
    expect(registry.handlers.has("pipeline_build")).toBe(true);
    expect(registry.handlers.has("pipeline_check_types")).toBe(true);
    expect(registry.handlers.has("pipeline_lint")).toBe(true);
    expect(registry.handlers.has("pipeline_run")).toBe(true);
  });

  it("should register all tools in pipeline category with workspace tier", () => {
    const mockRegister = registry.register as ReturnType<typeof vi.fn>;
    for (const call of mockRegister.mock.calls) {
      const def = call[0] as { category: string; tier: string; };
      expect(def.category).toBe("pipeline");
      expect(def.tier).toBe("workspace");
    }
  });

  // ── pipeline_run_tests ──────────────────────────────────────

  describe("pipeline_run_tests", () => {
    it("should return PASS when tests succeed", async () => {
      mockExecSync.mockReturnValue("Tests: 42 passed\n Duration: 5.2s\n");

      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Run Tests — PASS");
      expect(text).toContain("**Exit code:** 0");
    });

    it("should return FAIL when tests fail", async () => {
      const err = new Error("Tests failed") as Error & {
        stdout?: string;
        stderr?: string;
        status?: number;
      };
      err.stdout = "FAIL src/test.ts\n Expected true, got false";
      err.status = 1;
      mockExecSync.mockImplementation(() => {
        throw err;
      });

      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Run Tests — FAIL");
      expect(text).toContain("**Exit code:** 1");
    });

    it("should include coverage flag when requested", async () => {
      mockExecSync.mockReturnValue("Tests passed with coverage\n");

      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({ coverage: true });
      const text = getText(result);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("--coverage"),
        expect.objectContaining({ timeout: 300_000 }),
      );
      expect(text).toContain("**Coverage:** enabled");
    });

    it("should include scope when provided", async () => {
      mockExecSync.mockReturnValue("Tests passed\n");

      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({ scope: "src/lib/mcp" });
      const text = getText(result);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("src/lib/mcp"),
        expect.objectContaining({ timeout: 300_000 }),
      );
      expect(text).toContain("**Scope:** src/lib/mcp");
    });

    it("should include pattern when provided", async () => {
      mockExecSync.mockReturnValue("Tests passed\n");

      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({ pattern: "pipeline" });
      const text = getText(result);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("pipeline"),
        expect.objectContaining({ timeout: 300_000 }),
      );
      expect(text).toContain("**Pattern:** pipeline");
    });

    it("should reject invalid scope to prevent command injection", async () => {
      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({ scope: "src; rm -rf /" });
      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("Invalid scope");
    });

    it("should reject invalid pattern to prevent command injection", async () => {
      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({ pattern: "$(whoami)" });
      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("Invalid pattern");
    });

    it("should reject scope with path traversal", async () => {
      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({ scope: "../../etc/passwd" });
      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
    });
  });

  // ── pipeline_build ──────────────────────────────────────────

  describe("pipeline_build", () => {
    it("should return PASS when build succeeds", async () => {
      mockExecSync.mockReturnValue("Build completed successfully\n");

      const handler = registry.handlers.get("pipeline_build")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Build — PASS");
      expect(text).toContain("**Exit code:** 0");
    });

    it("should return FAIL when build fails", async () => {
      const err = new Error("Build failed") as Error & {
        stdout?: string;
        stderr?: string;
        status?: number;
      };
      err.stdout = "Error: Module not found";
      err.status = 1;
      mockExecSync.mockImplementation(() => {
        throw err;
      });

      const handler = registry.handlers.get("pipeline_build")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Build — FAIL");
      expect(text).toContain("**Exit code:** 1");
    });

    it("should use 10 minute timeout", async () => {
      mockExecSync.mockReturnValue("Build done\n");

      const handler = registry.handlers.get("pipeline_build")!;
      await handler({});

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("yarn build"),
        expect.objectContaining({ timeout: 600_000 }),
      );
    });
  });

  // ── pipeline_check_types ────────────────────────────────────

  describe("pipeline_check_types", () => {
    it("should return PASS when no type errors", async () => {
      mockExecSync.mockReturnValue("No errors found\n");

      const handler = registry.handlers.get("pipeline_check_types")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Type Check — PASS");
      expect(text).toContain("**Errors:** 0");
      expect(text).toContain("No type errors found");
    });

    it("should return FAIL and count errors when type errors exist", async () => {
      const err = new Error("Type check failed") as Error & {
        stdout?: string;
        stderr?: string;
        status?: number;
      };
      err.stdout = [
        "src/app/page.tsx(10,5): error TS2322: Type 'string' is not assignable to type 'number'.",
        "src/lib/utils.ts(25,3): error TS2345: Argument of type 'null' is not assignable.",
        "Found 2 errors.",
      ].join("\n");
      err.status = 2;
      mockExecSync.mockImplementation(() => {
        throw err;
      });

      const handler = registry.handlers.get("pipeline_check_types")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Type Check — FAIL");
      expect(text).toContain("**Errors:** 2");
      expect(text).toContain("error TS2322");
      expect(text).toContain("error TS2345");
    });

    it("should use yarn typecheck command", async () => {
      mockExecSync.mockReturnValue("No errors\n");

      const handler = registry.handlers.get("pipeline_check_types")!;
      await handler({});

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("yarn typecheck"),
        expect.objectContaining({ timeout: 120_000 }),
      );
    });
  });

  // ── pipeline_lint ───────────────────────────────────────────

  describe("pipeline_lint", () => {
    it("should return PASS when no lint issues", async () => {
      mockExecSync.mockReturnValue("No issues found\n");

      const handler = registry.handlers.get("pipeline_lint")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Lint — PASS");
      expect(text).toContain("**Errors:** 0");
      expect(text).toContain("**Warnings:** 0");
    });

    it("should return FAIL and count issues when lint errors exist", async () => {
      const err = new Error("Lint failed") as Error & {
        stdout?: string;
        stderr?: string;
        status?: number;
      };
      err.stdout = "3 errors and 5 warnings found\n/src/app.tsx\n  10:5  error  no-unused-vars";
      err.status = 1;
      mockExecSync.mockImplementation(() => {
        throw err;
      });

      const handler = registry.handlers.get("pipeline_lint")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Lint — FAIL");
      expect(text).toContain("**Errors:** 3");
      expect(text).toContain("**Warnings:** 5");
    });

    it("should include --fix flag when requested", async () => {
      mockExecSync.mockReturnValue("Fixed 2 issues\n");

      const handler = registry.handlers.get("pipeline_lint")!;
      const result = await handler({ fix: true });
      const text = getText(result);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("--fix"),
        expect.objectContaining({ timeout: 60_000 }),
      );
      expect(text).toContain("**Auto-fix:** enabled");
    });

    it("should include scope when provided", async () => {
      mockExecSync.mockReturnValue("No issues\n");

      const handler = registry.handlers.get("pipeline_lint")!;
      const result = await handler({ scope: "src/lib/mcp" });
      const text = getText(result);

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("src/lib/mcp"),
        expect.objectContaining({ timeout: 60_000 }),
      );
      expect(text).toContain("**Scope:** src/lib/mcp");
    });

    it("should reject invalid scope", async () => {
      const handler = registry.handlers.get("pipeline_lint")!;
      const result = await handler({ scope: "src && rm -rf /" });
      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
    });
  });

  // ── pipeline_run ────────────────────────────────────────────

  describe("pipeline_run", () => {
    it("should execute quick pipeline (lint + types)", async () => {
      mockExecSync
        .mockReturnValueOnce("No lint issues\n") // lint
        .mockReturnValueOnce("No type errors\n"); // typecheck

      const handler = registry.handlers.get("pipeline_run")!;
      const result = await handler({ name: "quick" });
      const text = getText(result);
      expect(text).toContain("Pipeline: quick — PASS");
      expect(text).toContain("**Steps:** 2/2");
      expect(text).toContain("**lint** — PASS");
      expect(text).toContain("**typecheck** — PASS");
    });

    it("should execute ci pipeline (lint + types + tests)", async () => {
      mockExecSync
        .mockReturnValueOnce("No lint issues\n") // lint
        .mockReturnValueOnce("No type errors\n") // typecheck
        .mockReturnValueOnce("Tests: 100 passed\n"); // tests

      const handler = registry.handlers.get("pipeline_run")!;
      const result = await handler({ name: "ci" });
      const text = getText(result);
      expect(text).toContain("Pipeline: ci — PASS");
      expect(text).toContain("**Steps:** 3/3");
    });

    it("should execute full pipeline (lint + types + tests + build)", async () => {
      mockExecSync
        .mockReturnValueOnce("No lint issues\n")
        .mockReturnValueOnce("No type errors\n")
        .mockReturnValueOnce("Tests passed\n")
        .mockReturnValueOnce("Build complete\n");

      const handler = registry.handlers.get("pipeline_run")!;
      const result = await handler({ name: "full" });
      const text = getText(result);
      expect(text).toContain("Pipeline: full — PASS");
      expect(text).toContain("**Steps:** 4/4");
    });

    it("should stop on first failure when fail_fast is true (default)", async () => {
      mockExecSync.mockReturnValueOnce("No lint issues\n");
      // typecheck fails
      const err = new Error("Type check failed") as Error & {
        stdout?: string;
        status?: number;
      };
      err.stdout = "Found 3 errors";
      err.status = 2;
      mockExecSync.mockImplementationOnce(() => {
        throw err;
      });

      const handler = registry.handlers.get("pipeline_run")!;
      const result = await handler({ name: "ci" });
      const text = getText(result);
      expect(text).toContain("Pipeline: ci — FAIL");
      expect(text).toContain("**Steps:** 2/3"); // Stopped after typecheck
      expect(text).toContain("**lint** — PASS");
      expect(text).toContain("**typecheck** — FAIL");
      expect(text).not.toContain("**tests**");
    });

    it("should continue on failure when fail_fast is false", async () => {
      mockExecSync.mockReturnValueOnce("No lint issues\n");
      // typecheck fails
      const err = new Error("Type check failed") as Error & {
        stdout?: string;
        status?: number;
      };
      err.stdout = "Found 3 errors";
      err.status = 2;
      mockExecSync
        .mockImplementationOnce(() => {
          throw err;
        })
        .mockReturnValueOnce("Tests passed\n");

      const handler = registry.handlers.get("pipeline_run")!;
      const result = await handler({ name: "ci", fail_fast: false });
      const text = getText(result);
      expect(text).toContain("Pipeline: ci — FAIL");
      expect(text).toContain("**Steps:** 3/3"); // All steps ran
      expect(text).toContain("**lint** — PASS");
      expect(text).toContain("**typecheck** — FAIL");
      expect(text).toContain("**tests** — PASS");
    });

    it("should show failure summary for failed steps", async () => {
      const err = new Error("Lint failed") as Error & {
        stdout?: string;
        status?: number;
      };
      err.stdout = "10:5  error  no-unused-vars  x is defined but never used";
      err.status = 1;
      mockExecSync.mockImplementation(() => {
        throw err;
      });

      const handler = registry.handlers.get("pipeline_run")!;
      const result = await handler({ name: "quick" });
      const text = getText(result);
      expect(text).toContain("Pipeline: quick — FAIL");
      expect(text).toContain("**lint** — FAIL");
      expect(text).toContain("no-unused-vars");
    });

    it("should report total duration across all steps", async () => {
      mockExecSync
        .mockReturnValueOnce("OK\n")
        .mockReturnValueOnce("OK\n");

      const handler = registry.handlers.get("pipeline_run")!;
      const result = await handler({ name: "quick" });
      const text = getText(result);
      expect(text).toContain("**Total duration:**");
    });
  });

  describe("pipeline_run edge cases", () => {
    it("should reject unknown pipeline name", async () => {
      const handler = registry.handlers.get("pipeline_run")!;
      const result = await handler({ name: "nonexistent" });
      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("Unknown pipeline");
      expect(text).toContain("nonexistent");
    });
  });

  describe("output truncation", () => {
    it("should truncate very long test output", async () => {
      // Return output longer than 6000 chars to trigger truncation
      mockExecSync.mockReturnValue("x".repeat(7000));

      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("...(truncated)");
    });
  });

  // ── Input validation edge cases ──────────────────────────────

  describe("input validation", () => {
    it("should accept valid directory-like scopes", async () => {
      mockExecSync.mockReturnValue("OK\n");

      const handler = registry.handlers.get("pipeline_run_tests")!;
      await handler({ scope: "src/lib/mcp/server/tools" });

      expect(mockExecSync).toHaveBeenCalledWith(
        expect.stringContaining("src/lib/mcp/server/tools"),
        expect.objectContaining({}),
      );
    });

    it("should reject scope with backticks", async () => {
      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({ scope: "`whoami`" });
      expect(getText(result)).toContain("VALIDATION_ERROR");
    });

    it("should reject scope with $() subshell", async () => {
      const handler = registry.handlers.get("pipeline_lint")!;
      const result = await handler({ scope: "$(cat /etc/passwd)" });
      expect(getText(result)).toContain("VALIDATION_ERROR");
    });

    it("should reject scope exceeding 200 characters", async () => {
      const handler = registry.handlers.get("pipeline_run_tests")!;
      const result = await handler({ scope: "a".repeat(201) });
      expect(getText(result)).toContain("VALIDATION_ERROR");
    });
  });
});
