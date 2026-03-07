import { test, expect, describe } from "vitest";
import { PERSONAS, createFixerSessionId, QUIZ_BANK } from "../../../src/mcp-tools/bazdmeg/core-logic/personas.js";

describe("Fixer Core Logic", () => {
  test("Should have 16 personas", () => {
    expect(Object.keys(PERSONAS).length).toBe(16);
  });

  test("Session IDs should be generated correctly", () => {
    const id = createFixerSessionId();
    expect(id.startsWith("fixer_")).toBe(true);
    expect(id.length).toBeGreaterThan(10);
  });

  test("Quiz banks should exist for all stages", () => {
    expect(QUIZ_BANK["1_setup"]).toBeDefined();
    expect(QUIZ_BANK["2_explore"]).toBeDefined();
    expect(QUIZ_BANK["3_triage"]).toBeDefined();
    expect(QUIZ_BANK["4_fix"]).toBeDefined();
    expect(QUIZ_BANK["5_regression"]).toBeDefined();
  });
});
