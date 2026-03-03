/**
 * Health Alert Manager
 *
 * Manages alerts for account health issues.
 * Integrates with the notification system to send multi-channel alerts.
 *
 * Resolves #586: Implement Account Health Monitor
 */

import type {
  AccountHealthEventType,
  AccountHealthStatus,
  IssueSeverity,
  Prisma,
  SocialAccount,
  SocialAccountHealth,
} from "@prisma/client";

import { sendEmail } from "@/lib/email/client";
import { HealthAlertEmail } from "@/lib/email/templates/health-alert";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";

import { scoreToStatus } from "./health-calculator";
import type { CreateHealthEventOptions, HealthAlertConfig } from "./types";

/**
 * Default alert thresholds
 */
const DEFAULT_ALERT_THRESHOLDS = {
  scoreWarning: 50,
  scoreCritical: 20,
  consecutiveErrorsWarning: 3,
  consecutiveErrorsCritical: 5,
};

/**
 * Create a health event record
 */
export async function createHealthEvent(
  options: CreateHealthEventOptions,
): Promise<string> {
  const event = await prisma.accountHealthEvent.create({
    data: {
      accountId: options.accountId,
      workspaceId: options.workspaceId,
      eventType: options.eventType,
      severity: options.severity,
      previousStatus: options.previousStatus,
      newStatus: options.newStatus,
      previousScore: options.previousScore,
      newScore: options.newScore,
      message: options.message,
      details: options.details as Prisma.InputJsonValue | undefined,
    },
  });

  return event.id;
}

/**
 * Detect status change and create event if needed
 */
export async function detectAndLogStatusChange(
  account: SocialAccount,
  health: SocialAccountHealth,
  previousScore: number,
  previousStatus: AccountHealthStatus,
): Promise<void> {
  const newStatus = scoreToStatus(health.healthScore);
  const scoreChanged = previousScore !== health.healthScore;
  const statusChanged = previousStatus !== newStatus;

  if (!scoreChanged && !statusChanged) {
    return;
  }

  let eventType: AccountHealthEventType;
  let severity: IssueSeverity;
  let message: string;

  if (statusChanged) {
    eventType = "STATUS_CHANGED";

    // Determine severity based on new status
    if (newStatus === "CRITICAL") {
      severity = "CRITICAL";
      message = `Account health has become critical (score: ${health.healthScore})`;
    } else if (newStatus === "UNHEALTHY") {
      severity = "ERROR";
      message = `Account health has degraded to unhealthy (score: ${health.healthScore})`;
    } else if (newStatus === "DEGRADED") {
      severity = "WARNING";
      message = `Account health has degraded (score: ${health.healthScore})`;
    } else {
      severity = "INFO";
      message = `Account health has recovered to healthy (score: ${health.healthScore})`;
      eventType = "ACCOUNT_RECOVERED";
    }
  } else if (health.healthScore < previousScore) {
    eventType = "SCORE_DECREASED";
    severity = health.healthScore < 50 ? "WARNING" : "INFO";
    message = `Health score decreased from ${previousScore} to ${health.healthScore}`;
  } else {
    eventType = "SCORE_RECOVERED";
    severity = "INFO";
    message = `Health score improved from ${previousScore} to ${health.healthScore}`;
  }

  await createHealthEvent({
    accountId: account.id,
    workspaceId: account.workspaceId,
    eventType,
    severity,
    previousStatus,
    newStatus,
    previousScore,
    newScore: health.healthScore,
    message,
    details: {
      platform: account.platform,
      accountName: account.accountName,
    },
  });
}

/**
 * Log a rate limit event
 */
export async function logRateLimitEvent(
  account: SocialAccount,
  health: SocialAccountHealth,
  isLimited: boolean,
): Promise<void> {
  const eventType: AccountHealthEventType = isLimited
    ? "RATE_LIMIT_HIT"
    : "RATE_LIMIT_CLEARED";
  const severity: IssueSeverity = isLimited ? "WARNING" : "INFO";
  const message = isLimited
    ? `Rate limit hit for ${account.platform} account`
    : `Rate limit cleared for ${account.platform} account`;

  await createHealthEvent({
    accountId: account.id,
    workspaceId: account.workspaceId,
    eventType,
    severity,
    newStatus: scoreToStatus(health.healthScore),
    newScore: health.healthScore,
    message,
    details: {
      platform: account.platform,
      accountName: account.accountName,
      rateLimitResetAt: health.rateLimitResetAt,
    },
  });
}

/**
 * Log an error event
 */
export async function logErrorEvent(
  account: SocialAccount,
  health: SocialAccountHealth,
  error: string,
): Promise<void> {
  const severity: IssueSeverity = health.consecutiveErrors
      >= DEFAULT_ALERT_THRESHOLDS.consecutiveErrorsCritical
    ? "CRITICAL"
    : health.consecutiveErrors
        >= DEFAULT_ALERT_THRESHOLDS.consecutiveErrorsWarning
    ? "ERROR"
    : "WARNING";

  await createHealthEvent({
    accountId: account.id,
    workspaceId: account.workspaceId,
    eventType: "ERROR_OCCURRED",
    severity,
    newStatus: scoreToStatus(health.healthScore),
    newScore: health.healthScore,
    message: `Error on ${account.platform} account: ${error}`,
    details: {
      platform: account.platform,
      accountName: account.accountName,
      error,
      consecutiveErrors: health.consecutiveErrors,
    },
  });
}

/**
 * Log token expiration event
 */
export async function logTokenExpiryEvent(
  account: SocialAccount,
  health: SocialAccountHealth,
  isExpired: boolean,
): Promise<void> {
  const eventType: AccountHealthEventType = isExpired
    ? "TOKEN_EXPIRED"
    : "TOKEN_REFRESHED";
  const severity: IssueSeverity = isExpired ? "ERROR" : "INFO";
  const message = isExpired
    ? `Token expired for ${account.platform} account`
    : `Token refreshed for ${account.platform} account`;

  await createHealthEvent({
    accountId: account.id,
    workspaceId: account.workspaceId,
    eventType,
    severity,
    newStatus: scoreToStatus(health.healthScore),
    newScore: health.healthScore,
    message,
    details: {
      platform: account.platform,
      accountName: account.accountName,
      tokenExpiresAt: health.tokenExpiresAt,
    },
  });
}

/**
 * Send health alert email
 */
export async function sendHealthAlertEmail(
  recipient: { email: string; name?: string; },
  alert: {
    accountName: string;
    platform: string;
    healthScore: number;
    status: AccountHealthStatus;
    issue: string;
    dashboardUrl: string;
  },
): Promise<void> {
  const severityEmoji = alert.status === "CRITICAL"
    ? "\u{1F6A8}"
    : alert.status === "UNHEALTHY"
    ? "\u{26A0}\u{FE0F}"
    : "\u{2139}\u{FE0F}";

  await sendEmail({
    to: recipient.email,
    subject: `${severityEmoji} Account Health Alert: ${alert.accountName}`,
    react: HealthAlertEmail({
      recipientName: recipient.name,
      accountName: alert.accountName,
      platform: alert.platform,
      healthScore: alert.healthScore,
      status: alert.status,
      issue: alert.issue,
      dashboardUrl: alert.dashboardUrl,
    }),
  });
}

/**
 * Map IssueSeverity to notification priority
 */
function severityToPriority(
  severity: IssueSeverity,
): "LOW" | "MEDIUM" | "HIGH" | "URGENT" {
  const mapping: Record<IssueSeverity, "LOW" | "MEDIUM" | "HIGH" | "URGENT"> = {
    INFO: "LOW",
    WARNING: "MEDIUM",
    ERROR: "HIGH",
    CRITICAL: "URGENT",
  };
  return mapping[severity];
}

/**
 * Create an in-app notification for a health alert
 *
 * Stores a persistent notification in the database that will be displayed
 * in the NotificationBell component. Does not throw errors to avoid
 * disrupting the main alert flow.
 *
 * @param params - Health alert notification parameters
 */
async function createHealthAlertNotification(params: {
  workspaceId: string;
  accountId: string;
  accountName: string;
  platform: string;
  healthScore: number;
  status: AccountHealthStatus;
  issue: string;
  severity: IssueSeverity;
  dashboardUrl: string;
}): Promise<void> {
  try {
    await prisma.notification.create({
      data: {
        workspaceId: params.workspaceId,
        type: "HEALTH_ALERT",
        title: `Account Health Alert: ${params.accountName}`,
        message: params.issue,
        priority: severityToPriority(params.severity),
        entityType: "SocialAccount",
        entityId: params.accountId,
        metadata: {
          platform: params.platform,
          healthScore: params.healthScore,
          status: params.status,
          severity: params.severity,
          dashboardUrl: params.dashboardUrl,
        },
      },
    });
    logger.info(
      `[HealthAlerts] In-app notification created for ${params.accountName}`,
    );
  } catch (error) {
    // Log but don't throw - we don't want notification failures to break alert flow
    logger.error("[HealthAlerts] Failed to create in-app notification", {
      error,
    });
  }
}

/**
 * Send alerts for accounts needing attention
 */
export async function sendHealthAlerts(
  workspaceId: string,
  config: HealthAlertConfig,
): Promise<number> {
  // Get accounts with health issues
  const accounts = await prisma.socialAccount.findMany({
    where: {
      workspaceId,
      health: {
        OR: [
          { healthScore: { lte: config.alertOnScoreBelow ?? 50 } },
          { isRateLimited: config.alertOnRateLimit ? true : undefined },
          {
            tokenRefreshRequired: config.alertOnTokenExpiry ? true : undefined,
          },
        ],
      },
    },
    include: { health: true },
  });

  if (accounts.length === 0) {
    return 0;
  }

  // Get workspace admins for notification
  const admins = await prisma.workspaceMember.findMany({
    where: {
      workspaceId,
      role: { in: ["OWNER", "ADMIN"] },
    },
    include: {
      user: { select: { email: true, name: true } },
    },
  });

  const validAdmins = admins.filter(
    m => m.user.email !== null,
  );

  if (validAdmins.length === 0) {
    return 0;
  }

  // Get workspace slug for dashboard URL
  const workspace = await prisma.workspace.findUnique({
    where: { id: workspaceId },
    select: { slug: true },
  });

  let alertsSent = 0;

  for (const account of accounts) {
    if (!account.health) continue;

    const status = scoreToStatus(account.health.healthScore);

    // Check severity threshold
    const severity: IssueSeverity = status === "CRITICAL"
      ? "CRITICAL"
      : status === "UNHEALTHY"
      ? "ERROR"
      : "WARNING";

    if (!shouldAlert(severity, config.minSeverity)) {
      continue;
    }

    // Determine issue message
    let issue = `Account health is ${status.toLowerCase()}`;
    if (account.health.isRateLimited) {
      issue = "Account has hit rate limits";
    } else if (account.health.tokenRefreshRequired) {
      issue = "Token refresh required";
    } else if (account.health.consecutiveErrors >= 3) {
      issue = `${account.health.consecutiveErrors} consecutive sync errors`;
    }

    // Send to all admins if email is in notify channels
    if (config.notifyChannels.includes("email")) {
      for (const admin of validAdmins) {
        await sendHealthAlertEmail(
          { email: admin.user.email!, name: admin.user.name || undefined },
          {
            accountName: account.accountName,
            platform: account.platform,
            healthScore: account.health.healthScore,
            status,
            issue,
            dashboardUrl:
              `https://spike.land/orbit/${workspace?.slug}/accounts/health/${account.id}`,
          },
        );
        alertsSent++;
      }
    }

    // Store in-app notification
    if (config.notifyChannels.includes("in_app")) {
      await createHealthAlertNotification({
        workspaceId,
        accountId: account.id,
        accountName: account.accountName,
        platform: account.platform,
        healthScore: account.health.healthScore,
        status,
        issue,
        severity,
        dashboardUrl: `https://spike.land/orbit/${workspace?.slug}/accounts/health/${account.id}`,
      });
    }
  }

  return alertsSent;
}

/**
 * Check if alert should be sent based on severity threshold
 */
function shouldAlert(
  eventSeverity: IssueSeverity,
  minSeverity: IssueSeverity,
): boolean {
  const severityOrder: Record<IssueSeverity, number> = {
    INFO: 0,
    WARNING: 1,
    ERROR: 2,
    CRITICAL: 3,
  };

  return severityOrder[eventSeverity] >= severityOrder[minSeverity];
}

/**
 * Get recent health events for a workspace
 */
export async function getRecentHealthEvents(
  workspaceId: string,
  limit: number = 20,
): Promise<
  Array<{
    id: string;
    accountId: string;
    accountName: string;
    platform: string;
    eventType: AccountHealthEventType;
    severity: IssueSeverity;
    message: string;
    createdAt: Date;
  }>
> {
  const events = await prisma.accountHealthEvent.findMany({
    where: { workspaceId },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: {
      account: { select: { accountName: true, platform: true } },
    },
  });

  return events.map(e => ({
    id: e.id,
    accountId: e.accountId,
    accountName: e.account.accountName,
    platform: e.account.platform,
    eventType: e.eventType,
    severity: e.severity,
    message: e.message,
    createdAt: e.createdAt,
  }));
}

/**
 * Get health events for a specific account
 */
export async function getAccountHealthEvents(
  accountId: string,
  limit: number = 50,
): Promise<
  Array<{
    id: string;
    eventType: AccountHealthEventType;
    severity: IssueSeverity;
    previousStatus: AccountHealthStatus | null;
    newStatus: AccountHealthStatus;
    previousScore: number | null;
    newScore: number;
    message: string;
    createdAt: Date;
    resolvedAt: Date | null;
  }>
> {
  const events = await prisma.accountHealthEvent.findMany({
    where: { accountId },
    orderBy: { createdAt: "desc" },
    take: limit,
  });

  return events.map(e => ({
    id: e.id,
    eventType: e.eventType,
    severity: e.severity,
    previousStatus: e.previousStatus,
    newStatus: e.newStatus,
    previousScore: e.previousScore,
    newScore: e.newScore,
    message: e.message,
    createdAt: e.createdAt,
    resolvedAt: e.resolvedAt,
  }));
}
