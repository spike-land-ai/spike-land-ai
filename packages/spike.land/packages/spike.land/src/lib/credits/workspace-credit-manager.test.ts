/**
 * Tests for WorkspaceCreditManager
 *
 * Covers workspace resolution logic, balance retrieval,
 * credit consumption (including the source parameter from #1495),
 * and credit refund.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks — must be defined before any imports that use them
// ---------------------------------------------------------------------------

const { mockPrisma, mockLogger } = vi.hoisted(() => ({
  mockLogger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
  mockPrisma: {
    workspace: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    workspaceMember: {
      findFirst: vi.fn(),
    },
    workspaceAuditLog: {
      create: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    $executeRaw: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

vi.mock("@/lib/logger", () => ({
  default: mockLogger,
}));

// Mock the subscription service used inside WorkspaceCreditManager
vi.mock("@/lib/subscription/workspace-subscription", () => ({
  WorkspaceSubscriptionService: {
    canUseAiCredits: vi.fn(),
    consumeAiCredits: vi.fn(),
  },
  AiCreditSource: {},
}));

// Mock ensure-personal-workspace
vi.mock("@/lib/workspace/ensure-personal-workspace", () => ({
  ensurePersonalWorkspace: vi.fn(),
}));

// ---------------------------------------------------------------------------
// Imports (after mocks)
// ---------------------------------------------------------------------------

import { WorkspaceCreditManager } from "./workspace-credit-manager";
import { WorkspaceSubscriptionService } from "@/lib/subscription/workspace-subscription";
import { ensurePersonalWorkspace } from "@/lib/workspace/ensure-personal-workspace";

// Cast mocks to typed spy helpers
const mockCanUseAiCredits = vi.mocked(WorkspaceSubscriptionService.canUseAiCredits);
const mockConsumeAiCredits = vi.mocked(WorkspaceSubscriptionService.consumeAiCredits);
const mockEnsurePersonalWorkspace = vi.mocked(ensurePersonalWorkspace);

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const USER_ID = "user-abc-123";
const WORKSPACE_ID = "ws-xyz-456";

// ---------------------------------------------------------------------------
// resolveWorkspaceForUser
// ---------------------------------------------------------------------------

describe("WorkspaceCreditManager.resolveWorkspaceForUser", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns null for empty userId", async () => {
    const result = await WorkspaceCreditManager.resolveWorkspaceForUser("");
    expect(result).toBeNull();
    expect(mockPrisma.workspace.findFirst).not.toHaveBeenCalled();
  });

  it("returns null for anonymous user", async () => {
    const result = await WorkspaceCreditManager.resolveWorkspaceForUser("anonymous");
    expect(result).toBeNull();
  });

  it("returns null for guest_ prefixed userId", async () => {
    const result = await WorkspaceCreditManager.resolveWorkspaceForUser("guest_session_42");
    expect(result).toBeNull();
  });

  it("returns personal workspace id when one exists", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });

    const result = await WorkspaceCreditManager.resolveWorkspaceForUser(USER_ID);

    expect(result).toBe(WORKSPACE_ID);
    expect(mockPrisma.workspace.findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ isPersonal: true }),
      }),
    );
    expect(mockPrisma.workspaceMember.findFirst).not.toHaveBeenCalled();
  });

  it("falls back to first workspace membership when no personal workspace", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue(null);
    mockPrisma.workspaceMember.findFirst.mockResolvedValue({
      workspaceId: "ws-team-789",
    });

    const result = await WorkspaceCreditManager.resolveWorkspaceForUser(USER_ID);

    expect(result).toBe("ws-team-789");
    expect(mockPrisma.workspaceMember.findFirst).toHaveBeenCalled();
  });

  it("auto-creates personal workspace when user has no workspace at all", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue(null);
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ name: "Alice" });
    mockEnsurePersonalWorkspace.mockResolvedValue("ws-new-created");

    const result = await WorkspaceCreditManager.resolveWorkspaceForUser(USER_ID);

    expect(result).toBe("ws-new-created");
    expect(mockEnsurePersonalWorkspace).toHaveBeenCalledWith(USER_ID, "Alice");
  });

  it("returns null when user record does not exist and no workspace found", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue(null);
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const result = await WorkspaceCreditManager.resolveWorkspaceForUser(USER_ID);

    expect(result).toBeNull();
    expect(mockEnsurePersonalWorkspace).not.toHaveBeenCalled();
  });

  it("returns null when personal workspace creation fails", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue(null);
    mockPrisma.workspaceMember.findFirst.mockResolvedValue(null);
    mockPrisma.user.findUnique.mockResolvedValue({ name: "Bob" });
    mockEnsurePersonalWorkspace.mockRejectedValue(new Error("DB constraint error"));

    const result = await WorkspaceCreditManager.resolveWorkspaceForUser(USER_ID);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// getBalance
// ---------------------------------------------------------------------------

describe("WorkspaceCreditManager.getBalance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns null when user has no workspace", async () => {
    const result = await WorkspaceCreditManager.getBalance("anonymous");
    expect(result).toBeNull();
  });

  it("returns credit balance for a user with a personal workspace", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockPrisma.workspace.findUnique.mockResolvedValue({
      monthlyAiCredits: 500,
      usedAiCredits: 120,
      subscriptionTier: "FREE",
    });

    const result = await WorkspaceCreditManager.getBalance(USER_ID);

    expect(result).not.toBeNull();
    expect(result?.limit).toBe(500);
    expect(result?.used).toBe(120);
    expect(result?.remaining).toBe(380);
    expect(result?.tier).toBe("FREE");
    expect(result?.workspaceId).toBe(WORKSPACE_ID);
  });

  it("clamps remaining to 0 when usedAiCredits exceeds limit", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockPrisma.workspace.findUnique.mockResolvedValue({
      monthlyAiCredits: 100,
      usedAiCredits: 150,
      subscriptionTier: "PRO",
    });

    const result = await WorkspaceCreditManager.getBalance(USER_ID);

    expect(result?.remaining).toBe(0);
    expect(result?.used).toBe(150);
  });

  it("returns null when workspace data is not found after resolution", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockPrisma.workspace.findUnique.mockResolvedValue(null);

    const result = await WorkspaceCreditManager.getBalance(USER_ID);

    expect(result).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// hasEnoughCredits
// ---------------------------------------------------------------------------

describe("WorkspaceCreditManager.hasEnoughCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns false for anonymous users (no workspace)", async () => {
    const result = await WorkspaceCreditManager.hasEnoughCredits("anonymous", 10);
    expect(result).toBe(false);
    expect(mockCanUseAiCredits).not.toHaveBeenCalled();
  });

  it("returns true when subscription service allows the amount", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockCanUseAiCredits.mockResolvedValue({
      allowed: true,
      currentCount: 50,
      limit: 500,
      upgradeRequired: false,
      message: "450 AI credits remaining this month",
    });

    const result = await WorkspaceCreditManager.hasEnoughCredits(USER_ID, 50);

    expect(result).toBe(true);
    expect(mockCanUseAiCredits).toHaveBeenCalledWith(WORKSPACE_ID, 50);
  });

  it("returns false when subscription service denies the amount", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockCanUseAiCredits.mockResolvedValue({
      allowed: false,
      currentCount: 490,
      limit: 500,
      upgradeRequired: true,
      message: "Insufficient AI credits",
    });

    const result = await WorkspaceCreditManager.hasEnoughCredits(USER_ID, 100);

    expect(result).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// consumeCredits — key area for ticket #1495
// ---------------------------------------------------------------------------

describe("WorkspaceCreditManager.consumeCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns error when no workspace found for user", async () => {
    const result = await WorkspaceCreditManager.consumeCredits({
      userId: "anonymous",
      amount: 10,
    });

    expect(result.success).toBe(false);
    expect(result.remaining).toBe(0);
    expect(result.error).toContain("No active workspace found");
    expect(mockConsumeAiCredits).not.toHaveBeenCalled();
  });

  it("forwards to subscription service and returns its result on success", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockConsumeAiCredits.mockResolvedValue({
      success: true,
      remaining: 450,
    });

    const result = await WorkspaceCreditManager.consumeCredits({
      userId: USER_ID,
      amount: 50,
    });

    expect(result.success).toBe(true);
    expect(result.remaining).toBe(450);
    // The service is invoked for the resolved workspace
    expect(mockConsumeAiCredits).toHaveBeenCalledOnce();
    const [calledWorkspaceId, calledAmount] = mockConsumeAiCredits.mock.calls[0]!;
    expect(calledWorkspaceId).toBe(WORKSPACE_ID);
    expect(calledAmount).toBe(50);
  });

  it("accepts source and sourceId parameters without throwing", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockConsumeAiCredits.mockResolvedValue({
      success: true,
      remaining: 200,
    });

    // source/sourceId are accepted params (ticket #1495 tracking)
    const result = await WorkspaceCreditManager.consumeCredits({
      userId: USER_ID,
      amount: 10,
      source: "orbit-post-enhance",
      sourceId: "post-id-999",
    });

    expect(result.success).toBe(true);
    // consumeAiCredits is called with correct workspace and amount
    expect(mockConsumeAiCredits).toHaveBeenCalledOnce();
    const [calledWorkspaceId, calledAmount] = mockConsumeAiCredits.mock.calls[0]!;
    expect(calledWorkspaceId).toBe(WORKSPACE_ID);
    expect(calledAmount).toBe(10);
  });

  it("propagates failure from subscription service", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockConsumeAiCredits.mockResolvedValue({
      success: false,
      remaining: 0,
      error: "Insufficient AI credits. Need 100, have 5.",
    });

    const result = await WorkspaceCreditManager.consumeCredits({
      userId: USER_ID,
      amount: 100,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Insufficient");
  });
});

// ---------------------------------------------------------------------------
// consumeCredits — audit log persistence (added by C1, tested by C2)
// ---------------------------------------------------------------------------

describe("WorkspaceCreditManager.consumeCredits — audit log", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates audit log entry with all source fields on success", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockConsumeAiCredits.mockResolvedValue({ success: true, remaining: 490 });
    mockPrisma.workspaceAuditLog.create.mockResolvedValue({});

    await WorkspaceCreditManager.consumeCredits({
      userId: USER_ID,
      amount: 10,
      model: "claude-sonnet-4-6",
      provider: "anthropic",
      feature: "orbit-post-enhance",
      sourceId: "post-42",
    });

    expect(mockPrisma.workspaceAuditLog.create).toHaveBeenCalledOnce();
    expect(mockPrisma.workspaceAuditLog.create).toHaveBeenCalledWith({
      data: {
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
        action: "AI_GENERATION_REQUEST",
        resourceType: "ai_credits",
        metadata: {
          amount: 10,
          remaining: 490,
          model: "claude-sonnet-4-6",
          provider: "anthropic",
          feature: "orbit-post-enhance",
          sourceId: "post-42",
        },
      },
    });
  });

  it("maps legacy source string to feature when no explicit feature provided", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockConsumeAiCredits.mockResolvedValue({ success: true, remaining: 300 });
    mockPrisma.workspaceAuditLog.create.mockResolvedValue({});

    await WorkspaceCreditManager.consumeCredits({
      userId: USER_ID,
      amount: 5,
      source: "orbit-enhance",
      sourceId: "post-99",
    });

    expect(mockPrisma.workspaceAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          feature: "orbit-enhance",
          sourceId: "post-99",
          model: null,
          provider: null,
        }),
      }),
    });
  });

  it("prefers explicit feature over legacy source string", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockConsumeAiCredits.mockResolvedValue({ success: true, remaining: 100 });
    mockPrisma.workspaceAuditLog.create.mockResolvedValue({});

    await WorkspaceCreditManager.consumeCredits({
      userId: USER_ID,
      amount: 3,
      source: "legacy-label",
      feature: "explicit-feature",
    });

    expect(mockPrisma.workspaceAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: expect.objectContaining({
          feature: "explicit-feature",
        }),
      }),
    });
  });

  it("sets all metadata fields to null when no source info provided", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockConsumeAiCredits.mockResolvedValue({ success: true, remaining: 450 });
    mockPrisma.workspaceAuditLog.create.mockResolvedValue({});

    await WorkspaceCreditManager.consumeCredits({
      userId: USER_ID,
      amount: 50,
    });

    expect(mockPrisma.workspaceAuditLog.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        metadata: {
          amount: 50,
          remaining: 450,
          model: null,
          provider: null,
          feature: null,
          sourceId: null,
        },
      }),
    });
  });

  it("does NOT create audit log when consumption fails", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockConsumeAiCredits.mockResolvedValue({
      success: false,
      remaining: 0,
      error: "Insufficient credits",
    });

    await WorkspaceCreditManager.consumeCredits({
      userId: USER_ID,
      amount: 999,
      model: "gpt-4o",
      provider: "openai",
      feature: "content-gen",
    });

    expect(mockPrisma.workspaceAuditLog.create).not.toHaveBeenCalled();
  });

  it("returns success even when audit log DB write fails (non-blocking)", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockConsumeAiCredits.mockResolvedValue({ success: true, remaining: 200 });
    mockPrisma.workspaceAuditLog.create.mockRejectedValue(
      new Error("Audit table locked"),
    );

    const result = await WorkspaceCreditManager.consumeCredits({
      userId: USER_ID,
      amount: 10,
      model: "claude-opus-4-6",
      provider: "anthropic",
      feature: "orbit-analytics",
    });

    // Credits were consumed — audit failure should not affect the result
    expect(result.success).toBe(true);
    expect(result.remaining).toBe(200);

    // Verify the warning was logged
    expect(mockLogger.warn).toHaveBeenCalledWith(
      "Failed to persist AI credit audit log",
      expect.objectContaining({
        workspaceId: WORKSPACE_ID,
        userId: USER_ID,
      }),
    );
  });

  it("does NOT create audit log when no workspace found", async () => {
    const result = await WorkspaceCreditManager.consumeCredits({
      userId: "anonymous",
      amount: 10,
    });

    expect(result.success).toBe(false);
    expect(mockPrisma.workspaceAuditLog.create).not.toHaveBeenCalled();
  });
});

// ---------------------------------------------------------------------------
// refundCredits
// ---------------------------------------------------------------------------

describe("WorkspaceCreditManager.refundCredits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns true immediately for zero amount (no-op)", async () => {
    const result = await WorkspaceCreditManager.refundCredits(USER_ID, 0);

    expect(result).toBe(true);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("returns true immediately for negative amount (no-op)", async () => {
    const result = await WorkspaceCreditManager.refundCredits(USER_ID, -5);

    expect(result).toBe(true);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("returns false when user has no workspace", async () => {
    const result = await WorkspaceCreditManager.refundCredits("anonymous", 10);

    expect(result).toBe(false);
    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
  });

  it("executes raw SQL to decrement credits with GREATEST guard", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockPrisma.$executeRaw.mockResolvedValue(1);

    const result = await WorkspaceCreditManager.refundCredits(USER_ID, 25);

    expect(result).toBe(true);
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
  });

  it("returns false when the raw query throws", async () => {
    mockPrisma.workspace.findFirst.mockResolvedValue({ id: WORKSPACE_ID });
    mockPrisma.$executeRaw.mockRejectedValue(new Error("DB constraint violated"));

    const result = await WorkspaceCreditManager.refundCredits(USER_ID, 25);

    expect(result).toBe(false);
  });
});
