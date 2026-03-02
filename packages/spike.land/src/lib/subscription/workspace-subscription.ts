/**
 * Workspace Subscription Service
 *
 * Provides limit checking and enforcement for workspace-level subscriptions.
 * Used by Orbit app for social media management limits.
 *
 * @module subscription/workspace-subscription
 */

import type { WorkspaceSubscriptionTier } from "@/generated/prisma";
import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";

import { getTierLimits, isUnlimited } from "./tier-config";

/**
 * Optional source metadata for AI credit consumption.
 * Used for audit trail and cost attribution.
 */
export interface AiCreditSource {
  /** The AI model that was used (e.g. "claude-sonnet-4-6") */
  model?: string;
  /** The AI provider (e.g. "anthropic", "openai") */
  provider?: string;
  /** The product feature that triggered the consumption (e.g. "orbit-post-enhance") */
  feature?: string;
}

/**
 * Result of a limit check operation
 */
export interface LimitCheckResult {
  /** Whether the action is allowed */
  allowed: boolean;
  /** Current count of the resource */
  currentCount: number;
  /** Maximum allowed (or -1 for unlimited) */
  limit: number;
  /** Whether an upgrade is required to proceed */
  upgradeRequired: boolean;
  /** Human-readable message */
  message: string;
}

/**
 * Result of a workspace fetch with subscription data
 */
interface WorkspaceWithSubscription {
  id: string;
  subscriptionTier: WorkspaceSubscriptionTier;
  maxSocialAccounts: number;
  maxScheduledPosts: number;
  maxAbTests: number;
  monthlyAiCredits: number;
  usedAiCredits: number;
  maxTeamMembers: number;
  billingCycleStart: Date | null;
  _count: {
    socialAccounts: number;
    scheduledPosts: number;
    members: number;
  };
}

/**
 * Workspace Subscription Service
 *
 * Provides methods for checking and enforcing workspace-level limits
 */
export class WorkspaceSubscriptionService {
  /**
   * Check if a workspace can add another social account
   */
  static async canAddSocialAccount(workspaceId: string): Promise<LimitCheckResult> {
    const workspace = await this.getWorkspaceWithCounts(workspaceId);
    if (!workspace) {
      return this.workspaceNotFoundResult();
    }

    const limit = workspace.maxSocialAccounts;
    const currentCount = workspace._count.socialAccounts;

    if (isUnlimited(limit)) {
      return this.unlimitedResult(currentCount);
    }

    const allowed = currentCount < limit;
    return {
      allowed,
      currentCount,
      limit,
      upgradeRequired: !allowed,
      message: allowed
        ? `You can add ${limit - currentCount} more social account(s)`
        : `Social account limit reached (${limit}). Upgrade to add more.`,
    };
  }

  /**
   * Check if a workspace can create another scheduled post
   */
  static async canCreateScheduledPost(workspaceId: string): Promise<LimitCheckResult> {
    const workspace = await this.getWorkspaceWithCounts(workspaceId);
    if (!workspace) {
      return this.workspaceNotFoundResult();
    }

    const limit = workspace.maxScheduledPosts;
    const currentCount = workspace._count.scheduledPosts;

    if (isUnlimited(limit)) {
      return this.unlimitedResult(currentCount);
    }

    const allowed = currentCount < limit;
    return {
      allowed,
      currentCount,
      limit,
      upgradeRequired: !allowed,
      message: allowed
        ? `You can schedule ${limit - currentCount} more post(s) this month`
        : `Scheduled posts limit reached (${limit}). Upgrade for unlimited scheduling.`,
    };
  }

  /**
   * Check if a workspace can create another A/B test
   * Note: A/B testing feature is Phase 4, but limits are pre-configured
   */
  static async canCreateAbTest(workspaceId: string): Promise<LimitCheckResult> {
    const workspace = await this.getWorkspaceWithLimits(workspaceId);
    if (!workspace) {
      return this.workspaceNotFoundResult();
    }

    // A/B tests not yet implemented - return 0 count for now
    const limit = workspace.maxAbTests;
    const currentCount = 0;

    if (isUnlimited(limit)) {
      return this.unlimitedResult(currentCount);
    }

    const allowed = currentCount < limit;
    return {
      allowed,
      currentCount,
      limit,
      upgradeRequired: !allowed,
      message: allowed
        ? `You can create ${limit - currentCount} more A/B test(s)`
        : `A/B test limit reached (${limit}). Upgrade for more tests.`,
    };
  }

  /**
   * Check if a workspace can use AI credits
   */
  static async canUseAiCredits(workspaceId: string, amount: number): Promise<LimitCheckResult> {
    if (amount <= 0) {
      return {
        allowed: true,
        currentCount: 0,
        limit: 0,
        upgradeRequired: false,
        message: "No credits required",
      };
    }

    const workspace = await this.getWorkspaceWithLimits(workspaceId);
    if (!workspace) {
      return this.workspaceNotFoundResult();
    }

    const limit = workspace.monthlyAiCredits;
    const used = workspace.usedAiCredits;
    const remaining = limit - used;

    if (isUnlimited(limit)) {
      return this.unlimitedResult(used);
    }

    const allowed = remaining >= amount;
    return {
      allowed,
      currentCount: used,
      limit,
      upgradeRequired: !allowed,
      message: allowed
        ? `${remaining} AI credits remaining this month`
        : `Insufficient AI credits. Need ${amount}, have ${remaining}. Upgrade for more.`,
    };
  }

  /**
   * Check if a workspace can add another team member
   */
  static async canAddTeamMember(workspaceId: string): Promise<LimitCheckResult> {
    const workspace = await this.getWorkspaceWithCounts(workspaceId);
    if (!workspace) {
      return this.workspaceNotFoundResult();
    }

    const limit = workspace.maxTeamMembers;
    const currentCount = workspace._count.members;

    if (isUnlimited(limit)) {
      return this.unlimitedResult(currentCount);
    }

    const allowed = currentCount < limit;
    return {
      allowed,
      currentCount,
      limit,
      upgradeRequired: !allowed,
      message: allowed
        ? `You can add ${limit - currentCount} more team member(s)`
        : `Team member limit reached (${limit}). Upgrade for more seats.`,
    };
  }

  /**
   * Consume AI credits for a workspace
   * Returns success/failure and remaining credits.
   *
   * @param workspaceId - The workspace to charge
   * @param amount      - Number of credits to consume
   * @param source      - Optional metadata for audit trail (model, provider, feature)
   */
  static async consumeAiCredits(
    workspaceId: string,
    amount: number,
    source?: AiCreditSource,
  ): Promise<{ success: boolean; remaining: number; error?: string }> {
    if (amount <= 0) {
      return { success: true, remaining: 0 };
    }

    const check = await this.canUseAiCredits(workspaceId, amount);
    if (!check.allowed) {
      logger.warn("AI credit consumption denied", {
        workspaceId,
        amount,
        model: source?.model,
        provider: source?.provider,
        feature: source?.feature,
        reason: check.message,
      });
      return {
        success: false,
        remaining: check.limit - check.currentCount,
        error: check.message,
      };
    }

    const { data: workspace, error } = await tryCatch(
      prisma.workspace.update({
        where: { id: workspaceId },
        data: { usedAiCredits: { increment: amount } },
        select: { monthlyAiCredits: true, usedAiCredits: true },
      }),
    );

    if (error || !workspace) {
      logger.error("Failed to consume AI credits", error, {
        workspaceId,
        amount,
        model: source?.model,
        provider: source?.provider,
        feature: source?.feature,
      });
      return {
        success: false,
        remaining: 0,
        error: "Failed to consume AI credits",
      };
    }

    const remaining = workspace.monthlyAiCredits - workspace.usedAiCredits;

    logger.info("AI credits consumed", {
      workspaceId,
      amount,
      remaining,
      model: source?.model,
      provider: source?.provider,
      feature: source?.feature,
    });

    return { success: true, remaining };
  }

  /**
   * Reset monthly AI credits for a workspace
   * Called by the monthly cron job on billing cycle anniversary
   */
  static async resetMonthlyCredits(
    workspaceId: string,
  ): Promise<{ success: boolean; error?: string }> {
    const { error } = await tryCatch(
      prisma.workspace.update({
        where: { id: workspaceId },
        data: { usedAiCredits: 0 },
      }),
    );

    if (error) {
      return { success: false, error: "Failed to reset AI credits" };
    }

    return { success: true };
  }

  /**
   * Upgrade a workspace to a new subscription tier
   * Updates limits based on the new tier configuration
   */
  static async upgradeTier(
    workspaceId: string,
    newTier: WorkspaceSubscriptionTier,
  ): Promise<{ success: boolean; error?: string }> {
    const limits = getTierLimits(newTier);

    const { error } = await tryCatch(
      prisma.workspace.update({
        where: { id: workspaceId },
        data: {
          subscriptionTier: newTier,
          maxSocialAccounts: limits.maxSocialAccounts,
          maxScheduledPosts: limits.maxScheduledPosts,
          maxAbTests: limits.maxAbTests,
          monthlyAiCredits: limits.monthlyAiCredits,
          maxTeamMembers: limits.maxTeamMembers,
          billingCycleStart: new Date(),
        },
      }),
    );

    if (error) {
      return { success: false, error: "Failed to upgrade tier" };
    }

    return { success: true };
  }

  /**
   * Get workspace subscription info for display
   */
  static async getSubscriptionInfo(workspaceId: string): Promise<{
    tier: WorkspaceSubscriptionTier;
    limits: {
      socialAccounts: { used: number; max: number };
      scheduledPosts: { used: number; max: number };
      abTests: { used: number; max: number };
      aiCredits: { used: number; max: number };
      teamMembers: { used: number; max: number };
    };
  } | null> {
    const workspace = await this.getWorkspaceWithCounts(workspaceId);
    if (!workspace) {
      return null;
    }

    return {
      tier: workspace.subscriptionTier,
      limits: {
        socialAccounts: {
          used: workspace._count.socialAccounts,
          max: workspace.maxSocialAccounts,
        },
        scheduledPosts: {
          used: workspace._count.scheduledPosts,
          max: workspace.maxScheduledPosts,
        },
        abTests: {
          used: 0, // Not implemented yet
          max: workspace.maxAbTests,
        },
        aiCredits: {
          used: workspace.usedAiCredits,
          max: workspace.monthlyAiCredits,
        },
        teamMembers: {
          used: workspace._count.members,
          max: workspace.maxTeamMembers,
        },
      },
    };
  }

  /**
   * Find workspaces with billing cycle anniversary today
   * Used by the monthly credit reset cron job
   */
  static async findWorkspacesForCreditReset(): Promise<string[]> {
    const today = new Date();
    const dayOfMonth = today.getUTCDate();

    // Find workspaces where billingCycleStart day matches today
    const { data: workspaces, error } = await tryCatch(
      prisma.$queryRaw<{ id: string }[]>`
        SELECT id FROM workspaces 
        WHERE "billingCycleStart" IS NOT NULL 
        AND EXTRACT(DAY FROM "billingCycleStart") = ${dayOfMonth}
        AND "subscriptionTier" != 'FREE'
      `,
    );

    if (error || !workspaces) {
      return [];
    }

    return workspaces.map((w) => w.id);
  }

  // Private helper methods

  private static async getWorkspaceWithCounts(
    workspaceId: string,
  ): Promise<WorkspaceWithSubscription | null> {
    const { data: workspace, error } = await tryCatch(
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          id: true,
          subscriptionTier: true,
          maxSocialAccounts: true,
          maxScheduledPosts: true,
          maxAbTests: true,
          monthlyAiCredits: true,
          usedAiCredits: true,
          maxTeamMembers: true,
          billingCycleStart: true,
          _count: {
            select: {
              socialAccounts: true,
              scheduledPosts: true,
              members: true,
            },
          },
        },
      }),
    );

    if (error || !workspace) {
      return null;
    }

    return workspace;
  }

  private static async getWorkspaceWithLimits(workspaceId: string): Promise<{
    subscriptionTier: WorkspaceSubscriptionTier;
    maxAbTests: number;
    monthlyAiCredits: number;
    usedAiCredits: number;
  } | null> {
    const { data: workspace, error } = await tryCatch(
      prisma.workspace.findUnique({
        where: { id: workspaceId },
        select: {
          subscriptionTier: true,
          maxAbTests: true,
          monthlyAiCredits: true,
          usedAiCredits: true,
        },
      }),
    );

    if (error || !workspace) {
      return null;
    }

    return workspace;
  }

  private static workspaceNotFoundResult(): LimitCheckResult {
    return {
      allowed: false,
      currentCount: 0,
      limit: 0,
      upgradeRequired: false,
      message: "Workspace not found",
    };
  }

  private static unlimitedResult(currentCount: number): LimitCheckResult {
    return {
      allowed: true,
      currentCount,
      limit: -1,
      upgradeRequired: false,
      message: "Unlimited",
    };
  }
}

// Re-export tier utilities for convenience
export {
  getNextTier,
  getTierLimits,
  isDowngrade,
  isUnlimited,
  isUpgrade,
  WORKSPACE_TIER_DISPLAY_NAMES,
  WORKSPACE_TIER_LIMITS,
  WORKSPACE_TIER_ORDER,
} from "./tier-config";
