import { describe, expect, it } from "vitest";

import {
  CONTENT_TYPES,
  contentScoreRequestSchema,
  type GeminiScoreResponse,
  geminiScoreResponseSchema,
  getOverallAssessment,
  OVERALL_ASSESSMENTS,
  SUGGESTION_CATEGORIES,
  SUGGESTION_PRIORITIES,
  transformGeminiResponse,
  VIOLATION_SEVERITIES,
  VIOLATION_TYPES,
} from "./brand-score";

describe("brand-score validations", () => {
  describe("constants", () => {
    it("should have 5 content types", () => {
      expect(CONTENT_TYPES).toHaveLength(5);
      expect(CONTENT_TYPES).toContain("social_post");
      expect(CONTENT_TYPES).toContain("general");
    });

    it("should have 5 violation types", () => {
      expect(VIOLATION_TYPES).toHaveLength(5);
    });

    it("should have 4 violation severities", () => {
      expect(VIOLATION_SEVERITIES).toHaveLength(4);
    });

    it("should have 5 overall assessments", () => {
      expect(OVERALL_ASSESSMENTS).toHaveLength(5);
    });

    it("should have 4 suggestion categories", () => {
      expect(SUGGESTION_CATEGORIES).toHaveLength(4);
    });

    it("should have 3 suggestion priorities", () => {
      expect(SUGGESTION_PRIORITIES).toHaveLength(3);
    });
  });

  describe("contentScoreRequestSchema", () => {
    it("should accept valid input with defaults", () => {
      const result = contentScoreRequestSchema.safeParse({
        content: "Hello world",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contentType).toBe("general");
        expect(result.data.strictMode).toBe(false);
      }
    });

    it("should accept explicit contentType and strictMode", () => {
      const result = contentScoreRequestSchema.safeParse({
        content: "Check this tweet",
        contentType: "social_post",
        strictMode: true,
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.contentType).toBe("social_post");
        expect(result.data.strictMode).toBe(true);
      }
    });

    it("should reject empty content", () => {
      const result = contentScoreRequestSchema.safeParse({ content: "" });
      expect(result.success).toBe(false);
    });

    it("should reject content over 50000 chars", () => {
      const result = contentScoreRequestSchema.safeParse({
        content: "x".repeat(50001),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("getOverallAssessment", () => {
    it("should return EXCELLENT for score >= 90", () => {
      expect(getOverallAssessment(90)).toBe("EXCELLENT");
      expect(getOverallAssessment(100)).toBe("EXCELLENT");
    });

    it("should return GOOD for score 70-89", () => {
      expect(getOverallAssessment(70)).toBe("GOOD");
      expect(getOverallAssessment(89)).toBe("GOOD");
    });

    it("should return NEEDS_WORK for score 50-69", () => {
      expect(getOverallAssessment(50)).toBe("NEEDS_WORK");
      expect(getOverallAssessment(69)).toBe("NEEDS_WORK");
    });

    it("should return POOR for score 25-49", () => {
      expect(getOverallAssessment(25)).toBe("POOR");
      expect(getOverallAssessment(49)).toBe("POOR");
    });

    it("should return OFF_BRAND for score < 25", () => {
      expect(getOverallAssessment(0)).toBe("OFF_BRAND");
      expect(getOverallAssessment(24)).toBe("OFF_BRAND");
    });
  });

  describe("transformGeminiResponse", () => {
    const baseGeminiResponse: GeminiScoreResponse = {
      score: 85,
      violations: [
        {
          type: "BANNED_WORD",
          severity: "HIGH",
          message: "Don't use 'synergy'",
          lineNumber: 3,
          wordIndex: 5,
          excerpt: "maximize synergy",
          suggestion: "Use 'collaboration' instead",
        },
      ],
      suggestions: [
        {
          category: "TONE",
          recommendation: "Make it more casual",
          priority: "MEDIUM",
        },
      ],
      toneAnalysis: {
        formalCasual: 72.6,
        technicalSimple: 45.3,
        seriousPlayful: 30.8,
        reservedEnthusiastic: 55.1,
        alignment: 82.9,
      },
    };

    it("should transform score and assessment", () => {
      const result = transformGeminiResponse(baseGeminiResponse, false);
      expect(result.score).toBe(85);
      expect(result.overallAssessment).toBe("GOOD");
      expect(result.cached).toBe(false);
      expect(result.cachedAt).toBeUndefined();
    });

    it("should map violations with location", () => {
      const result = transformGeminiResponse(baseGeminiResponse, false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0]!.location).toEqual({
        lineNumber: 3,
        wordIndex: 5,
        excerpt: "maximize synergy",
      });
      expect(result.violations[0]!.suggestion).toBe(
        "Use 'collaboration' instead",
      );
    });

    it("should omit location when no location fields present", () => {
      const response: GeminiScoreResponse = {
        ...baseGeminiResponse,
        violations: [
          {
            type: "TONE_MISMATCH",
            severity: "LOW",
            message: "Tone is off",
          },
        ],
      };
      const result = transformGeminiResponse(response, false);
      expect(result.violations[0]!.location).toBeUndefined();
    });

    it("should round tone analysis values", () => {
      const result = transformGeminiResponse(baseGeminiResponse, false);
      expect(result.toneAnalysis.formalCasual).toBe(73);
      expect(result.toneAnalysis.technicalSimple).toBe(45);
      expect(result.toneAnalysis.seriousPlayful).toBe(31);
      expect(result.toneAnalysis.reservedEnthusiastic).toBe(55);
      expect(result.toneAnalysis.alignment).toBe(83);
    });

    it("should include cachedAt when provided", () => {
      const cachedAt = new Date("2025-06-01T12:00:00Z");
      const result = transformGeminiResponse(baseGeminiResponse, true, cachedAt);
      expect(result.cached).toBe(true);
      expect(result.cachedAt).toBe("2025-06-01T12:00:00.000Z");
    });
  });

  describe("geminiScoreResponseSchema", () => {
    it("should validate a well-formed Gemini response", () => {
      const result = geminiScoreResponseSchema.safeParse({
        score: 75,
        violations: [],
        suggestions: [],
        toneAnalysis: {
          formalCasual: 50,
          technicalSimple: 50,
          seriousPlayful: 50,
          reservedEnthusiastic: 50,
          alignment: 80,
        },
      });
      expect(result.success).toBe(true);
    });

    it("should reject score out of range", () => {
      const result = geminiScoreResponseSchema.safeParse({
        score: 150,
        violations: [],
        suggestions: [],
        toneAnalysis: {
          formalCasual: 50,
          technicalSimple: 50,
          seriousPlayful: 50,
          reservedEnthusiastic: 50,
          alignment: 80,
        },
      });
      expect(result.success).toBe(false);
    });
  });
});
