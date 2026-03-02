import { describe, expect, it } from "vitest";
import { applyPattern, extractTestableUnits, generateTestCode } from "./engine";

describe("testgen engine", () => {
  it("should generate test code", () => {
    const code = generateTestCode("Test feature X", "vitest");
    expect(code).toContain('describe("Generated tests"');
    expect(code).toContain("Test feature X");
  });

  it("should apply a pattern", () => {
    const pattern = {
      id: "p1",
      name: "Simple",
      template: "import {{mod}} from './{{mod}}';",
      framework: "vitest",
      variables: ["mod"],
    };
    const result = applyPattern(pattern, { mod: "utils" });
    expect(result).toBe("import utils from './utils';");
  });

  it("should extract testable units", () => {
    const source = "export function a() {} \n export class B {}";
    const units = extractTestableUnits(source);
    expect(units).toContain("a");
    expect(units).toContain("B");
  });
});
