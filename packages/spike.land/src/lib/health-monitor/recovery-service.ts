/**
 * Recovery Service
 *
 * Provides recovery guidance for account health issues.
 * Matches issues to recovery templates and tracks resolution.
 *
 * Resolves #586: Implement Account Health Monitor
 * Resolves #797: Type Safety Improvements
 */

import type {
  AccountIssueType,
  IssueSeverity,
  Prisma,
  RecoveryGuidance,
  SocialPlatform,
} from "@prisma/client";

import prisma from "@/lib/prisma";

import type { RecoveryGuidanceInfo, RecoveryStep } from "./types";

/**
 * Get recovery guidance for a specific issue type and platform
 */
export async function getRecoveryGuidance(
  issueType: AccountIssueType,
  platform?: SocialPlatform,
): Promise<RecoveryGuidanceInfo | null> {
  // Try to find platform-specific guidance first
  let guidance = await prisma.recoveryGuidance.findFirst({
    where: {
      issueType,
      platform: platform ?? null,
    },
  });

  // Fall back to generic guidance if no platform-specific one exists
  if (!guidance && platform) {
    guidance = await prisma.recoveryGuidance.findFirst({
      where: {
        issueType,
        platform: null,
      },
    });
  }

  if (!guidance) {
    return null;
  }

  return formatGuidance(guidance);
}

/**
 * Format database guidance to response type
 */
function formatGuidance(guidance: RecoveryGuidance): RecoveryGuidanceInfo {
  return {
    id: guidance.id,
    issueType: guidance.issueType,
    severity: guidance.severity,
    title: guidance.title,
    description: guidance.description,
    // Prisma stores JSON as JsonValue - we know this is RecoveryStep[] from our schema
    steps: guidance.steps as unknown as RecoveryStep[],
    estimatedTime: guidance.estimatedTime,
    requiresAction: guidance.requiresAction,
    autoRecoverable: guidance.autoRecoverable,
  };
}

/**
 * Get all recovery guidance templates
 */
export async function getAllRecoveryGuidance(): Promise<
  RecoveryGuidanceInfo[]
> {
  const guidance = await prisma.recoveryGuidance.findMany({
    orderBy: [{ severity: "desc" }, { issueType: "asc" }],
  });

  return guidance.map(formatGuidance);
}

/**
 * Create or update recovery guidance
 */
export async function upsertRecoveryGuidance(options: {
  platform: SocialPlatform | null;
  issueType: AccountIssueType;
  severity: IssueSeverity;
  title: string;
  description: string;
  steps: RecoveryStep[];
  estimatedTime?: string;
  requiresAction?: boolean;
  autoRecoverable?: boolean;
}): Promise<RecoveryGuidanceInfo> {
  // Find existing guidance
  const existing = await prisma.recoveryGuidance.findFirst({
    where: {
      platform: options.platform,
      issueType: options.issueType,
    },
  });

  // Convert RecoveryStep[] to Prisma JSON input format
  const stepsJson = options.steps as unknown as Prisma.InputJsonValue;

  let guidance: RecoveryGuidance;
  if (existing) {
    guidance = await prisma.recoveryGuidance.update({
      where: { id: existing.id },
      data: {
        severity: options.severity,
        title: options.title,
        description: options.description,
        steps: stepsJson,
        ...(options.estimatedTime !== undefined ? { estimatedTime: options.estimatedTime } : {}),
        requiresAction: options.requiresAction ?? true,
        autoRecoverable: options.autoRecoverable ?? false,
      },
    });
  } else {
    guidance = await prisma.recoveryGuidance.create({
      data: {
        platform: options.platform,
        issueType: options.issueType,
        severity: options.severity,
        title: options.title,
        description: options.description,
        steps: stepsJson,
        ...(options.estimatedTime !== undefined ? { estimatedTime: options.estimatedTime } : {}),
        requiresAction: options.requiresAction ?? true,
        autoRecoverable: options.autoRecoverable ?? false,
      },
    });
  }

  return formatGuidance(guidance);
}

/**
 * Seed default recovery guidance templates
 */
export async function seedDefaultRecoveryGuidance(): Promise<void> {
  const defaultGuidance: Array<{
    platform: SocialPlatform | null;
    issueType: AccountIssueType;
    severity: IssueSeverity;
    title: string;
    description: string;
    steps: RecoveryStep[];
    estimatedTime: string;
    requiresAction: boolean;
    autoRecoverable: boolean;
  }> = [
    {
      platform: null,
      issueType: "TOKEN_EXPIRED",
      severity: "ERROR",
      title: "Reconnect Your Account",
      description:
        "Your account authorization has expired. You need to reconnect your account to continue syncing.",
      steps: [
        {
          order: 1,
          title: "Go to Account Settings",
          description:
            "Navigate to your workspace settings and find the connected accounts section.",
          actionUrl: "/settings/accounts",
        },
        {
          order: 2,
          title: "Click Reconnect",
          description: "Find the affected account and click the Reconnect button.",
        },
        {
          order: 3,
          title: "Authorize Access",
          description: "You'll be redirected to the social platform. Sign in and authorize access.",
        },
        {
          order: 4,
          title: "Verify Connection",
          description:
            "After authorization, verify that the account shows as connected and syncing.",
        },
      ],
      estimatedTime: "2-5 minutes",
      requiresAction: true,
      autoRecoverable: false,
    },
    {
      platform: null,
      issueType: "TOKEN_EXPIRING_SOON",
      severity: "WARNING",
      title: "Token Expiring Soon",
      description:
        "Your account authorization will expire soon. Reconnect now to avoid interruption.",
      steps: [
        {
          order: 1,
          title: "Go to Account Settings",
          description:
            "Navigate to your workspace settings and find the connected accounts section.",
          actionUrl: "/settings/accounts",
        },
        {
          order: 2,
          title: "Refresh Connection",
          description: "Click the Refresh button on the affected account to extend authorization.",
        },
      ],
      estimatedTime: "1-2 minutes",
      requiresAction: true,
      autoRecoverable: true,
    },
    {
      platform: null,
      issueType: "RATE_LIMITED",
      severity: "WARNING",
      title: "API Rate Limit Exceeded",
      description:
        "You've hit the platform's API rate limit. Activity will resume automatically when the limit resets.",
      steps: [
        {
          order: 1,
          title: "Wait for Reset",
          description: "Rate limits typically reset within 15-60 minutes. No action needed.",
        },
        {
          order: 2,
          title: "Reduce Activity",
          description: "Consider reducing posting frequency or spreading out scheduled posts.",
        },
        {
          order: 3,
          title: "Review Usage",
          description: "Check your usage patterns in the dashboard to optimize API consumption.",
          actionUrl: "/dashboard/usage",
        },
      ],
      estimatedTime: "15-60 minutes (automatic)",
      requiresAction: false,
      autoRecoverable: true,
    },
    {
      platform: null,
      issueType: "API_ERROR",
      severity: "ERROR",
      title: "API Error Detected",
      description:
        "An error occurred while communicating with the platform. This may be temporary.",
      steps: [
        {
          order: 1,
          title: "Wait and Retry",
          description: "Wait a few minutes and try your action again.",
        },
        {
          order: 2,
          title: "Check Account Status",
          description: "Verify your account is still active on the platform.",
        },
        {
          order: 3,
          title: "Reconnect if Needed",
          description: "If errors persist, try reconnecting your account.",
          actionUrl: "/settings/accounts",
        },
      ],
      estimatedTime: "5-15 minutes",
      requiresAction: false,
      autoRecoverable: true,
    },
    {
      platform: null,
      issueType: "PERMISSION_DENIED",
      severity: "ERROR",
      title: "Permission Denied",
      description:
        "The app no longer has the required permissions. Please reauthorize with full permissions.",
      steps: [
        {
          order: 1,
          title: "Disconnect Account",
          description: "Go to settings and disconnect the affected account.",
          actionUrl: "/settings/accounts",
        },
        {
          order: 2,
          title: "Check Platform Settings",
          description:
            "Visit the platform's app settings and ensure our app has the required permissions.",
        },
        {
          order: 3,
          title: "Reconnect Account",
          description: "Reconnect your account and make sure to grant all requested permissions.",
        },
      ],
      estimatedTime: "5-10 minutes",
      requiresAction: true,
      autoRecoverable: false,
    },
    {
      platform: null,
      issueType: "ACCOUNT_RESTRICTED",
      severity: "CRITICAL",
      title: "Account Restricted",
      description:
        "The platform has placed restrictions on this account. This requires action on the platform.",
      steps: [
        {
          order: 1,
          title: "Check Platform Notifications",
          description:
            "Log in to the platform directly and check for any notifications or warnings.",
        },
        {
          order: 2,
          title: "Review Terms of Service",
          description:
            "Review the platform's terms to understand what may have caused the restriction.",
        },
        {
          order: 3,
          title: "Submit Appeal if Needed",
          description:
            "If the restriction seems incorrect, submit an appeal through the platform's support.",
        },
        {
          order: 4,
          title: "Contact Support",
          description: "If you need help, contact our support team for guidance.",
          actionUrl: "/support",
        },
      ],
      estimatedTime: "Varies (may take days)",
      requiresAction: true,
      autoRecoverable: false,
    },
    {
      platform: null,
      issueType: "ACCOUNT_SUSPENDED",
      severity: "CRITICAL",
      title: "Account Suspended",
      description:
        "This social media account has been suspended by the platform. Immediate action is required.",
      steps: [
        {
          order: 1,
          title: "Check Platform Email",
          description: "Look for emails from the platform explaining the suspension reason.",
        },
        {
          order: 2,
          title: "Appeal the Suspension",
          description: "Submit an appeal through the platform's official appeal process.",
        },
        {
          order: 3,
          title: "Disconnect from Orbit",
          description: "Remove the suspended account from Orbit to prevent errors.",
          actionUrl: "/settings/accounts",
        },
        {
          order: 4,
          title: "Contact Support",
          description: "If you need assistance, reach out to our support team.",
          actionUrl: "/support",
        },
      ],
      estimatedTime: "Varies (may take weeks)",
      requiresAction: true,
      autoRecoverable: false,
    },
    {
      platform: null,
      issueType: "SYNC_FAILED",
      severity: "WARNING",
      title: "Sync Failed",
      description: "Unable to sync data from this account. This may be a temporary issue.",
      steps: [
        {
          order: 1,
          title: "Wait for Retry",
          description: "The system will automatically retry syncing.",
        },
        {
          order: 2,
          title: "Force Manual Sync",
          description: "Click the Sync Now button to trigger a manual sync.",
        },
        {
          order: 3,
          title: "Check Connection",
          description: "If syncs continue to fail, try reconnecting the account.",
          actionUrl: "/settings/accounts",
        },
      ],
      estimatedTime: "5-15 minutes",
      requiresAction: false,
      autoRecoverable: true,
    },
    {
      platform: null,
      issueType: "CONNECTION_LOST",
      severity: "ERROR",
      title: "Connection Lost",
      description:
        "Cannot establish a connection to the platform. This may be a network or platform issue.",
      steps: [
        {
          order: 1,
          title: "Check Platform Status",
          description: "Verify the platform is not experiencing an outage.",
        },
        {
          order: 2,
          title: "Wait and Retry",
          description: "Wait a few minutes and try again.",
        },
        {
          order: 3,
          title: "Reconnect Account",
          description: "If the issue persists, try reconnecting your account.",
          actionUrl: "/settings/accounts",
        },
      ],
      estimatedTime: "Varies",
      requiresAction: false,
      autoRecoverable: true,
    },
    {
      platform: null,
      issueType: "QUOTA_EXCEEDED",
      severity: "ERROR",
      title: "API Quota Exceeded",
      description:
        "The daily/monthly API quota has been exceeded. Service will resume when the quota resets.",
      steps: [
        {
          order: 1,
          title: "Wait for Reset",
          description: "Quotas typically reset daily or monthly. No immediate action needed.",
        },
        {
          order: 2,
          title: "Review Usage",
          description: "Check your API usage to understand consumption patterns.",
          actionUrl: "/dashboard/usage",
        },
        {
          order: 3,
          title: "Consider Upgrade",
          description: "If you regularly hit quotas, consider upgrading your plan.",
          actionUrl: "/pricing",
        },
      ],
      estimatedTime: "Until quota reset (daily/monthly)",
      requiresAction: false,
      autoRecoverable: true,
    },
  ];

  for (const guidance of defaultGuidance) {
    await upsertRecoveryGuidance(guidance);
  }
}

/**
 * Mark an account issue as resolved
 */
export async function markIssueResolved(
  eventId: string,
  resolvedById: string,
  notes?: string,
): Promise<void> {
  await prisma.accountHealthEvent.update({
    where: { id: eventId },
    data: {
      resolvedAt: new Date(),
      resolvedById,
      ...(notes !== undefined ? { resolutionNotes: notes } : {}),
    },
  });
}

/**
 * Get unresolved issues for an account
 */
export async function getUnresolvedIssues(
  accountId: string,
): Promise<
  Array<{
    id: string;
    eventType: string;
    severity: IssueSeverity;
    message: string;
    createdAt: Date;
  }>
> {
  const events = await prisma.accountHealthEvent.findMany({
    where: {
      accountId,
      resolvedAt: null,
      eventType: {
        in: [
          "ERROR_OCCURRED",
          "TOKEN_EXPIRED",
          "RATE_LIMIT_HIT",
          "STATUS_CHANGED",
        ],
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return events.map(e => ({
    id: e.id,
    eventType: e.eventType,
    severity: e.severity,
    message: e.message,
    createdAt: e.createdAt,
  }));
}
