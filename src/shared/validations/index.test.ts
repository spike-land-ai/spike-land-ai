import { describe, expect, it } from "vitest";
import {
  AddToCartRequestSchema,
  AlbumPrivacySchema,
  AspectRatioSchema,
  BatchEnhanceRequestSchema,
  CheckEmailRequestSchema,
  CreateAlbumRequestSchema,
  CreateOrderRequestSchema,
  EnhanceImageRequestSchema,
  EnhancementTierSchema,
  GenerateImageRequestSchema,
  ModifyImageRequestSchema,
  RedeemVoucherRequestSchema,
  ShippingAddressSchema,
  SignUpRequestSchema,
  UpdateAlbumRequestSchema,
} from "./index";

describe("validations", () => {
  describe("EnhancementTierSchema", () => {
    it("should accept valid tiers", () => {
      expect(EnhancementTierSchema.parse("FREE")).toBe("FREE");
      expect(EnhancementTierSchema.parse("TIER_1K")).toBe("TIER_1K");
      expect(EnhancementTierSchema.parse("TIER_2K")).toBe("TIER_2K");
      expect(EnhancementTierSchema.parse("TIER_4K")).toBe("TIER_4K");
    });

    it("should reject invalid tiers", () => {
      expect(() => EnhancementTierSchema.parse("INVALID")).toThrow();
      expect(() => EnhancementTierSchema.parse("")).toThrow();
      expect(() => EnhancementTierSchema.parse(null)).toThrow();
    });
  });

  describe("EnhanceImageRequestSchema", () => {
    it("should accept valid request", () => {
      const result = EnhanceImageRequestSchema.parse({
        imageId: "img_123",
        tier: "TIER_1K",
      });
      expect(result.imageId).toBe("img_123");
      expect(result.tier).toBe("TIER_1K");
    });

    it("should accept optional fields", () => {
      const result = EnhanceImageRequestSchema.parse({
        imageId: "img_123",
        tier: "TIER_2K",
        prompt: "enhance this photo",
        pipelineId: "pipeline_456",
      });
      expect(result.prompt).toBe("enhance this photo");
      expect(result.pipelineId).toBe("pipeline_456");
    });

    it("should reject empty imageId", () => {
      expect(() =>
        EnhanceImageRequestSchema.parse({
          imageId: "",
          tier: "TIER_1K",
        }),
      ).toThrow();
    });

    it("should reject missing required fields", () => {
      expect(() => EnhanceImageRequestSchema.parse({ imageId: "img_123" })).toThrow();
      expect(() => EnhanceImageRequestSchema.parse({ tier: "TIER_1K" })).toThrow();
    });
  });

  describe("BatchEnhanceRequestSchema", () => {
    it("should accept valid batch request", () => {
      const result = BatchEnhanceRequestSchema.parse({
        imageIds: ["img_1", "img_2", "img_3"],
        tier: "TIER_1K",
      });
      expect(result.imageIds).toHaveLength(3);
      expect(result.tier).toBe("TIER_1K");
    });

    it("should reject empty array", () => {
      expect(() =>
        BatchEnhanceRequestSchema.parse({
          imageIds: [],
          tier: "TIER_1K",
        }),
      ).toThrow();
    });

    it("should reject too many images (max 20)", () => {
      const tooManyIds = Array.from({ length: 21 }, (_, i) => `img_${i}`);
      expect(() =>
        BatchEnhanceRequestSchema.parse({
          imageIds: tooManyIds,
          tier: "TIER_1K",
        }),
      ).toThrow();
    });

    it("should accept exactly 20 images", () => {
      const maxIds = Array.from({ length: 20 }, (_, i) => `img_${i}`);
      const result = BatchEnhanceRequestSchema.parse({
        imageIds: maxIds,
        tier: "TIER_1K",
      });
      expect(result.imageIds).toHaveLength(20);
    });
  });

  describe("AspectRatioSchema", () => {
    it("should accept valid aspect ratios", () => {
      expect(AspectRatioSchema.parse("1:1")).toBe("1:1");
      expect(AspectRatioSchema.parse("16:9")).toBe("16:9");
      expect(AspectRatioSchema.parse("9:16")).toBe("9:16");
    });

    it("should reject invalid aspect ratios", () => {
      expect(() => AspectRatioSchema.parse("2:1")).toThrow();
      expect(() => AspectRatioSchema.parse("invalid")).toThrow();
    });
  });

  describe("GenerateImageRequestSchema", () => {
    it("should accept valid request with defaults", () => {
      const result = GenerateImageRequestSchema.parse({
        prompt: "A beautiful sunset",
      });
      expect(result.prompt).toBe("A beautiful sunset");
      expect(result.tier).toBe("TIER_1K"); // default
      expect(result.aspectRatio).toBe("1:1"); // default
    });

    it("should accept all optional fields", () => {
      const result = GenerateImageRequestSchema.parse({
        prompt: "A beautiful sunset",
        tier: "TIER_4K",
        aspectRatio: "16:9",
        negativePrompt: "blurry, low quality",
      });
      expect(result.tier).toBe("TIER_4K");
      expect(result.aspectRatio).toBe("16:9");
      expect(result.negativePrompt).toBe("blurry, low quality");
    });

    it("should reject empty prompt", () => {
      expect(() => GenerateImageRequestSchema.parse({ prompt: "" })).toThrow();
    });

    it("should reject prompt over 4000 characters", () => {
      const longPrompt = "a".repeat(4001);
      expect(() => GenerateImageRequestSchema.parse({ prompt: longPrompt })).toThrow();
    });

    it("should accept prompt at exactly 4000 characters", () => {
      const maxPrompt = "a".repeat(4000);
      const result = GenerateImageRequestSchema.parse({ prompt: maxPrompt });
      expect(result.prompt).toHaveLength(4000);
    });
  });

  describe("ModifyImageRequestSchema", () => {
    it("should accept valid request with image URL", () => {
      const result = ModifyImageRequestSchema.parse({
        prompt: "Make it brighter",
        imageUrl: "https://example.com/image.jpg",
      });
      expect(result.prompt).toBe("Make it brighter");
      expect(result.imageUrl).toBe("https://example.com/image.jpg");
    });

    it("should accept request with base64 image", () => {
      const result = ModifyImageRequestSchema.parse({
        prompt: "Add filters",
        imageBase64: "base64encodedstring",
      });
      expect(result.imageBase64).toBe("base64encodedstring");
    });

    it("should reject invalid URL", () => {
      expect(() =>
        ModifyImageRequestSchema.parse({
          prompt: "Test",
          imageUrl: "not-a-url",
        }),
      ).toThrow();
    });
  });

  describe("AlbumPrivacySchema", () => {
    it("should accept valid privacy levels", () => {
      expect(AlbumPrivacySchema.parse("PRIVATE")).toBe("PRIVATE");
      expect(AlbumPrivacySchema.parse("UNLISTED")).toBe("UNLISTED");
      expect(AlbumPrivacySchema.parse("PUBLIC")).toBe("PUBLIC");
    });

    it("should reject invalid privacy level", () => {
      expect(() => AlbumPrivacySchema.parse("SECRET")).toThrow();
    });
  });

  describe("CreateAlbumRequestSchema", () => {
    it("should accept valid request with defaults", () => {
      const result = CreateAlbumRequestSchema.parse({
        name: "My Album",
      });
      expect(result.name).toBe("My Album");
      expect(result.privacy).toBe("PRIVATE"); // default
      expect(result.defaultTier).toBe("TIER_1K"); // default
    });

    it("should accept all fields", () => {
      const result = CreateAlbumRequestSchema.parse({
        name: "Vacation Photos",
        description: "Photos from my trip",
        privacy: "PUBLIC",
        defaultTier: "TIER_4K",
      });
      expect(result.description).toBe("Photos from my trip");
      expect(result.privacy).toBe("PUBLIC");
      expect(result.defaultTier).toBe("TIER_4K");
    });

    it("should reject empty name", () => {
      expect(() => CreateAlbumRequestSchema.parse({ name: "" })).toThrow();
    });

    it("should reject name over 100 characters", () => {
      const longName = "a".repeat(101);
      expect(() => CreateAlbumRequestSchema.parse({ name: longName })).toThrow();
    });

    it("should reject description over 500 characters", () => {
      const longDesc = "a".repeat(501);
      expect(() =>
        CreateAlbumRequestSchema.parse({
          name: "Album",
          description: longDesc,
        }),
      ).toThrow();
    });
  });

  describe("UpdateAlbumRequestSchema", () => {
    it("should accept partial updates", () => {
      const result = UpdateAlbumRequestSchema.parse({
        name: "New Name",
      });
      expect(result.name).toBe("New Name");
      expect(result.description).toBeUndefined();
    });

    it("should accept all fields", () => {
      const result = UpdateAlbumRequestSchema.parse({
        name: "Updated Album",
        description: "New description",
        privacy: "UNLISTED",
        defaultTier: "TIER_2K",
        coverImageId: "img_cover",
      });
      expect(result.coverImageId).toBe("img_cover");
    });

    it("should accept empty object", () => {
      const result = UpdateAlbumRequestSchema.parse({});
      expect(result).toEqual({});
    });
  });

  describe("RedeemVoucherRequestSchema", () => {
    it("should transform code to uppercase", () => {
      const result = RedeemVoucherRequestSchema.parse({
        code: "abc123",
      });
      expect(result.code).toBe("ABC123");
    });

    it("should trim whitespace", () => {
      const result = RedeemVoucherRequestSchema.parse({
        code: "  CODE  ",
      });
      expect(result.code).toBe("CODE");
    });

    it("should reject code shorter than 4 characters", () => {
      expect(() => RedeemVoucherRequestSchema.parse({ code: "ABC" })).toThrow();
    });

    it("should reject code longer than 20 characters", () => {
      const longCode = "A".repeat(21);
      expect(() => RedeemVoucherRequestSchema.parse({ code: longCode })).toThrow();
    });
  });

  describe("AddToCartRequestSchema", () => {
    it("should accept valid request with defaults", () => {
      const result = AddToCartRequestSchema.parse({
        productId: "prod_123",
      });
      expect(result.productId).toBe("prod_123");
      expect(result.quantity).toBe(1); // default
    });

    it("should accept all optional fields", () => {
      const result = AddToCartRequestSchema.parse({
        productId: "prod_123",
        variantId: "var_456",
        imageId: "img_789",
        uploadedImageUrl: "https://example.com/image.jpg",
        quantity: 3,
        customText: "My custom text",
      });
      expect(result.variantId).toBe("var_456");
      expect(result.quantity).toBe(3);
    });

    it("should reject quantity less than 1", () => {
      expect(() =>
        AddToCartRequestSchema.parse({
          productId: "prod_123",
          quantity: 0,
        }),
      ).toThrow();
    });

    it("should reject quantity greater than 10", () => {
      expect(() =>
        AddToCartRequestSchema.parse({
          productId: "prod_123",
          quantity: 11,
        }),
      ).toThrow();
    });

    it("should reject invalid uploaded image URL", () => {
      expect(() =>
        AddToCartRequestSchema.parse({
          productId: "prod_123",
          uploadedImageUrl: "not-a-url",
        }),
      ).toThrow();
    });
  });

  describe("ShippingAddressSchema", () => {
    it("should accept valid address", () => {
      const result = ShippingAddressSchema.parse({
        name: "John Doe",
        line1: "123 Main St",
        city: "London",
        postalCode: "SW1A 1AA",
        country: "GB",
      });
      expect(result.name).toBe("John Doe");
      expect(result.country).toBe("GB");
    });

    it("should accept optional fields", () => {
      const result = ShippingAddressSchema.parse({
        name: "John Doe",
        line1: "123 Main St",
        line2: "Apt 4B",
        city: "London",
        state: "Greater London",
        postalCode: "SW1A 1AA",
        country: "GB",
      });
      expect(result.line2).toBe("Apt 4B");
      expect(result.state).toBe("Greater London");
    });

    it("should reject invalid country code (must be 2 characters)", () => {
      expect(() =>
        ShippingAddressSchema.parse({
          name: "John Doe",
          line1: "123 Main St",
          city: "London",
          postalCode: "SW1A 1AA",
          country: "GBR", // 3 characters
        }),
      ).toThrow();
    });

    it("should reject missing required fields", () => {
      expect(() =>
        ShippingAddressSchema.parse({
          name: "John Doe",
          city: "London",
        }),
      ).toThrow();
    });
  });

  describe("CreateOrderRequestSchema", () => {
    const validAddress = {
      name: "John Doe",
      line1: "123 Main St",
      city: "London",
      postalCode: "SW1A 1AA",
      country: "GB",
    };

    it("should accept valid order request", () => {
      const result = CreateOrderRequestSchema.parse({
        shippingAddress: validAddress,
        email: "john@example.com",
      });
      expect(result.email).toBe("john@example.com");
    });

    it("should accept all optional fields", () => {
      const result = CreateOrderRequestSchema.parse({
        shippingAddress: validAddress,
        billingAddress: validAddress,
        email: "john@example.com",
        phone: "+44123456789",
        notes: "Please leave at door",
      });
      expect(result.billingAddress).toBeDefined();
      expect(result.phone).toBe("+44123456789");
    });

    it("should reject invalid email", () => {
      expect(() =>
        CreateOrderRequestSchema.parse({
          shippingAddress: validAddress,
          email: "not-an-email",
        }),
      ).toThrow();
    });
  });

  describe("CheckEmailRequestSchema", () => {
    it("should accept valid email", () => {
      const result = CheckEmailRequestSchema.parse({
        email: "user@example.com",
      });
      expect(result.email).toBe("user@example.com");
    });

    it("should reject invalid email", () => {
      expect(() => CheckEmailRequestSchema.parse({ email: "invalid" })).toThrow();
    });
  });

  describe("SignUpRequestSchema", () => {
    it("should accept valid signup request", () => {
      const result = SignUpRequestSchema.parse({
        email: "user@example.com",
        password: "securepassword123",
      });
      expect(result.email).toBe("user@example.com");
    });

    it("should accept optional fields", () => {
      const result = SignUpRequestSchema.parse({
        email: "user@example.com",
        password: "securepassword123",
        name: "John Doe",
        referralCode: "REF123",
      });
      expect(result.name).toBe("John Doe");
      expect(result.referralCode).toBe("REF123");
    });

    it("should reject password shorter than 8 characters", () => {
      expect(() =>
        SignUpRequestSchema.parse({
          email: "user@example.com",
          password: "short",
        }),
      ).toThrow();
    });

    it("should accept password at exactly 8 characters", () => {
      const result = SignUpRequestSchema.parse({
        email: "user@example.com",
        password: "exactly8",
      });
      expect(result.password).toBe("exactly8");
    });

    it("should reject password over 100 characters", () => {
      const longPassword = "a".repeat(101);
      expect(() =>
        SignUpRequestSchema.parse({
          email: "user@example.com",
          password: longPassword,
        }),
      ).toThrow();
    });
  });
});

// =============================================================================
// Dual-Read Helper Tests (Phase 4 - JSON Extraction)
// =============================================================================

import {
  getCampaignObjectivesWithFallback,
  getTargetAudienceWithFallback,
  parseJson,
  safeParseJson,
  TargetAudienceSchema,
  type TypedCampaignObjective,
  type TypedTargetAudience,
} from "./json-schemas";

describe("dual-read helpers", () => {
  describe("safeParseJson", () => {
    it("should return parsed value for valid input", () => {
      const validAudience = {
        ageRange: { min: 18, max: 35 },
        genders: ["male", "female"],
        locations: ["US", "UK"],
      };
      const result = safeParseJson(TargetAudienceSchema, validAudience);
      expect(result).toEqual(validAudience);
    });

    it("should return undefined for invalid input", () => {
      const invalidAudience = {
        ageRange: { min: "not a number" },
      };
      const result = safeParseJson(TargetAudienceSchema, invalidAudience);
      expect(result).toBeUndefined();
    });

    it("should return undefined for null input", () => {
      const result = safeParseJson(TargetAudienceSchema, null);
      expect(result).toBeUndefined();
    });
  });

  describe("parseJson", () => {
    it("should return parsed value for valid input", () => {
      const validAudience = {
        ageRange: { min: 18, max: 35 },
        genders: ["male"],
      };
      const result = parseJson(TargetAudienceSchema, validAudience);
      expect(result).toEqual(validAudience);
    });

    it("should throw for invalid input", () => {
      const invalidAudience = { ageRange: "invalid" };
      expect(() => parseJson(TargetAudienceSchema, invalidAudience)).toThrow();
    });
  });

  describe("getTargetAudienceWithFallback", () => {
    const mockTypedAudience: TypedTargetAudience = {
      id: "aud_123",
      briefId: "brief_123",
      ageMin: 18,
      ageMax: 35,
      genders: ["male", "female"],
      locations: ["US", "UK"],
      interests: ["technology", "sports"],
      behaviors: ["online_shopper"],
      createdAt: new Date("2024-01-01"),
      updatedAt: new Date("2024-01-02"),
    };

    it("should prefer typed model when available", () => {
      const jsonAudience = {
        ageRange: { min: 25, max: 40 },
        genders: ["other"],
      };

      const result = getTargetAudienceWithFallback(mockTypedAudience, jsonAudience);

      // Should use typed model values, not JSON
      expect(result?.ageRange).toEqual({ min: 18, max: 35 });
      expect(result?.genders).toEqual(["male", "female"]);
      expect(result?.locations).toEqual(["US", "UK"]);
      expect(result?.interests).toEqual(["technology", "sports"]);
      expect(result?.behaviors).toEqual(["online_shopper"]);
    });

    it("should handle typed audience with null age range", () => {
      const typedWithNullAge: TypedTargetAudience = {
        ...mockTypedAudience,
        ageMin: null,
        ageMax: null,
      };

      const result = getTargetAudienceWithFallback(typedWithNullAge, null);

      expect(result?.ageRange).toBeUndefined();
      expect(result?.genders).toEqual(["male", "female"]);
    });

    it("should handle typed audience with partial age range", () => {
      const typedWithPartialAge: TypedTargetAudience = {
        ...mockTypedAudience,
        ageMin: 18,
        ageMax: null,
      };

      const result = getTargetAudienceWithFallback(typedWithPartialAge, null);

      // Only set ageRange if both min and max are present
      expect(result?.ageRange).toBeUndefined();
    });

    it("should fall back to JSON when typed model is null", () => {
      const jsonAudience = {
        ageRange: { min: 25, max: 40 },
        genders: ["other"],
        locations: ["CA"],
      };

      const result = getTargetAudienceWithFallback(null, jsonAudience);

      expect(result?.ageRange).toEqual({ min: 25, max: 40 });
      expect(result?.genders).toEqual(["other"]);
      expect(result?.locations).toEqual(["CA"]);
    });

    it("should fall back to JSON when typed model is undefined", () => {
      const jsonAudience = {
        ageRange: { min: 30, max: 50 },
      };

      const result = getTargetAudienceWithFallback(undefined, jsonAudience);

      expect(result?.ageRange).toEqual({ min: 30, max: 50 });
    });

    it("should return undefined when both typed and JSON are invalid", () => {
      const invalidJson = { ageRange: "invalid" };

      const result = getTargetAudienceWithFallback(null, invalidJson);

      expect(result).toBeUndefined();
    });
  });

  describe("getCampaignObjectivesWithFallback", () => {
    const mockTypedObjectives: TypedCampaignObjective[] = [
      {
        id: "obj_1",
        briefId: "brief_123",
        type: "AWARENESS",
        metric: "impressions",
        targetValue: 1000000,
        deadline: new Date("2024-06-30"),
        priority: 1,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      },
      {
        id: "obj_2",
        briefId: "brief_123",
        type: "CONVERSION",
        metric: "purchases",
        targetValue: 5000,
        deadline: null,
        priority: 2,
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-01-02"),
      },
    ];

    it("should prefer typed models when available", () => {
      const jsonObjectives = [{ type: "ENGAGEMENT", metric: "clicks" }];

      const result = getCampaignObjectivesWithFallback(mockTypedObjectives, jsonObjectives);

      // Should use typed model values, not JSON
      expect(result).toHaveLength(2);
      expect(result![0]!.type).toBe("AWARENESS");
      expect(result![0]!.metric).toBe("impressions");
      expect(result![0]!.targetValue).toBe(1000000);
      expect(result![0]!.deadline).toBe("2024-06-30T00:00:00.000Z");
      expect(result![0]!.priority).toBe(1);

      expect(result![1]!.type).toBe("CONVERSION");
      expect(result![1]!.targetValue).toBe(5000);
      expect(result![1]!.deadline).toBeUndefined();
    });

    it("should handle null target values in typed models", () => {
      const typedWithNulls: TypedCampaignObjective[] = [
        {
          id: "obj_3",
          briefId: "brief_123",
          type: "AWARENESS",
          metric: "reach",
          targetValue: null,
          deadline: null,
          priority: 1,
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ];

      const result = getCampaignObjectivesWithFallback(typedWithNulls, null);

      expect(result[0]!.targetValue).toBeUndefined();
      expect(result[0]!.deadline).toBeUndefined();
    });

    it("should fall back to JSON when typed array is empty", () => {
      const jsonObjectives = [{ type: "ENGAGEMENT", metric: "likes", targetValue: 10000 }];

      const result = getCampaignObjectivesWithFallback([], jsonObjectives);

      expect(result).toHaveLength(1);
      expect(result![0]!.type).toBe("ENGAGEMENT");
      expect(result![0]!.metric).toBe("likes");
    });

    it("should fall back to JSON when typed array is null", () => {
      const jsonObjectives = [{ type: "RETENTION", metric: "subscribers" }];

      const result = getCampaignObjectivesWithFallback(null, jsonObjectives);

      expect(result).toHaveLength(1);
      expect(result![0]!.type).toBe("RETENTION");
    });

    it("should fall back to JSON when typed array is undefined", () => {
      const jsonObjectives = [{ type: "AWARENESS", metric: "reach" }];

      const result = getCampaignObjectivesWithFallback(undefined, jsonObjectives);

      expect(result).toHaveLength(1);
      expect(result![0]!.type).toBe("AWARENESS");
    });

    it("should return empty array when both typed and JSON are invalid", () => {
      const invalidJson = "not an array";

      const result = getCampaignObjectivesWithFallback(null, invalidJson);

      expect(result).toEqual([]);
    });

    it("should return empty array when both are null/empty", () => {
      const result = getCampaignObjectivesWithFallback([], null);

      expect(result).toEqual([]);
    });
  });
});
