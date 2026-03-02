import { describe, expect, it, vi } from "vitest";
import { ensureSchedulerTable, processAlarm, scheduleReducer } from "./scheduler.js";
import { executeReducer } from "./reducer-engine.js";
import { parseClientMessage, serialize } from "../protocol/messages.js";
import { generateIdentity, signToken, verifyToken } from "./identity.js";
import type { DatabaseSchema } from "../schema/types.js";
import type { SqlStorage, SqlResult } from "./table-handle.js";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createMockSql(): SqlStorage & { queries: string[] } {
  const queries: string[] = [];
  const rows: Record<string, unknown>[][] = [];

  return {
    queries,
    exec(query: string, ..._params: unknown[]): SqlResult {
      queries.push(query);
      const resultRows = rows.shift() ?? [];
      return {
        toArray: () => resultRows,
        rowsRead: resultRows.length,
        rowsWritten: 0,
      };
    },
  };
}

function createTestSchema(): DatabaseSchema {
  return {
    name: "test_db",
    tables: {
      users: {
        name: "users",
        columns: {
          id: { kind: "string", zodSchema: {} as never, sqlType: "TEXT", nullable: false },
          name: { kind: "string", zodSchema: {} as never, sqlType: "TEXT", nullable: false },
        },
        primaryKey: "id",
        indexes: [],
      },
    },
    reducers: {
      add_user: {
        name: "add_user",
        handler: (ctx: unknown, id: unknown, name: unknown) => {
          const context = ctx as { db: Record<string, { insert: (row: Record<string, unknown>) => void }> };
          context.db.users.insert({ id, name });
        },
      },
      fail_reducer: {
        name: "fail_reducer",
        handler: () => {
          throw new Error("intentional failure");
        },
      },
    },
  };
}

// ---------------------------------------------------------------------------
// Scheduler tests
// ---------------------------------------------------------------------------

describe("scheduler", () => {
  it("ensureSchedulerTable creates the table", () => {
    const sql = createMockSql();
    ensureSchedulerTable(sql);
    expect(sql.queries).toHaveLength(1);
    expect(sql.queries[0]).toContain("CREATE TABLE IF NOT EXISTS __scheduled_reducers");
  });

  it("scheduleReducer inserts a row and calls setAlarm", () => {
    const sql = createMockSql();
    const setAlarm = vi.fn();
    const now = Date.now();

    const runAt = scheduleReducer(sql, setAlarm, "my_reducer", 5000, ["arg1"]);

    expect(sql.queries).toHaveLength(1);
    expect(sql.queries[0]).toContain("INSERT INTO __scheduled_reducers");
    expect(setAlarm).toHaveBeenCalledOnce();
    expect(runAt).toBeGreaterThanOrEqual(now + 5000);
    expect(runAt).toBeLessThanOrEqual(now + 5100);
  });

  it("processAlarm executes due reducers and deletes them", () => {
    // Create SQL mock that returns scheduled rows on first query, then empty on second
    const queries: string[] = [];
    let callCount = 0;
    const sql: SqlStorage = {
      exec(query: string, ..._params: unknown[]): SqlResult {
        queries.push(query);
        callCount++;
        if (callCount === 1) {
          // SELECT scheduled reducers
          return {
            toArray: () => [{ id: 1, reducer: "test_reducer", args_json: '["hello"]', run_at: Date.now() - 1000 }],
            rowsRead: 1,
            rowsWritten: 0,
          };
        }
        if (query.startsWith("SELECT MIN")) {
          return {
            toArray: () => [{ next_run: null }],
            rowsRead: 1,
            rowsWritten: 0,
          };
        }
        // DELETE and other calls
        return { toArray: () => [], rowsRead: 0, rowsWritten: 0 };
      },
    };

    const schema = createTestSchema();
    const setAlarm = vi.fn();
    const scheduleFn = vi.fn();
    const executor = vi.fn().mockReturnValue({ mutations: [{ table: "users", op: "insert", newRow: { id: "1" } }] });

    const mutations = processAlarm(sql, schema, executor, setAlarm, scheduleFn);

    expect(executor).toHaveBeenCalledOnce();
    expect(executor).toHaveBeenCalledWith(sql, schema, "test_reducer", ["hello"], "__scheduler__", scheduleFn);
    expect(mutations).toHaveLength(1);
    expect(mutations[0].table).toBe("users");
    // Should have tried to delete the completed row
    expect(queries.some((q) => q.startsWith("DELETE"))).toBe(true);
  });

  it("processAlarm sets next alarm when more items remain", () => {
    let callCount = 0;
    const futureTime = Date.now() + 60000;
    const sql: SqlStorage = {
      exec(query: string, ..._params: unknown[]): SqlResult {
        callCount++;
        if (callCount === 1) {
          return { toArray: () => [], rowsRead: 0, rowsWritten: 0 };
        }
        // MIN query returns future time
        return {
          toArray: () => [{ next_run: futureTime }],
          rowsRead: 1,
          rowsWritten: 0,
        };
      },
    };

    const schema = createTestSchema();
    const setAlarm = vi.fn();
    const scheduleFn = vi.fn();

    processAlarm(sql, schema, executeReducer, setAlarm, scheduleFn);

    expect(setAlarm).toHaveBeenCalledWith(futureTime);
  });
});

// ---------------------------------------------------------------------------
// Message routing tests
// ---------------------------------------------------------------------------

describe("message routing", () => {
  it("parses reducer_call message", () => {
    const msg = parseClientMessage({
      type: "reducer_call",
      id: "req-1",
      reducer: "add_user",
      args: ["u1", "Alice"],
    });
    expect(msg.type).toBe("reducer_call");
    if (msg.type === "reducer_call") {
      expect(msg.reducer).toBe("add_user");
      expect(msg.args).toEqual(["u1", "Alice"]);
    }
  });

  it("parses subscribe message", () => {
    const msg = parseClientMessage({
      type: "subscribe",
      id: "sub-1",
      queries: [{ table: "users" }],
    });
    expect(msg.type).toBe("subscribe");
    if (msg.type === "subscribe") {
      expect(msg.queries).toHaveLength(1);
      expect(msg.queries[0].table).toBe("users");
    }
  });

  it("parses unsubscribe message", () => {
    const msg = parseClientMessage({
      type: "unsubscribe",
      subscriptionId: "sub-1",
    });
    expect(msg.type).toBe("unsubscribe");
  });

  it("parses ping message", () => {
    const msg = parseClientMessage({ type: "ping" });
    expect(msg.type).toBe("ping");
  });

  it("rejects invalid message", () => {
    expect(() => parseClientMessage({ type: "invalid" })).toThrow();
  });

  it("serializes server messages correctly", () => {
    const pong = serialize({ type: "pong" });
    expect(JSON.parse(pong)).toEqual({ type: "pong" });

    const result = serialize({
      type: "reducer_result",
      id: "req-1",
      ok: true,
    });
    const parsed = JSON.parse(result);
    expect(parsed.type).toBe("reducer_result");
    expect(parsed.ok).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// Identity flow tests
// ---------------------------------------------------------------------------

describe("identity", () => {
  const SECRET = "test-secret-key-for-hmac";

  it("generateIdentity returns identity and token", async () => {
    const result = await generateIdentity(SECRET);
    expect(result.identity).toHaveLength(64); // 32 bytes hex
    expect(result.token).toContain(".");
    expect(result.token.split(".")).toHaveLength(3);
  });

  it("verifyToken validates a freshly signed token", async () => {
    const { identity, token } = await generateIdentity(SECRET);
    const verified = await verifyToken(token, SECRET);
    expect(verified).toBe(identity);
  });

  it("verifyToken rejects token with wrong secret", async () => {
    const { token } = await generateIdentity(SECRET);
    const verified = await verifyToken(token, "wrong-secret");
    expect(verified).toBeNull();
  });

  it("verifyToken rejects malformed token", async () => {
    expect(await verifyToken("not-a-token", SECRET)).toBeNull();
    expect(await verifyToken("a.b", SECRET)).toBeNull();
    expect(await verifyToken("", SECRET)).toBeNull();
  });

  it("signToken creates a verifiable token for existing identity", async () => {
    const identity = "abcdef1234567890".repeat(4);
    const token = await signToken(identity, SECRET);
    const verified = await verifyToken(token, SECRET);
    expect(verified).toBe(identity);
  });

  it("verifyToken rejects expired token", async () => {
    // Manually create a token with an old timestamp by signing then manipulating
    const identity = "a".repeat(64);
    const oldTimestamp = (Date.now() - 100_000).toString();
    // Sign with the old timestamp by calling signToken which uses Date.now(),
    // then verify with a very short maxAge
    const token = await signToken(identity, SECRET);
    // maxAge of 1ms — by the time we verify, it will have elapsed
    await new Promise((resolve) => setTimeout(resolve, 5));
    const verified = await verifyToken(token, SECRET, 1);
    expect(verified).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// ReducerEngine integration tests (with mock SQL)
// ---------------------------------------------------------------------------

describe("executeReducer", () => {
  it("executes a known reducer and returns mutations", () => {
    let insertCalled = false;
    const schema: DatabaseSchema = {
      name: "test",
      tables: {
        users: {
          name: "users",
          columns: {
            id: { kind: "string", zodSchema: {} as never, sqlType: "TEXT", nullable: false },
            name: { kind: "string", zodSchema: {} as never, sqlType: "TEXT", nullable: false },
          },
          primaryKey: "id",
          indexes: [],
        },
      },
      reducers: {
        noop: { name: "noop", handler: () => { /* no-op */ } },
      },
    };

    // Mock SQL that tracks queries
    const sql = createMockSql();
    const scheduleFn = vi.fn();

    const result = executeReducer(sql, schema, "noop", [], "sender-1", scheduleFn);
    expect(result.error).toBeUndefined();
    expect(result.mutations).toEqual([]);
    // Should have BEGIN + COMMIT
    expect(sql.queries[0]).toBe("BEGIN IMMEDIATE");
    expect(sql.queries[sql.queries.length - 1]).toBe("COMMIT");
  });

  it("returns error for unknown reducer", () => {
    const schema = createTestSchema();
    const sql = createMockSql();
    const scheduleFn = vi.fn();

    const result = executeReducer(sql, schema, "nonexistent", [], "sender", scheduleFn);
    expect(result.error).toBe("Unknown reducer: nonexistent");
    expect(result.mutations).toEqual([]);
  });

  it("rolls back on reducer error", () => {
    const schema = createTestSchema();
    const sql = createMockSql();
    const scheduleFn = vi.fn();

    const result = executeReducer(sql, schema, "fail_reducer", [], "sender", scheduleFn);
    expect(result.error).toBe("intentional failure");
    expect(result.mutations).toEqual([]);
    // Should have BEGIN + ROLLBACK
    expect(sql.queries[0]).toBe("BEGIN IMMEDIATE");
    expect(sql.queries[sql.queries.length - 1]).toBe("ROLLBACK");
  });
});
