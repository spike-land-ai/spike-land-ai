import { describe, expect, it } from "vitest";
import type { Delta } from "../protocol/messages";
import { SubscriptionManager } from "./subscription-engine";

class MockWebSocket {
  sent: string[] = [];
  readyState = 1; // WebSocket.OPEN
  send(data: string) {
    if (this.readyState !== 1) throw new Error("WebSocket is closed");
    this.sent.push(data);
  }
  close() {
    this.readyState = 3;
  }
}

function mockSqlExec(data: Record<string, unknown[]>) {
  return (query: string, ..._params: unknown[]): unknown[] => {
    for (const table of Object.keys(data)) {
      if (query.includes(table)) {
        // If there's a WHERE clause with filters, apply them
        if (query.includes("WHERE")) {
          return data[table];
        }
        return data[table];
      }
    }
    return [];
  };
}

function parse(json: string): Record<string, unknown> {
  return JSON.parse(json) as Record<string, unknown>;
}

describe("SubscriptionManager", () => {
  it("subscribe sends initial_snapshot with existing rows", () => {
    const mgr = new SubscriptionManager();
    const ws = new MockWebSocket() as unknown as WebSocket;
    const rows = [{ id: 1, name: "Alice" }, { id: 2, name: "Bob" }];

    mgr.subscribe(ws, "sub-1", [{ table: "users" }], mockSqlExec({ users: rows }));

    expect((ws as unknown as MockWebSocket).sent).toHaveLength(1);
    const msg = parse((ws as unknown as MockWebSocket).sent[0]);
    expect(msg.type).toBe("initial_snapshot");
    expect(msg.subscriptionId).toBe("sub-1");
    expect((msg.tables as Record<string, unknown[]>).users).toEqual(rows);
  });

  it("subscribe with filter sends only matching rows in initial_snapshot", () => {
    const mgr = new SubscriptionManager();
    const ws = new MockWebSocket() as unknown as WebSocket;
    const filteredRows = [{ id: 1, role: "admin" }];

    mgr.subscribe(
      ws,
      "sub-2",
      [{ table: "users", filter: { role: "admin" } }],
      mockSqlExec({ users: filteredRows }),
    );

    expect((ws as unknown as MockWebSocket).sent).toHaveLength(1);
    const msg = parse((ws as unknown as MockWebSocket).sent[0]);
    expect(msg.type).toBe("initial_snapshot");
    expect((msg.tables as Record<string, unknown[]>).users).toEqual(filteredRows);
  });

  it("broadcastDeltas sends transaction_update to matching subscriber", () => {
    const mgr = new SubscriptionManager();
    const ws = new MockWebSocket() as unknown as WebSocket;

    mgr.subscribe(ws, "sub-1", [{ table: "users" }], mockSqlExec({ users: [] }));

    const deltas: Delta[] = [
      { table: "users", op: "insert", newRow: { id: 3, name: "Charlie" } },
    ];
    mgr.broadcastDeltas(deltas, "caller-1", "createUser");

    expect((ws as unknown as MockWebSocket).sent).toHaveLength(2); // snapshot + update
    const msg = parse((ws as unknown as MockWebSocket).sent[1]);
    expect(msg.type).toBe("transaction_update");
    expect(msg.reducerName).toBe("createUser");
    expect(msg.callerIdentity).toBe("caller-1");
    expect((msg.deltas as Delta[])).toHaveLength(1);
    expect((msg.deltas as Delta[])[0].table).toBe("users");
  });

  it("broadcastDeltas skips subscriber when filter does not match", () => {
    const mgr = new SubscriptionManager();
    const ws = new MockWebSocket() as unknown as WebSocket;

    mgr.subscribe(
      ws,
      "sub-1",
      [{ table: "users", filter: { role: "admin" } }],
      mockSqlExec({ users: [] }),
    );

    const deltas: Delta[] = [
      { table: "users", op: "insert", newRow: { id: 1, role: "viewer" } },
    ];
    mgr.broadcastDeltas(deltas, "caller-1", "createUser");

    // Only initial snapshot, no transaction_update
    expect((ws as unknown as MockWebSocket).sent).toHaveLength(1);
  });

  it("broadcastDeltas delivers to matching subscribers only", () => {
    const mgr = new SubscriptionManager();
    const ws1 = new MockWebSocket() as unknown as WebSocket;
    const ws2 = new MockWebSocket() as unknown as WebSocket;
    const exec = mockSqlExec({ users: [], posts: [] });

    mgr.subscribe(ws1, "sub-users", [{ table: "users" }], exec);
    mgr.subscribe(ws2, "sub-posts", [{ table: "posts" }], exec);

    const deltas: Delta[] = [
      { table: "users", op: "insert", newRow: { id: 1 } },
    ];
    mgr.broadcastDeltas(deltas, "caller-1", "createUser");

    // ws1 gets snapshot + update, ws2 gets snapshot only
    expect((ws1 as unknown as MockWebSocket).sent).toHaveLength(2);
    expect((ws2 as unknown as MockWebSocket).sent).toHaveLength(1);
  });

  it("unsubscribe stops delta delivery", () => {
    const mgr = new SubscriptionManager();
    const ws = new MockWebSocket() as unknown as WebSocket;

    mgr.subscribe(ws, "sub-1", [{ table: "users" }], mockSqlExec({ users: [] }));
    mgr.unsubscribe("sub-1");

    const deltas: Delta[] = [
      { table: "users", op: "insert", newRow: { id: 1 } },
    ];
    mgr.broadcastDeltas(deltas, "caller-1", "createUser");

    // Only initial snapshot, no update after unsubscribe
    expect((ws as unknown as MockWebSocket).sent).toHaveLength(1);
    expect(mgr.getSubscriptionCount()).toBe(0);
  });

  it("removeBySocket removes all subscriptions for a WebSocket", () => {
    const mgr = new SubscriptionManager();
    const ws = new MockWebSocket() as unknown as WebSocket;
    const exec = mockSqlExec({ users: [], posts: [] });

    mgr.subscribe(ws, "sub-1", [{ table: "users" }], exec);
    mgr.subscribe(ws, "sub-2", [{ table: "posts" }], exec);
    expect(mgr.getSubscriptionCount()).toBe(2);

    mgr.removeBySocket(ws);
    expect(mgr.getSubscriptionCount()).toBe(0);

    // No deltas delivered
    const deltas: Delta[] = [
      { table: "users", op: "insert", newRow: { id: 1 } },
    ];
    mgr.broadcastDeltas(deltas, "caller-1", "createUser");

    // Only the 2 initial snapshots, nothing more
    expect((ws as unknown as MockWebSocket).sent).toHaveLength(2);
  });

  it("closed WebSocket causes silent failure and subscription cleanup", () => {
    const mgr = new SubscriptionManager();
    const ws = new MockWebSocket() as unknown as WebSocket;

    mgr.subscribe(ws, "sub-1", [{ table: "users" }], mockSqlExec({ users: [] }));
    expect(mgr.getSubscriptionCount()).toBe(1);

    // Close the WebSocket
    (ws as unknown as MockWebSocket).close();

    const deltas: Delta[] = [
      { table: "users", op: "insert", newRow: { id: 1 } },
    ];
    mgr.broadcastDeltas(deltas, "caller-1", "createUser");

    // Subscription should be cleaned up after failed send
    expect(mgr.getSubscriptionCount()).toBe(0);
  });

  it("delete delta matches subscription via oldRow", () => {
    const mgr = new SubscriptionManager();
    const ws = new MockWebSocket() as unknown as WebSocket;

    mgr.subscribe(
      ws,
      "sub-1",
      [{ table: "users", filter: { role: "admin" } }],
      mockSqlExec({ users: [] }),
    );

    const deltas: Delta[] = [
      { table: "users", op: "delete", oldRow: { id: 1, role: "admin" } },
    ];
    mgr.broadcastDeltas(deltas, "caller-1", "deleteUser");

    // snapshot + transaction_update (matched via oldRow)
    expect((ws as unknown as MockWebSocket).sent).toHaveLength(2);
    const msg = parse((ws as unknown as MockWebSocket).sent[1]);
    expect(msg.type).toBe("transaction_update");
  });

  it("getSubscriptionCount returns correct count", () => {
    const mgr = new SubscriptionManager();
    expect(mgr.getSubscriptionCount()).toBe(0);

    const ws = new MockWebSocket() as unknown as WebSocket;
    const exec = mockSqlExec({ users: [] });

    mgr.subscribe(ws, "sub-1", [{ table: "users" }], exec);
    expect(mgr.getSubscriptionCount()).toBe(1);

    mgr.subscribe(ws, "sub-2", [{ table: "users" }], exec);
    expect(mgr.getSubscriptionCount()).toBe(2);

    mgr.unsubscribe("sub-1");
    expect(mgr.getSubscriptionCount()).toBe(1);
  });
});
