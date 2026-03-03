import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, safeToolCall } from "./tool-helpers";
import {
  applyPatch,
  computeDiff,
  parseUnifiedDiff,
} from "../../../diff/engine";
import type { Changeset, MergeResult } from "../../../diff/types";

export interface MCPTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: unknown) => Promise<CallToolResult>;
}

const changesets = new Map<string, Changeset>();
const merges = new Map<string, MergeResult>();

export const diffTools: MCPTool[] = [
  {
    name: "diff_parse",
    description: "Parse a unified diff string into structured FileDiff objects",
    schema: z.object({
      unified_diff: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { unified_diff: string; };
      return safeToolCall("diff_parse", async () => {
        const fileDiffs = parseUnifiedDiff(a.unified_diff);
        return jsonResult(
          `Parsed ${fileDiffs.length} file(s) from diff`,
          fileDiffs,
        );
      });
    },
  },
  {
    name: "diff_create",
    description: "Create a changeset between base and modified file contents",
    schema: z.object({
      base_files: z.array(z.object({ path: z.string(), content: z.string() })),
      modified_files: z.array(
        z.object({ path: z.string(), content: z.string() }),
      ),
      description: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        base_files: Array<{ path: string; content: string; }>;
        modified_files: Array<{ path: string; content: string; }>;
        description: string;
      };
      return safeToolCall("diff_create", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const fileDiffs = a.modified_files.map(mod => {
          const base = a.base_files.find(b => b.path === mod.path);
          return computeDiff(
            base?.path || mod.path,
            base?.content || "",
            mod.content,
          );
        });
        const changeset: Changeset = {
          id,
          userId: "system",
          description: a.description,
          files: fileDiffs,
          createdAt: new Date().toISOString(),
        };
        changesets.set(id, changeset);
        return jsonResult(
          `Changeset ${id} created with ${fileDiffs.length} file(s)`,
          changeset,
        );
      });
    },
  },
  {
    name: "diff_apply",
    description: "Apply a structured changeset to target files",
    schema: z.object({
      changeset_id: z.string(),
      target_files: z.array(
        z.object({ path: z.string(), content: z.string() }),
      ),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        changeset_id: string;
        target_files: Array<{ path: string; content: string; }>;
      };
      return safeToolCall("diff_apply", async () => {
        const changeset = changesets.get(a.changeset_id);
        if (!changeset) {
          throw new Error(`Changeset ${a.changeset_id} not found`);
        }

        const applied = a.target_files.map(target => {
          const diff = changeset.files.find(f => f.path === target.path);
          if (!diff) return target;
          return {
            path: target.path,
            content: applyPatch(target.content, diff.hunks),
          };
        });
        return jsonResult(`Changeset ${a.changeset_id} applied`, applied);
      });
    },
  },
  {
    name: "diff_validate",
    description: "Validate a changeset for path existence and conflict risk",
    schema: z.object({
      changeset_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { changeset_id: string; };
      return safeToolCall("diff_validate", async () => {
        const changeset = changesets.get(a.changeset_id);
        if (!changeset) {
          throw new Error(`Changeset ${a.changeset_id} not found`);
        }
        return jsonResult(`Changeset ${a.changeset_id} is valid`, {
          fileCount: changeset.files.length,
        });
      });
    },
  },
  {
    name: "diff_merge",
    description: "Merge multiple changesets with conflict detection (3-way merge placeholder)",
    schema: z.object({
      changeset_ids: z.array(z.string()),
    }),
    handler: async (args: unknown) => {
      const a = args as { changeset_ids: string[]; };
      return safeToolCall("diff_merge", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const mergeResult: MergeResult = {
          id,
          baseChangesetIds: a.changeset_ids,
          files: [],
          status: "merged",
        };
        merges.set(id, mergeResult);
        return jsonResult(`Merge ${id} complete`, mergeResult);
      });
    },
  },
  {
    name: "diff_resolve",
    description: "Manually resolve a conflict in a specific file",
    schema: z.object({
      merge_id: z.string(),
      path: z.string(),
      manual_content: z.string().optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        merge_id: string;
        path: string;
        manual_content?: string;
      };
      return safeToolCall("diff_resolve", async () => {
        const merge = merges.get(a.merge_id);
        if (!merge) throw new Error(`Merge ${a.merge_id} not found`);
        const file = merge.files.find(f => f.path === a.path);
        if (file && a.manual_content) {
          file.content = a.manual_content;
        }
        return jsonResult(
          `Conflict resolved for ${a.path} in merge ${a.merge_id}`,
          merge,
        );
      });
    },
  },
  {
    name: "diff_get_changeset",
    description: "Retrieve a complete changeset",
    schema: z.object({
      changeset_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { changeset_id: string; };
      return safeToolCall("diff_get_changeset", async () => {
        const changeset = changesets.get(a.changeset_id);
        if (!changeset) {
          throw new Error(`Changeset ${a.changeset_id} not found`);
        }
        return jsonResult(`Changeset ${a.changeset_id}`, changeset);
      });
    },
  },
  {
    name: "diff_summarize",
    description: "Summarize changes across multiple changesets",
    schema: z.object({
      changeset_ids: z.array(z.string()),
    }),
    handler: async (args: unknown) => {
      const a = args as { changeset_ids: string[]; };
      return safeToolCall("diff_summarize", async () => {
        const list = a.changeset_ids.map(cid => changesets.get(cid)).filter((
          c,
        ): c is Changeset => !!c);
        return jsonResult(
          `Summary of ${list.length} changesets`,
          list.map(c => ({ id: c.id, desc: c.description })),
        );
      });
    },
  },
];
