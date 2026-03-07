import { afterEach, describe, expect, it, vi } from "vitest";

// Mock the checker module
const mockCheckLinks = vi.fn();
const mockCheckSingleFile = vi.fn();
const mockFormatReport = vi.fn();

vi.mock("../../../src/core/browser-automation/core-logic/link-checker/checker.js", () => ({
  checkLinks: (...args: unknown[]) => mockCheckLinks(...args),
  checkSingleFile: (...args: unknown[]) => mockCheckSingleFile(...args),
  formatReport: (...args: unknown[]) => mockFormatReport(...args),
}));

import { createMockServer } from "@spike-land-ai/mcp-server-base";
import { registerLinkCheckerTools } from "../../../src/core/browser-automation/mcp/link-checker-tools.js";
import type {
  ScanReport,
  FileReport,
} from "../../../src/core/browser-automation/core-logic/link-checker/types.js";

describe("link checker MCP tools", () => {
  const server = createMockServer();
  registerLinkCheckerTools(server as never);

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("check_links", () => {
    it("is registered", () => {
      expect(server.handlers.has("check_links")).toBe(true);
    });

    it("returns formatted text by default", async () => {
      const report: ScanReport = {
        rootDir: "/project",
        filePattern: "**/*.md",
        filesScanned: 1,
        summary: { totalLinks: 3, broken: 1, warnings: 0, ok: 2, skipped: 0, errors: 0 },
        files: [],
        durationMs: 100,
      };
      mockCheckLinks.mockResolvedValue(report);
      mockFormatReport.mockReturnValue("# Report\nBroken: 1");

      const result = await server.call("check_links", { root_dir: "/project" });
      expect(result.content[0]!.text).toContain("Report");
      expect(mockCheckLinks).toHaveBeenCalledWith(expect.objectContaining({ rootDir: "/project" }));
    });

    it("returns JSON when format=json", async () => {
      const report: ScanReport = {
        rootDir: "/project",
        filePattern: "**/*.md",
        filesScanned: 0,
        summary: { totalLinks: 0, broken: 0, warnings: 0, ok: 0, skipped: 0, errors: 0 },
        files: [],
        durationMs: 10,
      };
      mockCheckLinks.mockResolvedValue(report);

      const result = await server.call("check_links", {
        root_dir: "/project",
        format: "json",
      });
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.rootDir).toBe("/project");
    });

    it("passes options through", async () => {
      mockCheckLinks.mockResolvedValue({
        rootDir: "/project",
        filePattern: "docs/**/*.md",
        filesScanned: 0,
        summary: { totalLinks: 0, broken: 0, warnings: 0, ok: 0, skipped: 0, errors: 0 },
        files: [],
        durationMs: 10,
      });
      mockFormatReport.mockReturnValue("");

      await server.call("check_links", {
        root_dir: "/project",
        file_pattern: "docs/**/*.md",
        check_external: true,
        check_github: false,
        concurrency: 3,
      });

      expect(mockCheckLinks).toHaveBeenCalledWith(
        expect.objectContaining({
          rootDir: "/project",
          filePattern: "docs/**/*.md",
          checkExternal: true,
          checkGithub: false,
          concurrency: 3,
        }),
      );
    });
  });

  describe("check_file_links", () => {
    it("is registered", () => {
      expect(server.handlers.has("check_file_links")).toBe(true);
    });

    it("checks a single file and returns text", async () => {
      const fileReport: FileReport = {
        filePath: "/project/README.md",
        totalLinks: 5,
        broken: [
          {
            link: {
              target: "./missing.md",
              text: "link",
              line: 3,
              column: 1,
              category: "relative_file",
              inCodeBlock: false,
              inComment: false,
            },
            status: "broken",
            reason: "File not found",
            durationMs: 2,
          },
        ],
        warnings: [],
        ok: [],
        skipped: [],
        errors: [],
      };
      mockCheckSingleFile.mockResolvedValue(fileReport);

      const result = await server.call("check_file_links", {
        file_path: "/project/README.md",
      });
      expect(result.content[0]!.text).toContain("Broken Links");
      expect(result.content[0]!.text).toContain("./missing.md");
    });

    it("returns JSON when format=json", async () => {
      const fileReport: FileReport = {
        filePath: "test.md",
        totalLinks: 0,
        broken: [],
        warnings: [],
        ok: [],
        skipped: [],
        errors: [],
      };
      mockCheckSingleFile.mockResolvedValue(fileReport);

      const result = await server.call("check_file_links", {
        file_path: "test.md",
        format: "json",
      });
      const parsed = JSON.parse(result.content[0]!.text);
      expect(parsed.filePath).toBe("test.md");
    });
  });
});
