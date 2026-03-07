import { readdir, access, readFile } from "node:fs/promises";
import { resolve, dirname, basename, join, relative } from "node:path";
import type { LinkValidationResult, ExtractedLink } from "./types.js";
import { extractHeadings } from "./markdown-parser.js";

export async function validateRelativeLink(
  link: ExtractedLink,
  sourceFile: string,
  rootDir: string,
): Promise<LinkValidationResult> {
  const start = Date.now();
  const target = decodeURIComponent(link.target);
  const sourceDir = dirname(sourceFile);
  const resolved = resolve(sourceDir, target);

  // Security: ensure resolved path is within rootDir
  const rel = relative(rootDir, resolved);
  if (rel.startsWith("..") || resolve(rootDir, rel) !== resolved) {
    return {
      link,
      status: "broken",
      reason: `Path escapes root directory: ${target}`,
      durationMs: Date.now() - start,
    };
  }

  try {
    await access(resolved);
  } catch {
    const suggestion = await suggestCorrectPath(target, sourceDir, rootDir);
    return {
      link,
      status: "broken",
      reason: `File not found: ${target}`,
      suggestion,
      durationMs: Date.now() - start,
    };
  }

  // Case sensitivity check: verify the exact filename matches on disk
  const parentDir = dirname(resolved);
  const expectedName = basename(resolved);
  try {
    const entries = await readdir(parentDir);
    const exactMatch = entries.find((e) => e === expectedName);
    if (!exactMatch) {
      const caseMatch = entries.find((e) => e.toLowerCase() === expectedName.toLowerCase());
      if (caseMatch) {
        return {
          link,
          status: "warning",
          reason: `Case mismatch: "${expectedName}" on disk is "${caseMatch}" (will break on case-sensitive filesystems)`,
          suggestion: target.replace(expectedName, caseMatch),
          durationMs: Date.now() - start,
        };
      }
    }
  } catch {
    // readdir failed, skip case check
  }

  return {
    link,
    status: "ok",
    reason: "File exists",
    durationMs: Date.now() - start,
  };
}

export async function validateAnchor(
  link: ExtractedLink,
  sourceContent: string,
): Promise<LinkValidationResult> {
  const start = Date.now();
  const anchor = link.target.slice(1); // Remove leading #
  const headings = extractHeadings(sourceContent);

  if (headings.includes(anchor)) {
    return {
      link,
      status: "ok",
      reason: "Anchor found",
      durationMs: Date.now() - start,
    };
  }

  return {
    link,
    status: "broken",
    reason: `Anchor "#${anchor}" not found in file headings`,
    suggestion:
      headings.length > 0
        ? `Available anchors: ${headings
            .slice(0, 5)
            .map((h) => `#${h}`)
            .join(", ")}`
        : undefined,
    durationMs: Date.now() - start,
  };
}

export async function validateFileWithAnchor(
  link: ExtractedLink,
  sourceFile: string,
  rootDir: string,
): Promise<LinkValidationResult> {
  const start = Date.now();
  const [filePart, anchor] = link.target.split("#", 2) as [string, string];
  const sourceDir = dirname(sourceFile);
  const resolved = resolve(sourceDir, decodeURIComponent(filePart));

  try {
    await access(resolved);
  } catch {
    const suggestion = await suggestCorrectPath(filePart, sourceDir, rootDir);
    return {
      link,
      status: "broken",
      reason: `File not found: ${filePart}`,
      suggestion,
      durationMs: Date.now() - start,
    };
  }

  if (anchor) {
    try {
      const content = await readFile(resolved, "utf-8");
      const headings = extractHeadings(content);
      if (!headings.includes(anchor)) {
        return {
          link,
          status: "broken",
          reason: `File exists but anchor "#${anchor}" not found`,
          durationMs: Date.now() - start,
        };
      }
    } catch {
      return {
        link,
        status: "warning",
        reason: `File exists but could not read to verify anchor "#${anchor}"`,
        durationMs: Date.now() - start,
      };
    }
  }

  return {
    link,
    status: "ok",
    reason: "File and anchor exist",
    durationMs: Date.now() - start,
  };
}

export async function suggestCorrectPath(
  brokenPath: string,
  sourceDir: string,
  rootDir: string,
): Promise<string | undefined> {
  const targetName = basename(brokenPath);

  // Search in sibling directories and common doc locations
  const searchDirs = [sourceDir, dirname(sourceDir), rootDir, join(rootDir, "docs")];

  for (const dir of searchDirs) {
    try {
      const entries = await readdir(dir, { recursive: true });
      for (const entry of entries) {
        if (typeof entry === "string" && basename(entry) === targetName) {
          const foundPath = join(dir, entry);
          const suggestion = relative(sourceDir, foundPath);
          if (suggestion !== brokenPath) {
            return suggestion.startsWith(".") ? suggestion : `./${suggestion}`;
          }
        }
      }
    } catch {
      // Directory not readable, skip
    }
  }

  return undefined;
}
