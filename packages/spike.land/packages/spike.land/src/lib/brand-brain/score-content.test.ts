import { describe, expect, it, vi } from "vitest";
import type { BrandGuardrail, BrandProfile, BrandVocabulary } from "@/types/brand-brain";

const { mockGenerateStructuredResponse } = vi.hoisted(() => ({
  mockGenerateStructuredResponse: vi.fn(),
}));

vi.mock("@/lib/ai/gemini-client", () => ({
  generateStructuredResponse: mockGenerateStructuredResponse,
}));

vi.mock("@/lib/logger", () => ({
  default: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  _buildBrandScoringSystemPrompt,
  scoreContent,
  type ScoreContentParams,
} from "./score-content";

// ── Helpers ──────────────────────────────────────────────────────────────────

function makeBrandProfile(overrides: Partial<BrandProfile> = {}): BrandProfile {
  return {
    id: "bp-1",
    workspaceId: "ws-1",
    name: "TestBrand",
    mission: "Empower users",
    values: ["innovation", "trust"],
    toneDescriptors: {
      formalCasual: 40,
      technicalSimple: 60,
      seriousPlayful: 30,
      reservedEnthusiastic: 70,
    },
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as BrandProfile;
}

function makeGuardrail(overrides: Partial<BrandGuardrail> = {}): BrandGuardrail {
  return {
    id: "g-1",
    workspaceId: "ws-1",
    type: "TONE",
    name: "Stay professional",
    description: "No slang",
    severity: "HIGH",
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  } as BrandGuardrail;
}

function makeVocab(overrides: Partial<BrandVocabulary> = {}): BrandVocabulary {
  return {
    id: "v-1",
    workspaceId: "ws-1",
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

function makeValidGeminiResponse() {
  return {
    score: 85,
    violations: [],
    suggestions: [
      { category: "TONE", recommendation: "Use active voice", priority: "LOW" },
    ],
    toneAnalysis: {
      formalCasual: 45,
      technicalSimple: 55,
      seriousPlayful: 35,
      reservedEnthusiastic: 65,
      alignment: 80,
    },
  };
}

function makeParams(overrides: Partial<ScoreContentParams> = {}): ScoreContentParams {
  return {
    content: "Innovate your workflow today.",
    contentType: "social_post",
    strictMode: false,
    brandProfile: makeBrandProfile(),
    guardrails: [],
    vocabulary: [],
    ...overrides,
  };
}

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("_buildBrandScoringSystemPrompt", () => {
  it("includes the brand name in the prompt", () => {
    const prompt = _buildBrandScoringSystemPrompt(makeParams());
    expect(prompt).toContain("TestBrand");
  });

  it("includes the brand mission", () => {
    const prompt = _buildBrandScoringSystemPrompt(makeParams());
    expect(prompt).toContain("Empower users");
  });

  it("includes the brand values", () => {
    const prompt = _buildBrandScoringSystemPrompt(makeParams());
    expect(prompt).toContain("innovation");
    expect(prompt).toContain("trust");
  });

  it("includes tone descriptor values", () => {
    const prompt = _buildBrandScoringSystemPrompt(makeParams());
    expect(prompt).toContain("40"); // formalCasual
    expect(prompt).toContain("60"); // technicalSimple
  });

  it("uses default tone (50) when toneDescriptors is null/undefined", () => {
    const params = makeParams({
      brandProfile: makeBrandProfile({ toneDescriptors: null }),
    });
    const prompt = _buildBrandScoringSystemPrompt(params);
    expect(prompt).toContain("50");
  });

  it("includes guardrail information when guardrails are provided", () => {
    const params = makeParams({
      guardrails: [makeGuardrail({ name: "No Slang Rule" })],
    });
    const prompt = _buildBrandScoringSystemPrompt(params);
    expect(prompt).toContain("No Slang Rule");
  });

  it("includes 'Not specified' for missing mission", () => {
    const params = makeParams({
      brandProfile: makeBrandProfile({ mission: null }),
    });
    const prompt = _buildBrandScoringSystemPrompt(params);
    expect(prompt).toContain("Not specified");
  });

  it("includes vocabulary information when vocabulary is provided", () => {
    const params = makeParams({
      vocabulary: [makeVocab({ type: "BANNED", term: "cheap" })],
    });
    const prompt = _buildBrandScoringSystemPrompt(params);
    expect(prompt).toContain("cheap");
  });
});

describe("scoreContent", () => {
  beforeEach(() => {
    mockGenerateStructuredResponse.mockReset();
  });

  it("returns a ContentScoreResponse on success", async () => {
    mockGenerateStructuredResponse.mockResolvedValue(makeValidGeminiResponse());
    const result = await scoreContent(makeParams());
    expect(result.score).toBe(85);
    expect(result.overallAssessment).toBe("GOOD");
    expect(result.cached).toBe(false);
  });

  it("passes the correct maxTokens and temperature to generateStructuredResponse", async () => {
    mockGenerateStructuredResponse.mockResolvedValue(makeValidGeminiResponse());
    await scoreContent(makeParams());
    expect(mockGenerateStructuredResponse).toHaveBeenCalledWith(
      expect.objectContaining({
        maxTokens: 4096,
        temperature: 0.3,
      }),
    );
  });

  it("throws when generateStructuredResponse fails", async () => {
    mockGenerateStructuredResponse.mockRejectedValue(new Error("API error"));
    await expect(scoreContent(makeParams())).rejects.toThrow(
      "Failed to score content: API error",
    );
  });

  it("throws when AI response fails Zod validation", async () => {
    // Return invalid structure (missing required fields)
    mockGenerateStructuredResponse.mockResolvedValue({ score: "not-a-number" });
    await expect(scoreContent(makeParams())).rejects.toThrow(
      "Invalid score response structure from AI",
    );
  });

  it("applies strictMode: sets score to 0 when there are violations", async () => {
    const geminiResponse = {
      ...makeValidGeminiResponse(),
      score: 75,
      violations: [
        {
          type: "BANNED_WORD",
          severity: "HIGH",
          message: "Used banned word",
        },
      ],
    };
    mockGenerateStructuredResponse.mockResolvedValue(geminiResponse);
    const result = await scoreContent(makeParams({ strictMode: true }));
    expect(result.score).toBe(0);
    expect(result.overallAssessment).toBe("OFF_BRAND");
  });

  it("does not zero the score in strictMode when there are no violations", async () => {
    mockGenerateStructuredResponse.mockResolvedValue(makeValidGeminiResponse());
    const result = await scoreContent(makeParams({ strictMode: true }));
    expect(result.score).toBe(85);
  });

  it("does not zero the score in normal mode even with violations", async () => {
    const geminiResponse = {
      ...makeValidGeminiResponse(),
      score: 70,
      violations: [
        { type: "TONE_MISMATCH", severity: "MEDIUM", message: "Slightly off tone" },
      ],
    };
    mockGenerateStructuredResponse.mockResolvedValue(geminiResponse);
    const result = await scoreContent(makeParams({ strictMode: false }));
    expect(result.score).toBe(70);
  });

  it("correctly maps toneAnalysis fields (rounding)", async () => {
    const geminiResponse = {
      ...makeValidGeminiResponse(),
      toneAnalysis: {
        formalCasual: 45.6,
        technicalSimple: 54.3,
        seriousPlayful: 30.9,
        reservedEnthusiastic: 65.1,
        alignment: 80.5,
      },
    };
    mockGenerateStructuredResponse.mockResolvedValue(geminiResponse);
    const result = await scoreContent(makeParams());
    expect(result.toneAnalysis.formalCasual).toBe(46);
    expect(result.toneAnalysis.technicalSimple).toBe(54);
    expect(result.toneAnalysis.seriousPlayful).toBe(31);
    expect(result.toneAnalysis.reservedEnthusiastic).toBe(65);
    expect(result.toneAnalysis.alignment).toBe(81);
  });

  it("maps violation location when present", async () => {
    const geminiResponse = {
      ...makeValidGeminiResponse(),
      violations: [
        {
          type: "BANNED_WORD",
          severity: "LOW",
          message: "Found 'cheap'",
          lineNumber: 3,
          wordIndex: 5,
          excerpt: "this is cheap stuff",
          suggestion: "Use 'affordable' instead",
        },
      ],
    };
    mockGenerateStructuredResponse.mockResolvedValue(geminiResponse);
    const result = await scoreContent(makeParams());
    expect(result.violations[0]!.location?.lineNumber).toBe(3);
    expect(result.violations[0]!.location?.wordIndex).toBe(5);
    expect(result.violations[0]!.location?.excerpt).toBe("this is cheap stuff");
    expect(result.violations[0]!.suggestion).toBe("Use 'affordable' instead");
  });

  it("omits location when violation has no lineNumber/wordIndex/excerpt", async () => {
    const geminiResponse = {
      ...makeValidGeminiResponse(),
      violations: [
        {
          type: "TONE_MISMATCH",
          severity: "MEDIUM",
          message: "Slightly off",
        },
      ],
    };
    mockGenerateStructuredResponse.mockResolvedValue(geminiResponse);
    const result = await scoreContent(makeParams());
    expect(result.violations[0]!.location).toBeUndefined();
  });
});
