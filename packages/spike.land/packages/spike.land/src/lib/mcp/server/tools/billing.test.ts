import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspaceMember: {
    findFirst: vi.fn(),
  },
  workspace: {
    findFirst: vi.fn(),
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

const mockGetBalance = vi.hoisted(() => vi.fn());

vi.mock("@/lib/credits/workspace-credit-manager", () => ({
  WorkspaceCreditManager: {
    getBalance: mockGetBalance,
  },
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBillingTools } from "./billing";

describe("billing tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBillingTools(registry, userId);
  });

  it("should register 2 billing tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
    expect(registry.handlers.has("billing_create_checkout")).toBe(true);
    expect(registry.handlers.has("billing_status")).toBe(true);
  });

  describe("billing_create_checkout", () => {
    it("should create checkout intent for tokens", async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
      const handler = registry.handlers.get("billing_create_checkout")!;
      const result = await handler({ type: "tokens", workspace_id: "ws-1" });
      expect(getText(result)).toContain("Checkout Session Intent");
      expect(getText(result)).toContain("tokens");
      expect(getText(result)).toContain("ws-1");
      expect(getText(result)).toContain("OWNER");
    });

    it("should create checkout intent for subscription", async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: "ADMIN" });
      const handler = registry.handlers.get("billing_create_checkout")!;
      const result = await handler({
        type: "subscription",
        workspace_id: "ws-2",
      });
      expect(getText(result)).toContain("Checkout Session Intent");
      expect(getText(result)).toContain("subscription");
      expect(getText(result)).toContain("ws-2");
      expect(getText(result)).toContain("ADMIN");
    });

    it("should create checkout intent for workspace_tier", async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({
        role: "MEMBER",
      });
      const handler = registry.handlers.get("billing_create_checkout")!;
      const result = await handler({
        type: "workspace_tier",
        workspace_id: "ws-3",
      });
      expect(getText(result)).toContain("Checkout Session Intent");
      expect(getText(result)).toContain("workspace_tier");
      expect(getText(result)).toContain("ws-3");
      expect(getText(result)).toContain("MEMBER");
    });

    it("should return error when not a workspace member", async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("billing_create_checkout")!;
      const result = await handler({ type: "tokens", workspace_id: "ws-nope" });
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain(
        "Workspace not found or you are not a member",
      );
    });

    it("should verify workspace membership with correct params", async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
      const handler = registry.handlers.get("billing_create_checkout")!;
      await handler({ type: "tokens", workspace_id: "ws-check" });
      expect(mockPrisma.workspaceMember.findFirst).toHaveBeenCalledWith({
        where: { userId, workspaceId: "ws-check" },
        select: { role: true },
      });
    });

    it("should include checkout instructions in result", async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
      const handler = registry.handlers.get("billing_create_checkout")!;
      const result = await handler({ type: "tokens", workspace_id: "ws-1" });
      expect(getText(result)).toContain("billing page");
      expect(getText(result)).toContain("POST /api/stripe/checkout");
    });

    it("should include price_id when provided", async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
      const handler = registry.handlers.get("billing_create_checkout")!;
      const result = await handler({
        type: "subscription",
        workspace_id: "ws-1",
        price_id: "price_abc123",
      });
      const text = getText(result);
      expect(text).toContain("**Price ID:** price_abc123");
    });

    it("should include success and cancel URLs when provided", async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
      const handler = registry.handlers.get("billing_create_checkout")!;
      const result = await handler({
        type: "subscription",
        workspace_id: "ws-1",
        price_id: "price_xyz",
        success_url: "https://spike.land/billing/success",
        cancel_url: "https://spike.land/billing/cancel",
      });
      const text = getText(result);
      expect(text).toContain("**Success URL:** https://spike.land/billing/success");
      expect(text).toContain("**Cancel URL:** https://spike.land/billing/cancel");
    });

    it("should omit optional fields when not provided", async () => {
      mockPrisma.workspaceMember.findFirst.mockResolvedValue({ role: "OWNER" });
      const handler = registry.handlers.get("billing_create_checkout")!;
      const result = await handler({ type: "tokens", workspace_id: "ws-1" });
      const text = getText(result);
      expect(text).not.toContain("**Price ID:**");
      expect(text).not.toContain("**Success URL:**");
      expect(text).not.toContain("**Cancel URL:**");
    });
  });

  describe("billing_status", () => {
    it("should return combined subscription and credit status", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-1",
        name: "My Workspace",
        subscriptionTier: "PRO",
        stripeSubscriptionId: "sub_abc123",
        monthlyAiCredits: 5000,
        usedAiCredits: 1200,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([]);
      mockGetBalance.mockResolvedValue({
        remaining: 750,
        limit: 1000,
        used: 250,
        tier: "PRO",
        workspaceId: "ws-abc",
      });
      const handler = registry.handlers.get("billing_status")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Billing Status");
      // Personal Subscription section
      expect(text).toContain("Personal Subscription");
      expect(text).toContain("My Workspace");
      expect(text).toContain("ws-1");
      expect(text).toContain("PRO");
      expect(text).toContain("Yes");
      // Credits section
      expect(text).toContain("5000");
      expect(text).toContain("1200");
      expect(text).toContain("3800");
      // Credit Manager section
      expect(text).toContain("Credit Manager");
      expect(text).toContain("750");
      expect(text).toContain("1000");
      expect(text).toContain("250");
    });

    it("should show No for active subscription when no stripeSubscriptionId", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-2",
        name: "Free Workspace",
        subscriptionTier: "FREE",
        stripeSubscriptionId: null,
        monthlyAiCredits: 100,
        usedAiCredits: 50,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([]);
      mockGetBalance.mockResolvedValue(null);
      const handler = registry.handlers.get("billing_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("**Active Stripe Subscription:** No");
      expect(getText(result)).toContain("FREE");
      expect(getText(result)).toContain("**Remaining:** 50");
    });

    it("should clamp remaining credits to 0 when overused", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-3",
        name: "Overused Workspace",
        subscriptionTier: "STARTER",
        stripeSubscriptionId: "sub_xyz",
        monthlyAiCredits: 200,
        usedAiCredits: 300,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([]);
      mockGetBalance.mockResolvedValue(null);
      const handler = registry.handlers.get("billing_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("**Remaining:** 0");
      expect(getText(result)).toContain("**Used:** 300");
    });

    it("should return error when no personal workspace found", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("billing_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("Error");
      expect(getText(result)).toContain("No personal workspace found");
    });

    it("should query workspace with correct filters", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-1",
        name: "Test",
        subscriptionTier: "FREE",
        stripeSubscriptionId: null,
        monthlyAiCredits: 100,
        usedAiCredits: 0,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([]);
      mockGetBalance.mockResolvedValue(null);
      const handler = registry.handlers.get("billing_status")!;
      await handler({});
      expect(mockPrisma.workspace.findFirst).toHaveBeenCalledWith({
        where: {
          isPersonal: true,
          members: { some: { userId } },
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          subscriptionTier: true,
          stripeSubscriptionId: true,
          monthlyAiCredits: true,
          usedAiCredits: true,
        },
      });
    });

    it("should call getBalance with correct userId", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-1",
        name: "Test",
        subscriptionTier: "FREE",
        stripeSubscriptionId: null,
        monthlyAiCredits: 100,
        usedAiCredits: 0,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([]);
      mockGetBalance.mockResolvedValue({
        remaining: 0,
        limit: 100,
        used: 100,
        tier: "FREE",
        workspaceId: "ws-123",
      });
      const handler = registry.handlers.get("billing_status")!;
      await handler({});
      expect(mockGetBalance).toHaveBeenCalledWith(userId);
    });

    it("should display zero remaining credits", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-1",
        name: "Test",
        subscriptionTier: "STARTER",
        stripeSubscriptionId: null,
        monthlyAiCredits: 500,
        usedAiCredits: 500,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([]);
      mockGetBalance.mockResolvedValue({
        remaining: 0,
        limit: 500,
        used: 500,
        tier: "STARTER",
        workspaceId: "ws-zero",
      });
      const handler = registry.handlers.get("billing_status")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("**Remaining:** 0");
      expect(text).toContain("**Used:** 500");
    });

    it("should work when credit manager is unavailable", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-1",
        name: "Test",
        subscriptionTier: "FREE",
        stripeSubscriptionId: null,
        monthlyAiCredits: 100,
        usedAiCredits: 50,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([]);
      mockGetBalance.mockRejectedValue(new Error("Service unavailable"));
      const handler = registry.handlers.get("billing_status")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Billing Status");
      expect(text).toContain("**Remaining:** 50");
      expect(text).not.toContain("Credit Manager");
    });

    it("should include team workspaces in billing status", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-personal",
        name: "Personal",
        subscriptionTier: "FREE",
        stripeSubscriptionId: null,
        monthlyAiCredits: 100,
        usedAiCredits: 20,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([
        {
          id: "ws-team-1",
          name: "Acme Corp",
          subscriptionTier: "PRO",
          stripeSubscriptionId: "sub_team1",
          monthlyAiCredits: 10000,
          usedAiCredits: 3500,
        },
        {
          id: "ws-team-2",
          name: "Side Project",
          subscriptionTier: "STARTER",
          stripeSubscriptionId: null,
          monthlyAiCredits: 500,
          usedAiCredits: 500,
        },
      ]);
      mockGetBalance.mockResolvedValue(null);

      const handler = registry.handlers.get("billing_status")!;
      const result = await handler({});
      const text = getText(result);

      // Personal section
      expect(text).toContain("Personal Subscription");
      expect(text).toContain("Personal");
      // Team workspaces section
      expect(text).toContain("Team Workspaces (2)");
      expect(text).toContain("Acme Corp");
      expect(text).toContain("ws-team-1");
      expect(text).toContain("Stripe Subscription: Yes");
      expect(text).toContain("Side Project");
      expect(text).toContain("ws-team-2");
      expect(text).toContain("Stripe Subscription: No");
      expect(text).toContain("3500/10000 used, 6500 remaining");
      expect(text).toContain("500/500 used, 0 remaining");
    });

    it("should query team workspaces with isPersonal: false", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-1",
        name: "Test",
        subscriptionTier: "FREE",
        stripeSubscriptionId: null,
        monthlyAiCredits: 100,
        usedAiCredits: 0,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([]);
      mockGetBalance.mockResolvedValue(null);

      const handler = registry.handlers.get("billing_status")!;
      await handler({});

      expect(mockPrisma.workspace.findMany).toHaveBeenCalledWith({
        where: {
          isPersonal: false,
          members: { some: { userId } },
          deletedAt: null,
        },
        select: {
          id: true,
          name: true,
          subscriptionTier: true,
          stripeSubscriptionId: true,
          monthlyAiCredits: true,
          usedAiCredits: true,
        },
      });
    });

    it("should omit team workspaces section when user has none", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws-1",
        name: "Solo",
        subscriptionTier: "FREE",
        stripeSubscriptionId: null,
        monthlyAiCredits: 100,
        usedAiCredits: 0,
      });
      mockPrisma.workspace.findMany.mockResolvedValue([]);
      mockGetBalance.mockResolvedValue(null);

      const handler = registry.handlers.get("billing_status")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).not.toContain("Team Workspaces");
    });
  });
});
