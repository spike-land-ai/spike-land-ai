import { describe, expect, it } from "vitest";
import { ZodError } from "zod";
import {
  type ClientMessage,
  DeltaSchema,
  type ServerMessage,
  parseClientMessage,
  parseServerMessage,
  serialize,
} from "./messages.js";

// ---------------------------------------------------------------------------
// Client → Server round-trip tests
// ---------------------------------------------------------------------------

describe("ClientMessage round-trip", () => {
  const clientCases: Array<{ name: string; msg: ClientMessage }> = [
    {
      name: "reducer_call",
      msg: {
        type: "reducer_call",
        id: "r1",
        reducer: "addUser",
        args: ["alice", 42],
      },
    },
    {
      name: "subscribe",
      msg: {
        type: "subscribe",
        id: "s1",
        queries: [
          { table: "users" },
          { table: "posts", filter: { authorId: "u1" } },
        ],
      },
    },
    {
      name: "unsubscribe",
      msg: { type: "unsubscribe", subscriptionId: "sub-123" },
    },
    {
      name: "ping",
      msg: { type: "ping" },
    },
  ];

  for (const { name, msg } of clientCases) {
    it(`round-trips ${name}`, () => {
      const json = serialize(msg);
      const parsed = parseClientMessage(JSON.parse(json));
      expect(parsed).toEqual(msg);
    });
  }
});

// ---------------------------------------------------------------------------
// Server → Client round-trip tests
// ---------------------------------------------------------------------------

describe("ServerMessage round-trip", () => {
  const serverCases: Array<{ name: string; msg: ServerMessage }> = [
    {
      name: "connected",
      msg: {
        type: "connected",
        identity: "id-abc",
        dbIdentity: "db-xyz",
      },
    },
    {
      name: "initial_snapshot",
      msg: {
        type: "initial_snapshot",
        subscriptionId: "sub-1",
        tables: {
          users: [{ id: 1, name: "alice" }],
          posts: [],
        },
      },
    },
    {
      name: "transaction_update (committed)",
      msg: {
        type: "transaction_update",
        reducerName: "addUser",
        callerIdentity: "caller-1",
        status: "committed",
        deltas: [
          { table: "users", op: "insert", newRow: { id: 1, name: "bob" } },
        ],
      },
    },
    {
      name: "transaction_update (failed)",
      msg: {
        type: "transaction_update",
        reducerName: "deleteUser",
        callerIdentity: "caller-2",
        status: "failed",
        error: "user not found",
        deltas: [],
      },
    },
    {
      name: "reducer_result (ok)",
      msg: { type: "reducer_result", id: "r1", ok: true },
    },
    {
      name: "reducer_result (error)",
      msg: {
        type: "reducer_result",
        id: "r2",
        ok: false,
        error: "constraint violation",
      },
    },
    {
      name: "pong",
      msg: { type: "pong" },
    },
  ];

  for (const { name, msg } of serverCases) {
    it(`round-trips ${name}`, () => {
      const json = serialize(msg);
      const parsed = parseServerMessage(JSON.parse(json));
      expect(parsed).toEqual(msg);
    });
  }
});

// ---------------------------------------------------------------------------
// Malformed client messages
// ---------------------------------------------------------------------------

describe("parseClientMessage rejects malformed input", () => {
  it("rejects unknown type", () => {
    expect(() => parseClientMessage({ type: "unknown_type" })).toThrow(
      ZodError,
    );
  });

  it("rejects reducer_call missing reducer field", () => {
    expect(() =>
      parseClientMessage({ type: "reducer_call", id: "r1", args: [] }),
    ).toThrow(ZodError);
  });

  it("rejects reducer_call with non-array args", () => {
    expect(() =>
      parseClientMessage({
        type: "reducer_call",
        id: "r1",
        reducer: "foo",
        args: "not-array",
      }),
    ).toThrow(ZodError);
  });

  it("rejects subscribe missing queries", () => {
    expect(() =>
      parseClientMessage({ type: "subscribe", id: "s1" }),
    ).toThrow(ZodError);
  });

  it("rejects unsubscribe missing subscriptionId", () => {
    expect(() => parseClientMessage({ type: "unsubscribe" })).toThrow(
      ZodError,
    );
  });

  it("rejects null input", () => {
    expect(() => parseClientMessage(null)).toThrow(ZodError);
  });

  it("rejects string input", () => {
    expect(() => parseClientMessage("ping")).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// Malformed server messages
// ---------------------------------------------------------------------------

describe("parseServerMessage rejects malformed input", () => {
  it("rejects unknown type", () => {
    expect(() => parseServerMessage({ type: "bad_type" })).toThrow(ZodError);
  });

  it("rejects connected missing identity", () => {
    expect(() =>
      parseServerMessage({ type: "connected", dbIdentity: "db" }),
    ).toThrow(ZodError);
  });

  it("rejects initial_snapshot missing tables", () => {
    expect(() =>
      parseServerMessage({
        type: "initial_snapshot",
        subscriptionId: "s1",
      }),
    ).toThrow(ZodError);
  });

  it("rejects transaction_update with invalid status", () => {
    expect(() =>
      parseServerMessage({
        type: "transaction_update",
        reducerName: "foo",
        callerIdentity: "c1",
        status: "maybe",
        deltas: [],
      }),
    ).toThrow(ZodError);
  });

  it("rejects reducer_result missing ok field", () => {
    expect(() =>
      parseServerMessage({ type: "reducer_result", id: "r1" }),
    ).toThrow(ZodError);
  });
});

// ---------------------------------------------------------------------------
// Delta validation
// ---------------------------------------------------------------------------

describe("DeltaSchema", () => {
  it("accepts insert delta", () => {
    const result = DeltaSchema.parse({
      table: "users",
      op: "insert",
      newRow: { id: 1 },
    });
    expect(result.op).toBe("insert");
    expect(result.oldRow).toBeUndefined();
  });

  it("accepts update delta", () => {
    const result = DeltaSchema.parse({
      table: "users",
      op: "update",
      oldRow: { id: 1, name: "old" },
      newRow: { id: 1, name: "new" },
    });
    expect(result.op).toBe("update");
  });

  it("accepts delete delta", () => {
    const result = DeltaSchema.parse({
      table: "users",
      op: "delete",
      oldRow: { id: 1 },
    });
    expect(result.op).toBe("delete");
    expect(result.newRow).toBeUndefined();
  });

  it("rejects invalid op", () => {
    expect(() =>
      DeltaSchema.parse({ table: "users", op: "upsert" }),
    ).toThrow(ZodError);
  });

  it("rejects missing table", () => {
    expect(() => DeltaSchema.parse({ op: "insert" })).toThrow(ZodError);
  });
});
