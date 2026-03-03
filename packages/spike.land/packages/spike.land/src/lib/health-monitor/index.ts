/**
 * Account Health Monitor
 *
 * Comprehensive health monitoring system for connected social accounts.
 * Tracks API rate limits, sync status, token health, and provides
 * recovery guidance.
 *
 * Resolves #586: Implement Account Health Monitor
 */

// Types
export * from "./types";

// Health Calculator
export {
  calculateErrorScore,
  calculateFullHealth,
  calculateHealthScore,
  calculateRateLimitScore,
  calculateSyncScore,
  calculateTokenScore,
  getOrCreateHealth,
  scoreToStatus,
  updateHealth,
} from "./health-calculator";

// Rate Limit Tracker
export {
  checkAndClearExpiredRateLimits,
  clearAccountRateLimit,
  getRateLimitUsage,
  parseFacebookRateLimits,
  parseLinkedInRateLimits,
  parseRateLimitHeaders,
  parseTwitterRateLimits,
} from "./rate-limit-tracker";

// Sync Monitor
export {
  getAccountsNeedingSync,
  getAccountsWithSyncIssues,
  getSyncStatus,
  needsSync,
  recordFailedSync,
  recordSuccessfulSync,
  resetDailyErrorCounters,
} from "./sync-monitor";

// Recovery Service
export {
  getAllRecoveryGuidance,
  getRecoveryGuidance,
  getUnresolvedIssues,
  markIssueResolved,
  seedDefaultRecoveryGuidance,
  upsertRecoveryGuidance,
} from "./recovery-service";

// Health Alert Manager
export {
  createHealthEvent,
  detectAndLogStatusChange,
  getAccountHealthEvents,
  getRecentHealthEvents,
  logErrorEvent,
  logRateLimitEvent,
  logTokenExpiryEvent,
  sendHealthAlertEmail,
  sendHealthAlerts,
} from "./health-alert-manager";
