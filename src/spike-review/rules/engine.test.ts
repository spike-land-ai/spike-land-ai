import { describe, expect, it } from "vitest";
import { computeOverallStatus, formatGateResults, getBuiltinRules, runGates } from "./engine.js";
import type { RuleContext } from "./engine.js";
import type { GateResult } from "../types.js";

function makeContext(overrides: Partial<RuleContext> = {}): RuleContext {
  return {
    diff: "+const x: number = 1;",
    files: ["src/foo.ts", "src/foo.test.ts"],
    additions: 10,
    deletions: 5,
    prTitle: "feat: add feature",
    prBody:
      "This PR adds a new feature with proper testing and documentation explaining why we need this change and how it improves the overall architecture.",
    claudeMdRules: [],
    ...overrides,
  };
}

describe("getBuiltinRules", () => {
  it("returns BAZDMEG rules", () => {
    const rules = getBuiltinRules();
    expect(rules.length).toBeGreaterThan(0);
    const names = rules.map((r) => r.name);
    expect(names).toContain("Unit Tests Present");
    expect(names).toContain("TypeScript Strict Compliance");
    expect(names).toContain("PR Description Quality");
    expect(names).toContain("Security Patterns");
    expect(names).toContain("Change Size");
  });
});

describe("runGates", () => {
  it("all GREEN for a well-formed PR", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext();
    const results = runGates(rules, ctx);
    expect(results.every((r) => r.status === "GREEN")).toBe(true);
  });

  it("RED for missing tests when code files change", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext({ files: ["src/foo.ts"] });
    const results = runGates(rules, ctx);
    const testGate = results.find((r) => r.name === "Unit Tests Present");
    expect(testGate?.status).toBe("RED");
  });

  it("GREEN for non-code files without tests", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext({ files: ["docs/README.md"] });
    const results = runGates(rules, ctx);
    const testGate = results.find((r) => r.name === "Unit Tests Present");
    expect(testGate?.status).toBe("GREEN");
  });

  it("RED for any type in diff", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext({ diff: "+const x: any;" });
    const results = runGates(rules, ctx);
    const tsGate = results.find((r) => r.name === "TypeScript Strict Compliance");
    expect(tsGate?.status).toBe("RED");
    expect(tsGate?.detail).toContain("`any` type");
  });

  it("RED for eslint-disable in diff", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext({ diff: "+// eslint-disable-next-line" });
    const results = runGates(rules, ctx);
    const tsGate = results.find((r) => r.name === "TypeScript Strict Compliance");
    expect(tsGate?.status).toBe("RED");
  });

  it("RED for missing PR description", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext({ prBody: null });
    const results = runGates(rules, ctx);
    const descGate = results.find((r) => r.name === "PR Description Quality");
    expect(descGate?.status).toBe("RED");
  });

  it("YELLOW for short PR description", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext({ prBody: "Quick fix for the bug" });
    const results = runGates(rules, ctx);
    const descGate = results.find((r) => r.name === "PR Description Quality");
    expect(descGate?.status).toBe("YELLOW");
  });

  it("RED for hardcoded credentials in diff", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext({
      diff: '+const password = "supersecret123";',
    });
    const results = runGates(rules, ctx);
    const secGate = results.find((r) => r.name === "Security Patterns");
    expect(secGate?.status).toBe("RED");
    expect(secGate?.detail).toContain("Hardcoded password");
  });

  it("RED for large changes", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext({ additions: 800, deletions: 300 });
    const results = runGates(rules, ctx);
    const sizeGate = results.find((r) => r.name === "Change Size");
    expect(sizeGate?.status).toBe("RED");
  });

  it("YELLOW for medium changes", () => {
    const rules = getBuiltinRules();
    const ctx = makeContext({ additions: 400, deletions: 200 });
    const results = runGates(rules, ctx);
    const sizeGate = results.find((r) => r.name === "Change Size");
    expect(sizeGate?.status).toBe("YELLOW");
  });
});

describe("computeOverallStatus", () => {
  it("returns GREEN when all green", () => {
    const gates: GateResult[] = [
      { name: "A", status: "GREEN", detail: "" },
      { name: "B", status: "GREEN", detail: "" },
    ];
    expect(computeOverallStatus(gates)).toBe("GREEN");
  });

  it("returns YELLOW when any yellow", () => {
    const gates: GateResult[] = [
      { name: "A", status: "GREEN", detail: "" },
      { name: "B", status: "YELLOW", detail: "" },
    ];
    expect(computeOverallStatus(gates)).toBe("YELLOW");
  });

  it("returns RED when any red", () => {
    const gates: GateResult[] = [
      { name: "A", status: "GREEN", detail: "" },
      { name: "B", status: "RED", detail: "" },
    ];
    expect(computeOverallStatus(gates)).toBe("RED");
  });

  it("RED takes precedence over YELLOW", () => {
    const gates: GateResult[] = [
      { name: "A", status: "YELLOW", detail: "" },
      { name: "B", status: "RED", detail: "" },
    ];
    expect(computeOverallStatus(gates)).toBe("RED");
  });
});

describe("formatGateResults", () => {
  it("includes markdown table", () => {
    const gates: GateResult[] = [{ name: "Test", status: "GREEN", detail: "All good" }];
    const output = formatGateResults(gates);
    expect(output).toContain("| Test |");
    expect(output).toContain("All good");
    expect(output).toContain("Overall: GREEN");
  });

  it("includes warning for RED status", () => {
    const gates: GateResult[] = [{ name: "Fail", status: "RED", detail: "Bad" }];
    const output = formatGateResults(gates);
    expect(output).toContain("must be addressed");
  });
});
