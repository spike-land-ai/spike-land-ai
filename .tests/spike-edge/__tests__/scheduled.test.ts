import { describe, expect, it, vi } from "vitest";
import { handleScheduled } from "../../../src/edge-api/main/lazy-imports/scheduled.js";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";

function createDB(overrides: {
  errorCount?: number;
  lastAlert?: { created_at: number } | null;
  firstReturns?: Array<unknown>;
}) {
  const nowSec = Math.floor(Date.now() / 1000);
  const _oneHourAgo = nowSec - 60 * 60;

  let callIndex = 0;
  const responses = [
    { count: overrides.errorCount ?? 0 }, // first SELECT COUNT(*)
    overrides.lastAlert !== undefined ? overrides.lastAlert : null, // second (lastAlert)
  ];

  const firstMock = vi.fn().mockImplementation(() => {
    const val = responses[callIndex] ?? null;
    callIndex++;
    return Promise.resolve(val);
  });

  return {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnThis(),
      first: firstMock,
      run: vi.fn().mockResolvedValue({}),
    }),
    batch: vi.fn().mockResolvedValue([]),
  } as unknown as D1Database;
}

function createEnv(db: D1Database): Env {
  return {
    DB: db,
  } as unknown as Env;
}

describe("handleScheduled", () => {
  it("logs error count when below threshold (no alert sent)", async () => {
    const db = createDB({ errorCount: 10 });
    const env = createEnv(db);
    await expect(handleScheduled(env)).resolves.toBeUndefined();
    // prepare called once for the count query
    expect(db.prepare).toHaveBeenCalledWith(
      expect.stringContaining("SELECT COUNT(*) as count FROM error_logs"),
    );
  });

  it("sends alert when error count exceeds threshold and no recent alert", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const twoHoursAgo = nowSec - 2 * 60 * 60;
    const db = createDB({ errorCount: 51, lastAlert: { created_at: twoHoursAgo } });
    const env = createEnv(db);
    await expect(handleScheduled(env)).resolves.toBeUndefined();
    // Should call prepare multiple times: count query + lastAlert query + insert
    expect(db.prepare).toHaveBeenCalledTimes(3);
  });

  it("does not double-alert when alert was sent within the last hour", async () => {
    const nowSec = Math.floor(Date.now() / 1000);
    const thirtyMinAgo = nowSec - 30 * 60;
    const db = createDB({ errorCount: 100, lastAlert: { created_at: thirtyMinAgo } });
    const env = createEnv(db);
    await expect(handleScheduled(env)).resolves.toBeUndefined();
    // Only count query + lastAlert query — no insert because alert was recent
    expect(db.prepare).toHaveBeenCalledTimes(2);
  });

  it("handles DB error gracefully", async () => {
    const db = {
      prepare: vi.fn().mockReturnValue({
        bind: vi.fn().mockReturnThis(),
        first: vi.fn().mockRejectedValue(new Error("DB down")),
        run: vi.fn().mockResolvedValue({}),
      }),
      batch: vi.fn().mockResolvedValue([]),
    } as unknown as D1Database;

    const env = createEnv(db);
    await expect(handleScheduled(env)).resolves.toBeUndefined();
  });

  it("handles alert exactly at threshold (count === 50, no alert)", async () => {
    const db = createDB({ errorCount: 50 });
    const env = createEnv(db);
    await handleScheduled(env);
    // At exactly 50, threshold not exceeded, no alert
    expect(db.prepare).toHaveBeenCalledTimes(1);
  });
});
