import { afterEach, describe, expect, it, vi } from "vitest";

const mockReaddir = vi.fn();
const mockReadFile = vi.fn();
const mockStat = vi.fn();
const mockAccess = vi.fn();

vi.mock("node:fs/promises", () => ({
  readdir: (...args: unknown[]) => mockReaddir(...args),
  readFile: (...args: unknown[]) => mockReadFile(...args),
  stat: (...args: unknown[]) => mockStat(...args),
  access: (...args: unknown[]) => mockAccess(...args),
}));

import {
  checkLinks,
  checkSingleFile,
  formatReport,
} from "../../../src/core/browser-automation/core-logic/link-checker/checker.js";
import type { ScanReport } from "../../../src/core/browser-automation/core-logic/link-checker/types.js";

describe("checkLinks", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("scans files and reports broken relative links", async () => {
    const mdContent = "# Test\n\n[link](./missing.md)\n[ok](./exists.md)";

    mockReaddir.mockResolvedValue(["test.md"]);
    mockReadFile.mockResolvedValue(mdContent);
    mockAccess.mockImplementation(async (path: string) => {
      if ((path as string).includes("missing")) throw new Error("ENOENT");
    });
    // For case sensitivity check on existing file
    mockReaddir.mockImplementation(async (_dir: string, opts?: { recursive?: boolean }) => {
      if (opts?.recursive) return ["test.md"];
      return ["exists.md"];
    });

    const report = await checkLinks({
      rootDir: "/project",
      files: ["test.md"],
      checkGithub: false,
      checkExternal: false,
    });

    expect(report.filesScanned).toBe(1);
    expect(report.summary.broken).toBeGreaterThanOrEqual(1);
  });

  it("skips node_modules and .git directories", async () => {
    mockReaddir.mockResolvedValue([
      "README.md",
      "node_modules/pkg/README.md",
      ".git/hooks/README.md",
      "dist/README.md",
    ]);

    const report = await checkLinks({
      rootDir: "/project",
      checkGithub: false,
      checkExternal: false,
    });

    // Only README.md should be scanned (others filtered out)
    expect(report.filesScanned).toBeLessThanOrEqual(1);
  });

  it("uses URL deduplication cache", async () => {
    const md = "[a](https://github.com/org/repo)\n[b](https://github.com/org/repo)";
    mockReaddir.mockResolvedValue(["test.md"]);
    mockReadFile.mockResolvedValue(md);

    const originalFetch = globalThis.fetch;
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      headers: new Headers({ "X-RateLimit-Remaining": "50" }),
    });
    globalThis.fetch = mockFetch;

    const report = await checkLinks({
      rootDir: "/project",
      files: ["test.md"],
      checkGithub: true,
      checkExternal: false,
    });

    // Same URL should only be fetched once
    expect(mockFetch).toHaveBeenCalledTimes(1);
    globalThis.fetch = originalFetch;
  });
});

describe("checkSingleFile", () => {
  afterEach(() => {
    vi.clearAllMocks();
    vi.restoreAllMocks();
  });

  it("checks a single file", async () => {
    mockReadFile.mockResolvedValue("# Test\n[link](./file.md)");
    mockAccess.mockResolvedValue(undefined);
    mockReaddir.mockResolvedValue(["file.md"]);
    mockStat.mockRejectedValue(new Error("not found")); // for findRepoRoot

    const report = await checkSingleFile("/project/test.md", {
      rootDir: "/project",
      checkGithub: false,
    });
    expect(report.totalLinks).toBeGreaterThanOrEqual(1);
  });
});

describe("formatReport", () => {
  it("formats a report with broken links", () => {
    const report: ScanReport = {
      rootDir: "/project",
      filePattern: "**/*.md",
      filesScanned: 2,
      summary: {
        totalLinks: 5,
        broken: 2,
        warnings: 1,
        ok: 1,
        skipped: 1,
        errors: 0,
      },
      files: [
        {
          filePath: "README.md",
          totalLinks: 3,
          broken: [
            {
              link: {
                target: "./missing.md",
                text: "link",
                line: 10,
                column: 1,
                category: "relative_file",
                inCodeBlock: false,
                inComment: false,
              },
              status: "broken",
              reason: "File not found: ./missing.md",
              suggestion: "./docs/missing.md",
              durationMs: 5,
            },
          ],
          warnings: [],
          ok: [
            {
              link: {
                target: "./exists.md",
                text: "ok",
                line: 5,
                column: 1,
                category: "relative_file",
                inCodeBlock: false,
                inComment: false,
              },
              status: "ok",
              reason: "File exists",
              durationMs: 1,
            },
          ],
          skipped: [],
          errors: [],
        },
      ],
      durationMs: 100,
    };

    const text = formatReport(report);
    expect(text).toContain("Link Check Report");
    expect(text).toContain("Broken: 2");
    expect(text).toContain("./missing.md");
    expect(text).toContain("Suggestion: ./docs/missing.md");
    expect(text).toContain("Line 10");
  });

  it("handles report with no broken links", () => {
    const report: ScanReport = {
      rootDir: "/project",
      filePattern: "**/*.md",
      filesScanned: 1,
      summary: { totalLinks: 3, broken: 0, warnings: 0, ok: 3, skipped: 0, errors: 0 },
      files: [],
      durationMs: 50,
    };

    const text = formatReport(report);
    expect(text).toContain("Broken: 0");
    expect(text).not.toContain("## Broken Links");
  });
});
