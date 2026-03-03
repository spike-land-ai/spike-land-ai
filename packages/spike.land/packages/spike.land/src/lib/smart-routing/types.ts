import type { InboxSentiment } from "@prisma/client";

export interface SmartRoutingSettings {
  enabled: boolean;
  autoAnalyzeOnFetch: boolean;
  negativeSentimentThreshold: number; // -1 to 1
  priorityWeights: {
    sentiment: number;
    urgency: number;
    followerCount: number;
    engagement: number;
    accountTier: number;
  };
  escalation: {
    enabled: boolean;
    slaTimeoutMinutes: number; // Default SLA in minutes
    levels: EscalationLevelDefinition[];
    autoAssign: boolean;
  };
  rules: RoutingRule[];
}

export interface EscalationLevelDefinition {
  level: number;
  name: string;
  triggerDelayMinutes?: number; // Auto-escalate after X minutes
  notifyChannels: string[]; // "email", "slack", "in_app"
  assignToRole?: string; // "admin", "owner", etc.
}

export interface RoutingRule {
  id: string;
  name: string;
  condition: RoutingCondition;
  action: RoutingAction;
  active: boolean;
}

export interface RoutingCondition {
  field: "sentiment" | "priority" | "platform" | "content" | "sender_followers";
  operator: "equals" | "contains" | "greater_than" | "less_than";
  value: string | number;
}

export interface RoutingAction {
  type: "escalate" | "assign" | "tag" | "resolve";
  value?: string | number; // userId, level, tagId
}

export interface RoutingAnalysisResult {
  sentiment: InboxSentiment;
  sentimentScore: number;
  priorityScore: number;
  priorityFactors: Record<string, number>;
  urgency: "low" | "medium" | "high" | "critical";
  category?: string;
  suggestedResponse?: string;
  suggestedActions?: string[];
}
