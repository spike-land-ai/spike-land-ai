export type BoostStatus = "ACTIVE" | "PAUSED" | "COMPLETED" | "CANCELLED";

export interface BoostCampaignData {
  id: string;
  workspaceId: string;
  originalPostId: string | null;
  campaignId: string;
  boostedAt: Date;
  boostedBy: string;
  boostReason: string;
  boostStrategy: string;
  organicMetrics: OrganicMetricsSnapshot;
  targetingCriteria: TargetingCriteria | null;
  initialBudget: number;
  duration: number;
  status: BoostStatus;
}

export interface OrganicMetricsSnapshot {
  impressions: number;
  engagement: number;
  reach: number;
  likes: number;
  comments: number;
  shares: number;
  capturedAt: Date;
}

export interface TargetingCriteria {
  demographics?: {
    ageMin?: number;
    ageMax?: number;
    genders?: string[];
    languages?: string[];
  };
  interests?: string[];
  locations?: {
    countries?: string[];
    regions?: string[];
    cities?: string[];
  };
  behaviors?: string[];
  customAudiences?: string[];
}

export interface BoostPerformanceMetrics {
  organic: {
    impressions: number;
    engagements: number;
    reach: number;
  };
  paid: {
    impressions: number;
    clicks: number;
    conversions: number;
    spend: number;
    ctr: number;
    cpa: number;
    roas: number;
  };
  attribution: {
    organic: number;
    paid: number;
    overlap: number;
  };
  computed: {
    incrementalReach: number;
    costPerResult: number;
    totalRoi: number;
  };
}

export interface BoostEffectivenessAnalysis {
  boostCampaignId: string;
  overallScore: number; // 0-100
  metrics: BoostPerformanceMetrics;
  comparison: {
    organicOnlyProjected: number; // What would have happened without boost?
    actualWithBoost: number;
    lift: number; // % improvement
  };
  costEfficiency: {
    costPerIncremental: number;
    organicVsPaidCostRatio: number;
  };
  recommendations: string[];
}
