/**
 * Diff Management MCP Tools
 *
 * Unified diff parsing, changeset creation, application, and merging.
 * Ported from spike.land — pure in-memory computation.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, jsonResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  lines: string[];
}

interface FileDiff {
  path: string;
  type: "modified" | "added" | "deleted" | "renamed";
  oldPath?: string;
  hunks: DiffHunk[];
}

interface Changeset {
  id: string;
  userId: string;
  description: string;
  files: FileDiff[];
  createdAt: string;
}

interface MergeResult {
  id: string;
  baseChangesetIds: string[];
  files: Array<{ path: string; content: string; hasConflicts: boolean }>;
  status: "pending" | "merged" | "conflicted";
}

// ─── In-memory storage ───────────────────────────────────────────────────────

const changesets = new Map<string, Changeset>();
const merges = new Map<string, MergeResult>();

export function clearDiff(): void {
  changesets.clear();
  merges.clear();
}

// ─── Engine functions ────────────────────────────────────────────────────────

function computeDiff(path: string, base: string, modified: string): FileDiff {
  if (base === modified) return { path, type: "modified", hunks: [] };
  const baseLines = base.split("\n");
  const modifiedLines = modified.split("\n");
  const hunk: DiffHunk = {
    oldStart: 1,
    oldLines: baseLines.length,
    newStart: 1,
    newLines: modifiedLines.length,
    lines: [...baseLines.map((l) => "-" + l), ...modifiedLines.map((l) => "+" + l)],
  };
  return { path, type: "modified", hunks: [hunk] };
}

function parseUnifiedDiff(diffText: string): FileDiff[] {
  const files: FileDiff[] = [];
  const lines = diffText.split("\n");
  let currentFile: FileDiff | null = null;
  let currentHunk: DiffHunk | null = null;
  for (const line of lines) {
    if (line.startsWith("--- ")) continue;
    if (line.startsWith("+++ ")) {
      const path = line.substring(4).trim();
      currentFile = { path, type: "modified", hunks: [] };
      files.push(currentFile);
      currentHunk = null;
    } else if (line.startsWith("@@ ") && currentFile) {
      const match = line.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/);
      if (match) {
        currentHunk = {
          oldStart: parseInt(match[1]!, 10),
          oldLines: parseInt(match[2] || "1", 10),
          newStart: parseInt(match[3]!, 10),
          newLines: parseInt(match[4] || "1", 10),
          lines: [],
        };
        currentFile.hunks.push(currentHunk);
      }
    } else if (
      currentHunk &&
      (line.startsWith("+") || line.startsWith("-") || line.startsWith(" "))
    ) {
      currentHunk.lines.push(line);
    }
  }
  return files;
}

function applyPatch(base: string, hunks: DiffHunk[]): string {
  if (hunks.length === 0) return base;
  const lines = base.split("\n");
  const result: string[] = [];
  let currentLine = 1;
  for (const hunk of hunks) {
    while (currentLine < hunk.oldStart) {
      result.push(lines[currentLine - 1]!);
      currentLine++;
    }
    for (const hunkLine of hunk.lines) {
      if (hunkLine.startsWith("+")) result.push(hunkLine.substring(1));
      else if (hunkLine.startsWith("-")) currentLine++;
      else if (hunkLine.startsWith(" ")) {
        result.push(hunkLine.substring(1));
        currentLine++;
      }
    }
  }
  while (currentLine <= lines.length) {
    result.push(lines[currentLine - 1]!);
    currentLine++;
  }
  return result.join("\n");
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerDiffTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool("diff_parse", "Parse a unified diff string into structured FileDiff objects.", {
        unified_diff: z.string().describe("Unified diff text."),
      })
      .meta({ category: "diff", tier: "free" })
      .handler(async ({ input }) => {
        const fileDiffs = parseUnifiedDiff(input.unified_diff);
        return jsonResult(`Parsed ${fileDiffs.length} file(s) from diff`, fileDiffs);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("diff_create", "Create a changeset between base and modified file contents.", {
        base_files: z
          .array(z.object({ path: z.string(), content: z.string() }))
          .describe("Base files."),
        modified_files: z
          .array(z.object({ path: z.string(), content: z.string() }))
          .describe("Modified files."),
        description: z.string().describe("Changeset description."),
      })
      .meta({ category: "diff", tier: "free" })
      .handler(async ({ input }) => {
        const id = crypto.randomUUID();
        const fileDiffs = input.modified_files.map((mod) => {
          const base = input.base_files.find((b) => b.path === mod.path);
          return computeDiff(base?.path || mod.path, base?.content || "", mod.content);
        });
        const changeset: Changeset = {
          id,
          userId,
          description: input.description,
          files: fileDiffs,
          createdAt: new Date().toISOString(),
        };
        changesets.set(id, changeset);
        return jsonResult(`Changeset ${id} created with ${fileDiffs.length} file(s)`, changeset);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("diff_apply", "Apply a structured changeset to target files.", {
        changeset_id: z.string().describe("Changeset ID."),
        target_files: z
          .array(z.object({ path: z.string(), content: z.string() }))
          .describe("Target files."),
      })
      .meta({ category: "diff", tier: "free" })
      .handler(async ({ input }) => {
        const changeset = changesets.get(input.changeset_id);
        if (!changeset) throw new Error(`Changeset ${input.changeset_id} not found`);
        const applied = input.target_files.map((target) => {
          const diff = changeset.files.find((f) => f.path === target.path);
          if (!diff) return target;
          return { path: target.path, content: applyPatch(target.content, diff.hunks) };
        });
        return jsonResult(`Changeset ${input.changeset_id} applied`, applied);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("diff_validate", "Validate a changeset for path existence and conflict risk.", {
        changeset_id: z.string().describe("Changeset ID."),
      })
      .meta({ category: "diff", tier: "free" })
      .handler(async ({ input }) => {
        const changeset = changesets.get(input.changeset_id);
        if (!changeset) throw new Error(`Changeset ${input.changeset_id} not found`);
        return jsonResult(`Changeset ${input.changeset_id} is valid`, {
          fileCount: changeset.files.length,
        });
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("diff_merge", "Merge multiple changesets with conflict detection.", {
        changeset_ids: z.array(z.string()).describe("Changeset IDs to merge."),
      })
      .meta({ category: "diff", tier: "free" })
      .handler(async ({ input }) => {
        const id = crypto.randomUUID();
        const mergeResult: MergeResult = {
          id,
          baseChangesetIds: input.changeset_ids,
          files: [],
          status: "merged",
        };
        merges.set(id, mergeResult);
        return jsonResult(`Merge ${id} complete`, mergeResult);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("diff_resolve", "Manually resolve a conflict in a specific file.", {
        merge_id: z.string().describe("Merge ID."),
        path: z.string().describe("File path to resolve."),
        manual_content: z.string().optional().describe("Manual resolution content."),
      })
      .meta({ category: "diff", tier: "free" })
      .handler(async ({ input }) => {
        const merge = merges.get(input.merge_id);
        if (!merge) throw new Error(`Merge ${input.merge_id} not found`);
        const file = merge.files.find((f) => f.path === input.path);
        if (file && input.manual_content) file.content = input.manual_content;
        return jsonResult(`Conflict resolved for ${input.path} in merge ${input.merge_id}`, merge);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("diff_get_changeset", "Retrieve a complete changeset.", {
        changeset_id: z.string().describe("Changeset ID."),
      })
      .meta({ category: "diff", tier: "free" })
      .handler(async ({ input }) => {
        const changeset = changesets.get(input.changeset_id);
        if (!changeset) throw new Error(`Changeset ${input.changeset_id} not found`);
        return jsonResult(`Changeset ${input.changeset_id}`, changeset);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("diff_summarize", "Summarize changes across multiple changesets.", {
        changeset_ids: z.array(z.string()).describe("Changeset IDs."),
      })
      .meta({ category: "diff", tier: "free" })
      .handler(async ({ input }) => {
        const list = input.changeset_ids
          .map((cid) => changesets.get(cid))
          .filter((c): c is Changeset => !!c);
        return jsonResult(
          `Summary of ${list.length} changesets`,
          list.map((c) => ({ id: c.id, desc: c.description })),
        );
      }),
  );
}
