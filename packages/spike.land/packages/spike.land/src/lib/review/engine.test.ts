import { describe, expect, it } from "vitest";
import { analyzeComplexity, checkConventions, getBuiltInRules } from "./engine";

describe("review engine", () => {
  it("should find convention violations", () => {
    const files = [{ path: "test.ts", content: "const x: any = 1;" }];
    const rules = [{
      id: "no-any",
      name: "No any",
      description: "No any",
      pattern: ":\\s*any",
      severity: "error" as const,
      message: "Detected any",
    }];
    const findings = checkConventions(files, rules);
    expect(findings).toHaveLength(1);
    expect(findings[0]!.ruleId).toBe("no-any");
  });

  it("should detect high complexity", () => {
    const content = "{\n {\n  {\n   {\n    {\n     {\n     }\n    }\n   }\n  }\n }\n}";
    const findings = analyzeComplexity(content, "comp.ts");
    expect(findings.some(f => f.ruleId === "complexity-nesting")).toBe(true);
  });

  it("should return built-in rules", () => {
    const rules = getBuiltInRules("nextjs");
    expect(rules.length).toBeGreaterThan(0);
    expect(rules.find(r => r.id === "no-any")).toBeDefined();
  });
});
