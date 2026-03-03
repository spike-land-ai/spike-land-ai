/**
 * Filesystem Tools (Server-Side)
 *
 * Claude Code-style filesystem operations for codespace virtual file trees.
 * In-memory storage: each codespace gets a Map<path, content>.
 * Entry point /src/App.tsx syncs with the codespace session.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// ── In-memory storage with TTL ────────────────────────────────────────────

/** Default TTL for filesystem entries: 1 hour in milliseconds. */
const DEFAULT_TTL_MS = 60 * 60 * 1000;

interface FilesystemEntry {
  files: Map<string, string>;
  /** Timestamp of last access (read or write). */
  lastAccessedAt: number;
  /** Timer handle for TTL cleanup. */
  ttlTimer: ReturnType<typeof setTimeout>;
}

const filesystems = new Map<string, FilesystemEntry>();

/** Reschedule TTL cleanup for a codespace. */
function touchFilesystem(codespaceId: string): void {
  const entry = filesystems.get(codespaceId);
  if (!entry) return;
  entry.lastAccessedAt = Date.now();
  clearTimeout(entry.ttlTimer);
  entry.ttlTimer = setTimeout(() => {
    filesystems.delete(codespaceId);
  }, DEFAULT_TTL_MS);
}

/** Exported for testing — clears all filesystems and their timers. */
export function _resetFilesystems(): void {
  for (const entry of filesystems.values()) {
    clearTimeout(entry.ttlTimer);
  }
  filesystems.clear();
}

/** Exported for testing — get filesystem count. */
export function _getFilesystemCount(): number {
  return filesystems.size;
}

/** Exported for testing — get the TTL constant. */
export function _getDefaultTtlMs(): number {
  return DEFAULT_TTL_MS;
}

/** Get or create a filesystem for a codespace, resetting its TTL. */
export function getFilesystem(codespaceId: string): Map<string, string> {
  let entry = filesystems.get(codespaceId);
  if (!entry) {
    entry = {
      files: new Map<string, string>(),
      lastAccessedAt: Date.now(),
      ttlTimer: setTimeout(() => {
        filesystems.delete(codespaceId);
      }, DEFAULT_TTL_MS),
    };
    filesystems.set(codespaceId, entry);
  } else {
    touchFilesystem(codespaceId);
  }
  return entry.files;
}

/** Get the files Map for an existing codespace without creating one. */
function getExistingFiles(codespaceId: string): Map<string, string> | undefined {
  const entry = filesystems.get(codespaceId);
  if (entry) {
    touchFilesystem(codespaceId);
    return entry.files;
  }
  return undefined;
}

// ── Constants ──────────────────────────────────────────────────────────────

const CODESPACE_ID_PATTERN = /^[a-zA-Z0-9_.-]+$/;
const MAX_FILE_SIZE_BYTES = 1_048_576; // 1 MB
const MAX_FILE_COUNT = 100;
const MAX_TOTAL_SIZE_BYTES = 52_428_800; // 50 MB
const ENTRY_POINT = "/src/App.tsx";

function validateCodeSpaceId(id: string): void {
  if (!CODESPACE_ID_PATTERN.test(id)) {
    throw new Error(`Invalid codespace ID format: ${id}`);
  }
}

function normalizePath(path: string): string {
  // Ensure leading slash
  if (!path.startsWith("/")) return `/${path}`;
  return path;
}

function totalSizeBytes(fs: Map<string, string>): number {
  let total = 0;
  for (const content of fs.values()) {
    total += new TextEncoder().encode(content).byteLength;
  }
  return total;
}

// ── Glob matching ──────────────────────────────────────────────────────────

function globToRegex(pattern: string): RegExp {
  // Normalize pattern
  const normalized = pattern.startsWith("/") ? pattern : `/${pattern}`;

  let regex = "";
  let i = 0;
  while (i < normalized.length) {
    const char = normalized[i]!;
    if (char === "*" && normalized[i + 1] === "*") {
      // ** matches any path segments
      if (normalized[i + 2] === "/") {
        regex += "(?:.*/)?";
        i += 3;
      } else {
        regex += ".*";
        i += 2;
      }
    } else if (char === "*") {
      // * matches within a single path segment
      regex += "[^/]*";
      i++;
    } else if (char === "?") {
      regex += "[^/]";
      i++;
    } else if (".+^${}()|[]\\".includes(char)) {
      regex += `\\${char}`;
      i++;
    } else {
      regex += char;
      i++;
    }
  }

  return new RegExp(`^${regex}$`);
}

function matchGlob(pattern: string, filePath: string): boolean {
  const re = globToRegex(pattern);
  return re.test(filePath);
}

// ── Registration ───────────────────────────────────────────────────────────

export function registerFilesystemTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  // ── fs_read ────────────────────────────────────────────────────────────
  registry.register({
    name: "fs_read",
    description: "Read a file from the codespace virtual filesystem.\n"
      + "Returns content with line numbers (cat -n style).\n"
      + "Use offset/limit for large files.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      file_path: z.string().min(1).describe("Absolute path e.g. /src/App.tsx"),
      offset: z.number().int().min(1).optional().describe(
        "Start from line number (1-based)",
      ),
      limit: z.number().int().min(1).optional().describe(
        "Number of lines to return",
      ),
    },
    handler: async ({
      codespace_id,
      file_path,
      offset,
      limit,
    }: {
      codespace_id: string;
      file_path: string;
      offset?: number;
      limit?: number;
    }): Promise<CallToolResult> =>
      safeToolCall("fs_read", async () => {
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);
        const path = normalizePath(file_path);

        if (!fs || !fs.has(path)) {
          return {
            content: [{
              type: "text",
              text: `File "${path}" not found in codespace "${codespace_id}".`,
            }],
            isError: true,
          };
        }

        const content = fs.get(path)!;
        let lines = content.split("\n");

        const startLine = offset ?? 1;
        const endLine = limit ? startLine + limit - 1 : lines.length;

        lines = lines.slice(startLine - 1, endLine);

        const numbered = lines
          .map((line, i) => {
            const lineNum = String(startLine + i).padStart(6, " ");
            return `${lineNum}\t${line}`;
          })
          .join("\n");

        return textResult(numbered);
      }),
  });

  // ── fs_write ───────────────────────────────────────────────────────────
  registry.register({
    name: "fs_write",
    description: "Write or create a file in the codespace virtual filesystem.\n"
      + "Limits: 1MB per file, 100 files per codespace, 50MB total.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      file_path: z.string().min(1).describe("Absolute path e.g. /src/utils.ts"),
      content: z.string().describe("File content"),
    },
    handler: async ({
      codespace_id,
      file_path,
      content,
    }: {
      codespace_id: string;
      file_path: string;
      content: string;
    }): Promise<CallToolResult> =>
      safeToolCall("fs_write", async () => {
        validateCodeSpaceId(codespace_id);
        const fs = getFilesystem(codespace_id);
        const path = normalizePath(file_path);

        const sizeBytes = new TextEncoder().encode(content).byteLength;

        if (sizeBytes > MAX_FILE_SIZE_BYTES) {
          return {
            content: [{
              type: "text",
              text: `File exceeds 1MB limit (${sizeBytes} bytes).`,
            }],
            isError: true,
          };
        }

        if (fs.size >= MAX_FILE_COUNT && !fs.has(path)) {
          return {
            content: [{
              type: "text",
              text: `File limit (${MAX_FILE_COUNT}) reached for codespace "${codespace_id}".`,
            }],
            isError: true,
          };
        }

        // Check total size (subtract old file size if overwriting)
        const oldSize = fs.has(path)
          ? new TextEncoder().encode(fs.get(path)!).byteLength
          : 0;
        const newTotal = totalSizeBytes(fs) - oldSize + sizeBytes;
        if (newTotal > MAX_TOTAL_SIZE_BYTES) {
          return {
            content: [{
              type: "text",
              text: `Total size limit (50MB) exceeded for codespace "${codespace_id}".`,
            }],
            isError: true,
          };
        }

        const isNew = !fs.has(path);
        fs.set(path, content);

        return textResult(
          `**File ${isNew ? "created" : "updated"}**\n\n`
            + `- **Path:** ${path}\n`
            + `- **Size:** ${sizeBytes} bytes\n`
            + `- **Total files:** ${fs.size}`,
        );
      }),
  });

  // ── fs_edit ────────────────────────────────────────────────────────────
  registry.register({
    name: "fs_edit",
    description: "Exact string replacement in a codespace file.\n"
      + "Fails if old_text is not found or appears more than once.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      file_path: z.string().min(1).describe("Absolute path"),
      old_text: z.string().min(1).describe("Exact text to find"),
      new_text: z.string().describe("Replacement text"),
    },
    handler: async ({
      codespace_id,
      file_path,
      old_text,
      new_text,
    }: {
      codespace_id: string;
      file_path: string;
      old_text: string;
      new_text: string;
    }): Promise<CallToolResult> =>
      safeToolCall("fs_edit", async () => {
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);
        const path = normalizePath(file_path);

        if (!fs || !fs.has(path)) {
          return {
            content: [{
              type: "text",
              text: `File "${path}" not found in codespace "${codespace_id}".`,
            }],
            isError: true,
          };
        }

        const content = fs.get(path)!;
        const firstIndex = content.indexOf(old_text);

        if (firstIndex === -1) {
          return {
            content: [{
              type: "text",
              text: `old_text not found in "${path}".`,
            }],
            isError: true,
          };
        }

        const secondIndex = content.indexOf(old_text, firstIndex + 1);
        if (secondIndex !== -1) {
          return {
            content: [{
              type: "text",
              text:
                `old_text appears multiple times in "${path}". Provide more context to make it unique.`,
            }],
            isError: true,
          };
        }

        const updated = content.replace(old_text, new_text);
        fs.set(path, updated);

        // Simple diff output
        const diffLines: string[] = [];
        const oldLines = old_text.split("\n");
        const newLines = new_text.split("\n");
        for (const line of oldLines) {
          diffLines.push(`- ${line}`);
        }
        for (const line of newLines) {
          diffLines.push(`+ ${line}`);
        }

        return textResult(
          `**File edited:** ${path}\n\n`
            + `\`\`\`diff\n${diffLines.join("\n")}\n\`\`\``,
        );
      }),
  });

  // ── fs_glob ────────────────────────────────────────────────────────────
  registry.register({
    name: "fs_glob",
    description: "Find files by glob pattern in a codespace.\n"
      + "Supports ** (any path) and * (any name segment).",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      pattern: z.string().min(1).describe("Glob pattern e.g. **/*.test.*"),
    },
    handler: async ({
      codespace_id,
      pattern,
    }: {
      codespace_id: string;
      pattern: string;
    }): Promise<CallToolResult> =>
      safeToolCall("fs_glob", async () => {
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);

        if (!fs || fs.size === 0) {
          return textResult(`No files in codespace "${codespace_id}".`);
        }

        const matches: string[] = [];
        for (const filePath of fs.keys()) {
          if (matchGlob(pattern, filePath)) {
            matches.push(filePath);
          }
        }

        matches.sort();

        if (matches.length === 0) {
          return textResult(
            `No files matching "${pattern}" in codespace "${codespace_id}".`,
          );
        }

        return textResult(
          `**${matches.length} file(s) matching \`${pattern}\`:**\n\n`
            + matches.map(p => `- ${p}`).join("\n"),
        );
      }),
  });

  // ── fs_grep ────────────────────────────────────────────────────────────
  registry.register({
    name: "fs_grep",
    description: "Search file contents in a codespace.\n"
      + "Returns matched lines with file:line format.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      pattern: z.string().min(1).describe("Search pattern (string or regex)"),
      glob: z.string().optional().describe("Glob filter for files to search"),
      is_regex: z.boolean().optional().default(false).describe(
        "Treat pattern as regex",
      ),
      context: z.number().int().min(0).max(10).optional().default(0).describe(
        "Context lines around match",
      ),
    },
    handler: async ({
      codespace_id,
      pattern,
      glob,
      is_regex,
      context,
    }: {
      codespace_id: string;
      pattern: string;
      glob?: string;
      is_regex?: boolean;
      context?: number;
    }): Promise<CallToolResult> =>
      safeToolCall("fs_grep", async () => {
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);

        if (!fs || fs.size === 0) {
          return textResult(`No files in codespace "${codespace_id}".`);
        }

        const ctx = context ?? 0;
        let re: RegExp;
        try {
          re = is_regex
            ? new RegExp(pattern)
            : new RegExp(escapeRegex(pattern));
        } catch {
          return {
            content: [{
              type: "text",
              text: `Invalid regex pattern: "${pattern}"`,
            }],
            isError: true,
          };
        }

        const results: string[] = [];

        for (const [filePath, content] of fs.entries()) {
          if (glob && !matchGlob(glob, filePath)) continue;

          const lines = content.split("\n");
          for (let i = 0; i < lines.length; i++) {
            if (re.test(lines[i]!)) {
              if (ctx > 0) {
                const start = Math.max(0, i - ctx);
                const end = Math.min(lines.length - 1, i + ctx);
                for (let j = start; j <= end; j++) {
                  const prefix = j === i ? ">" : " ";
                  results.push(`${filePath}:${j + 1}:${prefix} ${lines[j]}`);
                }
                results.push("--");
              } else {
                results.push(`${filePath}:${i + 1}: ${lines[i]}`);
              }
            }
          }
        }

        if (results.length === 0) {
          return textResult(
            `No matches for "${pattern}" in codespace "${codespace_id}".`,
          );
        }

        return textResult(results.join("\n"));
      }),
  });

  // ── fs_ls ──────────────────────────────────────────────────────────────
  registry.register({
    name: "fs_ls",
    description: "List files and directories at a path in the codespace.\n"
      + "Defaults to root (/).",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      path: z.string().optional().default("/").describe(
        "Directory path to list",
      ),
    },
    handler: async ({
      codespace_id,
      path,
    }: {
      codespace_id: string;
      path?: string;
    }): Promise<CallToolResult> =>
      safeToolCall("fs_ls", async () => {
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);

        if (!fs || fs.size === 0) {
          return textResult(`No files in codespace "${codespace_id}".`);
        }

        const dirPath = normalizePath(path ?? "/");
        const prefix = dirPath === "/" ? "/" : `${dirPath}/`;

        const entries = new Set<string>();

        for (const filePath of fs.keys()) {
          if (dirPath === "/" || filePath.startsWith(prefix)) {
            // Get the part after the prefix
            const relative = dirPath === "/"
              ? filePath.slice(1)
              : filePath.slice(prefix.length);
            const firstSegment = relative.split("/")[0];
            if (firstSegment) {
              // Check if it's a directory (has more segments after)
              const isDir = relative.includes("/");
              entries.add(isDir ? `${firstSegment}/` : firstSegment);
            }
          }
        }

        const sorted = Array.from(entries).sort();

        if (sorted.length === 0) {
          return textResult(
            `No entries at "${dirPath}" in codespace "${codespace_id}".`,
          );
        }

        return textResult(
          `**${dirPath}** (${sorted.length} entries):\n\n`
            + sorted.map(e => `- ${e}`).join("\n"),
        );
      }),
  });

  // ── fs_rm ──────────────────────────────────────────────────────────────
  registry.register({
    name: "fs_rm",
    description: "Remove a file from the codespace virtual filesystem.\n"
      + "The entry point /src/App.tsx is protected and cannot be removed.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      file_path: z.string().min(1).describe("Absolute path of file to remove"),
    },
    handler: async ({
      codespace_id,
      file_path,
    }: {
      codespace_id: string;
      file_path: string;
    }): Promise<CallToolResult> =>
      safeToolCall("fs_rm", async () => {
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);
        const path = normalizePath(file_path);

        if (path === ENTRY_POINT) {
          return {
            content: [{
              type: "text",
              text: `Cannot remove entry point "${ENTRY_POINT}". It is protected.`,
            }],
            isError: true,
          };
        }

        if (!fs || !fs.has(path)) {
          return {
            content: [{
              type: "text",
              text: `File "${path}" not found in codespace "${codespace_id}".`,
            }],
            isError: true,
          };
        }

        fs.delete(path);

        return textResult(
          `**File removed:** ${path}\n`
            + `**Remaining files:** ${fs.size}`,
        );
      }),
  });

  // ── fs_intent ──────────────────────────────────────────────────────────
  registry.register({
    name: "fs_intent",
    description: "Declare agent mission and get relevant files proactively.\n"
      + "Analyzes mission text against file paths and contents,\n"
      + "returns a curated list of files the agent should read.",
    category: "filesystem",
    tier: "free",
    inputSchema: {
      codespace_id: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_.-]+$/),
      mission: z.string().min(1).describe("What you intend to build or fix"),
      include_tests: z.boolean().optional().default(true).describe(
        "Include test files in results",
      ),
    },
    handler: async ({
      codespace_id,
      mission,
      include_tests,
    }: {
      codespace_id: string;
      mission: string;
      include_tests?: boolean;
    }): Promise<CallToolResult> =>
      safeToolCall("fs_intent", async () => {
        validateCodeSpaceId(codespace_id);
        const fs = getExistingFiles(codespace_id);

        if (!fs || fs.size === 0) {
          return textResult(
            `No files in codespace "${codespace_id}". Start by writing files with fs_write.`,
          );
        }

        const keywords = mission
          .toLowerCase()
          .split(/[\s,;.!?]+/)
          .filter(w => w.length > 2);

        const scored: Array<{ path: string; score: number; reason: string; }> = [];

        for (const [filePath, content] of fs.entries()) {
          // Skip test files unless requested
          const isTest = /\.(test|spec)\.(ts|tsx|js|jsx)$/.test(filePath);
          if (isTest && !include_tests) continue;

          let score = 0;
          const reasons: string[] = [];

          const pathLower = filePath.toLowerCase();
          const contentLower = content.toLowerCase();

          for (const kw of keywords) {
            if (pathLower.includes(kw)) {
              score += 3;
              reasons.push(`path contains "${kw}"`);
            }
            if (contentLower.includes(kw)) {
              score += 1;
              reasons.push(`content contains "${kw}"`);
            }
          }

          // Always include entry point
          if (filePath === ENTRY_POINT) {
            score += 5;
            reasons.push("entry point");
          }

          // Boost test files if included
          if (isTest && include_tests) {
            score += 2;
            reasons.push("test file");
          }

          if (score > 0) {
            scored.push({
              path: filePath,
              score,
              reason: [...new Set(reasons)].join(", "),
            });
          }
        }

        scored.sort((a, b) => b.score - a.score);
        const top = scored.slice(0, 20);

        if (top.length === 0) {
          return textResult(
            `No files match mission "${mission}" in codespace "${codespace_id}".\n`
              + `Available files: ${Array.from(fs.keys()).join(", ")}`,
          );
        }

        const lines = top.map(
          f => `- **${f.path}** (score: ${f.score}) — ${f.reason}`,
        );

        return textResult(
          `**Mission:** ${mission}\n`
            + `**Relevant files (${top.length}):**\n\n`
            + lines.join("\n"),
        );
      }),
  });
}

// ── Helpers ────────────────────────────────────────────────────────────────

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
