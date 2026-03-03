/**
 * Account Health Monitor Types
 *
 * Type definitions for the health monitoring system.
 *
 * Resolves #586: Implement Account Health Monitor
 * Resolves #797: Type Safety Improvements
 */

import type { HealthEventDetails } from "@/lib/types/common";
import type {
  AccountHealthEventType,
  AccountHealthStatus,
  AccountIssueType,
  IssueSeverity,
  SocialPlatform,
} from "@prisma/client";

/**
 * Rate limit usage information for an account
 */
export interface RateLimitUsage {
  remaining: number;
  total: number;
  resetAt: Date;
  percentUsed: number;
}

/**
 * Rate limit information parsed from API responses
 */
export interface RateLimitInfo {
  remaining: number;
  total: number;
  resetAt: Date;
  isLimited: boolean;
}

/**
 * Current issues affecting an account
 */
export interface AccountIssue {
  type: AccountIssueType;
  severity: IssueSeverity;
  message: string;
  detectedAt: Date;
  isResolved: boolean;
}

/**
 * Summary of account health for display
 */
export interface AccountHealthSummary {
  accountId: string;
  platform: SocialPlatform;
  accountName: string;
  healthScore: number;
  status: AccountHealthStatus;
  issues: AccountIssue[];
  lastSync: Date | null;
  rateLimitUsage: RateLimitUsage | null;
  tokenExpiresAt: Date | null;
  consecutiveErrors: number;
}

/**
 * Recovery step for resolving issues
 */
export interface RecoveryStep {
  order: number;
  title: string;
  description: string;
  actionUrl?: string;
  isAutomated?: boolean;
}

/**
 * Recovery guidance for an issue
 */
export interface RecoveryGuidanceInfo {
  id: string;
  issueType: AccountIssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  steps: RecoveryStep[];
  estimatedTime: string | null;
  requiresAction: boolean;
  autoRecoverable: boolean;
}

/**
 * Health calculation weights
 */
export interface HealthWeights {
  syncStatus: number;
  rateLimitUsage: number;
  errorFrequency: number;
  tokenHealth: number;
}

/**
 * Default weights for health score calculation
 */
export const DEFAULT_HEALTH_WEIGHTS: HealthWeights = {
  syncStatus: 0.30, // 30%
  rateLimitUsage: 0.25, // 25%
  errorFrequency: 0.25, // 25%
  tokenHealth: 0.20, // 20%
};

/**
 * Health score thresholds for status mapping
 */
export const HEALTH_THRESHOLDS = {
  HEALTHY: 80,
  DEGRADED: 50,
  UNHEALTHY: 20,
  CRITICAL: 0,
} as const;

/**
 * Options for creating a health event
 */
export interface CreateHealthEventOptions {
  accountId: string;
  workspaceId: string;
  eventType: AccountHealthEventType;
  severity: IssueSeverity;
  previousStatus?: AccountHealthStatus;
  newStatus: AccountHealthStatus;
  previousScore?: number;
  newScore: number;
  message: string;
  details?: HealthEventDetails;
}

/**
 * Options for updating account health
 */
export interface UpdateHealthOptions {
  lastSuccessfulSync?: Date;
  lastSyncAttempt?: Date;
  lastError?: string;
  lastErrorAt?: Date;
  consecutiveErrors?: number;
  totalErrorsLast24h?: number;
  rateLimitRemaining?: number;
  rateLimitTotal?: number;
  rateLimitResetAt?: Date;
  isRateLimited?: boolean;
  tokenExpiresAt?: Date;
  tokenRefreshRequired?: boolean;
}

/**
 * Health alert configuration
 */
export interface HealthAlertConfig {
  workspaceId: string;
  minSeverity: IssueSeverity;
  notifyChannels: string[];
  alertOnScoreBelow?: number;
  alertOnStatusChange?: boolean;
  alertOnRateLimit?: boolean;
  alertOnTokenExpiry?: boolean;
}

/**
 * Dashboard health metrics
 */
export interface HealthDashboardMetrics {
  totalAccounts: number;
  healthyAccounts: number;
  degradedAccounts: number;
  unhealthyAccounts: number;
  criticalAccounts: number;
  averageHealthScore: number;
  accountsWithRateLimits: number;
  accountsWithExpiringTokens: number;
  recentEvents: {
    id: string;
    accountId: string;
    eventType: AccountHealthEventType;
    severity: IssueSeverity;
    message: string;
    createdAt: Date;
  }[];
}
