import { describe, expect, it } from "vitest";

import {
  approveDraftRequestSchema,
  draftItemSchema,
  geminiDraftResponseSchema,
  generateDraftsRequestSchema,
  messageAnalysisSchema,
  messageIntentSchema,
  regenerateDraftsRequestSchema,
  saveDraftRequestSchema,
  sendDraftRequestSchema,
  toneMatchSchema,
} from "./relay-draft";

describe("relay-draft validations", () => {
  describe("toneMatchSchema", () => {
    it("should accept valid tone match", () => {
      const result = toneMatchSchema.safeParse({
        alignment: 80,
        formalCasual: 50,
        technicalSimple: 60,
        seriousPlayful: 40,
        reservedEnthusiastic: 70,
      });
      expect(result.success).toBe(true);
    });

    it("should reject values outside 0-100 range", () => {
      const result = toneMatchSchema.safeParse({
        alignment: 101,
        formalCasual: 50,
        technicalSimple: 50,
        seriousPlayful: 50,
        reservedEnthusiastic: 50,
      });
      expect(result.success).toBe(false);
    });

    it("should reject negative values", () => {
      const result = toneMatchSchema.safeParse({
        alignment: -1,
        formalCasual: 50,
        technicalSimple: 50,
        seriousPlayful: 50,
        reservedEnthusiastic: 50,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("draftItemSchema", () => {
    const validToneMatch = {
      alignment: 80,
      formalCasual: 50,
      technicalSimple: 60,
      seriousPlayful: 40,
      reservedEnthusiastic: 70,
    };

    it("should accept valid draft item", () => {
      const result = draftItemSchema.safeParse({
        content: "Hello world",
        confidenceScore: 0.85,
        isPreferred: true,
        reason: "Best match for brand voice",
        toneMatch: validToneMatch,
      });
      expect(result.success).toBe(true);
    });

    it("should accept optional hashtags and mentions", () => {
      const result = draftItemSchema.safeParse({
        content: "Check it out!",
        confidenceScore: 0.7,
        isPreferred: false,
        reason: "Alternative",
        hashtags: ["#trending"],
        mentions: ["@user"],
        toneMatch: validToneMatch,
      });
      expect(result.success).toBe(true);
    });

    it("should reject confidenceScore above 1", () => {
      const result = draftItemSchema.safeParse({
        content: "Hello",
        confidenceScore: 1.5,
        isPreferred: false,
        reason: "Test",
        toneMatch: validToneMatch,
      });
      expect(result.success).toBe(false);
    });

    it("should reject empty content", () => {
      const result = draftItemSchema.safeParse({
        content: "",
        confidenceScore: 0.5,
        isPreferred: false,
        reason: "Test",
        toneMatch: validToneMatch,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("messageIntentSchema", () => {
    it("should accept all valid intents", () => {
      const intents = [
        "question",
        "feedback",
        "complaint",
        "praise",
        "request",
        "general",
        "support",
        "sales",
      ];
      for (const intent of intents) {
        expect(messageIntentSchema.safeParse(intent).success).toBe(true);
      }
    });

    it("should reject invalid intent", () => {
      expect(messageIntentSchema.safeParse("unknown").success).toBe(false);
    });
  });

  describe("messageAnalysisSchema", () => {
    it("should accept valid message analysis", () => {
      const result = messageAnalysisSchema.safeParse({
        sentiment: "positive",
        intent: "feedback",
        topics: ["product", "pricing"],
        urgency: "medium",
        hasQuestion: false,
        hasComplaint: false,
        needsEscalation: false,
      });
      expect(result.success).toBe(true);
    });

    it("should reject invalid sentiment", () => {
      const result = messageAnalysisSchema.safeParse({
        sentiment: "angry",
        intent: "general",
        topics: [],
        urgency: "low",
        hasQuestion: false,
        hasComplaint: false,
        needsEscalation: false,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("geminiDraftResponseSchema", () => {
    it("should accept valid response with 1-5 drafts", () => {
      const result = geminiDraftResponseSchema.safeParse({
        drafts: [
          {
            content: "Draft 1",
            confidenceScore: 0.9,
            isPreferred: true,
            reason: "Best",
            toneMatch: {
              alignment: 90,
              formalCasual: 50,
              technicalSimple: 50,
              seriousPlayful: 50,
              reservedEnthusiastic: 50,
            },
          },
        ],
        messageAnalysis: {
          sentiment: "neutral",
          intent: "general",
          topics: ["test"],
          urgency: "low",
          hasQuestion: false,
          hasComplaint: false,
          needsEscalation: false,
        },
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty drafts array", () => {
      const result = geminiDraftResponseSchema.safeParse({
        drafts: [],
        messageAnalysis: {
          sentiment: "neutral",
          intent: "general",
          topics: [],
          urgency: "low",
          hasQuestion: false,
          hasComplaint: false,
          needsEscalation: false,
        },
      });
      expect(result.success).toBe(false);
    });
  });

  describe("generateDraftsRequestSchema", () => {
    it("should accept valid request with defaults", () => {
      const result = generateDraftsRequestSchema.safeParse({
        inboxItemId: "item-1",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.numDrafts).toBe(3);
      }
    });

    it("should accept custom numDrafts", () => {
      const result = generateDraftsRequestSchema.safeParse({
        inboxItemId: "item-1",
        numDrafts: 5,
      });
      expect(result.success).toBe(true);
    });

    it("should reject numDrafts > 5", () => {
      const result = generateDraftsRequestSchema.safeParse({
        inboxItemId: "item-1",
        numDrafts: 6,
      });
      expect(result.success).toBe(false);
    });
  });

  describe("saveDraftRequestSchema", () => {
    it("should accept valid save request", () => {
      const result = saveDraftRequestSchema.safeParse({
        inboxItemId: "item-1",
        content: "My draft reply",
        confidenceScore: 0.8,
        isPreferred: true,
        reason: "Best match",
      });
      expect(result.success).toBe(true);
    });

    it("should accept optional metadata", () => {
      const result = saveDraftRequestSchema.safeParse({
        inboxItemId: "item-1",
        content: "Reply",
        confidenceScore: 0.5,
        isPreferred: false,
        reason: "Alternative",
        metadata: {
          toneMatch: {
            alignment: 80,
            formalCasual: 50,
            technicalSimple: 50,
            seriousPlayful: 50,
            reservedEnthusiastic: 50,
          },
          withinCharacterLimit: true,
          characterCount: 50,
          platformLimit: 280,
        },
      });
      expect(result.success).toBe(true);
    });
  });

  describe("approveDraftRequestSchema", () => {
    it("should accept valid draftId", () => {
      const result = approveDraftRequestSchema.safeParse({ draftId: "d-1" });
      expect(result.success).toBe(true);
    });

    it("should reject empty draftId", () => {
      const result = approveDraftRequestSchema.safeParse({ draftId: "" });
      expect(result.success).toBe(false);
    });
  });

  describe("sendDraftRequestSchema", () => {
    it("should accept valid draftId", () => {
      const result = sendDraftRequestSchema.safeParse({ draftId: "d-1" });
      expect(result.success).toBe(true);
    });
  });

  describe("regenerateDraftsRequestSchema", () => {
    it("should accept valid request with defaults", () => {
      const result = regenerateDraftsRequestSchema.safeParse({
        inboxItemId: "item-1",
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.numDrafts).toBe(3);
      }
    });

    it("should accept optional feedback", () => {
      const result = regenerateDraftsRequestSchema.safeParse({
        inboxItemId: "item-1",
        feedback: "Make it more formal",
      });
      expect(result.success).toBe(true);
    });
  });
});
