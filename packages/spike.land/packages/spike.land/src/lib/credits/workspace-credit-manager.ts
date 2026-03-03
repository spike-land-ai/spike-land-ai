/**
 * Workspace Credit Manager
 *
 * User-facing service for managing Orbit AI credits.
 * Handles workspace resolution and credit operations.
 */

import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import {
  type AiCreditSource,
  WorkspaceSubscriptionService,
} from "@/lib/subscription/workspace-subscription";
import { tryCatch } from "@/lib/try-catch";
import { ensurePersonalWorkspace } from "@/lib/workspace/ensure-personal-workspace";
import type { WorkspaceSubscriptionTier } from "@/generated/prisma";

export interface CreditBalance {
  remaining: number;
  limit: number;
  used: number;
  tier: WorkspaceSubscriptionTier;
  workspaceId: string;
}

export class WorkspaceCreditManager {
  /**
   * Resolve the active workspace for a user to charge credits against.
   * Priority:
   * 1. Personal workspace (isPersonal: true)
   * 2. First available workspace owned/member
   * 3. Create personal workspace if none exists
   */
  static async resolveWorkspaceForUser(userId: string): Promise<string | null> {
    // Guard: unauthenticated or anonymous users cannot have workspaces
    if (!userId || userId === "anonymous" || userId.startsWith("guest_")) {
      return null;
    }

    // 1. Try to find a personal workspace
    const personalWorkspace = await prisma.workspace.findFirst({
      where: {
        isPersonal: true,
        members: {
          some: { userId },
        },
        deletedAt: null,
      },
      select: { id: true },
    });

    if (personalWorkspace) {
      return personalWorkspace.id;
    }

    // 2. Fallback to any active workspace membership
    const membership = await prisma.workspaceMember.findFirst({
      where: {
        userId,
        workspace: {
          deletedAt: null,
        },
      },
      select: { workspaceId: true },
      orderBy: { createdAt: "asc" }, // consistent fallback
    });

    if (membership) {
      return membership.workspaceId;
    }

    // 3. Auto-create personal workspace if absolutely nothing found
    // This is a safety net; normally users should have a workspace on signup.
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { name: true },
    });

    if (!user) {
      logger.debug(
        `Cannot auto-create workspace: user record missing for userId=${userId}. `
          + "User needs to sign in again to trigger user record creation.",
      );
      return null;
    }

    const { data: workspaceId, error } = await tryCatch(
      ensurePersonalWorkspace(userId, user.name),
    );

    if (error || !workspaceId) {
      logger.warn("Failed to auto-create personal workspace", { error });
      return null;
    }

    return workspaceId;
  }

  /**
   * Get the current credit balance for a user
   */
  static async getBalance(userId: string): Promise<CreditBalance | null> {
    const workspaceId = await this.resolveWorkspaceForUser(userId);
    if (!workspaceId) return null;

    const workspace = await prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: {
        monthlyAiCredits: true,
        usedAiCredits: true,
        subscriptionTier: true,
      },
    });

    if (!workspace) return null;

    const { monthlyAiCredits, usedAiCredits, subscriptionTier } = workspace;

    // Handle unlimited (-1) logic if applicable, though standard tiers usually have fixed limits
    // leveraging existing pattern.
    const limit = monthlyAiCredits;
    const remaining = Math.max(0, limit - usedAiCredits);

    return {
      remaining,
      limit,
      used: usedAiCredits,
      tier: subscriptionTier,
      workspaceId,
    };
  }

  /**
   * Check if user has enough credits for an operation
   */
  static async hasEnoughCredits(
    userId: string,
    amount: number,
  ): Promise<boolean> {
    const workspaceId = await this.resolveWorkspaceForUser(userId);
    if (!workspaceId) return false;

    const check = await WorkspaceSubscriptionService.canUseAiCredits(
      workspaceId,
      amount,
    );
    return check.allowed;
  }

  /**
   * Consume credits for a user.
   *
   * Source metadata (model, provider, feature) is forwarded to
   * WorkspaceSubscriptionService.consumeAiCredits for audit trail logging.
   * The legacy `source` string is mapped to `feature` when no explicit
   * `feature` value is provided.
   *
   * @param userId    - Authenticated user ID
   * @param amount    - Number of credits to consume
   * @param source    - Optional string label for the call-site (e.g. "orbit-enhance")
   * @param sourceId  - Optional reference ID (e.g. post ID) for the call-site
   * @param model     - Optional AI model name for audit trail (e.g. "claude-sonnet-4-6")
   * @param provider  - Optional AI provider for audit trail (e.g. "anthropic")
   * @param feature   - Optional product feature label for audit trail
   */
  static async consumeCredits({
    userId,
    amount,
    source,
    sourceId,
    model,
    provider,
    feature,
  }: {
    userId: string;
    amount: number;
    source?: string;
    sourceId?: string;
    model?: string;
    provider?: string;
    feature?: string;
  }): Promise<{ success: boolean; remaining: number; error?: string; }> {
    const workspaceId = await this.resolveWorkspaceForUser(userId);
    if (!workspaceId) {
      return {
        success: false,
        remaining: 0,
        error: "No active workspace found for billing",
      };
    }

    const creditSource: AiCreditSource = {
      model,
      provider,
      // Prefer the explicit feature label; fall back to the legacy source string.
      feature: feature ?? source,
    };

    const result = await WorkspaceSubscriptionService.consumeAiCredits(
      workspaceId,
      amount,
      creditSource,
    );

    // Persist audit trail for successful credit consumption
    if (result.success) {
      const { error: auditError } = await tryCatch(
        prisma.workspaceAuditLog.create({
          data: {
            workspaceId,
            userId,
            action: "AI_GENERATION_REQUEST",
            resourceType: "ai_credits",
            metadata: {
              amount,
              remaining: result.remaining,
              model: model ?? null,
              provider: provider ?? null,
              feature: creditSource.feature ?? null,
              sourceId: sourceId ?? null,
            },
          },
        }),
      );

      if (auditError) {
        // Audit failure is non-blocking — credits were already consumed
        logger.warn("Failed to persist AI credit audit log", {
          workspaceId,
          userId,
          error: auditError,
        });
      }
    }

    return result;
  }

  /**
   * Refund credits to a user (e.g., failed job)
   * Decrements usedAiCredits, clamping at 0.
   */
  static async refundCredits(userId: string, amount: number): Promise<boolean> {
    if (amount <= 0) return true;

    const workspaceId = await this.resolveWorkspaceForUser(userId);
    if (!workspaceId) return false;

    // Use raw query to ensure we don't go below 0
    const { error } = await tryCatch(
      prisma.$executeRaw`
                UPDATE workspaces
                SET "usedAiCredits" = GREATEST(0, "usedAiCredits" - ${amount})
                WHERE id = ${workspaceId}
            `,
    );

    if (error) {
      logger.error("Failed to refund credits", error);
      return false;
    }

    return true;
  }
}
