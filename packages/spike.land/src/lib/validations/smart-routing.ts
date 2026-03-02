import { InboxSentiment } from "@prisma/client";
import { z } from "zod";

const EscalationLevelDefinitionSchema = z.object({
  level: z.number(),
  name: z.string(),
  triggerDelayMinutes: z.number().optional(),
  notifyChannels: z.array(z.string()),
  assignToRole: z.string().optional(),
});

const RoutingConditionSchema = z.object({
  field: z.enum(["sentiment", "priority", "platform", "content", "sender_followers"]),
  operator: z.enum(["equals", "contains", "greater_than", "less_than"]),
  value: z.union([z.string(), z.number()]),
});

const RoutingActionSchema = z.object({
  type: z.enum(["escalate", "assign", "tag", "resolve"]),
  value: z.union([z.string(), z.number()]).optional(),
});

const RoutingRuleSchema = z.object({
  id: z.string(),
  name: z.string(),
  condition: RoutingConditionSchema,
  action: RoutingActionSchema,
  active: z.boolean(),
});

export const SmartRoutingSettingsSchema = z.object({
  enabled: z.boolean().default(true),
  autoAnalyzeOnFetch: z.boolean().default(true),
  negativeSentimentThreshold: z.number().min(-1).max(1).default(-0.3),
  priorityWeights: z.object({
    sentiment: z.number().default(30),
    urgency: z.number().default(25),
    followerCount: z.number().default(20),
    engagement: z.number().default(15),
    accountTier: z.number().default(10),
  }),
  escalation: z.object({
    enabled: z.boolean().default(true),
    slaTimeoutMinutes: z.number().default(60),
    levels: z.array(EscalationLevelDefinitionSchema).default([]),
    autoAssign: z.boolean().default(true),
  }),
  rules: z.array(RoutingRuleSchema).default([]),
});

export const AnalyzeMessageResponseSchema = z.object({
  sentiment: z.nativeEnum(InboxSentiment),
  sentimentScore: z.number().min(-1).max(1),
  urgency: z.enum(["low", "medium", "high", "critical"]),
  category: z.string().optional(),
  intent: z.string().optional(),
  suggestedResponses: z.array(z.string()).max(3),
  reasoning: z.string().optional(),
});

export const EscalationRequestSchema = z.object({
  reason: z.string().min(1),
  targetLevel: z.number().int().min(0).max(3).optional(),
  targetUserId: z.string().optional(),
});
