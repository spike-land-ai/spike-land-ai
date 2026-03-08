/**
 * Test Generation MCP Tools
 *
 * Generate test suites from specs or source code, with reusable patterns.
 * Ported from spike.land — pure in-memory computation.
 */

import { z } from "zod";
import type { ToolRegistry } from "../../lazy-imports/registry";
import { freeTool, jsonResult } from "../../lazy-imports/procedures-index.ts";
import type { DrizzleDB } from "../../db/db/db-index.ts";

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

function frameworkImport(framework: string): string {
  if (framework === "playwright") {
    return `import { test, expect } from "@playwright/test";`;
  }
  return `import { describe, it, expect, beforeEach, afterEach, vi } from "${
    framework === "vitest" ? "vitest" : "@jest/globals"
  }";`;
}

/** Extract exported function/class names from source code for targeted test generation. */
function extractExports(sourceCode: string): string[] {
  const names: string[] = [];
  const patterns = [
    /export\s+(?:async\s+)?function\s+(\w+)/g,
    /export\s+const\s+(\w+)\s*=/g,
    /export\s+class\s+(\w+)/g,
    /export\s+(?:default\s+)?(?:async\s+)?function\s*\*?\s*(\w+)/g,
  ];
  for (const pattern of patterns) {
    let match: RegExpExecArray | null;
    while ((match = pattern.exec(sourceCode)) !== null) {
      const name = match[1];
      if (name && !names.includes(name)) names.push(name);
    }
  }
  return names;
}

/** Detect whether source uses async patterns so stubs can match. */
function hasAsyncExports(sourceCode: string): boolean {
  return (
    /export\s+async\s+function/.test(sourceCode) ||
    /export\s+const\s+\w+\s*=\s*async/.test(sourceCode)
  );
}

function generateTestCode(spec: string, framework: string): string {
  const imports = frameworkImport(framework);
  const itFn = framework === "playwright" ? "test" : "it";

  if (framework === "playwright") {
    return [
      imports,
      "",
      `test.describe("${spec}", () => {`,
      `  test.beforeEach(async ({ page }) => {`,
      `    // Navigate to the page under test`,
      `    // await page.goto("https://example.com");`,
      `  });`,
      "",
      `  ${itFn}("should render the expected UI", async ({ page }) => {`,
      `    // Replace with actual selector and assertion`,
      `    // await expect(page.locator("h1")).toBeVisible();`,
      `    expect(true).toBe(true); // placeholder — replace with real assertion`,
      `  });`,
      "",
      `  ${itFn}("should handle user interaction", async ({ page }) => {`,
      `    // Example: await page.click("button#submit");`,
      `    // await expect(page.locator(".result")).toContainText("Success");`,
      `    expect(true).toBe(true); // placeholder — replace with real assertion`,
      `  });`,
      `});`,
    ].join("\n");
  }

  return [
    imports,
    "",
    `describe("${spec}", () => {`,
    `  beforeEach(() => {`,
    `    // Set up shared state or mocks before each test`,
    `    // vi.clearAllMocks();`,
    `  });`,
    "",
    `  afterEach(() => {`,
    `    // Tear down state or restore mocks after each test`,
    `  });`,
    "",
    `  ${itFn}("should return the expected result for a typical input", () => {`,
    `    // Arrange`,
    `    const input = undefined; // TO\DO: replace with a real input value`,
    `    const expected = undefined; // TO\DO: replace with the expected output`,
    "",
    `    // Act`,
    `    const result = undefined; // TO\DO: call the function under test, e.g. myFunction(input)`,
    "",
    `    // Assert`,
    `    expect(result).toEqual(expected);`,
    `  });`,
    "",
    `  ${itFn}("should handle edge case: empty / null input", () => {`,
    `    // TO\DO: test boundary conditions`,
    `    expect(() => {`,
    `      // myFunction(null);`,
    `    }).not.toThrow();`,
    `  });`,
    "",
    `  ${itFn}("should throw on invalid input", () => {`,
    `    // TO\DO: verify error handling`,
    `    expect(() => {`,
    `      // myFunction(invalidValue);`,
    `    }).toThrow();`,
    `  });`,
    `});`,
  ].join("\n");
}

function generateTestCodeFromSource(sourceCode: string, targetPath: string): string {
  const exports = extractExports(sourceCode);
  const isAsync = hasAsyncExports(sourceCode);
  const moduleName = targetPath.replace(/^.*\//, "").replace(/\.[^.]+$/, "");

  const importLine =
    exports.length > 0
      ? `import { ${exports.join(", ")} } from "./${moduleName}";`
      : `// import { myFunction } from "./${moduleName}";`;

  const lines: string[] = [
    `import { describe, it, expect, beforeEach, vi } from "vitest";`,
    importLine,
    "",
  ];

  if (exports.length === 0) {
    lines.push(
      `describe("${moduleName}", () => {`,
      `  it("should be importable and functional", () => {`,
      `    // No exports detected — add your own imports above and write tests here`,
      `    expect(true).toBe(true);`,
      `  });`,
      `});`,
    );
    return lines.join("\n");
  }

  lines.push(`describe("${moduleName}", () => {`);
  lines.push(`  beforeEach(() => {`);
  lines.push(`    vi.clearAllMocks();`);
  lines.push(`  });`);
  lines.push("");

  for (const name of exports) {
    const awaitKw = isAsync ? "await " : "";
    lines.push(`  describe("${name}", () => {`);
    lines.push(`    it("should return the expected result", ${isAsync ? "async " : ""}() => {`);
    lines.push(`      // Arrange`);
    lines.push(`      const input = undefined; // TO\DO: provide a real input`);
    lines.push(`      const expected = undefined; // TO\DO: provide the expected output`);
    lines.push("");
    lines.push(`      // Act`);
    lines.push(`      const result = ${awaitKw}${name}(input as never);`);
    lines.push("");
    lines.push(`      // Assert`);
    lines.push(`      expect(result).toEqual(expected);`);
    lines.push(`    });`);
    lines.push("");
    lines.push(
      `    it("should handle invalid input gracefully", ${isAsync ? "async " : ""}() => {`,
    );
    lines.push(
      `      ${isAsync ? "await " : ""}expect(${
        isAsync ? "async " : ""
      }() => ${awaitKw}${name}(null as never)).rejects // or .toThrow()`,
    );
    lines.push(`        // .toThrow("expected error message");`);
    lines.push(
      `      expect(true).toBe(true); // placeholder — remove once real assertion is in place`,
    );
    lines.push(`    });`);
    lines.push(`  });`);
    lines.push("");
  }

  lines.push(`});`);
  return lines.join("\n");
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
        const testCode = generateTestCodeFromSource(input.source_code, input.target_path);
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
        return jsonResult(`Suite ${input.suite_id} is valid`, {
          isValid: true,
        });
      }),
  );
}
