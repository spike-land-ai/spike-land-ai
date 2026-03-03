import { describe, expect, it } from "vitest";
import { BAZDMEG_SYSTEM_PROMPT } from "./bazdmeg-system";

describe("bazdmeg-system prompt", () => {
  it("should export a non-empty string", () => {
    expect(typeof BAZDMEG_SYSTEM_PROMPT).toBe("string");
    expect(BAZDMEG_SYSTEM_PROMPT.length).toBeGreaterThan(0);
  });

  it("should mention BAZDMEG Orchestrator role", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("BAZDMEG Orchestrator");
  });

  it("should include ticket-first rule", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("TICKET FIRST");
  });

  it("should include quality gates section", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("QUALITY GATES");
  });

  it("should include three checkpoints", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Pre-Code");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Post-Code");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Pre-PR");
  });

  it("should reference tool names", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("bazdmeg_quality_gates");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("bazdmeg_pr_readiness");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("bazdmeg_deploy_check");
  });

  it("should define 5 quality gates", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Gate 1: CI Speed");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Gate 2: Test Health");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Gate 3: Type Safety");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Gate 4: Coverage");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Gate 5: Dependency Health");
  });

  it("should include coverage thresholds in Gate 4", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("80% lines");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("80% functions");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("75% branches");
  });
});
