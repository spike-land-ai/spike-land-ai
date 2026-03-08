import { describe, expect, it, vi } from "vitest";
import {
  getBalance,
  deductCredit,
  purchaseCredits,
  getUsedToday,
} from "../../../src/edge-api/main/core-logic/credit-service.js";

/**
 * Build a mock D1Database that simulates the credit_balances table.
 */
function _createMockDB(
  options: {
    tier?: string;
    balance?: number;
    lastDailyGrant?: string | null;
    dailyLimit?: number;
  } = {},
) {
  const today = new Date().toISOString().slice(0, 10);
  const tier = options.tier ?? "free";
  const balance = options.balance ?? 0;
  const lastDailyGrant = options.lastDailyGrant !== undefined ? options.lastDailyGrant : today;
  const dailyLimit = options.dailyLimit ?? 50;

  const batchMock = vi.fn().mockResolvedValue([]);
  const runMock = vi.fn().mockResolvedValue({ success: true });

  // We need to handle multiple prepare() calls returning different values
  const _callCount = 0;
  const _firstResponses: Array<unknown> = [
    // resolveEffectiveTier: SELECT grants + SELECT sub
    null, // access_grants
    null, // subscriptions
    { tier }, // not used directly but needed for resolveEffectiveTier flow
    // upsert (run)
    // SELECT credit_balances
    { balance, daily_limit: dailyLimit, last_daily_grant: lastDailyGrant },
  ];

  // tier-service calls DB too — mock conservatively
  const prepareMock = vi.fn().mockImplementation((_sql: string) => {
    return {
      bind: vi.fn().mockReturnThis(),
      run: runMock,
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) {
          return Promise.resolve(null);
        }
        if (_sql.includes("subscriptions")) {
          return Promise.resolve(null);
        }
        if (_sql.includes("credit_balances") && _sql.includes("SELECT balance")) {
          return Promise.resolve({ balance });
        }
        if (_sql.includes("credit_balances")) {
          return Promise.resolve({
            balance,
            daily_limit: dailyLimit,
            last_daily_grant: lastDailyGrant,
          });
        }
        if (_sql.includes("credit_ledger") && _sql.includes("SUM")) {
          return Promise.resolve({ used: 5 });
        }
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    };
  });

  return {
    prepare: prepareMock,
    batch: batchMock,
  } as unknown as D1Database;
}

describe("getBalance", () => {
  it("returns current balance when daily grant already applied today", async () => {
    const today = new Date().toISOString().slice(0, 10);
    // Build a fully explicit DB so we avoid all mock complexity
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      all: vi.fn().mockResolvedValue({ results: [] }),
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) return Promise.resolve(null);
        if (_sql.includes("subscriptions")) return Promise.resolve(null);
        if (_sql.includes("credit_balances")) {
          return Promise.resolve({ balance: 30, daily_limit: 50, last_daily_grant: today });
        }
        return Promise.resolve(null);
      }),
    }));
    const db = {
      prepare: prepareMock,
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const result = await getBalance(db, "user1");
    expect(result.balance).toBe(30);
    expect(result.dailyLimit).toBe(50);
    expect(result.lastDailyGrant).toBe(today);
  });

  it("auto-grants daily credits when last grant was yesterday", async () => {
    const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) return Promise.resolve(null);
        if (_sql.includes("subscriptions")) return Promise.resolve(null);
        if (_sql.includes("credit_balances")) {
          return Promise.resolve({ balance: 0, daily_limit: 50, last_daily_grant: yesterday });
        }
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const result = await getBalance(db, "user2");
    expect(result.balance).toBe(50); // 0 + daily grant of 50
    expect(batchMock).toHaveBeenCalled(); // batch for grant
  });

  it("handles missing credit_balances row gracefully", async () => {
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) return Promise.resolve(null);
        if (_sql.includes("subscriptions")) return Promise.resolve(null);
        if (_sql.includes("credit_balances") && _sql.includes("SELECT")) {
          return Promise.resolve(null); // row not found
        }
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = {
      prepare: prepareMock,
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const result = await getBalance(db, "new-user");
    expect(result.balance).toBe(0);
    expect(result.lastDailyGrant).toBeNull();
  });

  it("updates daily_limit when tier changes", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const runMock = vi.fn().mockResolvedValue({});
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: runMock,
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) return Promise.resolve(null);
        if (_sql.includes("subscriptions"))
          return Promise.resolve({ plan: "pro", status: "active" });
        if (_sql.includes("credit_balances")) {
          return Promise.resolve({ balance: 100, daily_limit: 50, last_daily_grant: today }); // old limit was 50, now should be 500
        }
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = {
      prepare: prepareMock,
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    const result = await getBalance(db, "user-pro");
    // tier is pro => daily_limit should be 500, but stored as 50 => triggers update
    expect(result.dailyLimit).toBe(500);
  });
});

describe("deductCredit", () => {
  it("deducts credits and returns new balance", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) return Promise.resolve(null);
        if (_sql.includes("subscriptions")) return Promise.resolve(null);
        if (_sql.includes("credit_balances")) {
          return Promise.resolve({ balance: 20, daily_limit: 50, last_daily_grant: today });
        }
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const newBalance = await deductCredit(db, "user1", 5, "test usage", "ref-123");
    expect(newBalance).toBe(15);
    expect(batchMock).toHaveBeenCalled();
  });

  it("throws when insufficient credits", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) return Promise.resolve(null);
        if (_sql.includes("subscriptions")) return Promise.resolve(null);
        if (_sql.includes("credit_balances")) {
          return Promise.resolve({ balance: 0, daily_limit: 50, last_daily_grant: today });
        }
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = {
      prepare: prepareMock,
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;
    await expect(deductCredit(db, "user1", 5, "test")).rejects.toThrow("insufficient_credits");
  });

  it("deducts without referenceId", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) return Promise.resolve(null);
        if (_sql.includes("subscriptions")) return Promise.resolve(null);
        if (_sql.includes("credit_balances")) {
          return Promise.resolve({ balance: 10, daily_limit: 50, last_daily_grant: today });
        }
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const newBalance = await deductCredit(db, "user1", 3, "no-ref");
    expect(newBalance).toBe(7);
  });
});

describe("purchaseCredits", () => {
  it("adds credits to existing balance", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const batchMock = vi.fn().mockResolvedValue([]);
    const _selectBalanceCall = false;

    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) return Promise.resolve(null);
        if (_sql.includes("subscriptions")) return Promise.resolve(null);
        if (_sql.includes("credit_balances") && _sql.includes("last_daily_grant")) {
          return Promise.resolve({ balance: 50, daily_limit: 50, last_daily_grant: today });
        }
        if (_sql.includes("SELECT balance FROM credit_balances")) {
          return Promise.resolve({ balance: 50 });
        }
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const newBalance = await purchaseCredits(db, "user1", 100, "stripe-sess-123");
    expect(newBalance).toBe(150);
    expect(batchMock).toHaveBeenCalled();
  });

  it("handles missing balance row (defaults to 0)", async () => {
    const today = new Date().toISOString().slice(0, 10);
    const batchMock = vi.fn().mockResolvedValue([]);
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      run: vi.fn().mockResolvedValue({}),
      first: vi.fn().mockImplementation(() => {
        if (_sql.includes("access_grants")) return Promise.resolve(null);
        if (_sql.includes("subscriptions")) return Promise.resolve(null);
        if (_sql.includes("credit_balances") && _sql.includes("last_daily_grant")) {
          return Promise.resolve({ balance: 0, daily_limit: 50, last_daily_grant: today });
        }
        if (_sql.includes("SELECT balance FROM credit_balances")) {
          return Promise.resolve(null); // no row
        }
        return Promise.resolve(null);
      }),
      all: vi.fn().mockResolvedValue({ results: [] }),
    }));

    const db = { prepare: prepareMock, batch: batchMock } as unknown as D1Database;
    const newBalance = await purchaseCredits(db, "new-user", 200, "stripe-ref");
    expect(newBalance).toBe(200); // 0 + 200
  });
});

describe("getUsedToday", () => {
  it("returns sum of usage for today", async () => {
    const prepareMock = vi.fn().mockImplementation((_sql: string) => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue({ used: 12 }),
    }));

    const db = { prepare: prepareMock } as unknown as D1Database;
    const used = await getUsedToday(db, "user1");
    expect(used).toBe(12);
  });

  it("returns 0 when no usage row", async () => {
    const prepareMock = vi.fn().mockImplementation(() => ({
      bind: vi.fn().mockReturnThis(),
      first: vi.fn().mockResolvedValue(null),
    }));

    const db = { prepare: prepareMock } as unknown as D1Database;
    const used = await getUsedToday(db, "user1");
    expect(used).toBe(0);
  });
});
