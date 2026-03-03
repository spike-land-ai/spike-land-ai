import { describe, expect, it } from "vitest";

import {
  brandBasicsSchema,
  brandProfileSchema,
  COLOR_USAGES,
  colorPaletteItemSchema,
  DEFAULT_BRAND_PROFILE_FORM,
  DEFAULT_TONE_DESCRIPTORS,
  GUARDRAIL_SEVERITIES,
  GUARDRAIL_TYPE_LABELS,
  GUARDRAIL_TYPES,
  guardrailSchema,
  guardrailsStepSchema,
  hexColorSchema,
  toneDescriptorsSchema,
  updateBrandProfileSchema,
  visualIdentitySchema,
  VOCABULARY_TYPE_LABELS,
  VOCABULARY_TYPES,
  vocabularyItemSchema,
  VOICE_DIMENSION_LABELS,
  VOICE_DIMENSIONS,
  voiceToneSchema,
} from "./brand-brain";

describe("brand-brain validations", () => {
  describe("constants", () => {
    it("should have 4 voice dimensions", () => {
      expect(VOICE_DIMENSIONS).toHaveLength(4);
      expect(VOICE_DIMENSIONS).toContain("formalCasual");
    });

    it("should have labels for all voice dimensions", () => {
      for (const dim of VOICE_DIMENSIONS) {
        expect(VOICE_DIMENSION_LABELS[dim].left).toBeTruthy();
        expect(VOICE_DIMENSION_LABELS[dim].right).toBeTruthy();
      }
    });

    it("should have 3 guardrail types", () => {
      expect(GUARDRAIL_TYPES).toHaveLength(3);
      expect(GUARDRAIL_TYPE_LABELS.PROHIBITED_TOPIC).toBe("Prohibited Topic");
    });

    it("should have 4 guardrail severities", () => {
      expect(GUARDRAIL_SEVERITIES).toHaveLength(4);
    });

    it("should have 3 vocabulary types with labels", () => {
      expect(VOCABULARY_TYPES).toHaveLength(3);
      expect(VOCABULARY_TYPE_LABELS.PREFERRED).toBe("Preferred Term");
      expect(VOCABULARY_TYPE_LABELS.BANNED).toBe("Banned Term");
      expect(VOCABULARY_TYPE_LABELS.REPLACEMENT).toBe("Replacement");
    });

    it("should have 5 color usages", () => {
      expect(COLOR_USAGES).toHaveLength(5);
      expect(COLOR_USAGES).toContain("primary");
      expect(COLOR_USAGES).toContain("text");
    });
  });

  describe("hexColorSchema", () => {
    it("should accept valid 6-digit hex", () => {
      expect(hexColorSchema.safeParse("#FF5733").success).toBe(true);
      expect(hexColorSchema.safeParse("#aabbcc").success).toBe(true);
    });

    it("should accept valid 3-digit hex", () => {
      expect(hexColorSchema.safeParse("#FFF").success).toBe(true);
      expect(hexColorSchema.safeParse("#abc").success).toBe(true);
    });

    it("should reject invalid hex", () => {
      expect(hexColorSchema.safeParse("FF5733").success).toBe(false);
      expect(hexColorSchema.safeParse("#GGGGGG").success).toBe(false);
      expect(hexColorSchema.safeParse("#12345").success).toBe(false);
    });
  });

  describe("colorPaletteItemSchema", () => {
    it("should accept valid color palette item", () => {
      const result = colorPaletteItemSchema.safeParse({
        name: "Primary Blue",
        hex: "#0066FF",
        usage: "primary",
      });
      expect(result.success).toBe(true);
    });

    it("should accept without usage (optional)", () => {
      const result = colorPaletteItemSchema.safeParse({
        name: "Red",
        hex: "#FF0000",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty name", () => {
      const result = colorPaletteItemSchema.safeParse({
        name: "",
        hex: "#FF0000",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("guardrailSchema", () => {
    it("should accept valid guardrail", () => {
      const result = guardrailSchema.safeParse({
        type: "PROHIBITED_TOPIC",
        name: "No politics",
        severity: "HIGH",
        isActive: true,
      });
      expect(result.success).toBe(true);
    });

    it("should reject name shorter than 2 chars", () => {
      const result = guardrailSchema.safeParse({
        type: "CONTENT_WARNING",
        name: "X",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("vocabularyItemSchema", () => {
    it("should accept valid vocabulary item", () => {
      const result = vocabularyItemSchema.safeParse({
        type: "BANNED",
        term: "synergy",
        replacement: "collaboration",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty term", () => {
      const result = vocabularyItemSchema.safeParse({
        type: "PREFERRED",
        term: "",
      });
      expect(result.success).toBe(false);
    });
  });

  describe("toneDescriptorsSchema", () => {
    it("should accept valid descriptors", () => {
      const result = toneDescriptorsSchema.safeParse({
        formalCasual: 50,
        technicalSimple: 60,
        seriousPlayful: 30,
        reservedEnthusiastic: 80,
      });
      expect(result.success).toBe(true);
    });

    it("should reject values above 100", () => {
      const result = toneDescriptorsSchema.safeParse({
        formalCasual: 101,
        technicalSimple: 50,
        seriousPlayful: 50,
        reservedEnthusiastic: 50,
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative values", () => {
      const result = toneDescriptorsSchema.safeParse({
        formalCasual: -1,
        technicalSimple: 50,
        seriousPlayful: 50,
        reservedEnthusiastic: 50,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("brandBasicsSchema", () => {
    it("should accept valid brand basics", () => {
      const result = brandBasicsSchema.safeParse({
        name: "Acme Corp",
        mission: "To make great products",
        values: ["Innovation", "Quality"],
      });
      expect(result.success).toBe(true);
    });

    it("should reject name shorter than 2 chars", () => {
      const result = brandBasicsSchema.safeParse({ name: "A" });
      expect(result.success).toBe(false);
    });

    it("should reject more than 10 values", () => {
      const result = brandBasicsSchema.safeParse({
        name: "Acme",
        values: Array.from({ length: 11 }, (_, i) => `Value ${i}`),
      });
      expect(result.success).toBe(false);
    });
  });

  describe("voiceToneSchema", () => {
    it("should accept valid voice tone", () => {
      const result = voiceToneSchema.safeParse({
        toneDescriptors: {
          formalCasual: 50,
          technicalSimple: 50,
          seriousPlayful: 50,
          reservedEnthusiastic: 50,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("visualIdentitySchema", () => {
    it("should accept valid visual identity", () => {
      const result = visualIdentitySchema.safeParse({
        logoUrl: "https://example.com/logo.png",
        colorPalette: [{ name: "Blue", hex: "#0000FF" }],
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty logo URL", () => {
      const result = visualIdentitySchema.safeParse({ logoUrl: "" });
      expect(result.success).toBe(true);
    });

    it("should reject more than 10 colors", () => {
      const colors = Array.from({ length: 11 }, (_, i) => ({
        name: `Color ${i}`,
        hex: "#FF0000",
      }));
      const result = visualIdentitySchema.safeParse({ colorPalette: colors });
      expect(result.success).toBe(false);
    });
  });

  describe("guardrailsStepSchema", () => {
    it("should accept valid guardrails step", () => {
      const result = guardrailsStepSchema.safeParse({
        guardrails: [{ type: "PROHIBITED_TOPIC", name: "No spam" }],
        vocabulary: [{ type: "BANNED", term: "literally" }],
      });
      expect(result.success).toBe(true);
    });

    it("should accept empty arrays", () => {
      const result = guardrailsStepSchema.safeParse({
        guardrails: [],
        vocabulary: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("brandProfileSchema (merged)", () => {
    it("should accept a complete brand profile", () => {
      const result = brandProfileSchema.safeParse({
        name: "Acme Corp",
        mission: "Build great things",
        values: ["Quality"],
        toneDescriptors: DEFAULT_TONE_DESCRIPTORS,
        logoUrl: "",
        colorPalette: [],
        guardrails: [],
        vocabulary: [],
      });
      expect(result.success).toBe(true);
    });
  });

  describe("updateBrandProfileSchema", () => {
    it("should accept partial updates", () => {
      const result = updateBrandProfileSchema.safeParse({ name: "New Name" });
      expect(result.success).toBe(true);
    });

    it("should accept empty object", () => {
      const result = updateBrandProfileSchema.safeParse({});
      expect(result.success).toBe(true);
    });
  });

  describe("default values", () => {
    it("should have all tone descriptors at 50", () => {
      expect(DEFAULT_TONE_DESCRIPTORS.formalCasual).toBe(50);
      expect(DEFAULT_TONE_DESCRIPTORS.technicalSimple).toBe(50);
      expect(DEFAULT_TONE_DESCRIPTORS.seriousPlayful).toBe(50);
      expect(DEFAULT_TONE_DESCRIPTORS.reservedEnthusiastic).toBe(50);
    });

    it("should have empty default brand profile form", () => {
      expect(DEFAULT_BRAND_PROFILE_FORM.name).toBe("");
      expect(DEFAULT_BRAND_PROFILE_FORM.values).toEqual([]);
      expect(DEFAULT_BRAND_PROFILE_FORM.colorPalette).toEqual([]);
      expect(DEFAULT_BRAND_PROFILE_FORM.guardrails).toEqual([]);
      expect(DEFAULT_BRAND_PROFILE_FORM.vocabulary).toEqual([]);
    });
  });
});
