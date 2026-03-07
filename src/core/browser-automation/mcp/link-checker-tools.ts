import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, textResult, jsonResult } from "@spike-land-ai/mcp-server-base";
import { z } from "zod";

import { checkLinks, checkSingleFile, formatReport } from "../core-logic/link-checker/checker.js";

export function registerLinkCheckerTools(server: McpServer): void {
  // Tool 1: check_links - Full directory scan
  createZodTool(server, {
    name: "check_links",
    description:
      "Scan markdown files in a directory for broken links. Validates relative file paths, anchors, GitHub URLs, and optionally external URLs.",
    schema: {
      root_dir: z.string().describe("Root directory to scan"),
      file_pattern: z.string().optional().describe("Glob pattern for files (default: **/*.md)"),
      files: z.array(z.string()).optional().describe("Specific files to check (overrides file_pattern)"),
      check_external: z.boolean().optional().describe("Check external HTTP URLs (default: false)"),
      check_github: z.boolean().optional().describe("Validate GitHub URLs via API (default: true)"),
      skip_code_blocks: z.boolean().optional().describe("Skip links in code blocks (default: true)"),
      github_token: z.string().optional().describe("GitHub token for API auth"),
      concurrency: z.number().optional().describe("Max concurrent HTTP requests (default: 5)"),
      timeout: z.number().optional().describe("HTTP timeout in ms (default: 10000)"),
      verbose: z.boolean().optional().describe("Include all link results, not just issues"),
      format: z.enum(["text", "json"]).optional().describe("Output format (default: text)"),
      exclude_patterns: z.array(z.string()).optional().describe("Patterns to exclude from scan"),
    },
    async handler(args) {
      const report = await checkLinks({
        rootDir: String(args.root_dir),
        filePattern: args.file_pattern as string | undefined,
        files: args.files as string[] | undefined,
        checkExternal: args.check_external as boolean | undefined,
        checkGithub: args.check_github as boolean | undefined,
        skipCodeBlocks: args.skip_code_blocks as boolean | undefined,
        githubToken: args.github_token as string | undefined,
        concurrency: args.concurrency as number | undefined,
        timeout: args.timeout as number | undefined,
        verbose: args.verbose as boolean | undefined,
        excludePatterns: args.exclude_patterns as string[] | undefined,
      });

      if (args.format === "json") {
        return jsonResult(report);
      }

      return textResult(formatReport(report));
    },
  });

  // Tool 2: check_file_links - Single file check
  createZodTool(server, {
    name: "check_file_links",
    description:
      "Check all links in a single markdown file. Returns broken links, warnings, and suggestions.",
    schema: {
      file_path: z.string().describe("Path to the markdown file to check"),
      check_external: z.boolean().optional().describe("Check external HTTP URLs (default: false)"),
      check_github: z.boolean().optional().describe("Validate GitHub URLs via API (default: true)"),
      github_token: z.string().optional().describe("GitHub token for API auth"),
      format: z.enum(["text", "json"]).optional().describe("Output format (default: text)"),
    },
    async handler(args) {
      const fileReport = await checkSingleFile(String(args.file_path), {
        checkExternal: args.check_external as boolean | undefined,
        checkGithub: args.check_github as boolean | undefined,
        githubToken: args.github_token as string | undefined,
      });

      if (args.format === "json") {
        return jsonResult(fileReport);
      }

      // Format single file report as text
      const lines: string[] = [];
      lines.push(`# Link Check: ${fileReport.filePath}`);
      lines.push(`Total links: ${fileReport.totalLinks}`);
      lines.push(`OK: ${fileReport.ok.length} | Broken: ${fileReport.broken.length} | Warnings: ${fileReport.warnings.length} | Errors: ${fileReport.errors.length} | Skipped: ${fileReport.skipped.length}`);

      if (fileReport.broken.length > 0) {
        lines.push("\n## Broken Links");
        for (const r of fileReport.broken) {
          lines.push(`- Line ${r.link.line}: \`${r.link.target}\``);
          lines.push(`  ${r.reason}`);
          if (r.suggestion) lines.push(`  Suggestion: ${r.suggestion}`);
        }
      }

      if (fileReport.warnings.length > 0) {
        lines.push("\n## Warnings");
        for (const r of fileReport.warnings) {
          lines.push(`- Line ${r.link.line}: \`${r.link.target}\``);
          lines.push(`  ${r.reason}`);
          if (r.suggestion) lines.push(`  Suggestion: ${r.suggestion}`);
        }
      }

      return textResult(lines.join("\n"));
    },
  });
}
