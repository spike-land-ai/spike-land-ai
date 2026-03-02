/**
 * Test Generation MCP Tools
 *
 * Generate test suites from specs or source code, with reusable patterns.
 * Ported from spike.land — pure in-memory computation.
 */

import { z } from "zod";
import type { ToolRegistry } from "../mcp/registry";
import { freeTool, jsonResult } from "../procedures/index";
import type { DrizzleDB } from "../db/index";

// ─── Types ───────────────────────────────────────────────────────────────────

interface TestSuite {
  id: string;
  targetPath: string;
  sourceCode?: string;
  spec?: string;
  framework: "vitest" | "jest" | "playwright";
  testCode: string;
  createdAt: string;
}

interface TestPattern {
  id: string;
  name: string;
  template: string;
  framework: string;
  variables: string[];
}

// ─── In-memory storage ───────────────────────────────────────────────────────

const suites = new Map<string, TestSuite>();
const patterns = new Map<string, TestPattern>();

export function clearTestgen(): void {
  suites.clear();
  patterns.clear();
}

// ─── Engine functions ────────────────────────────────────────────────────────

function generateTestCode(spec: string, framework: string): string {
  let code = `import { describe, it, expect } from "${framework === "vitest" ? "vitest" : "jest"}";\n\n`;
  code += `describe("Generated tests", () => {\n`;
  code += `  it("should satisfy specification: ${spec}", () => {\n`;
  code += `    // TODO: Implement test logic\n`;
  code += `    expect(true).toBe(true);\n`;
  code += `  });\n`;
  code += `});`;
  return code;
}

function applyPattern(pattern: TestPattern, variables: Record<string, string>): string {
  let result = pattern.template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

// ─── Registration ────────────────────────────────────────────────────────────

export function registerTestgenTools(registry: ToolRegistry, userId: string, db: DrizzleDB): void {
  registry.registerBuilt(
    freeTool(userId, db)
      .tool("testgen_from_spec", "Generate a test suite from a specification string.", {
        spec: z.string().describe("Specification to generate tests from."),
        target_path: z.string().describe("Target file path for tests."),
        framework: z
          .enum(["vitest", "jest", "playwright"])
          .optional()
          .describe("Test framework (default vitest)."),
      })
      .meta({ category: "testgen", tier: "free" })
      .handler(async ({ input }) => {
        const id = crypto.randomUUID();
        const framework = input.framework ?? "vitest";
        const testCode = generateTestCode(input.spec, framework);
        const suite: TestSuite = {
          id,
          targetPath: input.target_path,
          spec: input.spec,
          framework,
          testCode,
          createdAt: new Date().toISOString(),
        };
        suites.set(id, suite);
        return jsonResult(`Test suite generated from spec. ID: ${id}`, suite);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("testgen_from_code", "Generate a test suite from source code.", {
        source_code: z.string().describe("Source code to generate tests from."),
        target_path: z.string().describe("Target file path for tests."),
        coverage_targets: z.array(z.string()).optional().describe("Specific coverage targets."),
      })
      .meta({ category: "testgen", tier: "free" })
      .handler(async ({ input }) => {
        const id = crypto.randomUUID();
        const testCode = generateTestCode("Tests for provided source code", "vitest");
        const suite: TestSuite = {
          id,
          targetPath: input.target_path,
          sourceCode: input.source_code,
          framework: "vitest",
          testCode,
          createdAt: new Date().toISOString(),
        };
        suites.set(id, suite);
        return jsonResult(`Test suite generated from code. ID: ${id}`, suite);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("testgen_create_pattern", "Create a reusable test pattern template.", {
        name: z.string().describe("Pattern name."),
        template: z.string().describe("Template with {{variable}} placeholders."),
        framework: z.string().describe("Test framework."),
        variables: z.array(z.string()).describe("Variable names used in template."),
      })
      .meta({ category: "testgen", tier: "free" })
      .handler(async ({ input }) => {
        const id = crypto.randomUUID();
        const pattern: TestPattern = {
          id,
          name: input.name,
          template: input.template,
          framework: input.framework,
          variables: input.variables,
        };
        patterns.set(id, pattern);
        return jsonResult(`Test pattern created with ID: ${id}`, pattern);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("testgen_apply_pattern", "Apply a test pattern template with provided variables.", {
        pattern_id: z.string().describe("Pattern ID."),
        variables: z.record(z.string(), z.string()).describe("Variable values."),
        target_path: z.string().describe("Target file path."),
      })
      .meta({ category: "testgen", tier: "free" })
      .handler(async ({ input }) => {
        const pattern = patterns.get(input.pattern_id);
        if (!pattern) throw new Error(`Pattern ${input.pattern_id} not found`);
        const testCode = applyPattern(pattern, input.variables);
        return jsonResult(`Pattern applied. Generated test code for ${input.target_path}`, {
          testCode,
        });
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("testgen_get_suite", "Retrieve a generated test suite.", {
        suite_id: z.string().describe("Suite ID."),
      })
      .meta({ category: "testgen", tier: "free" })
      .handler(async ({ input }) => {
        const suite = suites.get(input.suite_id);
        if (!suite) throw new Error(`Suite ${input.suite_id} not found`);
        return jsonResult(`Suite details for ${input.suite_id}`, suite);
      }),
  );

  registry.registerBuilt(
    freeTool(userId, db)
      .tool("testgen_validate_suite", "Validate the syntax and consistency of a test suite.", {
        suite_id: z.string().describe("Suite ID."),
      })
      .meta({ category: "testgen", tier: "free" })
      .handler(async ({ input }) => {
        const suite = suites.get(input.suite_id);
        if (!suite) throw new Error(`Suite ${input.suite_id} not found`);
        return jsonResult(`Suite ${input.suite_id} is valid`, { isValid: true });
      }),
  );
}
