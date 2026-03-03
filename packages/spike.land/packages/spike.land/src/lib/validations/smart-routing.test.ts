import { describe, expect, it } from "vitest";
import {
  AnalyzeMessageResponseSchema,
  EscalationRequestSchema,
  SmartRoutingSettingsSchema,
} from "./smart-routing";

describe("smart-routing validations", () => {
  describe("SmartRoutingSettingsSchema", () => {
    it("should accept minimal object with defaults", () => {
      const result = SmartRoutingSettingsSchema.safeParse({
        priorityWeights: {
          sentiment: 30,
          urgency: 25,
          followerCount: 20,
          engagement: 15,
          accountTier: 10,
        },
        escalation: {
          enabled: true,
          slaTimeoutMinutes: 60,
          autoAssign: true,
        },
      });
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.enabled).toBe(true);
        expect(result.data.autoAnalyzeOnFetch).toBe(true);
        expect(result.data.negativeSentimentThreshold).toBe(-0.3);
        expect(result.data.rules).toEqual([]);
      }
    });

    it("should accept complete settings", () => {
      const result = SmartRoutingSettingsSchema.safeParse({
        enabled: false,
        autoAnalyzeOnFetch: false,
        negativeSentimentThreshold: -0.5,
        priorityWeights: {
          sentiment: 40,
          urgency: 20,
          followerCount: 15,
          engagement: 15,
          accountTier: 10,
        },
        escalation: {
          enabled: false,
          slaTimeoutMinutes: 120,
          levels: [
            {
              level: 1,
              name: "Team Lead",
              triggerDelayMinutes: 15,
              notifyChannels: ["slack"],
            },
          ],
          autoAssign: false,
        },
        rules: [
          {
            id: "r1",
            name: "Escalate negative",
            condition: {
              field: "sentiment",
              operator: "less_than",
              value: -0.5,
            },
            action: { type: "escalate", value: "1" },
            active: true,
          },
        ],
      });
      expect(result.success).toBe(true);
    });

    it("should reject sentiment threshold outside [-1, 1]", () => {
      const result = SmartRoutingSettingsSchema.safeParse({
        negativeSentimentThreshold: -2,
      });
      expect(result.success).toBe(false);
    });

    it("should accept valid routing rule conditions", () => {
      const baseSettings = {
        priorityWeights: {
          sentiment: 30,
          urgency: 25,
          followerCount: 20,
          engagement: 15,
          accountTier: 10,
        },
        escalation: {
          enabled: true,
          slaTimeoutMinutes: 60,
          autoAssign: true,
        },
      };
      const fields = ["sentiment", "priority", "platform", "content", "sender_followers"] as const;
      for (const field of fields) {
        const result = SmartRoutingSettingsSchema.safeParse({
          ...baseSettings,
          rules: [
            {
              id: "r1",
              name: "Rule",
              condition: { field, operator: "equals", value: "test" },
              action: { type: "tag", value: "urgent" },
              active: true,
            },
          ],
        });
        expect(result.success).toBe(true);
      }
    });

    it("should reject invalid condition field", () => {
      const result = SmartRoutingSettingsSchema.safeParse({
        rules: [
          {
            id: "r1",
            name: "Rule",
            condition: { field: "invalid", operator: "equals", value: "x" },
            action: { type: "tag" },
            active: true,
          },
        ],
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid action type", () => {
      const result = SmartRoutingSettingsSchema.safeParse({
        rules: [
          {
            id: "r1",
            name: "Rule",
            condition: { field: "sentiment", operator: "equals", value: "x" },
            action: { type: "delete" },
            active: true,
          },
        ],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("AnalyzeMessageResponseSchema", () => {
    it("should accept valid analysis response", () => {
      const result = AnalyzeMessageResponseSchema.safeParse({
        sentiment: "NEGATIVE",
        sentimentScore: -0.7,
        urgency: "high",
        category: "complaint",
        intent: "cancel",
        suggestedResponses: ["I understand your concern..."],
      });
      expect(result.success).toBe(true);
    });

    it("should reject sentiment score outside [-1, 1]", () => {
      const result = AnalyzeMessageResponseSchema.safeParse({
        sentiment: "NEUTRAL",
        sentimentScore: 1.5,
        urgency: "low",
        suggestedResponses: [],
      });
      expect(result.success).toBe(false);
    });

    it("should reject more than 3 suggested responses", () => {
      const result = AnalyzeMessageResponseSchema.safeParse({
        sentiment: "POSITIVE",
        sentimentScore: 0.8,
        urgency: "low",
        suggestedResponses: ["a", "b", "c", "d"],
      });
      expect(result.success).toBe(false);
    });

    it("should reject invalid urgency level", () => {
      const result = AnalyzeMessageResponseSchema.safeParse({
        sentiment: "NEUTRAL",
        sentimentScore: 0,
        urgency: "extreme",
        suggestedResponses: [],
      });
      expect(result.success).toBe(false);
    });
  });

  describe("EscalationRequestSchema", () => {
    it("should accept valid escalation request", () => {
      const result = EscalationRequestSchema.safeParse({
        reason: "Customer threatening legal action",
        targetLevel: 2,
        targetUserId: "user-123",
      });
      expect(result.success).toBe(true);
    });

    it("should reject empty reason", () => {
      const result = EscalationRequestSchema.safeParse({
        reason: "",
      });
      expect(result.success).toBe(false);
    });

    it("should reject target level outside 0-3", () => {
      const result = EscalationRequestSchema.safeParse({
        reason: "Urgent",
        targetLevel: 5,
      });
      expect(result.success).toBe(false);
    });

    it("should accept request with only reason", () => {
      const result = EscalationRequestSchema.safeParse({
        reason: "Need help",
      });
      expect(result.success).toBe(true);
    });
  });
});
