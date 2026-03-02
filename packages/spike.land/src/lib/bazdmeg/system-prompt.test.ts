import { describe, expect, it } from "vitest";

import { BAZDMEG_SYSTEM_PROMPT } from "./system-prompt";

describe("BAZDMEG_SYSTEM_PROMPT", () => {
  it("is a non-empty string", () => {
    expect(typeof BAZDMEG_SYSTEM_PROMPT).toBe("string");
    expect(BAZDMEG_SYSTEM_PROMPT.length).toBeGreaterThan(100);
  });

  it("mentions all 7 principles", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Requirements Are The Product");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Discipline Before Automation");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Context Is Architecture");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Test The Lies");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Orchestrate, Do Not Operate");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Trust Is Earned In PRs");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Own What You Ship");
  });

  it("includes effort split percentages", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("30% Planning");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("50% Testing");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("20% Quality");
  });

  it("includes the hourglass testing model", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("70% MCP tool tests");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("20% E2E specs");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("10% UI component tests");
  });

  it("includes the three lies framework", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Small lies");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Big lies");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Human lies");
  });

  it("includes the planning interview questions", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("What problem are we solving");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("What data already exists");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("How will we verify it works");
  });

  it("includes the automation audit gates", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("CI Speed");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Flaky Tests");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("CLAUDE.md");
  });

  it("includes the responsibility framework", () => {
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Can you explain every line");
    expect(BAZDMEG_SYSTEM_PROMPT).toContain("Can you debug this at 3am");
  });
});
