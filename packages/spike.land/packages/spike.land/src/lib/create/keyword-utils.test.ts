import { describe, expect, it } from "vitest";

import { extractKeywords, isCompoundMatch, matchesAny } from "./keyword-utils";

describe("extractKeywords", () => {
  it("splits on slashes, dashes, underscores, and spaces", () => {
    expect(extractKeywords("games/tic-tac_toe board")).toEqual([
      "games",
      "tic",
      "tac",
      "toe",
      "board",
    ]);
  });

  it("lowercases all keywords", () => {
    expect(extractKeywords("Chart/Dashboard")).toEqual(["chart", "dashboard"]);
  });

  it("removes stop words", () => {
    expect(extractKeywords("tools for the home")).toEqual(["tools", "home"]);
  });

  it("returns empty for only stop words", () => {
    expect(extractKeywords("a and the")).toEqual([]);
  });

  it("filters empty segments", () => {
    expect(extractKeywords("a//b--c")).toEqual(["b", "c"]);
  });
});

describe("isCompoundMatch", () => {
  it("matches when keyword starts with trigger >= 5 chars", () => {
    expect(isCompoundMatch("charting", "chart")).toBe(true);
  });

  it("does not match triggers shorter than 5 chars", () => {
    expect(isCompoundMatch("gaming", "game")).toBe(false);
  });

  it("does not match if keyword does not start with trigger", () => {
    expect(isCompoundMatch("rechart", "chart")).toBe(false);
  });
});

describe("matchesAny", () => {
  it("matches exact keyword", () => {
    expect(matchesAny(["chart", "data"], ["chart"])).toBe(true);
  });

  it("matches compound keyword", () => {
    expect(matchesAny(["charting"], ["chart"])).toBe(true);
  });

  it("returns false for no match", () => {
    expect(matchesAny(["music", "audio"], ["chart"])).toBe(false);
  });

  it("returns false for empty keywords", () => {
    expect(matchesAny([], ["chart"])).toBe(false);
  });

  it("returns false for empty triggers", () => {
    expect(matchesAny(["chart"], [])).toBe(false);
  });
});
