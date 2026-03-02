import { describe, expect, it } from "vitest";
import { buildReviewPrompt, DEFAULT_REVIEW_PROMPT } from "./prompts.js";
import type { PRDetails } from "../types.js";

const mockPR: PRDetails = {
  title: "feat: add auth",
  body: "Adds OAuth login flow",
  state: "open",
  author: "testuser",
  createdAt: "2026-01-01T00:00:00Z",
  updatedAt: "2026-01-01T00:00:00Z",
  mergeable: true,
  merged: false,
  additions: 50,
  deletions: 10,
  changedFiles: 3,
  headSha: "abc123",
  baseSha: "def456",
  baseRef: "main",
  headRef: "feat/auth",
};

describe("DEFAULT_REVIEW_PROMPT", () => {
  it("contains review guidelines", () => {
    expect(DEFAULT_REVIEW_PROMPT).toContain("Code Quality");
    expect(DEFAULT_REVIEW_PROMPT).toContain("Security");
    expect(DEFAULT_REVIEW_PROMPT).toContain("Performance");
    expect(DEFAULT_REVIEW_PROMPT).toContain("APPROVE");
  });
});

describe("buildReviewPrompt", () => {
  it("includes PR context", () => {
    const prompt = buildReviewPrompt(mockPR, "+const x = 1;");
    expect(prompt).toContain("feat: add auth");
    expect(prompt).toContain("testuser");
    expect(prompt).toContain("+50");
    expect(prompt).toContain("feat/auth");
  });

  it("includes diff in code block", () => {
    const diff = "+const x = 1;\n-const y = 2;";
    const prompt = buildReviewPrompt(mockPR, diff);
    expect(prompt).toContain("```diff");
    expect(prompt).toContain(diff);
  });

  it("uses custom prompt when provided", () => {
    const custom = "Be very strict";
    const prompt = buildReviewPrompt(mockPR, "+code", custom);
    expect(prompt).toContain("Be very strict");
    expect(prompt).not.toContain(DEFAULT_REVIEW_PROMPT.slice(0, 20));
  });

  it("appends additional rules", () => {
    const rules = ["No console.log", "Always use const"];
    const prompt = buildReviewPrompt(mockPR, "+code", undefined, rules);
    expect(prompt).toContain("Additional Project Rules");
    expect(prompt).toContain("No console.log");
    expect(prompt).toContain("Always use const");
  });

  it("handles null PR body", () => {
    const pr = { ...mockPR, body: null };
    const prompt = buildReviewPrompt(pr, "+code");
    expect(prompt).toContain("(no description)");
  });
});
