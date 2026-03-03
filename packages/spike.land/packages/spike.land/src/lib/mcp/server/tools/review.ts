import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, safeToolCall } from "./tool-helpers";
import {
  analyzeComplexity,
  checkConventions,
  getBuiltInRules,
} from "../../../review/engine";
import type {
  ConventionSet,
  ReviewFinding,
  ReviewReport,
} from "../../../review/types";

export interface MCPTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: unknown) => Promise<CallToolResult>;
}

const reports = new Map<string, ReviewReport>();
const conventionSets = new Map<string, ConventionSet>();

export const reviewTools: MCPTool[] = [
  {
    name: "review_create_conventions",
    description: "Create a named set of convention rules",
    schema: z.object({
      name: z.string(),
      rules: z.array(
        z.object({
          id: z.string(),
          name: z.string(),
          description: z.string(),
          pattern: z.string(),
          severity: z.enum(["info", "warning", "error"]),
          message: z.string(),
        }),
      ),
    }),
    handler: async (args: unknown) => {
      const a = args as { name: string; rules: ConventionSet["rules"]; };
      return safeToolCall("review_create_conventions", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const set: ConventionSet = { id, name: a.name, rules: a.rules };
        conventionSets.set(id, set);
        return jsonResult(
          `Convention set ${a.name} created with ID: ${id}`,
          set,
        );
      });
    },
  },
  {
    name: "review_code",
    description: "Perform a comprehensive code review against conventions",
    schema: z.object({
      files: z.array(z.object({ path: z.string(), content: z.string() })),
      convention_set_id: z.string().optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        files: Array<{ path: string; content: string; }>;
        convention_set_id?: string;
      };
      return safeToolCall("review_code", async () => {
        const conventions = a.convention_set_id
          ? conventionSets.get(a.convention_set_id)
          : {
            id: "default",
            name: "Default",
            rules: getBuiltInRules("nextjs"),
          };

        if (!conventions) {
          throw new Error(`Convention set ${a.convention_set_id} not found`);
        }

        const findings = checkConventions(a.files, conventions.rules);
        const id = Math.random().toString(36).substring(2, 11);
        const report: ReviewReport = {
          id,
          userId: "system",
          findings,
          score: Math.max(0, 100 - findings.length * 10),
          summary: `Found ${findings.length} convention violations`,
          createdAt: new Date().toISOString(),
        };
        reports.set(id, report);
        return jsonResult(`Review complete. Report ID: ${id}`, report);
      });
    },
  },
  {
    name: "review_analyze_complexity",
    description: "Analyze cyclomatic complexity and maintainability index",
    schema: z.object({
      files: z.array(z.object({ path: z.string(), content: z.string() })),
    }),
    handler: async (args: unknown) => {
      const a = args as { files: Array<{ path: string; content: string; }>; };
      return safeToolCall("review_analyze_complexity", async () => {
        const allFindings: ReviewFinding[] = [];
        for (const file of a.files) {
          const findings = analyzeComplexity(file.content, file.path);
          allFindings.push(...findings);
        }
        return jsonResult(
          `Complexity analysis complete for ${a.files.length} file(s)`,
          allFindings,
        );
      });
    },
  },
  {
    name: "review_get_report",
    description: "Retrieve a complete review report",
    schema: z.object({
      report_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { report_id: string; };
      return safeToolCall("review_get_report", async () => {
        const report = reports.get(a.report_id);
        if (!report) throw new Error(`Report ${a.report_id} not found`);
        return jsonResult(`Review Report ${a.report_id}`, report);
      });
    },
  },
  {
    name: "review_list_conventions",
    description: "List all available convention sets",
    schema: z.object({}),
    handler: async () => {
      return safeToolCall("review_list_conventions", async () => {
        const list = Array.from(conventionSets.values());
        return jsonResult(`Found ${list.length} convention set(s)`, list);
      });
    },
  },
  {
    name: "review_get_built_in_rules",
    description: "Get the default built-in convention rules",
    schema: z.object({}),
    handler: async () => {
      return safeToolCall("review_get_built_in_rules", async () => {
        const rules = getBuiltInRules("nextjs");
        return jsonResult(`Found ${rules.length} built-in rule(s)`, rules);
      });
    },
  },
  {
    name: "review_estimate_effort",
    description: "Estimate refactoring effort based on review findings",
    schema: z.object({
      report_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { report_id: string; };
      return safeToolCall("review_estimate_effort", async () => {
        const report = reports.get(a.report_id);
        if (!report) throw new Error(`Report ${a.report_id} not found`);

        const effortHours = report.findings.length * 0.5;
        return jsonResult(
          `Estimated refactoring effort for report ${a.report_id}`,
          {
            hours: effortHours,
            difficulty: effortHours > 10
              ? "high"
              : effortHours > 4
              ? "medium"
              : "low",
          },
        );
      });
    },
  },
  {
    name: "review_get_conventions",
    description: "Retrieve a convention set definition",
    schema: z.object({
      convention_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { convention_id: string; };
      return safeToolCall("review_get_conventions", async () => {
        const set = conventionSets.get(a.convention_id);
        if (!set) {
          throw new Error(`Convention set ${a.convention_id} not found`);
        }
        return jsonResult(`Convention set ${a.convention_id}`, set);
      });
    },
  },
  {
    name: "review_project_rules",
    description: "Get built-in project rules",
    schema: z.object({
      project_type: z.string().optional().default("nextjs"),
    }),
    handler: async (args: unknown) => {
      const a = args as { project_type: string; };
      return safeToolCall("review_project_rules", async () => {
        const rules = getBuiltInRules(a.project_type);
        return jsonResult(`Built-in rules for ${a.project_type}`, rules);
      });
    },
  },
];
