import { readdir, readFile, stat } from "node:fs/promises";
import { join, relative, resolve } from "node:path";
import type {
  CheckerOptions,
  FileReport,
  LinkValidationResult,
  ScanReport,
} from "./types.js";
import { extractLinks } from "./markdown-parser.js";
import {
  validateRelativeLink,
  validateAnchor,
  validateFileWithAnchor,
} from "./file-validator.js";
import { createUrlValidator } from "./url-validator.js";
import { parseGitHubUrl, parseShieldsBadge, validateGitHubUrl } from "./github-validator.js";

export async function checkLinks(options: CheckerOptions): Promise<ScanReport> {
  const start = Date.now();
  const {
    rootDir,
    filePattern = "**/*.md",
    files,
    checkExternal = false,
    checkGithub = true,
    skipCodeBlocks = true,
    skipComments = true,
    githubToken,
    concurrency = 5,
    timeout = 10_000,
    excludePatterns = [],
  } = options;

  // Discover markdown files
  const mdFiles = files ?? (await discoverFiles(rootDir, filePattern, excludePatterns));

  const urlValidator = createUrlValidator({ concurrency, timeout });
  const urlCache = new Map<string, LinkValidationResult>();
  const fileReports: FileReport[] = [];

  for (const filePath of mdFiles) {
    const absPath = resolve(rootDir, filePath);
    let content: string;
    try {
      content = await readFile(absPath, "utf-8");
    } catch {
      continue; // Skip unreadable files
    }

    const links = extractLinks(content, absPath);
    const report: FileReport = {
      filePath: relative(rootDir, absPath),
      totalLinks: links.length,
      broken: [],
      warnings: [],
      ok: [],
      skipped: [],
      errors: [],
    };

    for (const link of links) {
      // Skip links in code blocks/comments if configured
      if (skipCodeBlocks && link.inCodeBlock) {
        report.skipped.push({
          link,
          status: "skipped",
          reason: "Inside code block",
          durationMs: 0,
        });
        continue;
      }
      if (skipComments && link.inComment) {
        report.skipped.push({
          link,
          status: "skipped",
          reason: "Inside HTML comment",
          durationMs: 0,
        });
        continue;
      }

      let result: LinkValidationResult;

      switch (link.category) {
        case "skipped":
          result = { link, status: "skipped", reason: "Skipped protocol/domain", durationMs: 0 };
          break;

        case "relative_file":
          result = await validateRelativeLink(link, absPath, rootDir);
          break;

        case "anchor":
          result = await validateAnchor(link, content);
          break;

        case "file_with_anchor":
          result = await validateFileWithAnchor(link, absPath, rootDir);
          break;

        case "github_repo":
        case "github_file":
        case "github_tree":
        case "github_raw": {
          if (!checkGithub) {
            result = { link, status: "skipped", reason: "GitHub checking disabled", durationMs: 0 };
            break;
          }
          // Check URL cache
          const cached = urlCache.get(link.target);
          if (cached) {
            result = { ...cached, link };
            break;
          }
          const parsed = parseGitHubUrl(link.target);
          if (parsed) {
            result = await validateGitHubUrl(link, parsed, githubToken ? { token: githubToken, timeout } : { timeout });
            urlCache.set(link.target, result);
          } else {
            result = { link, status: "error", reason: "Could not parse GitHub URL", durationMs: 0 };
          }
          break;
        }

        case "github_badge": {
          if (!checkGithub) {
            result = { link, status: "skipped", reason: "GitHub checking disabled", durationMs: 0 };
            break;
          }
          const cached = urlCache.get(link.target);
          if (cached) {
            result = { ...cached, link };
            break;
          }
          const badgeParsed = parseShieldsBadge(link.target);
          if (badgeParsed) {
            result = await validateGitHubUrl(link, badgeParsed, githubToken ? { token: githubToken, timeout } : { timeout });
            urlCache.set(link.target, result);
          } else {
            result = { link, status: "warning", reason: "Could not parse shields.io badge URL", durationMs: 0 };
          }
          break;
        }

        case "external_url": {
          if (!checkExternal) {
            result = { link, status: "skipped", reason: "External URL checking disabled", durationMs: 0 };
            break;
          }
          const cached = urlCache.get(link.target);
          if (cached) {
            result = { ...cached, link };
            break;
          }
          result = await urlValidator.validate(link);
          urlCache.set(link.target, result);
          break;
        }

        default:
          result = { link, status: "error", reason: `Unknown category: ${link.category}`, durationMs: 0 };
      }

      // Sort result into report buckets
      switch (result.status) {
        case "ok": report.ok.push(result); break;
        case "broken": report.broken.push(result); break;
        case "warning": report.warnings.push(result); break;
        case "skipped": report.skipped.push(result); break;
        case "error": report.errors.push(result); break;
      }
    }

    if (report.totalLinks > 0) {
      fileReports.push(report);
    }
  }

  const summary = {
    totalLinks: 0,
    broken: 0,
    warnings: 0,
    ok: 0,
    skipped: 0,
    errors: 0,
  };

  for (const fr of fileReports) {
    summary.totalLinks += fr.totalLinks;
    summary.broken += fr.broken.length;
    summary.warnings += fr.warnings.length;
    summary.ok += fr.ok.length;
    summary.skipped += fr.skipped.length;
    summary.errors += fr.errors.length;
  }

  return {
    rootDir,
    filePattern,
    filesScanned: mdFiles.length,
    summary,
    files: fileReports,
    durationMs: Date.now() - start,
  };
}

export async function checkSingleFile(
  filePath: string,
  options: Partial<CheckerOptions> = {},
): Promise<FileReport> {
  const rootDir = options.rootDir ?? (await findRepoRootAsync(filePath)) ?? process.cwd();
  const report = await checkLinks({
    ...options,
    rootDir,
    files: [filePath],
  });
  return report.files[0] ?? {
    filePath,
    totalLinks: 0,
    broken: [],
    warnings: [],
    ok: [],
    skipped: [],
    errors: [],
  };
}

export function formatReport(report: ScanReport): string {
  const lines: string[] = [];

  lines.push(`# Link Check Report`);
  lines.push(`Root: ${report.rootDir}`);
  lines.push(`Files scanned: ${report.filesScanned}`);
  lines.push(`Duration: ${report.durationMs}ms`);
  lines.push("");
  lines.push(`## Summary`);
  lines.push(`Total links: ${report.summary.totalLinks}`);
  lines.push(`OK: ${report.summary.ok}`);
  lines.push(`Broken: ${report.summary.broken}`);
  lines.push(`Warnings: ${report.summary.warnings}`);
  lines.push(`Errors: ${report.summary.errors}`);
  lines.push(`Skipped: ${report.summary.skipped}`);

  // Show broken links
  const brokenFiles = report.files.filter((f) => f.broken.length > 0);
  if (brokenFiles.length > 0) {
    lines.push("");
    lines.push(`## Broken Links`);
    for (const file of brokenFiles) {
      lines.push(`\n### ${file.filePath}`);
      for (const result of file.broken) {
        lines.push(`- Line ${result.link.line}: \`${result.link.target}\``);
        lines.push(`  Reason: ${result.reason}`);
        if (result.suggestion) {
          lines.push(`  Suggestion: ${result.suggestion}`);
        }
      }
    }
  }

  // Show warnings
  const warnFiles = report.files.filter((f) => f.warnings.length > 0);
  if (warnFiles.length > 0) {
    lines.push("");
    lines.push(`## Warnings`);
    for (const file of warnFiles) {
      lines.push(`\n### ${file.filePath}`);
      for (const result of file.warnings) {
        lines.push(`- Line ${result.link.line}: \`${result.link.target}\``);
        lines.push(`  ${result.reason}`);
        if (result.suggestion) {
          lines.push(`  Suggestion: ${result.suggestion}`);
        }
      }
    }
  }

  return lines.join("\n");
}

async function discoverFiles(
  rootDir: string,
  _pattern: string,
  excludePatterns: string[],
): Promise<string[]> {
  const allFiles: string[] = [];

  try {
    const entries = await readdir(rootDir, { recursive: true });
    for (const entry of entries) {
      if (typeof entry !== "string") continue;
      if (!entry.endsWith(".md")) continue;

      // Check exclude patterns
      let excluded = false;
      for (const exclude of excludePatterns) {
        if (entry.includes(exclude)) {
          excluded = true;
          break;
        }
      }
      if (excluded) continue;

      // Skip node_modules, .git, dist, coverage
      if (
        entry.includes("node_modules") ||
        entry.includes(".git/") ||
        entry.includes("dist/") ||
        entry.includes("coverage/")
      ) {
        continue;
      }

      allFiles.push(entry);
    }
  } catch {
    // Root directory not readable
  }

  return allFiles;
}

async function findRepoRootAsync(startPath: string): Promise<string | undefined> {
  let current = resolve(startPath);
  for (let i = 0; i < 20; i++) {
    try {
      await stat(join(current, ".git"));
      return current;
    } catch {
      const parent = resolve(current, "..");
      if (parent === current) break;
      current = parent;
    }
  }
  return undefined;
}
