import { describe, expect, it } from "vitest";

import { FALLBACK_SKILL, SKILL_DEFINITIONS, type SkillDefinition } from "./skill-definitions";

describe("SKILL_DEFINITIONS", () => {
  it("is a non-empty array", () => {
    expect(SKILL_DEFINITIONS.length).toBeGreaterThan(0);
  });

  it("every skill has required fields", () => {
    for (const skill of SKILL_DEFINITIONS) {
      expect(skill.id).toBeTruthy();
      expect(skill.name).toBeTruthy();
      expect(skill.icon).toBeTruthy();
      expect(skill.category).toBeTruthy();
      expect(skill.colorClass).toBeTruthy();
      expect(Array.isArray(skill.triggers)).toBe(true);
      expect(skill.triggers.length).toBeGreaterThan(0);
      expect(skill.description).toBeTruthy();
    }
  });

  it("has unique skill IDs", () => {
    const ids = SKILL_DEFINITIONS.map((s) => s.id);
    const unique = new Set(ids);
    expect(unique.size).toBe(ids.length);
  });

  it("triggers are all lowercase strings", () => {
    for (const skill of SKILL_DEFINITIONS) {
      for (const trigger of skill.triggers) {
        expect(trigger).toBe(trigger.toLowerCase());
      }
    }
  });

  it("colorClass contains Tailwind classes", () => {
    for (const skill of SKILL_DEFINITIONS) {
      expect(skill.colorClass).toContain("border-");
      expect(skill.colorClass).toContain("bg-");
      expect(skill.colorClass).toContain("text-");
    }
  });
});

describe("FALLBACK_SKILL", () => {
  it("has id general", () => {
    expect(FALLBACK_SKILL.id).toBe("general");
  });

  it("has empty triggers", () => {
    expect(FALLBACK_SKILL.triggers).toHaveLength(0);
  });

  it("satisfies SkillDefinition interface", () => {
    const skill: SkillDefinition = FALLBACK_SKILL;
    expect(skill.name).toBe("General");
    expect(skill.category).toBe("General");
    expect(skill.description).toBeTruthy();
  });
});
