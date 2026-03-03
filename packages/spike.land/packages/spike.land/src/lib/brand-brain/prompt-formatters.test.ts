import { describe, expect, it } from "vitest";

import type { BrandGuardrail, BrandVocabulary, GuardrailType } from "@/types/brand-brain";

import { formatGuardrails, formatVocabulary } from "./prompt-formatters";

function makeGuardrail(overrides: Partial<BrandGuardrail> = {}): BrandGuardrail {
  return {
    id: "g1",
    workspaceId: "ws1",
    severity: "MEDIUM",
    type: "TONE" as GuardrailType,
    name: "Stay professional",
    description: "Keep a professional tone",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as BrandGuardrail;
}

function makeVocab(overrides: Partial<BrandVocabulary> = {}): BrandVocabulary {
  return {
    id: "v1",
    workspaceId: "ws1",
    type: "PREFERRED",
    term: "innovate",
    replacement: null,
    context: null,
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as BrandVocabulary;
}

describe("formatGuardrails", () => {
  it("returns fallback for empty array", () => {
    expect(formatGuardrails([], "rewrite")).toBe("No specific guardrails defined.");
  });

  it("formats guardrails with text severity in rewrite style", () => {
    const result = formatGuardrails(
      [makeGuardrail({ severity: "HIGH", type: "TONE" as GuardrailType, name: "No slang" })],
      "rewrite",
    );
    expect(result).toContain("!");
    expect(result).toContain("[TONE]");
    expect(result).toContain("No slang");
  });

  it("formats guardrails with emoji severity in score style", () => {
    const result = formatGuardrails(
      [makeGuardrail({ severity: "CRITICAL" })],
      "score",
    );
    // CRITICAL emoji is red circle
    expect(result).toContain("\uD83D\uDD34");
  });

  it("uses fallback for unknown severity", () => {
    const result = formatGuardrails(
      [makeGuardrail({ severity: "UNKNOWN" as "MEDIUM" })],
      "rewrite",
    );
    // text fallback is "-"
    expect(result).toContain("-");
  });

  it("shows description or fallback", () => {
    const withDesc = formatGuardrails(
      [makeGuardrail({ description: "Keep it clean" })],
      "draft",
    );
    expect(withDesc).toContain("Keep it clean");

    const noDesc = formatGuardrails(
      [makeGuardrail({ description: null as unknown as string })],
      "draft",
    );
    expect(noDesc).toContain("No description");
  });

  it("joins multiple guardrails with newlines", () => {
    const result = formatGuardrails(
      [
        makeGuardrail({ name: "Rule A" }),
        makeGuardrail({ name: "Rule B" }),
      ],
      "rewrite",
    );
    expect(result).toContain("Rule A");
    expect(result).toContain("Rule B");
    expect(result.split("\n")).toHaveLength(2);
  });
});

describe("formatVocabulary", () => {
  it("returns fallback for empty array", () => {
    expect(formatVocabulary([], "rewrite")).toBe("No specific vocabulary rules defined.");
  });

  it("formats preferred terms", () => {
    const result = formatVocabulary(
      [makeVocab({ type: "PREFERRED", term: "innovate" })],
      "rewrite",
    );
    expect(result).toContain("**Preferred Terms:**");
    expect(result).toContain("innovate");
  });

  it("formats banned terms for rewrite style", () => {
    const result = formatVocabulary(
      [makeVocab({ type: "BANNED", term: "cheap" })],
      "rewrite",
    );
    expect(result).toContain("Banned Terms (MUST replace)");
    expect(result).toContain("cheap");
  });

  it("formats banned terms for score style", () => {
    const result = formatVocabulary(
      [makeVocab({ type: "BANNED", term: "cheap" })],
      "score",
    );
    expect(result).toContain("Banned Terms");
    expect(result).not.toContain("MUST replace");
  });

  it("includes context for banned terms when provided", () => {
    const result = formatVocabulary(
      [makeVocab({ type: "BANNED", term: "cheap", context: "pricing" })],
      "rewrite",
    );
    expect(result).toContain("cheap (pricing)");
  });

  it("formats replacement terms with arrow", () => {
    const result = formatVocabulary(
      [makeVocab({ type: "REPLACEMENT", term: "cheap", replacement: "affordable" })],
      "rewrite",
    );
    expect(result).toContain("Required Replacements");
    expect(result).toContain("\"cheap\" -> \"affordable\"");
  });

  it("uses unicode arrow for score style", () => {
    const result = formatVocabulary(
      [makeVocab({ type: "REPLACEMENT", term: "old", replacement: "vintage" })],
      "score",
    );
    expect(result).toContain("\u2192");
  });

  it("groups all vocabulary types together", () => {
    const result = formatVocabulary(
      [
        makeVocab({ type: "PREFERRED", term: "innovate" }),
        makeVocab({ type: "BANNED", term: "cheap" }),
        makeVocab({ type: "REPLACEMENT", term: "old", replacement: "vintage" }),
      ],
      "draft",
    );
    expect(result).toContain("Preferred Terms");
    expect(result).toContain("Banned Terms (MUST avoid)");
    expect(result).toContain("Required Replacements");
  });
});
