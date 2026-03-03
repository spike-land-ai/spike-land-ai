import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { jsonResult, safeToolCall } from "./tool-helpers";
import { applyPattern, generateTestCode } from "../../../testgen/engine";
import type { TestPattern, TestSuite } from "../../../testgen/types";

export interface MCPTool {
  name: string;
  description: string;
  schema: z.ZodObject<z.ZodRawShape>;
  handler: (args: unknown) => Promise<CallToolResult>;
}

const suites = new Map<string, TestSuite>();
const patterns = new Map<string, TestPattern>();

export const testgenTools: MCPTool[] = [
  {
    name: "testgen_from_spec",
    description: "Generate a test suite from a specification string",
    schema: z.object({
      spec: z.string(),
      target_path: z.string(),
      framework: z.enum(["vitest", "jest", "playwright"]).optional().default(
        "vitest",
      ),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        spec: string;
        target_path: string;
        framework: "vitest" | "jest" | "playwright";
      };
      return safeToolCall("testgen_from_spec", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const testCode = generateTestCode(a.spec, a.framework);
        const suite: TestSuite = {
          id,
          targetPath: a.target_path,
          spec: a.spec,
          framework: a.framework,
          testCode,
          createdAt: new Date().toISOString(),
        };
        suites.set(id, suite);
        return jsonResult(`Test suite generated from spec. ID: ${id}`, suite);
      });
    },
  },
  {
    name: "testgen_from_code",
    description: "Generate a test suite from source code",
    schema: z.object({
      source_code: z.string(),
      target_path: z.string(),
      coverage_targets: z.array(z.string()).optional(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        source_code: string;
        target_path: string;
        coverage_targets?: string[];
      };
      return safeToolCall("testgen_from_code", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const testCode = generateTestCode(
          "Tests for provided source code",
          "vitest",
        );
        const suite: TestSuite = {
          id,
          targetPath: a.target_path,
          sourceCode: a.source_code,
          framework: "vitest",
          testCode,
          createdAt: new Date().toISOString(),
        };
        suites.set(id, suite);
        return jsonResult(`Test suite generated from code. ID: ${id}`, suite);
      });
    },
  },
  {
    name: "testgen_create_pattern",
    description: "Create a reusable test pattern template",
    schema: z.object({
      name: z.string(),
      template: z.string(),
      framework: z.string(),
      variables: z.array(z.string()),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        name: string;
        template: string;
        framework: string;
        variables: string[];
      };
      return safeToolCall("testgen_create_pattern", async () => {
        const id = Math.random().toString(36).substring(2, 11);
        const pattern: TestPattern = {
          id,
          name: a.name,
          template: a.template,
          framework: a.framework,
          variables: a.variables,
        };
        patterns.set(id, pattern);
        return jsonResult(`Test pattern created with ID: ${id}`, pattern);
      });
    },
  },
  {
    name: "testgen_apply_pattern",
    description: "Apply a test pattern template with provided variables",
    schema: z.object({
      pattern_id: z.string(),
      variables: z.record(z.string(), z.string()),
      target_path: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as {
        pattern_id: string;
        variables: Record<string, string>;
        target_path: string;
      };
      return safeToolCall("testgen_apply_pattern", async () => {
        const pattern = patterns.get(a.pattern_id);
        if (!pattern) throw new Error(`Pattern ${a.pattern_id} not found`);
        const testCode = applyPattern(pattern, a.variables);
        return jsonResult(
          `Pattern applied. Generated test code for ${a.target_path}`,
          { testCode },
        );
      });
    },
  },
  {
    name: "testgen_get_suite",
    description: "Retrieve a generated test suite",
    schema: z.object({
      suite_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { suite_id: string; };
      return safeToolCall("testgen_get_suite", async () => {
        const suite = suites.get(a.suite_id);
        if (!suite) throw new Error(`Suite ${a.suite_id} not found`);
        return jsonResult(`Suite details for ${a.suite_id}`, suite);
      });
    },
  },
  {
    name: "testgen_validate_suite",
    description: "Validate the syntax and consistency of a test suite (Mock)",
    schema: z.object({
      suite_id: z.string(),
    }),
    handler: async (args: unknown) => {
      const a = args as { suite_id: string; };
      return safeToolCall("testgen_validate_suite", async () => {
        const suite = suites.get(a.suite_id);
        if (!suite) throw new Error(`Suite ${a.suite_id} not found`);
        return jsonResult(`Suite ${a.suite_id} is valid`, { isValid: true });
      });
    },
  },
];
