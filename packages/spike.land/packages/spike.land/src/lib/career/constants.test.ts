import { describe, expect, it } from "vitest";
import {
  ADZUNA_API_BASE,
  CACHE_PREFIX,
  CACHE_TTL,
  DEFAULT_COUNTRY_CODE,
  DEFAULT_RESULTS_LIMIT,
  ESCO_API_BASE,
  ESCO_SKILL_CATEGORIES,
  IP_API_BASE,
  MAX_SKILLS_PER_ASSESSMENT,
} from "./constants";

describe("career constants", () => {
  it("should have valid API base URLs", () => {
    expect(ESCO_API_BASE).toMatch(/^https?:\/\//);
    expect(IP_API_BASE).toMatch(/^https?:\/\//);
    expect(ADZUNA_API_BASE).toMatch(/^https?:\/\//);
  });

  it("should have 24-hour cache TTL in seconds", () => {
    expect(CACHE_TTL).toBe(86400);
  });

  it("should have a cache prefix", () => {
    expect(CACHE_PREFIX).toBe("career:");
  });

  it("should have expected skill categories", () => {
    expect(ESCO_SKILL_CATEGORIES.length).toBeGreaterThan(0);
    expect(ESCO_SKILL_CATEGORIES).toContain("communication");
    expect(ESCO_SKILL_CATEGORIES).toContain("technical");
    expect(ESCO_SKILL_CATEGORIES).toContain("digital");
  });

  it("should have reasonable defaults", () => {
    expect(DEFAULT_COUNTRY_CODE).toBe("gb");
    expect(DEFAULT_RESULTS_LIMIT).toBe(10);
    expect(MAX_SKILLS_PER_ASSESSMENT).toBe(50);
  });

  it("should have all lowercase skill categories", () => {
    for (const cat of ESCO_SKILL_CATEGORIES) {
      expect(cat).toBe(cat.toLowerCase());
    }
  });
});
