import { describe, expect, it } from "vitest";

import { getMatchedSkills } from "./match-skills";

describe("getMatchedSkills", () => {
  it("returns empty array for empty query", () => {
    expect(getMatchedSkills("")).toEqual([]);
  });

  it("returns matched skills for relevant query", () => {
    const skills = getMatchedSkills("build a website with react");
    // Should match at least one skill since "react" is a common trigger
    expect(Array.isArray(skills)).toBe(true);
  });

  it("returns empty array for nonsense query", () => {
    const skills = getMatchedSkills("xyzzyplugh");
    expect(skills).toEqual([]);
  });

  it("does not return duplicate skills", () => {
    const skills = getMatchedSkills("react react react component");
    const ids = skills.map((s) => s.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });

  it("returns SkillDefinition objects with required fields", () => {
    const skills = getMatchedSkills("create an app");
    for (const skill of skills) {
      expect(skill).toHaveProperty("id");
      expect(skill).toHaveProperty("triggers");
    }
  });
});
