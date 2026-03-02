import type { TestPattern } from "./types";

export function generateTestCode(spec: string, framework: string): string {
  // Simple AI-assisted generation placeholder
  let code = `import { describe, it, expect } from "${
    framework === "vitest" ? "vitest" : "jest"
  }";\n\n`;
  code += `describe("Generated tests", () => {\n`;
  code += `  it("should satisfy specification: ${spec}", () => {\n`;
  code += `    // TODO: Implement test logic\n`;
  code += `    expect(true).toBe(true);\n`;
  code += `  });\n`;
  code += `});`;
  return code;
}

export function applyPattern(pattern: TestPattern, variables: Record<string, string>): string {
  let result = pattern.template;
  for (const [key, value] of Object.entries(variables)) {
    result = result.replace(new RegExp(`\\{\\{${key}\\}\\}`, "g"), value);
  }
  return result;
}

export function extractTestableUnits(sourceCode: string): string[] {
  const units: string[] = [];
  const exportRegex = /export\s+(?:function|const|class)\s+([\w\d_]+)/g;
  let match;
  while ((match = exportRegex.exec(sourceCode)) !== null) {
    units.push(match[1]!);
  }
  return units;
}
