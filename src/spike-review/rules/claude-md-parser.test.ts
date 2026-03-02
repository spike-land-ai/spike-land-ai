import { describe, expect, it } from "vitest";
import { parseClaudeMd, rulesToPromptLines } from "./claude-md-parser.js";

describe("parseClaudeMd", () => {
  it("extracts blocking rules with NEVER/ALWAYS prefix", () => {
    const content = `# Code Quality Rules (BLOCKING)

- **NEVER** use \`any\` type
- **NEVER** add \`eslint-disable\` comments
- **ALWAYS** use strict mode

## Other Section
- unrelated bullet`;

    const result = parseClaudeMd(content);
    expect(result.blockingRules).toHaveLength(3);
    expect(result.blockingRules[0]).toContain("NEVER");
    expect(result.blockingRules[2]).toContain("ALWAYS");
  });

  it("extracts testing requirements", () => {
    const content = `# Testing Requirements

- Coverage thresholds enforced at 80%
- Place test files alongside source

## End`;

    const result = parseClaudeMd(content);
    expect(result.testingRequirements).toHaveLength(2);
    expect(result.testingRequirements[0]).toContain("80%");
  });

  it("handles empty content", () => {
    const result = parseClaudeMd("");
    expect(result.codeQualityRules).toHaveLength(0);
    expect(result.testingRequirements).toHaveLength(0);
    expect(result.blockingRules).toHaveLength(0);
  });

  it("stops collecting when hitting a new heading", () => {
    const content = `## Code Quality Rules

- Rule 1
- Rule 2

## Unrelated Section

- Not a rule`;

    const result = parseClaudeMd(content);
    expect(result.codeQualityRules).toHaveLength(2);
  });
});

describe("rulesToPromptLines", () => {
  it("formats rules as prompt sections", () => {
    const rules = {
      codeQualityRules: ["No globals"],
      testingRequirements: ["100% coverage"],
      blockingRules: ["**NEVER** use any"],
    };

    const lines = rulesToPromptLines(rules);
    expect(lines).toContain("## BLOCKING Rules (from CLAUDE.md)");
    expect(lines.some((l) => l.includes("NEVER"))).toBe(true);
    expect(lines.some((l) => l.includes("100% coverage"))).toBe(true);
  });

  it("skips empty sections", () => {
    const rules = {
      codeQualityRules: [],
      testingRequirements: [],
      blockingRules: [],
    };

    const lines = rulesToPromptLines(rules);
    expect(lines).toHaveLength(0);
  });
});
