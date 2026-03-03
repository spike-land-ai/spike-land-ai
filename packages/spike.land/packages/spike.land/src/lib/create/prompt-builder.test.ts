import { describe, expect, it } from "vitest";

import {
  AGENT_IDENTITY,
  buildFullSystemPrompt,
  buildSystemPrompt,
  buildUserPrompt,
  extractKeywords,
  getMatchedSkills,
  LUCIDE_ICONS,
  matchesAny,
  OUTPUT_SPEC,
  SYSTEM_PROMPT,
} from "./prompt-builder";

describe("constants", () => {
  it("AGENT_IDENTITY is a non-empty string", () => {
    expect(AGENT_IDENTITY.length).toBeGreaterThan(0);
    expect(AGENT_IDENTITY).toContain("React");
  });

  it("OUTPUT_SPEC contains output format instructions", () => {
    expect(OUTPUT_SPEC).toContain("OUTPUT FORMAT");
    expect(OUTPUT_SPEC).toContain("TITLE");
    expect(OUTPUT_SPEC).toContain("DESCRIPTION");
    expect(OUTPUT_SPEC).toContain("RELATED");
  });

  it("LUCIDE_ICONS is a Set with known icons", () => {
    expect(LUCIDE_ICONS).toBeInstanceOf(Set);
    expect(LUCIDE_ICONS.has("Home")).toBe(true);
    expect(LUCIDE_ICONS.has("Search")).toBe(true);
    expect(LUCIDE_ICONS.has("Settings")).toBe(true);
    expect(LUCIDE_ICONS.has("NotARealIcon")).toBe(false);
  });

  it("SYSTEM_PROMPT is pre-built from general topic", () => {
    expect(SYSTEM_PROMPT.length).toBeGreaterThan(0);
    expect(typeof SYSTEM_PROMPT).toBe("string");
  });
});

describe("re-exported keyword functions", () => {
  it("extractKeywords splits on separators", () => {
    expect(extractKeywords("games/tictactoe")).toEqual([
      "games",
      "tictactoe",
    ]);
  });

  it("matchesAny returns true on match", () => {
    expect(matchesAny(["chart"], ["chart"])).toBe(true);
  });
});

describe("getMatchedSkills", () => {
  it("returns matches for chart-related topic", () => {
    const skills = getMatchedSkills("chart dashboard");
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some(s => s.id === "recharts")).toBe(true);
  });

  it("returns matches for 3d topic", () => {
    const skills = getMatchedSkills("3d globe earth");
    expect(skills.length).toBeGreaterThan(0);
    expect(skills.some(s => s.category === "3d")).toBe(true);
  });

  it("returns empty for generic topic", () => {
    const skills = getMatchedSkills("xyzzy asdfgh");
    expect(skills).toHaveLength(0);
  });

  it("deduplicates by skill id", () => {
    const skills = getMatchedSkills("chart charts");
    const ids = skills.map(s => s.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("each matched skill has expected fields", () => {
    const skills = getMatchedSkills("game");
    for (const skill of skills) {
      expect(skill.id).toBeTruthy();
      expect(skill.name).toBeTruthy();
      expect(skill.category).toBeTruthy();
    }
  });
});

describe("buildSystemPrompt", () => {
  it("includes core prompt for any topic", () => {
    const prompt = buildSystemPrompt("chart dashboard");
    expect(prompt).toContain("expert React developer");
  });

  it("includes skill sections for matching topic", () => {
    const prompt = buildSystemPrompt("chart dashboard");
    expect(prompt).toContain("##");
  });

  it("returns core + fallback for unrecognized topic", () => {
    const prompt = buildSystemPrompt("xyzzy_unknown_topic");
    expect(prompt).toContain("expert React developer");
    // should include fallback libs
    expect(prompt.length).toBeGreaterThan(100);
  });

  it("varies by topic", () => {
    const chartPrompt = buildSystemPrompt("chart data analytics");
    const gamePrompt = buildSystemPrompt("game quiz trivia");
    expect(chartPrompt).not.toBe(gamePrompt);
  });
});

describe("buildUserPrompt", () => {
  it("includes the topic path", () => {
    const prompt = buildUserPrompt("games/tictactoe");
    expect(prompt).toContain("/create/games/tictactoe");
  });

  it("includes example responses", () => {
    const prompt = buildUserPrompt("anything");
    expect(prompt).toContain("TITLE");
    expect(prompt).toContain("DESCRIPTION");
    expect(prompt).toContain("RELATED");
  });

  it("includes URL param instruction for dashboard topic", () => {
    const prompt = buildUserPrompt("dashboard analytics config");
    expect(prompt).toContain("URL search params");
  });

  it("does not include URL param instruction for unrelated topic", () => {
    const prompt = buildUserPrompt("xyzzy_nothing");
    expect(prompt).not.toContain("URL search params");
  });
});

describe("buildFullSystemPrompt", () => {
  it("combines identity, system prompt, and output spec", () => {
    const full = buildFullSystemPrompt("chart");
    expect(full).toContain(AGENT_IDENTITY);
    expect(full).toContain("OUTPUT FORMAT");
  });

  it("varies by topic", () => {
    const a = buildFullSystemPrompt("chart data");
    const b = buildFullSystemPrompt("game quiz");
    expect(a).not.toBe(b);
  });
});
