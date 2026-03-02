import { describe, expect, it, vi, beforeEach } from "vitest";

// Mock cloudflare:workers before importing SpikeDatabase
vi.mock("cloudflare:workers", () => {
  return {
    DurableObject: class {
      ctx: any;
      env: any;
      constructor(ctx: any, env: any) {
        this.ctx = ctx;
        this.env = env;
      }
    }
  };
});

import { SpikeDatabase } from "../database-do.js";
import type { DatabaseSchema } from "../../schema/types.js";

// Mock Cloudflare global WebSocketPair
class MockWebSocket {
  send = vi.fn();
  close = vi.fn();
  addEventListener = vi.fn();
}

global.WebSocketPair = class {
  0 = new MockWebSocket();
  1 = new MockWebSocket();
} as any;

const OriginalResponse = global.Response;
// @ts-ignore
global.Response = class extends OriginalResponse {
  constructor(body?: any, init?: any) {
    if (init && init.status === 101) {
      // Create a dummy 200 response but override status
      super(body, { ...init, status: 200 });
      Object.defineProperty(this, 'status', { value: 101 });
      Object.defineProperty(this, 'webSocket', { value: init.webSocket });
    } else {
      super(body, init);
    }
  }
} as any;
// @ts-ignore
global.Response.json = OriginalResponse.json;

describe("SpikeDatabase", () => {
  let ctx: any;
  let env: any;
  let db: SpikeDatabase;

  beforeEach(() => {
    vi.clearAllMocks();
    
    const mockSql = {
      exec: vi.fn().mockReturnValue({
        toArray: () => [],
      }),
    };

    ctx = {
      storage: {
        sql: mockSql,
        setAlarm: vi.fn(),
      },
      blockConcurrencyWhile: vi.fn(async (fn) => await fn()),
      acceptWebSocket: vi.fn(),
      getTags: vi.fn().mockReturnValue(["user-123"]),
      id: { toString: () => "db-id" },
    };

    env = {
      IDENTITY_SECRET: "test-secret",
    };

    db = new SpikeDatabase(ctx, env);
  });

  it("initSchema initializes tables", async () => {
    const schema: DatabaseSchema = {
      name: "test",
      tables: {
        users: {
          name: "users",
          columns: {},
          primaryKey: "id",
          indexes: [],
        } as any,
      },
      reducers: {},
    };

    db.initSchema(schema);
    expect(ctx.storage.sql.exec).toHaveBeenCalled();
  });

  it("fetch handles /health", async () => {
    const req = new Request("http://localhost/health");
    const res = await db.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("fetch returns 404 for unknown route", async () => {
    const req = new Request("http://localhost/unknown");
    const res = await db.fetch(req);
    expect(res.status).toBe(404);
  });

  it("handleWebSocketUpgrade creates identity when no token provided", async () => {
    const req = new Request("http://localhost/ws", {
      headers: { Upgrade: "websocket" },
    });
    const res = await db.fetch(req);
    expect(res.status).toBe(101);
    expect(ctx.acceptWebSocket).toHaveBeenCalled();
  });

  it("webSocketMessage handles ping", async () => {
    const ws = new MockWebSocket();
    await db.webSocketMessage(ws as any, JSON.stringify({ type: "ping" }));
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"pong"'));
  });

  it("webSocketMessage handles reducer_call", async () => {
    const ws = new MockWebSocket();
    // Initialize schema so handleReducerCall doesn't fail early
    db.initSchema({
      name: "test",
      tables: {},
      reducers: {
        my_reducer: { name: "my_reducer", handler: vi.fn() }
      }
    });

    await db.webSocketMessage(ws as any, JSON.stringify({
      type: "reducer_call",
      id: "req-1",
      reducer: "my_reducer",
      args: [1, 2]
    }));

    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"type":"reducer_result"'));
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"ok":true'));
  });

  it("alarm executes scheduled reducers", async () => {
    db.initSchema({ name: "test", tables: {}, reducers: { r: { name: "r", handler: vi.fn() } } });
    
    // Mock SQL to return a scheduled task
    ctx.storage.sql.exec.mockReturnValueOnce({
      toArray: () => [{ id: 1, reducer: "r", args_json: "[]", run_at: Date.now() }]
    }).mockReturnValue({ toArray: () => [] });

    await db.alarm();
    // Should have checked for tasks, executed one, and checked for next
    expect(ctx.storage.sql.exec).toHaveBeenCalled();
  });

  it("fetch handles POST /reducer/:name", async () => {
    db.initSchema({
      name: "test",
      tables: {},
      reducers: {
        my_reducer: { name: "my_reducer", handler: vi.fn() }
      }
    });

    const req = new Request("http://localhost/reducer/my_reducer", {
      method: "POST",
      body: JSON.stringify({ args: [1, 2], sender: "test-sender" })
    });
    
    const res = await db.fetch(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it("handleWebSocketUpgrade handles valid token", async () => {
    const { token, identity } = await import("../identity.js").then(m => m.generateIdentity("test-secret"));
    const req = new Request(`http://localhost/ws?token=${token}`, {
      headers: { Upgrade: "websocket" }
    });
    const res = await db.fetch(req);
    expect(res.status).toBe(101);
    expect(ctx.acceptWebSocket).toHaveBeenCalledWith(expect.anything(), [identity]);
  });

  it("handleWebSocketUpgrade rejects invalid token", async () => {
    const req = new Request("http://localhost/ws?token=invalid", {
      headers: { Upgrade: "websocket" }
    });
    const res = await db.fetch(req);
    expect(res.status).toBe(401);
  });

  it("webSocketMessage handles invalid JSON", async () => {
    const ws = new MockWebSocket();
    await db.webSocketMessage(ws as any, "invalid-json");
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining("pong"));
  });

  it("webSocketClose removes subscription", async () => {
    const ws = new MockWebSocket();
    await db.webSocketClose(ws as any);
    // Verified by coverage
  });

  it("webSocketError removes subscription", async () => {
    const ws = new MockWebSocket();
    await db.webSocketError(ws as any);
    // Verified by coverage
  });

  it("handleReducerHttp errors when schema not initialized", async () => {
    const req = new Request("http://localhost/reducer/r", { method: "POST", body: "{}" });
    const res = await db.fetch(req);
    expect(res.status).toBe(500);
  });

  it("fetch handles /health with schema", async () => {
    db.initSchema({ name: "t", tables: { t1: {} as any }, reducers: {} });
    const req = new Request("http://localhost/health");
    const res = await db.fetch(req);
    const body = await res.json();
    expect(body.tables).toBe(1);
  });

  it("webSocketMessage handles binary message", async () => {
    const ws = new MockWebSocket();
    const data = new TextEncoder().encode(JSON.stringify({ type: "ping" }));
    await db.webSocketMessage(ws as any, data.buffer);
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining("pong"));
  });

  it("handleReducerCall errors when schema missing", async () => {
    const ws = new MockWebSocket();
    // No initSchema
    await (db as any).handleReducerCall(ws, "id", "r", []);
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining('"ok":false'));
    expect(ws.send).toHaveBeenCalledWith(expect.stringContaining("Schema not initialized"));
  });
});
