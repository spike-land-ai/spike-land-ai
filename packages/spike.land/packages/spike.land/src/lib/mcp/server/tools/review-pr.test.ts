// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockReadFile } = vi.hoisted(() => ({
  mockReadFile: vi.fn(),
}));

vi.mock("fs/promises", () => ({
  readFile: mockReadFile,
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerReviewPrTools } from "./review-pr";

describe("review-pr tools", () => {
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerReviewPrTools(registry, "test-user");
  });

  it("should register 4 review-pr tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("review_get_diff")).toBe(true);
    expect(registry.handlers.has("review_suggest_fix")).toBe(true);
    expect(registry.handlers.has("review_check_conventions")).toBe(true);
    expect(registry.handlers.has("review_security_scan")).toBe(true);
  });

  // ---------------------------------------------------------------------------
  // review_get_diff
  // ---------------------------------------------------------------------------
  describe("review_get_diff", () => {
    it("should return diff for a PR number", async () => {
      const handler = registry.handlers.get("review_get_diff")!;
      const result = await handler({ pr_number: 42 });
      const text = getText(result);
      expect(text).toContain("PR #42");
      expect(text).toContain("Changed files:");
      expect(text).toContain("route.ts");
    });

    it("should return diff for a branch", async () => {
      const handler = registry.handlers.get("review_get_diff")!;
      const result = await handler({ branch: "feature/my-feature" });
      const text = getText(result);
      expect(text).toContain("branch 'feature/my-feature'");
    });

    it("should return error when neither pr_number nor branch is provided", async () => {
      const handler = registry.handlers.get("review_get_diff")!;
      const result = await handler({});
      expect(getText(result)).toContain("Provide either pr_number or branch");
    });

    it("should filter files using a glob pattern", async () => {
      const handler = registry.handlers.get("review_get_diff")!;
      const result = await handler({ pr_number: 1, file_filter: "**/*.ts" });
      const text = getText(result);
      // .ts files match; .tsx and package.json do not
      expect(text).toContain("route.ts");
      expect(text).toContain("helper.ts");
      expect(text).not.toContain("package.json");
      expect(text).not.toContain("Button.tsx");
    });

    it("should return message when no files match the filter", async () => {
      const handler = registry.handlers.get("review_get_diff")!;
      const result = await handler({ pr_number: 1, file_filter: "**/*.go" });
      expect(getText(result)).toContain("No files match filter");
    });

    it("should mark key files with [KEY] label", async () => {
      const handler = registry.handlers.get("review_get_diff")!;
      const result = await handler({ pr_number: 7 });
      expect(getText(result)).toContain("[KEY]");
    });

    it("should include addition and deletion totals", async () => {
      const handler = registry.handlers.get("review_get_diff")!;
      const result = await handler({ pr_number: 5 });
      const text = getText(result);
      expect(text).toMatch(/Total: \+\d+ \/ -\d+/);
    });
  });

  // ---------------------------------------------------------------------------
  // review_suggest_fix
  // ---------------------------------------------------------------------------
  describe("review_suggest_fix", () => {
    it("should suggest a fix for an 'any' type issue", async () => {
      const handler = registry.handlers.get("review_suggest_fix")!;
      const result = await handler({
        file_path: "src/lib/helper.ts",
        line_number: 10,
        issue_description: "Using any type",
      });
      const text = getText(result);
      expect(text).toContain("Fix suggestion for src/lib/helper.ts:10");
      expect(text).toContain("unknown");
      expect(text).toContain("Confidence:");
    });

    it("should suggest removing console.log", async () => {
      const handler = registry.handlers.get("review_suggest_fix")!;
      const result = await handler({
        file_path: "src/app/page.tsx",
        line_number: 5,
        issue_description: "console.log used for debug output",
      });
      const text = getText(result);
      expect(text).toContain("logger");
      expect(text).toContain("Before:");
      expect(text).toContain("After:");
    });

    it("should suggest removing eval()", async () => {
      const handler = registry.handlers.get("review_suggest_fix")!;
      const result = await handler({
        file_path: "src/lib/exec.ts",
        line_number: 22,
        issue_description: "eval() call on user input",
      });
      const text = getText(result);
      expect(text).toContain("eval");
      expect(text).toContain("98%");
    });

    it("should suggest moving hardcoded password to env", async () => {
      const handler = registry.handlers.get("review_suggest_fix")!;
      const result = await handler({
        file_path: "src/lib/auth.ts",
        line_number: 3,
        issue_description: "Hardcoded password in source",
      });
      const text = getText(result);
      expect(text).toContain("process.env");
    });

    it("should return a generic fix for unrecognized issue types", async () => {
      const handler = registry.handlers.get("review_suggest_fix")!;
      const result = await handler({
        file_path: "src/foo.ts",
        line_number: 1,
        issue_description: "Unclear naming",
      });
      const text = getText(result);
      expect(text).toContain("Fix suggestion");
      expect(text).toContain("Confidence:");
    });
  });

  // ---------------------------------------------------------------------------
  // review_check_conventions
  // ---------------------------------------------------------------------------
  describe("review_check_conventions", () => {
    it("should pass a clean file with no issues", async () => {
      mockReadFile.mockResolvedValue("import { z } from \"zod\";\nconst x: string = \"hello\";");
      const handler = registry.handlers.get("review_check_conventions")!;
      const result = await handler({ file_paths: ["src/lib/clean.ts"] });
      const text = getText(result);
      expect(text).toContain("OK");
      expect(text).toContain("Total issues: 0");
    });

    it("should flag 'any' type usage", async () => {
      mockReadFile.mockResolvedValue("const data: any = {};");
      const handler = registry.handlers.get("review_check_conventions")!;
      const result = await handler({ file_paths: ["src/lib/bad.ts"] });
      const text = getText(result);
      expect(text).toContain("no-any");
      expect(text).toContain("ERROR");
    });

    it("should flag @ts-ignore comments", async () => {
      mockReadFile.mockResolvedValue("// @ts-ignore\nconst x = undefined as string;");
      const handler = registry.handlers.get("review_check_conventions")!;
      const result = await handler({ file_paths: ["src/lib/ignore.ts"] });
      expect(getText(result)).toContain("no-ts-ignore");
    });

    it("should flag console.log usage", async () => {
      mockReadFile.mockResolvedValue("console.log(\"hello\");");
      const handler = registry.handlers.get("review_check_conventions")!;
      const result = await handler({ file_paths: ["src/lib/log.ts"] });
      expect(getText(result)).toContain("no-console");
    });

    it("should handle unreadable files gracefully", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      const handler = registry.handlers.get("review_check_conventions")!;
      const result = await handler({ file_paths: ["src/lib/missing.ts"] });
      expect(getText(result)).toContain("could not read file");
    });

    it("should aggregate issues across multiple files", async () => {
      mockReadFile
        .mockResolvedValueOnce("const x: any = {};")
        .mockResolvedValueOnce("console.log(\"debug\");");
      const handler = registry.handlers.get("review_check_conventions")!;
      const result = await handler({
        file_paths: ["src/a.ts", "src/b.ts"],
      });
      const text = getText(result);
      expect(text).toContain("Convention Check (2 file(s))");
      expect(text).toContain("Total issues: 2");
    });
  });

  // ---------------------------------------------------------------------------
  // review_security_scan
  // ---------------------------------------------------------------------------
  describe("review_security_scan", () => {
    it("should report no vulnerabilities for clean code", async () => {
      mockReadFile.mockResolvedValue("const x = \"hello\";");
      const handler = registry.handlers.get("review_security_scan")!;
      const result = await handler({ file_paths: ["src/lib/clean.ts"] });
      const text = getText(result);
      expect(text).toContain("no vulnerabilities found");
      expect(text).toContain("0 total");
    });

    it("should detect eval() as critical", async () => {
      mockReadFile.mockResolvedValue("const r = eval(input);");
      const handler = registry.handlers.get("review_security_scan")!;
      const result = await handler({
        file_paths: ["src/lib/exec.ts"],
        scan_type: "thorough",
      });
      const text = getText(result);
      expect(text).toContain("CRITICAL");
      expect(text).toContain("CWE-95");
    });

    it("should detect dangerouslySetInnerHTML as high severity", async () => {
      mockReadFile.mockResolvedValue(
        "<div dangerouslySetInnerHTML={{ __html: userHtml }} />",
      );
      const handler = registry.handlers.get("review_security_scan")!;
      const result = await handler({
        file_paths: ["src/components/Risky.tsx"],
        scan_type: "thorough",
      });
      const text = getText(result);
      expect(text).toContain("HIGH");
      expect(text).toContain("CWE-79");
    });

    it("should detect Math.random() only in thorough mode", async () => {
      mockReadFile.mockResolvedValue("const token = Math.random().toString(36);");
      const handler = registry.handlers.get("review_security_scan")!;

      const quickResult = await handler({
        file_paths: ["src/lib/token.ts"],
        scan_type: "quick",
      });
      expect(getText(quickResult)).toContain("no vulnerabilities found");

      mockReadFile.mockResolvedValue("const token = Math.random().toString(36);");
      const thoroughResult = await handler({
        file_paths: ["src/lib/token.ts"],
        scan_type: "thorough",
      });
      expect(getText(thoroughResult)).toContain("CWE-338");
    });

    it("should handle unreadable files gracefully", async () => {
      mockReadFile.mockRejectedValue(new Error("ENOENT"));
      const handler = registry.handlers.get("review_security_scan")!;
      const result = await handler({ file_paths: ["missing.ts"] });
      expect(getText(result)).toContain("could not read file");
    });

    it("should aggregate findings from multiple files", async () => {
      mockReadFile
        .mockResolvedValueOnce("const pass = \"s3cr3t\";")
        .mockResolvedValueOnce("const r = eval(input);");
      const handler = registry.handlers.get("review_security_scan")!;
      const result = await handler({
        file_paths: ["src/a.ts", "src/b.ts"],
        scan_type: "quick",
      });
      const text = getText(result);
      // Both patterns are critical/high — should appear in quick scan
      expect(text).toContain("Vulnerability Details:");
    });

    it("should include fix suggestions in vulnerability details", async () => {
      mockReadFile.mockResolvedValue("const r = eval(input);");
      const handler = registry.handlers.get("review_security_scan")!;
      const result = await handler({
        file_paths: ["src/lib/bad.ts"],
        scan_type: "thorough",
      });
      const text = getText(result);
      expect(text).toContain("Fix:");
      expect(text).toContain("Location:");
    });
  });
});
