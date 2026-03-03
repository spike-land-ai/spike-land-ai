/**
 * System Report Types
 *
 * Type definitions for the unified system report API.
 */

/**
 * Job status counts from the image enhancement queue
 */
interface JobStatusMetrics {
  pending: number;
  processing: number;
  completed: number;
  failed: number;
  active: number;
}

/**
 * Platform-wide metrics from the admin dashboard
 */
export interface PlatformMetrics {
  totalUsers: number;
  adminCount: number;
  totalEnhancements: number;
  jobStatus: JobStatusMetrics;
  totalAiCreditsAllocated: number;
  totalAiCreditsUsed: number;
  totalWorkspaces: number;
}

/**
 * Auth provider breakdown
 */
export interface AuthProviderCount {
  provider: string;
  count: number;
}

/**
 * User analytics metrics
 */
export interface UserMetrics {
  totalUsers: number;
  newUsersLast7Days: number;
  newUsersLast30Days: number;
  activeUsersLast7Days: number;
  activeUsersLast30Days: number;
  authProviderBreakdown: AuthProviderCount[];
}

/**
 * Workspace tier distribution
 */
export interface TierDistribution {
  tier: string;
  count: number;
}

/**
 * Credit economics metrics
 */
export interface TokenMetrics {
  totalCreditsAllocated: number;
  totalCreditsUsed: number;
  averageCreditsPerWorkspace: number;
  tierDistribution: TierDistribution[];
}

/**
 * Processing time by tier
 */
export interface ProcessingTimeByTier {
  tier: string;
  seconds: number;
}

/**
 * Failure rate by tier
 */
export interface FailureRateByTier {
  tier: string;
  failureRate: number;
}

/**
 * System health metrics
 */
export interface HealthMetrics {
  queueDepth: number;
  recentFailures: number;
  avgProcessingTimeByTier: ProcessingTimeByTier[];
  failureRateByTier: FailureRateByTier[];
}

/**
 * Traffic source breakdown
 */
export interface TrafficSource {
  name: string;
  value: number;
}

/**
 * Marketing funnel metrics
 */
export interface MarketingMetrics {
  visitors: number;
  visitorsChange: number;
  signups: number;
  signupsChange: number;
  conversionRate: number;
  revenue: number;
  trafficSources: TrafficSource[];
}

/**
 * Error summary metrics
 */
export interface ErrorMetrics {
  last24Hours: number;
  topErrorTypes: Record<string, number>;
  topErrorFiles: Record<string, number>;
}

/**
 * Meta/Facebook campaign data
 */
export interface MetaCampaignData {
  id: string;
  name: string;
  status: string;
  spend: number;
  impressions: number;
  clicks: number;
  conversions: number;
}

/**
 * Meta/Facebook Ads aggregated data
 */
export interface MetaAdsData {
  campaigns: MetaCampaignData[];
  totalSpend: number;
  totalImpressions: number;
  totalClicks: number;
  totalConversions: number;
  ctr: number;
  cpc: number;
}

/**
 * External integrations data (optional, may fail gracefully)
 */
export interface ExternalData {
  metaAds?: MetaAdsData | null;
}

/**
 * Report period configuration
 */
export interface ReportPeriod {
  start: string;
  end: string;
}

/**
 * Complete system report
 */
export interface SystemReport {
  generatedAt: string;
  period: ReportPeriod;
  platform: PlatformMetrics;
  users: UserMetrics;
  tokens: TokenMetrics;
  health: HealthMetrics;
  marketing: MarketingMetrics;
  errors: ErrorMetrics;
  external?: ExternalData;
}

/**
 * Partial system report (when only specific sections requested)
 */
export interface PartialSystemReport {
  generatedAt: string;
  period: ReportPeriod;
  platform?: PlatformMetrics;
  users?: UserMetrics;
  tokens?: TokenMetrics;
  health?: HealthMetrics;
  marketing?: MarketingMetrics;
  errors?: ErrorMetrics;
  external?: ExternalData;
}

/**
 * Report sections that can be requested
 */
export type ReportSection =
  | "platform"
  | "users"
  | "tokens"
  | "health"
  | "marketing"
  | "errors"
  | "meta";

/**
 * Report period options
 */
export type ReportPeriodOption = "7d" | "30d" | "90d";

/**
 * Report format options
 */
export type ReportFormat = "json" | "summary";

/**
 * API request parameters
 */
export interface SystemReportRequest {
  period?: ReportPeriodOption;
  include?: ReportSection[];
  format?: ReportFormat;
}

/**
 * Summary format for quick overview
 */
export interface SystemReportSummary {
  generatedAt: string;
  period: ReportPeriod;
  highlights: {
    totalUsers: number;
    activeUsersLast7Days: number;
    totalEnhancements: number;
    pendingJobs: number;
    failedJobs: number;
    totalAiCreditsUsed: number;
    errorsLast24Hours: number;
    conversionRate: number;
  };
  external?: {
    metaTotalSpend?: number;
  };
}
