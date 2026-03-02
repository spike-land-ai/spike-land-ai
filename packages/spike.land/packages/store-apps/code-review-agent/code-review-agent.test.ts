import { describe, expect, it } from "vitest";
import { codeReviewAgentTools } from "./tools";

describe("Code Review Agent tools", () => {
  it("exports 13 tools", () => {
    expect(codeReviewAgentTools.length).toBe(13);
  });

  it("all tools have valid names starting with review_", () => {
    for (const tool of codeReviewAgentTools) {
      expect(tool.name).toMatch(/^review_/);
    }
  });

  it("covers review and review-pr categories", () => {
    const categories = new Set(codeReviewAgentTools.map((t) => t.category));
    expect(categories).toContain("review");
    expect(categories).toContain("review-pr");
  });

  it("review-pr tools are free tier and always enabled", () => {
    const prTools = codeReviewAgentTools.filter((t) => t.category === "review-pr");
    expect(prTools.length).toBe(4);
    for (const tool of prTools) {
      expect(tool.tier).toBe("free");
      expect(tool.alwaysEnabled).toBe(true);
    }
  });

  it("convention review tools are workspace tier", () => {
    const reviewTools = codeReviewAgentTools.filter((t) => t.category === "review");
    expect(reviewTools.length).toBe(9);
    for (const tool of reviewTools) {
      expect(tool.tier).toBe("workspace");
    }
  });

  it("has expected tool names", () => {
    const names = codeReviewAgentTools.map((t) => t.name);
    expect(names).toContain("review_create_conventions");
    expect(names).toContain("review_code");
    expect(names).toContain("review_analyze_complexity");
    expect(names).toContain("review_get_report");
    expect(names).toContain("review_list_conventions");
    expect(names).toContain("review_get_diff");
    expect(names).toContain("review_suggest_fix");
    expect(names).toContain("review_check_conventions");
    expect(names).toContain("review_security_scan");
  });
});
