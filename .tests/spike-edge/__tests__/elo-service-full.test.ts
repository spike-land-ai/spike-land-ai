import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  ensureUserElo,
  getUserElo,
  recordEloEvent,
  clearEloCache,
  grantBugBounty,
} from "../../../src/edge-api/main/core-logic/elo-service.js";

function buildDB(
  overrides: { existingRow?: Record<string, unknown> | null; batchResult?: unknown[] } = {},
) {
  const runMock = vi.fn().mockResolvedValue({});
  const batchMock = vi.fn().mockResolvedValue(overrides.batchResult ?? []);

  const prepareMock = vi.fn().mockImplementation((sql: string) => ({
    bind: vi.fn().mockReturnThis(),
    run: runMock,
    first: vi.fn().mockImplementation(() => {
      if (sql.includes("user_elo")) {
        return Promise.resolve(overrides.existingRow ?? null);
      }
      return Promise.resolve(null);
    }),
    all: vi.fn().mockResolvedValue({ results: [] }),
  }));

  return { prepare: prepareMock, batch: batchMock, runMock };
}

describe("ensureUserElo", () => {
  beforeEach(() => {
    clearEloCache();
  });

  it("returns existing user row from DB", async () => {
    const existingRow = {
      user_id: "user1",
      elo: 1300,
      event_count: 5,
      daily_gains: 20,
      daily_reset_at: Date.now(),
      tier: "pro",
    };

    const { prepare, batch } = buildDB({ existingRow });
    const db = { prepare, batch } as unknown as D1Database;

    const result = await ensureUserElo(db, "user1");
    expect(result.userId).toBe("user1");
    expect(result.elo).toBe(1300);
    expect(result.tier).toBe("pro");
  });

  it("creates new user with default ELO when no row exists", async () => {
    const { prepare, batch } = buildDB({ existingRow: null });
    const db = { prepare, batch } as unknown as D1Database;

    const result = await ensureUserElo(db, "new-user");
    expect(result.userId).toBe("new-user");
    expect(result.elo).toBe(1200);
    expect(result.tier).toBe("pro"); // 1200 is in pro range
    expect(result.eventCount).toBe(0);
  });

  it("returns cached result on second call", async () => {
    const existingRow = {
      user_id: "user-cache",
      elo: 1400,
      event_count: 3,
      daily_gains: 10,
      daily_reset_at: Date.now(),
      tier: "business",
    };

    const { prepare, batch } = buildDB({ existingRow });
    const db = { prepare, batch } as unknown as D1Database;

    const first = await ensureUserElo(db, "user-cache");
    const second = await ensureUserElo(db, "user-cache");
    expect(first.elo).toBe(second.elo);
    // prepare should only be called once (second call is cached)
    expect(prepare).toHaveBeenCalledTimes(1);
  });
});

describe("getUserElo", () => {
  beforeEach(() => {
    clearEloCache();
  });

  it("returns null when user has no ELO record", async () => {
    const { prepare, batch } = buildDB({ existingRow: null });
    const db = { prepare, batch } as unknown as D1Database;
    const result = await getUserElo(db, "unknown-user");
    expect(result).toBeNull();
  });

  it("returns user ELO when found", async () => {
    const existingRow = {
      user_id: "user2",
      elo: 1100,
      event_count: 2,
      daily_gains: 5,
      daily_reset_at: Date.now(),
      tier: "free",
    };

    const { prepare, batch } = buildDB({ existingRow });
    const db = { prepare, batch } as unknown as D1Database;

    const result = await getUserElo(db, "user2");
    expect(result).not.toBeNull();
    expect(result!.elo).toBe(1100);
    expect(result!.tier).toBe("free");
  });

  it("uses cache when available", async () => {
    const existingRow = {
      user_id: "user-cached",
      elo: 1250,
      event_count: 1,
      daily_gains: 0,
      daily_reset_at: Date.now(),
      tier: "pro",
    };

    const { prepare, batch } = buildDB({ existingRow });
    const db = { prepare, batch } as unknown as D1Database;

    // Populate cache via ensureUserElo
    await ensureUserElo(db, "user-cached");
    const prepareCalls = (prepare as ReturnType<typeof vi.fn>).mock.calls.length;

    // getUserElo should hit cache
    const result = await getUserElo(db, "user-cached");
    expect(result!.elo).toBe(1250);
    expect((prepare as ReturnType<typeof vi.fn>).mock.calls.length).toBe(prepareCalls);
  });
});

describe("recordEloEvent", () => {
  beforeEach(() => {
    clearEloCache();
  });

  it("records a positive ELO event and updates tier", async () => {
    const now = Date.now();
    const existingRow = {
      user_id: "user3",
      elo: 1200,
      event_count: 0,
      daily_gains: 0,
      daily_reset_at: now,
      tier: "pro",
    };

    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue(existingRow),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const result = await recordEloEvent(db, "user3", "report_valid_bug", "bug-123");

    expect(result.delta).toBe(25);
    expect(result.newElo).toBe(1225);
    expect(result.capped).toBe(false);
    expect(batchMock).toHaveBeenCalled();
  });

  it("caps daily gains at 100", async () => {
    const now = Date.now();
    const existingRow = {
      user_id: "user4",
      elo: 1200,
      event_count: 5,
      daily_gains: 95, // only 5 more allowed
      daily_reset_at: now,
      tier: "pro",
    };

    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue(existingRow),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const result = await recordEloEvent(db, "user4", "report_valid_bug"); // delta=25, but only 5 allowed

    expect(result.delta).toBe(5);
    expect(result.capped).toBe(true);
  });

  it("returns zero delta when daily cap fully exhausted", async () => {
    const now = Date.now();
    const existingRow = {
      user_id: "user5",
      elo: 1200,
      event_count: 10,
      daily_gains: 100, // cap already hit
      daily_reset_at: now,
      tier: "pro",
    };

    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue(existingRow),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const result = await recordEloEvent(db, "user5", "successful_tool_use"); // delta=1

    expect(result.delta).toBe(0);
    expect(result.capped).toBe(true);
    expect(result.newElo).toBe(1200); // unchanged
    // batch should NOT be called since no update needed
    expect(batchMock).not.toHaveBeenCalled();
  });

  it("applies negative ELO without daily cap", async () => {
    const now = Date.now();
    const existingRow = {
      user_id: "user6",
      elo: 1200,
      event_count: 0,
      daily_gains: 0,
      daily_reset_at: now,
      tier: "pro",
    };

    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue(existingRow),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const result = await recordEloEvent(db, "user6", "abuse_flag");

    expect(result.delta).toBe(-50);
    expect(result.capped).toBe(false);
    expect(result.newElo).toBeLessThan(1200);
  });

  it("resets daily gains on new day", async () => {
    // Set daily_reset_at to yesterday
    const yesterday = Date.now() - 25 * 60 * 60 * 1000;
    const existingRow = {
      user_id: "user7",
      elo: 1200,
      event_count: 5,
      daily_gains: 80, // high gains from yesterday
      daily_reset_at: yesterday,
      tier: "pro",
    };

    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockResolvedValue(existingRow),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const result = await recordEloEvent(db, "user7", "report_valid_bug");

    // Daily reset means daily_gains starts at 0, so full 25 delta applies
    expect(result.delta).toBe(25);
    expect(result.capped).toBe(false);
  });
});

describe("grantBugBounty", () => {
  beforeEach(() => {
    clearEloCache();
  });

  it("inserts access_grant and records bug_bounty_granted ELO event", async () => {
    const now = Date.now();
    const existingRow = {
      user_id: "user-bounty",
      elo: 1200,
      event_count: 0,
      daily_gains: 0,
      daily_reset_at: now,
      tier: "pro",
    };

    const runMock = vi.fn().mockResolvedValue({});
    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: runMock,
      first: vi.fn().mockResolvedValue(_sql.includes("user_elo") ? existingRow : null),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    await grantBugBounty(db, "user-bounty", "bug-789");

    // Should call INSERT INTO access_grants
    const insertCalls = (prepareMock as ReturnType<typeof vi.fn>).mock.calls.filter(
      (args: unknown[]) =>
        typeof args[0] === "string" && (args[0] as string).includes("access_grants"),
    );
    expect(insertCalls.length).toBeGreaterThan(0);
    // Should call batch for ELO event
    expect(batchMock).toHaveBeenCalled();
  });
});
