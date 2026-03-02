/**
 * Tests for health-alert-manager.ts
 *
 * Covers: createHealthEvent, detectAndLogStatusChange, logRateLimitEvent,
 * logErrorEvent, logTokenExpiryEvent, sendHealthAlertEmail, sendHealthAlerts,
 * getRecentHealthEvents, getAccountHealthEvents
 */

import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  AccountHealthEventType,
  AccountHealthStatus,
  IssueSeverity,
  SocialAccount,
  SocialAccountHealth,
} from "@prisma/client";

vi.mock("@/lib/prisma", () => ({
  default: {
    accountHealthEvent: {
      create: vi.fn(),
      findMany: vi.fn(),
      update: vi.fn(),
    },
    socialAccount: {
      findMany: vi.fn(),
    },
    workspaceMember: {
      findMany: vi.fn(),
    },
    workspace: {
      findUnique: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  },
}));

vi.mock("@/lib/email/client", () => ({
  sendEmail: vi.fn(),
}));

vi.mock("@/lib/email/templates/health-alert", () => ({
  HealthAlertEmail: vi.fn((props: Record<string, unknown>) => props),
}));

vi.mock("@/lib/logger", () => ({
  default: {
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock("./health-calculator", () => ({
  scoreToStatus: vi.fn((score: number): AccountHealthStatus => {
    if (score >= 80) return "HEALTHY";
    if (score >= 50) return "DEGRADED";
    if (score >= 20) return "UNHEALTHY";
    return "CRITICAL";
  }),
}));

import prisma from "@/lib/prisma";
import { sendEmail } from "@/lib/email/client";
import {
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
import type { HealthAlertConfig } from "./types";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeSocialAccount(overrides: Partial<SocialAccount> = {}): SocialAccount {
  return {
    id: "acc-1",
    platform: "TWITTER",
    accountId: "twitter-123",
    accountName: "TestUser",
    accessTokenEncrypted: "encrypted-token",
    refreshTokenEncrypted: null,
    tokenExpiresAt: null,
    connectedAt: new Date("2024-01-01"),
    status: "ACTIVE",
    metadata: null,
    userId: "user-1",
    workspaceId: "ws-1",
    createdAt: new Date("2024-01-01"),
    updatedAt: new Date("2024-01-01"),
    ...overrides,
  } as SocialAccount;
}

function makeHealth(overrides: Partial<SocialAccountHealth> = {}): SocialAccountHealth {
  return {
    id: "health-1",
    accountId: "acc-1",
    healthScore: 85,
    status: "HEALTHY",
    lastSuccessfulSync: new Date(),
    consecutiveErrors: 0,
    totalErrorsLast24h: 0,
    rateLimitRemaining: 100,
    rateLimitTotal: 100,
    isRateLimited: false,
    rateLimitResetAt: null,
    tokenExpiresAt: null,
    tokenRefreshRequired: false,
    lastCheckedAt: new Date(),
    updatedAt: new Date(),
    createdAt: new Date(),
    ...overrides,
  } as SocialAccountHealth;
}

function makeAlertConfig(overrides: Partial<HealthAlertConfig> = {}): HealthAlertConfig {
  return {
    workspaceId: "ws-1",
    minSeverity: "WARNING",
    notifyChannels: ["email"],
    alertOnScoreBelow: 50,
    alertOnRateLimit: false,
    alertOnTokenExpiry: false,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// createHealthEvent
// ---------------------------------------------------------------------------

describe("createHealthEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates a health event and returns the id", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "event-id-1",
    } as never);

    const id = await createHealthEvent({
      accountId: "acc-1",
      workspaceId: "ws-1",
      eventType: "STATUS_CHANGED",
      severity: "WARNING",
      newStatus: "DEGRADED",
      newScore: 55,
      message: "Score dropped",
    });

    expect(id).toBe("event-id-1");
    expect(prisma.accountHealthEvent.create).toHaveBeenCalledOnce();
    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data).toMatchObject({
      accountId: "acc-1",
      workspaceId: "ws-1",
      eventType: "STATUS_CHANGED",
      severity: "WARNING",
      newStatus: "DEGRADED",
      newScore: 55,
      message: "Score dropped",
    });
  });

  it("includes optional previousStatus and previousScore when provided", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "event-id-2",
    } as never);

    await createHealthEvent({
      accountId: "acc-1",
      workspaceId: "ws-1",
      eventType: "SCORE_DECREASED",
      severity: "INFO",
      previousStatus: "HEALTHY",
      newStatus: "DEGRADED",
      previousScore: 90,
      newScore: 60,
      message: "Score changed",
    });

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.previousStatus).toBe("HEALTHY");
    expect(createArg?.data.previousScore).toBe(90);
  });

  it("propagates database errors", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockRejectedValueOnce(
      new Error("DB connection error"),
    );

    await expect(
      createHealthEvent({
        accountId: "acc-1",
        workspaceId: "ws-1",
        eventType: "ERROR_OCCURRED",
        severity: "ERROR",
        newStatus: "UNHEALTHY",
        newScore: 30,
        message: "Error",
      }),
    ).rejects.toThrow("DB connection error");
  });
});

// ---------------------------------------------------------------------------
// detectAndLogStatusChange
// ---------------------------------------------------------------------------

describe("detectAndLogStatusChange", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("does nothing when score and status are unchanged", async () => {
    const account = makeSocialAccount();
    // health score 85 maps to HEALTHY (same as previousStatus)
    const health = makeHealth({ healthScore: 85 });

    await detectAndLogStatusChange(account, health, 85, "HEALTHY");

    expect(prisma.accountHealthEvent.create).not.toHaveBeenCalled();
  });

  it("creates STATUS_CHANGED/CRITICAL event when status becomes CRITICAL", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-1",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 10 });

    await detectAndLogStatusChange(account, health, 85, "HEALTHY");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("STATUS_CHANGED");
    expect(createArg?.data.severity).toBe("CRITICAL");
    expect(createArg?.data.message).toContain("critical");
  });

  it("creates STATUS_CHANGED/ERROR event when status becomes UNHEALTHY", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-2",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 35 });

    await detectAndLogStatusChange(account, health, 85, "HEALTHY");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.severity).toBe("ERROR");
    expect(createArg?.data.message).toContain("unhealthy");
  });

  it("creates STATUS_CHANGED/WARNING event when status becomes DEGRADED", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-3",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 60 });

    await detectAndLogStatusChange(account, health, 85, "HEALTHY");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.severity).toBe("WARNING");
    expect(createArg?.data.eventType).toBe("STATUS_CHANGED");
  });

  it("creates ACCOUNT_RECOVERED/INFO event when recovering to HEALTHY", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-4",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 90 });

    await detectAndLogStatusChange(account, health, 30, "UNHEALTHY");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("ACCOUNT_RECOVERED");
    expect(createArg?.data.severity).toBe("INFO");
  });

  it("creates SCORE_DECREASED event when score drops within same status", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-5",
    } as never);

    const account = makeSocialAccount();
    // score 60 maps to DEGRADED, previousStatus already DEGRADED — score changed
    const health = makeHealth({ healthScore: 60 });

    await detectAndLogStatusChange(account, health, 75, "DEGRADED");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("SCORE_DECREASED");
    expect(createArg?.data.previousScore).toBe(75);
    expect(createArg?.data.newScore).toBe(60);
  });

  it("creates SCORE_RECOVERED event when score improves within same status", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-6",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 75 });

    await detectAndLogStatusChange(account, health, 55, "DEGRADED");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("SCORE_RECOVERED");
    expect(createArg?.data.severity).toBe("INFO");
  });

  it("applies WARNING severity on SCORE_DECREASED when score < 50", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-7",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 35 });

    await detectAndLogStatusChange(account, health, 40, "UNHEALTHY");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("SCORE_DECREASED");
    expect(createArg?.data.severity).toBe("WARNING");
  });
});

// ---------------------------------------------------------------------------
// logRateLimitEvent
// ---------------------------------------------------------------------------

describe("logRateLimitEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates RATE_LIMIT_HIT event when isLimited=true", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-rl-1",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 50 });

    await logRateLimitEvent(account, health, true);

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("RATE_LIMIT_HIT");
    expect(createArg?.data.severity).toBe("WARNING");
    expect(createArg?.data.message).toContain("Rate limit hit");
  });

  it("creates RATE_LIMIT_CLEARED event when isLimited=false", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-rl-2",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 80 });

    await logRateLimitEvent(account, health, false);

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("RATE_LIMIT_CLEARED");
    expect(createArg?.data.severity).toBe("INFO");
    expect(createArg?.data.message).toContain("cleared");
  });

  it("includes platform and accountName in details", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-rl-3",
    } as never);

    const account = makeSocialAccount({ platform: "FACEBOOK", accountName: "MyPage" });
    const health = makeHealth({ healthScore: 40 });

    await logRateLimitEvent(account, health, true);

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.details).toMatchObject({
      platform: "FACEBOOK",
      accountName: "MyPage",
    });
  });
});

// ---------------------------------------------------------------------------
// logErrorEvent
// ---------------------------------------------------------------------------

describe("logErrorEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates ERROR_OCCURRED event with WARNING for low consecutive errors", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-err-1",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ consecutiveErrors: 2, healthScore: 70 });

    await logErrorEvent(account, health, "Timeout error");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("ERROR_OCCURRED");
    expect(createArg?.data.severity).toBe("WARNING");
    expect(createArg?.data.message).toContain("Timeout error");
  });

  it("uses ERROR severity when consecutiveErrors >= 3", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-err-2",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ consecutiveErrors: 3, healthScore: 55 });

    await logErrorEvent(account, health, "Auth failure");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.severity).toBe("ERROR");
  });

  it("uses CRITICAL severity when consecutiveErrors >= 5", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-err-3",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ consecutiveErrors: 5, healthScore: 20 });

    await logErrorEvent(account, health, "Critical failure");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.severity).toBe("CRITICAL");
  });

  it("includes consecutive error count in details", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-err-4",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ consecutiveErrors: 7, healthScore: 30 });

    await logErrorEvent(account, health, "Network error");

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.details).toMatchObject({
      consecutiveErrors: 7,
      error: "Network error",
    });
  });
});

// ---------------------------------------------------------------------------
// logTokenExpiryEvent
// ---------------------------------------------------------------------------

describe("logTokenExpiryEvent", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("creates TOKEN_EXPIRED event with ERROR severity when expired", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-tok-1",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 40 });

    await logTokenExpiryEvent(account, health, true);

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("TOKEN_EXPIRED");
    expect(createArg?.data.severity).toBe("ERROR");
    expect(createArg?.data.message).toContain("expired");
  });

  it("creates TOKEN_REFRESHED event with INFO severity when refreshed", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-tok-2",
    } as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 90 });

    await logTokenExpiryEvent(account, health, false);

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.eventType).toBe("TOKEN_REFRESHED");
    expect(createArg?.data.severity).toBe("INFO");
    expect(createArg?.data.message).toContain("refreshed");
  });

  it("includes token expiry details in the event", async () => {
    vi.mocked(prisma.accountHealthEvent.create).mockResolvedValueOnce({
      id: "ev-tok-3",
    } as never);

    const expiryDate = new Date("2024-12-31");
    const account = makeSocialAccount({ platform: "LINKEDIN" });
    const health = makeHealth({ healthScore: 40, tokenExpiresAt: expiryDate });

    await logTokenExpiryEvent(account, health, true);

    const createArg = vi.mocked(prisma.accountHealthEvent.create).mock.calls[0]?.[0];
    expect(createArg?.data.details).toMatchObject({
      platform: "LINKEDIN",
      tokenExpiresAt: expiryDate,
    });
  });
});

// ---------------------------------------------------------------------------
// sendHealthAlertEmail
// ---------------------------------------------------------------------------

describe("sendHealthAlertEmail", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sends email with critical emoji for CRITICAL status", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce(undefined as never);

    await sendHealthAlertEmail(
      { email: "admin@example.com", name: "Admin" },
      {
        accountName: "MyPage",
        platform: "FACEBOOK",
        healthScore: 10,
        status: "CRITICAL",
        issue: "Account critical",
        dashboardUrl: "https://spike.land/orbit/ws/accounts/health/acc-1",
      },
    );

    expect(sendEmail).toHaveBeenCalledOnce();
    const emailArg = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(emailArg?.to).toBe("admin@example.com");
    expect(emailArg?.subject).toContain("🚨");
    expect(emailArg?.subject).toContain("MyPage");
  });

  it("sends email with warning emoji for UNHEALTHY status", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce(undefined as never);

    await sendHealthAlertEmail(
      { email: "admin@example.com" },
      {
        accountName: "TestAccount",
        platform: "TWITTER",
        healthScore: 30,
        status: "UNHEALTHY",
        issue: "Unhealthy",
        dashboardUrl: "https://spike.land/orbit/ws/accounts/health/acc-1",
      },
    );

    const emailArg = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(emailArg?.subject).toContain("⚠️");
  });

  it("sends email with info emoji for non-critical statuses", async () => {
    vi.mocked(sendEmail).mockResolvedValueOnce(undefined as never);

    await sendHealthAlertEmail(
      { email: "admin@example.com" },
      {
        accountName: "TestAccount",
        platform: "TWITTER",
        healthScore: 60,
        status: "DEGRADED",
        issue: "Degraded",
        dashboardUrl: "https://spike.land/orbit/ws/accounts/health/acc-1",
      },
    );

    const emailArg = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(emailArg?.subject).toContain("ℹ️");
  });

  it("propagates email sending errors", async () => {
    vi.mocked(sendEmail).mockRejectedValueOnce(new Error("SMTP failure"));

    await expect(
      sendHealthAlertEmail(
        { email: "admin@example.com" },
        {
          accountName: "TestAccount",
          platform: "TWITTER",
          healthScore: 10,
          status: "CRITICAL",
          issue: "Critical",
          dashboardUrl: "https://spike.land/",
        },
      ),
    ).rejects.toThrow("SMTP failure");
  });
});

// ---------------------------------------------------------------------------
// sendHealthAlerts
// ---------------------------------------------------------------------------

describe("sendHealthAlerts", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 0 when no accounts have health issues", async () => {
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([]);

    const count = await sendHealthAlerts("ws-1", makeAlertConfig());

    expect(count).toBe(0);
    expect(prisma.workspaceMember.findMany).not.toHaveBeenCalled();
  });

  it("returns 0 when accounts have issues but no admins with email", async () => {
    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 30 });
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health } as never,
    ]);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([
      { role: "ADMIN", user: { email: null, name: null } } as never,
    ]);

    const count = await sendHealthAlerts("ws-1", makeAlertConfig());

    expect(count).toBe(0);
  });

  it("sends one email per account per admin via email channel", async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 30, consecutiveErrors: 0 });
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health } as never,
    ]);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([
      { role: "ADMIN", user: { email: "admin@test.com", name: "Admin" } } as never,
    ]);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      slug: "my-workspace",
    } as never);

    const count = await sendHealthAlerts("ws-1", makeAlertConfig());

    expect(count).toBe(1);
    expect(sendEmail).toHaveBeenCalledOnce();
  });

  it("skips accounts below minSeverity threshold", async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined as never);

    const account = makeSocialAccount();
    // Score 60 → DEGRADED → WARNING severity
    const health = makeHealth({ healthScore: 60 });
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health } as never,
    ]);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([
      { role: "ADMIN", user: { email: "admin@test.com", name: "Admin" } } as never,
    ]);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      slug: "my-workspace",
    } as never);

    // minSeverity = ERROR means WARNING accounts are skipped
    const count = await sendHealthAlerts("ws-1", makeAlertConfig({ minSeverity: "ERROR" }));

    expect(count).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("uses rate-limit issue message when account is rate limited", async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 30, isRateLimited: true });
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health } as never,
    ]);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([
      { role: "ADMIN", user: { email: "admin@test.com", name: null } } as never,
    ]);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      slug: "ws",
    } as never);

    await sendHealthAlerts("ws-1", makeAlertConfig({ minSeverity: "INFO" }));

    const emailArg = vi.mocked(sendEmail).mock.calls[0]?.[0];
    // HealthAlertEmail mock returns props, so we check the react prop
    expect(JSON.stringify(emailArg?.react)).toContain("rate limits");
  });

  it("uses token-refresh issue message when token refresh required", async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined as never);

    const account = makeSocialAccount();
    const health = makeHealth({
      healthScore: 30,
      isRateLimited: false,
      tokenRefreshRequired: true,
    });
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health } as never,
    ]);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([
      { role: "ADMIN", user: { email: "a@b.com", name: null } } as never,
    ]);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      slug: "ws",
    } as never);

    await sendHealthAlerts("ws-1", makeAlertConfig({ minSeverity: "INFO" }));

    const emailArg = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(JSON.stringify(emailArg?.react)).toContain("Token refresh");
  });

  it("creates in-app notification when in_app channel included", async () => {
    vi.mocked(prisma.notification.create).mockResolvedValueOnce({} as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 30 });
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health } as never,
    ]);
    // Must have at least one admin with email to pass the early-return guard
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([
      { role: "ADMIN", user: { email: "admin@test.com", name: "Admin" } } as never,
    ]);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      slug: "ws",
    } as never);

    await sendHealthAlerts(
      "ws-1",
      makeAlertConfig({ notifyChannels: ["in_app"], minSeverity: "INFO" }),
    );

    expect(prisma.notification.create).toHaveBeenCalledOnce();
    const notifArg = vi.mocked(prisma.notification.create).mock.calls[0]?.[0];
    expect(notifArg?.data.type).toBe("HEALTH_ALERT");
    expect(notifArg?.data.workspaceId).toBe("ws-1");
  });

  it("continues without throwing when in-app notification fails", async () => {
    vi.mocked(prisma.notification.create).mockRejectedValueOnce(new Error("Notification DB error"));

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 30 });
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health } as never,
    ]);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([]);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      slug: "ws",
    } as never);

    // Should not throw
    await expect(
      sendHealthAlerts(
        "ws-1",
        makeAlertConfig({ notifyChannels: ["in_app"], minSeverity: "INFO" }),
      ),
    ).resolves.not.toThrow();
  });

  it("skips accounts without health data", async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined as never);

    const account = makeSocialAccount();
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health: null } as never,
    ]);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([
      { role: "ADMIN", user: { email: "admin@test.com", name: "Admin" } } as never,
    ]);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      slug: "ws",
    } as never);

    const count = await sendHealthAlerts("ws-1", makeAlertConfig());

    expect(count).toBe(0);
    expect(sendEmail).not.toHaveBeenCalled();
  });

  it("sends to multiple admins for a single account", async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined as never);

    const account = makeSocialAccount();
    const health = makeHealth({ healthScore: 30 });
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health } as never,
    ]);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([
      { role: "OWNER", user: { email: "owner@test.com", name: "Owner" } } as never,
      { role: "ADMIN", user: { email: "admin@test.com", name: "Admin" } } as never,
    ]);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      slug: "ws",
    } as never);

    const count = await sendHealthAlerts("ws-1", makeAlertConfig());

    expect(count).toBe(2);
    expect(sendEmail).toHaveBeenCalledTimes(2);
  });

  it("uses consecutive errors issue message when >= 3 errors", async () => {
    vi.mocked(sendEmail).mockResolvedValue(undefined as never);

    const account = makeSocialAccount();
    const health = makeHealth({
      healthScore: 30,
      isRateLimited: false,
      tokenRefreshRequired: false,
      consecutiveErrors: 5,
    });
    vi.mocked(prisma.socialAccount.findMany).mockResolvedValueOnce([
      { ...account, health } as never,
    ]);
    vi.mocked(prisma.workspaceMember.findMany).mockResolvedValueOnce([
      { role: "ADMIN", user: { email: "admin@test.com", name: null } } as never,
    ]);
    vi.mocked(prisma.workspace.findUnique).mockResolvedValueOnce({
      slug: "ws",
    } as never);

    await sendHealthAlerts("ws-1", makeAlertConfig({ minSeverity: "INFO" }));

    const emailArg = vi.mocked(sendEmail).mock.calls[0]?.[0];
    expect(JSON.stringify(emailArg?.react)).toContain("consecutive sync errors");
  });
});

// ---------------------------------------------------------------------------
// getRecentHealthEvents
// ---------------------------------------------------------------------------

describe("getRecentHealthEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped events with account info", async () => {
    const now = new Date();
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([
      {
        id: "ev-1",
        accountId: "acc-1",
        workspaceId: "ws-1",
        eventType: "STATUS_CHANGED" as AccountHealthEventType,
        severity: "WARNING" as IssueSeverity,
        message: "Score dropped",
        createdAt: now,
        account: { accountName: "TestUser", platform: "TWITTER" },
      } as never,
    ]);

    const events = await getRecentHealthEvents("ws-1");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "ev-1",
      accountId: "acc-1",
      accountName: "TestUser",
      platform: "TWITTER",
      eventType: "STATUS_CHANGED",
      severity: "WARNING",
      message: "Score dropped",
      createdAt: now,
    });
  });

  it("uses default limit of 20", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getRecentHealthEvents("ws-1");

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    expect(findArg?.take).toBe(20);
  });

  it("respects custom limit parameter", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getRecentHealthEvents("ws-1", 5);

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    expect(findArg?.take).toBe(5);
  });

  it("filters by workspaceId", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getRecentHealthEvents("workspace-xyz");

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    expect(findArg?.where).toEqual({ workspaceId: "workspace-xyz" });
  });

  it("orders events by createdAt descending", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getRecentHealthEvents("ws-1");

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    expect(findArg?.orderBy).toEqual({ createdAt: "desc" });
  });

  it("returns empty array when no events found", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    const events = await getRecentHealthEvents("ws-1");

    expect(events).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// getAccountHealthEvents
// ---------------------------------------------------------------------------

describe("getAccountHealthEvents", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns mapped events for specific account", async () => {
    const now = new Date();
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([
      {
        id: "ev-acc-1",
        eventType: "TOKEN_EXPIRED" as AccountHealthEventType,
        severity: "ERROR" as IssueSeverity,
        previousStatus: "HEALTHY" as AccountHealthStatus,
        newStatus: "UNHEALTHY" as AccountHealthStatus,
        previousScore: 85,
        newScore: 30,
        message: "Token expired",
        createdAt: now,
        resolvedAt: null,
      } as never,
    ]);

    const events = await getAccountHealthEvents("acc-1");

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: "ev-acc-1",
      eventType: "TOKEN_EXPIRED",
      severity: "ERROR",
      previousStatus: "HEALTHY",
      newStatus: "UNHEALTHY",
      previousScore: 85,
      newScore: 30,
      message: "Token expired",
      resolvedAt: null,
    });
  });

  it("uses default limit of 50", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getAccountHealthEvents("acc-1");

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    expect(findArg?.take).toBe(50);
  });

  it("respects custom limit parameter", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getAccountHealthEvents("acc-1", 10);

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    expect(findArg?.take).toBe(10);
  });

  it("filters by accountId", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    await getAccountHealthEvents("specific-account-id");

    const findArg = vi.mocked(prisma.accountHealthEvent.findMany).mock.calls[0]?.[0];
    expect(findArg?.where).toEqual({ accountId: "specific-account-id" });
  });

  it("includes resolvedAt in the returned events", async () => {
    const resolvedDate = new Date("2024-06-01");
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([
      {
        id: "ev-resolved",
        eventType: "ERROR_OCCURRED" as AccountHealthEventType,
        severity: "ERROR" as IssueSeverity,
        previousStatus: null,
        newStatus: "UNHEALTHY" as AccountHealthStatus,
        previousScore: null,
        newScore: 35,
        message: "Error resolved",
        createdAt: new Date(),
        resolvedAt: resolvedDate,
      } as never,
    ]);

    const events = await getAccountHealthEvents("acc-1");

    expect(events[0]?.resolvedAt).toEqual(resolvedDate);
  });

  it("returns empty array when no events found", async () => {
    vi.mocked(prisma.accountHealthEvent.findMany).mockResolvedValueOnce([]);

    const events = await getAccountHealthEvents("acc-1");

    expect(events).toEqual([]);
  });
});
