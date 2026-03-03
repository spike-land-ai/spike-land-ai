/**
 * Tests for recovery-service.ts
 *
 * Covers: getRecoveryGuidance, getAllRecoveryGuidance, upsertRecoveryGuidance,
 * seedDefaultRecoveryGuidance, markIssueResolved, getUnresolvedIssues
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AccountIssueType,
  IssueSeverity,
  RecoveryGuidance,
  SocialPlatform,
} from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    recoveryGuidance: {
      findFirst: vi.fn(),
      findMany: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    accountHealthEvent: {
      findMany: vi.fn(),
      update: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  getAllRecoveryGuidance,
  getRecoveryGuidance,
  getUnresolvedIssues,
  markIssueResolved,
  seedDefaultRecoveryGuidance,
  upsertRecoveryGuidance,
} from "./recovery-service";
import type { RecoveryStep } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeDbGuidance(
  overrides: Partial<RecoveryGuidance> = {},
): RecoveryGuidance {
  return {
    id: "guid-1",
    platform: null,
    issueType: "TOKEN_EXPIRED" as AccountIssueType,
    severity: "ERROR" as IssueSeverity,
    title: "Reconnect Your Account",
    description: "Your account authorization has expired.",
    steps: [
      { order: 1, title: "Go to settings", description: "Navigate to settings." },
    ] as unknown as RecoveryGuidance["steps"],
    estimatedTime: "2-5 minutes",
    requiresAction: true,
    autoRecoverable: false,
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  } as RecoveryGuidance;
}

function makeRecoverySteps(count = 2): RecoveryStep[] {
  return Array.from({ length: count }, (_, i) => ({
    order: i + 1,
    title: `Step ${i + 1}`,
    description: `Do step ${i + 1}`,
    actionUrl: i === 0 ? "/settings" : undefined,
  }));
}

// ---------------------------------------------------------------------------
// getRecoveryGuidance
// ---------------------------------------------------------------------------

describe("getRecoveryGuidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns platform-specific guidance when it exists", async () => {
    const guidance = makeDbGuidance({ platform: "TWITTER" as SocialPlatform });
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(guidance);

    const result = await getRecoveryGuidance("TOKEN_EXPIRED", "TWITTER");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("guid-1");
    expect(result?.issueType).toBe("TOKEN_EXPIRED");
    expect(result?.severity).toBe("ERROR");
    expect(result?.requiresAction).toBe(true);
    expect(result?.autoRecoverable).toBe(false);
  });

  it("falls back to generic guidance when no platform-specific one exists", async () => {
    const genericGuidance = makeDbGuidance();
    vi.mocked(prisma.recoveryGuidance.findFirst)
      .mockResolvedValueOnce(null) // first call: platform-specific → not found
      .mockResolvedValueOnce(genericGuidance); // second call: generic → found

    const result = await getRecoveryGuidance("TOKEN_EXPIRED", "TWITTER");

    expect(result).not.toBeNull();
    expect(result?.id).toBe("guid-1");
    expect(prisma.recoveryGuidance.findFirst).toHaveBeenCalledTimes(2);

    const secondCall = vi.mocked(prisma.recoveryGuidance.findFirst).mock.calls[1]?.[0];
    expect(secondCall?.where?.platform).toBeNull();
  });

  it("returns null when no guidance found for any platform", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst)
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce(null);

    const result = await getRecoveryGuidance("TOKEN_EXPIRED", "TWITTER");

    expect(result).toBeNull();
  });

  it("queries without platform when no platform provided", async () => {
    const guidance = makeDbGuidance();
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(guidance);

    const result = await getRecoveryGuidance("RATE_LIMITED");

    expect(result).not.toBeNull();
    // With no platform, should only call findFirst once
    expect(prisma.recoveryGuidance.findFirst).toHaveBeenCalledTimes(1);
    const callArg = vi.mocked(prisma.recoveryGuidance.findFirst).mock.calls[0]?.[0];
    // platform ?? null → null is passed when no platform provided
    expect(callArg?.where?.platform).toBeNull();
    expect(callArg?.where?.issueType).toBe("RATE_LIMITED");
  });

  it("formats steps from JSON to RecoveryStep[]", async () => {
    const steps = makeRecoverySteps(3);
    const guidance = makeDbGuidance({
      steps: steps as unknown as RecoveryGuidance["steps"],
    });
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(guidance);

    const result = await getRecoveryGuidance("TOKEN_EXPIRED");

    expect(result?.steps).toHaveLength(3);
    expect(result?.steps[0]).toMatchObject({
      order: 1,
      title: "Step 1",
    });
    expect(result?.steps[2]).toMatchObject({
      order: 3,
      title: "Step 3",
    });
  });

  it("returns estimatedTime as null when not set", async () => {
    const guidance = makeDbGuidance({ estimatedTime: null });
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(guidance);

    const result = await getRecoveryGuidance("TOKEN_EXPIRED");

    expect(result?.estimatedTime).toBeNull();
  });

  it("does not make fallback call when no platform is provided and result is null", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(null);

    const result = await getRecoveryGuidance("SYNC_FAILED");

    expect(result).toBeNull();
    // No platform → no fallback needed → only 1 call
    expect(prisma.recoveryGuidance.findFirst).toHaveBeenCalledTimes(1);
  });
});

// ---------------------------------------------------------------------------
// getAllRecoveryGuidance
// ---------------------------------------------------------------------------

describe("getAllRecoveryGuidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns all guidance formatted", async () => {
    const guidances = [
      makeDbGuidance({ id: "g-1", issueType: "TOKEN_EXPIRED" as AccountIssueType }),
      makeDbGuidance({
        id: "g-2",
        issueType: "RATE_LIMITED" as AccountIssueType,
        severity: "WARNING" as IssueSeverity,
      }),
    ];
    vi.mocked(prisma.recoveryGuidance.findMany).mockResolvedValueOnce(guidances);

    const result = await getAllRecoveryGuidance();

    expect(result).toHaveLength(2);
    expect(result[0]?.id).toBe("g-1");
    expect(result[1]?.id).toBe("g-2");
  });

  it("returns empty array when no guidance exists", async () => {
    vi.mocked(prisma.recoveryGuidance.findMany).mockResolvedValueOnce([]);

    const result = await getAllRecoveryGuidance();

    expect(result).toEqual([]);
  });

  it("orders by severity desc then issueType asc", async () => {
    vi.mocked(prisma.recoveryGuidance.findMany).mockResolvedValueOnce([]);

    await getAllRecoveryGuidance();

    const findArg = vi.mocked(prisma.recoveryGuidance.findMany).mock.calls[0]?.[0];
    expect(findArg?.orderBy).toEqual([
      { severity: "desc" },
      { issueType: "asc" },
    ]);
  });

  it("formats steps correctly for all returned items", async () => {
    const steps = makeRecoverySteps(2);
    const guidance = makeDbGuidance({
      steps: steps as unknown as RecoveryGuidance["steps"],
    });
    vi.mocked(prisma.recoveryGuidance.findMany).mockResolvedValueOnce([guidance]);

    const result = await getAllRecoveryGuidance();

    expect(result[0]?.steps).toHaveLength(2);
    expect(result[0]?.steps[0]?.title).toBe("Step 1");
  });
});

// ---------------------------------------------------------------------------
// upsertRecoveryGuidance
// ---------------------------------------------------------------------------

describe("upsertRecoveryGuidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  const baseOptions = {
    platform: null as SocialPlatform | null,
    issueType: "TOKEN_EXPIRED" as AccountIssueType,
    severity: "ERROR" as IssueSeverity,
    title: "Reconnect Your Account",
    description: "Your account authorization has expired.",
    steps: makeRecoverySteps(2),
    estimatedTime: "2-5 minutes",
    requiresAction: true,
    autoRecoverable: false,
  };

  it("creates new guidance when none exists", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(null);
    const created = makeDbGuidance();
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValueOnce(created);

    const result = await upsertRecoveryGuidance(baseOptions);

    expect(prisma.recoveryGuidance.create).toHaveBeenCalledOnce();
    expect(prisma.recoveryGuidance.update).not.toHaveBeenCalled();
    expect(result.id).toBe("guid-1");
  });

  it("updates existing guidance when it already exists", async () => {
    const existing = makeDbGuidance({ id: "existing-id" });
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(existing);
    const updated = makeDbGuidance({
      id: "existing-id",
      title: "Updated Title",
    });
    vi.mocked(prisma.recoveryGuidance.update).mockResolvedValueOnce(updated);

    await upsertRecoveryGuidance({ ...baseOptions, title: "Updated Title" });

    expect(prisma.recoveryGuidance.update).toHaveBeenCalledOnce();
    expect(prisma.recoveryGuidance.create).not.toHaveBeenCalled();
    const updateArg = vi.mocked(prisma.recoveryGuidance.update).mock.calls[0]?.[0];
    expect(updateArg?.where).toEqual({ id: "existing-id" });
  });

  it("defaults requiresAction to true when not provided", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(null);
    const created = makeDbGuidance();
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValueOnce(created);

    await upsertRecoveryGuidance({
      ...baseOptions,
      requiresAction: undefined,
    });

    const createArg = vi.mocked(prisma.recoveryGuidance.create).mock.calls[0]?.[0];
    expect(createArg?.data.requiresAction).toBe(true);
  });

  it("defaults autoRecoverable to false when not provided", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(null);
    const created = makeDbGuidance();
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValueOnce(created);

    await upsertRecoveryGuidance({
      ...baseOptions,
      autoRecoverable: undefined,
    });

    const createArg = vi.mocked(prisma.recoveryGuidance.create).mock.calls[0]?.[0];
    expect(createArg?.data.autoRecoverable).toBe(false);
  });

  it("creates platform-specific guidance when platform provided", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(null);
    const created = makeDbGuidance({ platform: "FACEBOOK" as SocialPlatform });
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValueOnce(created);

    await upsertRecoveryGuidance({
      ...baseOptions,
      platform: "FACEBOOK",
    });

    const createArg = vi.mocked(prisma.recoveryGuidance.create).mock.calls[0]?.[0];
    expect(createArg?.data.platform).toBe("FACEBOOK");
  });

  it("returns formatted guidance info", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(null);
    const steps = makeRecoverySteps(3);
    const created = makeDbGuidance({
      steps: steps as unknown as RecoveryGuidance["steps"],
    });
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValueOnce(created);

    const result = await upsertRecoveryGuidance(baseOptions);

    expect(result.steps).toHaveLength(3);
    expect(result.issueType).toBe("TOKEN_EXPIRED");
  });

  it("uses update data from options when updating", async () => {
    const existing = makeDbGuidance({ id: "old-id" });
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValueOnce(existing);
    const updated = makeDbGuidance({ id: "old-id", severity: "CRITICAL" as IssueSeverity });
    vi.mocked(prisma.recoveryGuidance.update).mockResolvedValueOnce(updated);

    await upsertRecoveryGuidance({ ...baseOptions, severity: "CRITICAL" });

    const updateArg = vi.mocked(prisma.recoveryGuidance.update).mock.calls[0]?.[0];
    expect(updateArg?.data.severity).toBe("CRITICAL");
    expect(updateArg?.data.title).toBe(baseOptions.title);
    expect(updateArg?.data.description).toBe(baseOptions.description);
  });
});

// ---------------------------------------------------------------------------
// seedDefaultRecoveryGuidance
// ---------------------------------------------------------------------------

describe("seedDefaultRecoveryGuidance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("seeds all 10 default guidance templates", async () => {
    // All findFirst calls return null (fresh DB), all creates succeed
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValue(
      makeDbGuidance() as never,
    );

    await seedDefaultRecoveryGuidance();

    expect(prisma.recoveryGuidance.create).toHaveBeenCalledTimes(10);
  });

  it("seeds guidance covering key issue types", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValue(
      makeDbGuidance() as never,
    );

    await seedDefaultRecoveryGuidance();

    const createCalls = vi.mocked(prisma.recoveryGuidance.create).mock.calls;
    const seededIssueTypes = createCalls.map(
      call => call[0]?.data.issueType as AccountIssueType,
    );

    const expectedIssueTypes: AccountIssueType[] = [
      "TOKEN_EXPIRED",
      "TOKEN_EXPIRING_SOON",
      "RATE_LIMITED",
      "API_ERROR",
      "PERMISSION_DENIED",
      "ACCOUNT_RESTRICTED",
      "ACCOUNT_SUSPENDED",
      "SYNC_FAILED",
      "CONNECTION_LOST",
      "QUOTA_EXCEEDED",
    ];

    for (const issueType of expectedIssueTypes) {
      expect(seededIssueTypes).toContain(issueType);
    }
  });

  it("updates existing guidance templates instead of duplicating", async () => {
    const existing = makeDbGuidance({ id: "existing-guid-1" });
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValue(existing);
    vi.mocked(prisma.recoveryGuidance.update).mockResolvedValue(
      makeDbGuidance() as never,
    );

    await seedDefaultRecoveryGuidance();

    expect(prisma.recoveryGuidance.update).toHaveBeenCalledTimes(10);
    expect(prisma.recoveryGuidance.create).not.toHaveBeenCalled();
  });

  it("sets all guidance to generic platform (null)", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValue(
      makeDbGuidance() as never,
    );

    await seedDefaultRecoveryGuidance();

    const createCalls = vi.mocked(prisma.recoveryGuidance.create).mock.calls;
    for (const call of createCalls) {
      expect(call[0]?.data.platform).toBeNull();
    }
  });

  it("seeds ACCOUNT_SUSPENDED as CRITICAL severity", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValue(
      makeDbGuidance() as never,
    );

    await seedDefaultRecoveryGuidance();

    const createCalls = vi.mocked(prisma.recoveryGuidance.create).mock.calls;
    const suspendedCall = createCalls.find(
      call => call[0]?.data.issueType === "ACCOUNT_SUSPENDED",
    );
    expect(suspendedCall?.[0]?.data.severity).toBe("CRITICAL");
    expect(suspendedCall?.[0]?.data.requiresAction).toBe(true);
    expect(suspendedCall?.[0]?.data.autoRecoverable).toBe(false);
  });

  it("seeds RATE_LIMITED as auto-recoverable", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValue(
      makeDbGuidance() as never,
    );

    await seedDefaultRecoveryGuidance();

    const createCalls = vi.mocked(prisma.recoveryGuidance.create).mock.calls;
    const rateLimitCall = createCalls.find(
      call => call[0]?.data.issueType === "RATE_LIMITED",
    );
    expect(rateLimitCall?.[0]?.data.autoRecoverable).toBe(true);
    expect(rateLimitCall?.[0]?.data.requiresAction).toBe(false);
  });

  it("seeds TOKEN_EXPIRED as requiring user action", async () => {
    vi.mocked(prisma.recoveryGuidance.findFirst).mockResolvedValue(null);
    vi.mocked(prisma.recoveryGuidance.create).mockResolvedValue(
      makeDbGuidance() as never,
    );

    await seedDefaultRecoveryGuidance();

    const createCalls = vi.mocked(prisma.recoveryGuidance.create).mock.calls;
    const tokenExpiredCall = createCalls.find(
      call => call[0]?.data.issueType === "TOKEN_EXPIRED",
    );
    expect(tokenExpiredCall?.[0]?.data.requiresAction).toBe(true);
    expect(tokenExpiredCall?.[0]?.data.autoRecoverable).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// markIssueResolved
// ---------------------------------------------------------------------------

describe("markIssueResolved", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("updates event with resolvedAt, resolvedById and notes", async () => {
    vi.mocked(prisma.accountHealthEvent.update).mockResolvedValueOnce({} as never);

    await markIssueResolved("event-1", "user-abc", "Fixed by reconnecting");

    expect(prisma.accountHealthEvent.update).toHaveBeenCalledOnce();
    const updateArg = vi.mocked(prisma.accountHealthEvent.update).mock.calls[0]?.[0];
    expect(updateArg?.where).toEqual({ id: "event-1" });
    expect(updateArg?.data.resolvedById).toBe("user-abc");
    expect(updateArg?.data.resolutionNotes).toBe("Fixed by reconnecting");
    expect(updateArg?.data.resolvedAt).toBeInstanceOf(Date);
  });

  it("works without resolution notes", async () => {
    vi.mocked(prisma.accountHealthEvent.update).mockResolvedValueOnce({} as never);

    await markIssueResolved("event-2", "user-xyz");

    const updateArg = vi.mocked(prisma.accountHealthEvent.update).mock.calls[0]?.[0];
    expect(updateArg?.data.resolutionNotes).toBeUndefined();
    expect(updateArg?.data.resolvedAt).toBeInstanceOf(Date);
  });

  it("sets resolvedAt to approximately current time", async () => {
    vi.mocked(prisma.accountHealthEvent.update).mockResolvedValueOnce({} as never);

    const before = new Date();
    await markIssueResolved("event-3", "user-abc");
    const after = new Date();

    const updateArg = vi.mocked(prisma.accountHealthEvent.update).mock.calls[0]?.[0];
    const resolvedAt = updateArg?.data.resolvedAt as Date;
    expect(resolvedAt.getTime()).toBeGreaterThanOrEqual(before.getTime());
    expect(resolvedAt.getTime()).toBeLessThanOrEqual(after.getTime());
  });

  it("propagates database errors", async () => {
    vi.mocked(prisma.accountHealthEvent.update).mockRejectedValueOnce(
      new Error("Record not found"),
    );

    await expect(markIssueResolved("nonexistent-event", "user-abc")).rejects.toThrow(
      "Record not found",
    );
  });
});

// ---------------------------------------------------------------------------
// getUnresolvedIssues
// ---------------------------------------------------------------------------

describe("getUnresolvedIssues", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped unresolved events", async () => {
    const now = new Date();
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([
      {
        id: "issue-1",
        eventType: "ERROR_OCCURRED",
        severity: "ERROR" as IssueSeverity,
        message: "API rate limit exceeded",
        createdAt: now,
      } as never,
      {
        id: "issue-2",
        eventType: "TOKEN_EXPIRED",
        severity: "CRITICAL" as IssueSeverity,
        message: "Token has expired",
        createdAt: now,
      } as never,
    ]);

    const issues = await getUnresolvedIssues("acc-1");

    expect(issues).toHaveLength(2);
    expect(issues[0]).toMatchObject({
      id: "issue-1",
      eventType: "ERROR_OCCURRED",
      severity: "ERROR",
      message: "API rate limit exceeded",
    });
    expect(issues[1]).toMatchObject({
      id: "issue-2",
      eventType: "TOKEN_EXPIRED",
      severity: "CRITICAL",
    });
  });

  it("filters by accountId and resolvedAt null", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getUnresolvedIssues("acc-xyz");

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    expect(findArg?.where?.accountId).toBe("acc-xyz");
    expect(findArg?.where?.resolvedAt).toBeNull();
  });

  it("only fetches relevant event types", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getUnresolvedIssues("acc-1");

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    const eventTypes = (findArg?.where?.eventType as { in?: string[]; } | undefined)?.in ?? [];
    expect(eventTypes).toContain("ERROR_OCCURRED");
    expect(eventTypes).toContain("TOKEN_EXPIRED");
    expect(eventTypes).toContain("RATE_LIMIT_HIT");
    expect(eventTypes).toContain("STATUS_CHANGED");
  });

  it("orders events by createdAt descending", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getUnresolvedIssues("acc-1");

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    expect(findArg?.orderBy).toEqual({ createdAt: "desc" });
  });

  it("returns empty array when no unresolved issues", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    const issues = await getUnresolvedIssues("acc-1");

    expect(issues).toEqual([]);
  });

  it("returns createdAt for each issue", async () => {
    const now = new Date("2024-06-15T10:00:00Z");
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([
      {
        id: "issue-1",
        eventType: "RATE_LIMIT_HIT",
        severity: "WARNING" as IssueSeverity,
        message: "Rate limit hit",
        createdAt: now,
      } as never,
    ]);

    const issues = await getUnresolvedIssues("acc-1");

    expect(issues[0]?.createdAt).toEqual(now);
  });

  it("propagates database errors", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockRejectedValueOnce(
      new Error("DB timeout"),
    );

    await expect(getUnresolvedIssues("acc-1")).rejects.toThrow("DB timeout");
  });
});
