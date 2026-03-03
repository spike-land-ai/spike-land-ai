/**
 * Tests for WorkspaceSubscriptionService
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    workspace: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $queryRaw: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
const { mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

import {
  type AiCreditSource,
  WorkspaceSubscriptionService,
} from "./workspace-subscription";

const WORKSPACE_ID = "ws-test-123";

function makeWorkspaceWithCounts(overrides: {
  subscriptionTier?: "FREE" | "PRO" | "BUSINESS";
  maxSocialAccounts?: number;
  maxScheduledPosts?: number;
  maxAbTests?: number;
  monthlyAiCredits?: number;
  usedAiCredits?: number;
  maxTeamMembers?: number;
  socialAccounts?: number;
  scheduledPosts?: number;
  members?: number;
} = {}) {
  return {
    id: WORKSPACE_ID,
    subscriptionTier: overrides.subscriptionTier ?? "FREE",
    maxSocialAccounts: overrides.maxSocialAccounts ?? 5,
    maxScheduledPosts: overrides.maxScheduledPosts ?? 100,
    maxAbTests: overrides.maxAbTests ?? 3,
    monthlyAiCredits: overrides.monthlyAiCredits ?? 500,
    usedAiCredits: overrides.usedAiCredits ?? 0,
    maxTeamMembers: overrides.maxTeamMembers ?? 1,
    billingCycleStart: null,
    _count: {
      socialAccounts: overrides.socialAccounts ?? 0,
      scheduledPosts: overrides.scheduledPosts ?? 0,
      members: overrides.members ?? 1,
    },
  };
}

describe("WorkspaceSubscriptionService.canAddSocialAccount", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns allowed when below limit", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ maxSocialAccounts: 5, socialAccounts: 3 }),
    );
    const result = await WorkspaceSubscriptionService.canAddSocialAccount(WORKSPACE_ID);
    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(3);
    expect(result.limit).toBe(5);
    expect(result.upgradeRequired).toBe(false);
    expect(result.message).toContain("2 more social account");
  });

  it("returns denied when at limit", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ maxSocialAccounts: 5, socialAccounts: 5 }),
    );
    const result = await WorkspaceSubscriptionService.canAddSocialAccount(WORKSPACE_ID);
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
    expect(result.message).toContain("Upgrade");
  });

  it("returns unlimited when limit is -1", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ maxSocialAccounts: -1, socialAccounts: 99 }),
    );
    const result = await WorkspaceSubscriptionService.canAddSocialAccount(WORKSPACE_ID);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
    expect(result.message).toBe("Unlimited");
  });

  it("returns workspace-not-found result when workspace is missing", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(null);
    const result = await WorkspaceSubscriptionService.canAddSocialAccount(WORKSPACE_ID);
    expect(result.allowed).toBe(false);
    expect(result.message).toBe("Workspace not found");
  });

  it("returns workspace-not-found result when findUnique throws", async () => {
    mockPrisma.workspace.findUnique.mockRejectedValue(new Error("DB error"));
    const result = await WorkspaceSubscriptionService.canAddSocialAccount(WORKSPACE_ID);
    expect(result.allowed).toBe(false);
    expect(result.message).toBe("Workspace not found");
  });
});

describe("WorkspaceSubscriptionService.canCreateScheduledPost", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns allowed when below limit", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ maxScheduledPosts: 100, scheduledPosts: 50 }),
    );
    const result = await WorkspaceSubscriptionService.canCreateScheduledPost(WORKSPACE_ID);
    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(50);
    expect(result.limit).toBe(100);
    expect(result.message).toContain("50 more post");
  });

  it("returns denied when at limit", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ maxScheduledPosts: 100, scheduledPosts: 100 }),
    );
    const result = await WorkspaceSubscriptionService.canCreateScheduledPost(WORKSPACE_ID);
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
  });

  it("returns unlimited for PRO tier unlimited posts", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({
        subscriptionTier: "PRO",
        maxScheduledPosts: -1,
        scheduledPosts: 999,
      }),
    );
    const result = await WorkspaceSubscriptionService.canCreateScheduledPost(WORKSPACE_ID);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });
});

describe("WorkspaceSubscriptionService.canCreateAbTest", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns allowed when limit not reached (currentCount is always 0)", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(makeWorkspaceWithCounts({ maxAbTests: 3 }));
    const result = await WorkspaceSubscriptionService.canCreateAbTest(WORKSPACE_ID);
    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(0);
    expect(result.limit).toBe(3);
  });

  it("returns unlimited for BUSINESS tier", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ subscriptionTier: "BUSINESS", maxAbTests: -1 }),
    );
    const result = await WorkspaceSubscriptionService.canCreateAbTest(WORKSPACE_ID);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });

  it("returns workspace-not-found when workspace is missing", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(null);
    const result = await WorkspaceSubscriptionService.canCreateAbTest(WORKSPACE_ID);
    expect(result.allowed).toBe(false);
    expect(result.message).toBe("Workspace not found");
  });
});

describe("WorkspaceSubscriptionService.canUseAiCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns allowed immediately for zero amount", async () => {
    const result = await WorkspaceSubscriptionService.canUseAiCredits(WORKSPACE_ID, 0);
    expect(result.allowed).toBe(true);
    expect(result.message).toBe("No credits required");
    expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled();
  });

  it("returns allowed immediately for negative amount", async () => {
    const result = await WorkspaceSubscriptionService.canUseAiCredits(WORKSPACE_ID, -5);
    expect(result.allowed).toBe(true);
    expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled();
  });

  it("returns allowed when sufficient credits remain", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 500, usedAiCredits: 100 }),
    );
    const result = await WorkspaceSubscriptionService.canUseAiCredits(WORKSPACE_ID, 50);
    expect(result.allowed).toBe(true);
    expect(result.currentCount).toBe(100);
    expect(result.limit).toBe(500);
    expect(result.message).toContain("400 AI credits remaining");
  });

  it("returns denied when insufficient credits", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 500, usedAiCredits: 490 }),
    );
    const result = await WorkspaceSubscriptionService.canUseAiCredits(WORKSPACE_ID, 20);
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
    expect(result.message).toContain("Need 20, have 10");
  });

  it("returns denied when credits exactly exhausted", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 500, usedAiCredits: 500 }),
    );
    const result = await WorkspaceSubscriptionService.canUseAiCredits(WORKSPACE_ID, 1);
    expect(result.allowed).toBe(false);
  });

  it("returns unlimited for unlimited credit limit", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: -1, usedAiCredits: 9999 }),
    );
    const result = await WorkspaceSubscriptionService.canUseAiCredits(WORKSPACE_ID, 100);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
    expect(result.message).toBe("Unlimited");
  });
});

describe("WorkspaceSubscriptionService.canAddTeamMember", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns denied when at limit", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ maxTeamMembers: 1, members: 1 }),
    );
    const result = await WorkspaceSubscriptionService.canAddTeamMember(WORKSPACE_ID);
    expect(result.allowed).toBe(false);
    expect(result.upgradeRequired).toBe(true);
  });

  it("returns allowed when below limit", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ maxTeamMembers: 3, members: 1 }),
    );
    const result = await WorkspaceSubscriptionService.canAddTeamMember(WORKSPACE_ID);
    expect(result.allowed).toBe(true);
    expect(result.message).toContain("2 more team member");
  });

  it("returns unlimited for BUSINESS tier", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ maxTeamMembers: -1, members: 50 }),
    );
    const result = await WorkspaceSubscriptionService.canAddTeamMember(WORKSPACE_ID);
    expect(result.allowed).toBe(true);
    expect(result.limit).toBe(-1);
  });
});

describe("WorkspaceSubscriptionService.consumeAiCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns success immediately for zero amount without hitting DB", async () => {
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 0);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(0);
    expect(mockPrisma.workspace.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.workspace.update).not.toHaveBeenCalled();
  });

  it("returns success and decrements credits when check passes", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 500, usedAiCredits: 100 }),
    );
    mockPrisma.workspace.update.mockResolvedValue({ monthlyAiCredits: 500, usedAiCredits: 110 });

    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 10);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(390);
    expect(mockPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: WORKSPACE_ID },
        data: { usedAiCredits: { increment: 10 } },
      }),
    );
  });

  it("passes source metadata without affecting credit logic", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 500, usedAiCredits: 0 }),
    );
    mockPrisma.workspace.update.mockResolvedValue({ monthlyAiCredits: 500, usedAiCredits: 5 });

    const source: AiCreditSource = {
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      feature: "orbit-post-enhance",
    };
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 5, source);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(495);
  });

  it("returns failure when insufficient credits and logs source info", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 10, usedAiCredits: 8 }),
    );
    const source: AiCreditSource = {
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      feature: "orbit-post-enhance",
    };

    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 5, source);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient");
    expect(mockPrisma.workspace.update).not.toHaveBeenCalled();
  });

  it("returns failure when credits are exhausted", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 100, usedAiCredits: 100 }),
    );
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 1, {
      model: "gpt-4o",
      provider: "openai",
      feature: "content-gen",
    });
    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
  });

  it("returns failure when DB update throws", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 500, usedAiCredits: 0 }),
    );
    mockPrisma.workspace.update.mockRejectedValue(new Error("DB connection lost"));

    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 10);

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.error).toContain("Failed to consume AI credits");
  });

  it("returns failure when workspace not found during credit check", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(null);
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 10);
    expect(result.success).toBe(false);
    expect(result.error).toBeDefined();
    expect(mockPrisma.workspace.update).not.toHaveBeenCalled();
  });

  it("works without source parameter (backward compatibility)", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 200, usedAiCredits: 50 }),
    );
    mockPrisma.workspace.update.mockResolvedValue({ monthlyAiCredits: 200, usedAiCredits: 60 });
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 10);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(140);
  });

  it("returns remaining based on post-update values", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 1000, usedAiCredits: 990 }),
    );
    mockPrisma.workspace.update.mockResolvedValue({ monthlyAiCredits: 1000, usedAiCredits: 995 });
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 5);
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(5);
  });
});

describe("WorkspaceSubscriptionService.consumeAiCredits — source metadata flow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("logs all three source fields on successful consumption", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 500, usedAiCredits: 0 }),
    );
    mockPrisma.workspace.update.mockResolvedValue({ monthlyAiCredits: 500, usedAiCredits: 10 });

    const source: AiCreditSource = {
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      feature: "orbit-post-enhance",
    };
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 10, source);

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(490);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "AI credits consumed",
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        amount: 10,
        remaining: 490,
        model: "claude-sonnet-4-6",
        provider: "anthropic",
        feature: "orbit-post-enhance",
      }),
    );
  });

  it("logs only model field when provider and feature are omitted", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 500, usedAiCredits: 0 }),
    );
    mockPrisma.workspace.update.mockResolvedValue({ monthlyAiCredits: 500, usedAiCredits: 3 });

    const source: AiCreditSource = { model: "gpt-4o" };
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 3, source);

    expect(result.success).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "AI credits consumed",
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        amount: 3,
        model: "gpt-4o",
        provider: undefined,
        feature: undefined,
      }),
    );
  });

  it("logs undefined source fields when source is omitted entirely", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 200, usedAiCredits: 50 }),
    );
    mockPrisma.workspace.update.mockResolvedValue({ monthlyAiCredits: 200, usedAiCredits: 60 });

    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 10);

    expect(result.success).toBe(true);
    expect(mockLogger.info).toHaveBeenCalledWith(
      "AI credits consumed",
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        amount: 10,
        model: undefined,
        provider: undefined,
        feature: undefined,
      }),
    );
  });

  it("logs source fields on denial when credits are insufficient", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 10, usedAiCredits: 8 }),
    );

    const source: AiCreditSource = {
      model: "claude-opus-4-6",
      provider: "anthropic",
      feature: "content-gen",
    };
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 5, source);

    expect(result.success).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "AI credit consumption denied",
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        amount: 5,
        model: "claude-opus-4-6",
        provider: "anthropic",
        feature: "content-gen",
      }),
    );
    expect(mockPrisma.workspace.update).not.toHaveBeenCalled();
  });

  it("logs source fields on DB error during update", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 500, usedAiCredits: 0 }),
    );
    mockPrisma.workspace.update.mockRejectedValue(new Error("DB connection lost"));

    const source: AiCreditSource = {
      model: "gemini-pro",
      provider: "google",
      feature: "orbit-analytics",
    };
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 10, source);

    expect(result.success).toBe(false);
    expect(result.error).toContain("Failed to consume AI credits");
    expect(mockLogger.error).toHaveBeenCalledWith(
      "Failed to consume AI credits",
      expect.any(Error),
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        amount: 10,
        model: "gemini-pro",
        provider: "google",
        feature: "orbit-analytics",
      }),
    );
  });

  it("does not log source fields for zero-amount fast path", async () => {
    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 0, {
      model: "should-not-be-logged",
      provider: "test",
      feature: "noop",
    });

    expect(result.success).toBe(true);
    expect(mockLogger.info).not.toHaveBeenCalled();
    expect(mockLogger.warn).not.toHaveBeenCalled();
    expect(mockLogger.error).not.toHaveBeenCalled();
  });

  it("logs denial with undefined source fields when source is omitted and credits insufficient", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({ monthlyAiCredits: 5, usedAiCredits: 5 }),
    );

    const result = await WorkspaceSubscriptionService.consumeAiCredits(WORKSPACE_ID, 1);

    expect(result.success).toBe(false);
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "AI credit consumption denied",
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        model: undefined,
        provider: undefined,
        feature: undefined,
      }),
    );
  });
});

describe("WorkspaceSubscriptionService.resetMonthlyCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("resets used credits to zero", async () => {
    mockPrisma.workspace.update.mockResolvedValue({ usedAiCredits: 0 });
    const result = await WorkspaceSubscriptionService.resetMonthlyCredits(WORKSPACE_ID);
    expect(result.success).toBe(true);
    expect(mockPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: WORKSPACE_ID }, data: { usedAiCredits: 0 } }),
    );
  });

  it("returns failure when DB update throws", async () => {
    mockPrisma.workspace.update.mockRejectedValue(new Error("DB error"));
    const result = await WorkspaceSubscriptionService.resetMonthlyCredits(WORKSPACE_ID);
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to reset AI credits");
  });
});

describe("WorkspaceSubscriptionService.upgradeTier", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("upgrades workspace to PRO tier with correct limits", async () => {
    mockPrisma.workspace.update.mockResolvedValue({ subscriptionTier: "PRO" });
    const result = await WorkspaceSubscriptionService.upgradeTier(WORKSPACE_ID, "PRO");
    expect(result.success).toBe(true);
    expect(mockPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: WORKSPACE_ID },
        data: expect.objectContaining({
          subscriptionTier: "PRO",
          maxSocialAccounts: 10,
          monthlyAiCredits: 1000,
          maxTeamMembers: 3,
        }),
      }),
    );
  });

  it("upgrades workspace to BUSINESS tier with correct limits", async () => {
    mockPrisma.workspace.update.mockResolvedValue({ subscriptionTier: "BUSINESS" });
    const result = await WorkspaceSubscriptionService.upgradeTier(WORKSPACE_ID, "BUSINESS");
    expect(result.success).toBe(true);
    expect(mockPrisma.workspace.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subscriptionTier: "BUSINESS",
          maxSocialAccounts: -1,
          maxScheduledPosts: -1,
          monthlyAiCredits: 5000,
          maxTeamMembers: 10,
        }),
      }),
    );
  });

  it("sets billingCycleStart to current date on upgrade", async () => {
    const before = new Date();
    mockPrisma.workspace.update.mockResolvedValue({ subscriptionTier: "PRO" });
    await WorkspaceSubscriptionService.upgradeTier(WORKSPACE_ID, "PRO");
    const after = new Date();
    const updateCall = mockPrisma.workspace.update.mock.calls[0]?.[0];
    const billingCycleStart = updateCall?.data?.billingCycleStart as Date;
    expect(billingCycleStart).toBeInstanceOf(Date);
    expect(billingCycleStart.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(billingCycleStart.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("returns failure when DB update throws", async () => {
    mockPrisma.workspace.update.mockRejectedValue(new Error("DB error"));
    const result = await WorkspaceSubscriptionService.upgradeTier(WORKSPACE_ID, "PRO");
    expect(result.success).toBe(false);
    expect(result.error).toBe("Failed to upgrade tier");
  });
});

describe("WorkspaceSubscriptionService.getSubscriptionInfo", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns subscription info for a valid workspace", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(
      makeWorkspaceWithCounts({
        subscriptionTier: "PRO",
        maxSocialAccounts: 10,
        maxScheduledPosts: -1,
        monthlyAiCredits: 1000,
        usedAiCredits: 250,
        maxTeamMembers: 3,
        socialAccounts: 4,
        scheduledPosts: 12,
        members: 2,
      }),
    );
    const result = await WorkspaceSubscriptionService.getSubscriptionInfo(WORKSPACE_ID);
    expect(result).not.toBeNull();
    expect(result?.tier).toBe("PRO");
    expect(result?.limits.socialAccounts).toEqual({ used: 4, max: 10 });
    expect(result?.limits.aiCredits).toEqual({ used: 250, max: 1000 });
    expect(result?.limits.teamMembers).toEqual({ used: 2, max: 3 });
    expect(result?.limits.abTests).toEqual({ used: 0, max: 3 });
  });

  it("returns null when workspace not found", async () => {
    mockPrisma.workspace.findUnique.mockResolvedValue(null);
    const result = await WorkspaceSubscriptionService.getSubscriptionInfo(WORKSPACE_ID);
    expect(result).toBeNull();
  });
});

describe("WorkspaceSubscriptionService.findWorkspacesForCreditReset", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns workspace IDs matching today's billing day", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([{ id: "ws-aaa" }, { id: "ws-bbb" }]);
    const result = await WorkspaceSubscriptionService.findWorkspacesForCreditReset();
    expect(result).toEqual(["ws-aaa", "ws-bbb"]);
  });

  it("returns empty array when no workspaces match", async () => {
    mockPrisma.$queryRaw.mockResolvedValue([]);
    const result = await WorkspaceSubscriptionService.findWorkspacesForCreditReset();
    expect(result).toEqual([]);
  });

  it("returns empty array when query throws", async () => {
    mockPrisma.$queryRaw.mockRejectedValue(new Error("DB error"));
    const result = await WorkspaceSubscriptionService.findWorkspacesForCreditReset();
    expect(result).toEqual([]);
  });
});
