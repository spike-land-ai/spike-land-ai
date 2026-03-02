import { describe, it, expect, vi } from "vitest";
import type { Delta } from "../protocol/messages.js";
import { TableCache, ClientTable } from "./cache.js";
import { SubscriptionBuilder } from "./subscription.js";

// ---------------------------------------------------------------------------
// Mock WebSocket & Connection for testing
// ---------------------------------------------------------------------------

class MockConnection {
  sent: string[] = [];
  connected = false;

  get isConnected(): boolean {
    return this.connected;
  }

  send(data: string): void {
    this.sent.push(data);
  }

  connect(): void {
    this.connected = true;
  }

  disconnect(): void {
    this.connected = false;
  }
}

// ---------------------------------------------------------------------------
// TableCache tests
// ---------------------------------------------------------------------------

describe("TableCache", () => {
  function makeCache(): TableCache {
    const cache = new TableCache();
    cache.registerTable("users", "id");
    return cache;
  }

  it("applySnapshot populates rows and getRows returns them", () => {
    const cache = makeCache();
    cache.applySnapshot("users", [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);
    const rows = cache.getRows("users");
    expect(rows).toHaveLength(2);
    expect(rows).toEqual(
      expect.arrayContaining([
        { id: "1", name: "Alice" },
        { id: "2", name: "Bob" },
      ]),
    );
  });

  it("applyDelta insert adds a row", () => {
    const cache = makeCache();
    cache.applyDelta({
      table: "users",
      op: "insert",
      newRow: { id: "1", name: "Alice" },
    });
    expect(cache.getRows("users")).toEqual([{ id: "1", name: "Alice" }]);
  });

  it("applyDelta update modifies existing row", () => {
    const cache = makeCache();
    cache.applySnapshot("users", [{ id: "1", name: "Alice" }]);
    cache.applyDelta({
      table: "users",
      op: "update",
      oldRow: { id: "1", name: "Alice" },
      newRow: { id: "1", name: "Alice Updated" },
    });
    expect(cache.getRows("users")).toEqual([
      { id: "1", name: "Alice Updated" },
    ]);
  });

  it("applyDelta delete removes a row", () => {
    const cache = makeCache();
    cache.applySnapshot("users", [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);
    cache.applyDelta({
      table: "users",
      op: "delete",
      oldRow: { id: "1", name: "Alice" },
    });
    expect(cache.getRows("users")).toEqual([{ id: "2", name: "Bob" }]);
  });

  it("onChange fires when delta is applied", () => {
    const cache = makeCache();
    const handler = vi.fn();
    cache.onChange("users", handler);

    const delta: Delta = {
      table: "users",
      op: "insert",
      newRow: { id: "1", name: "Alice" },
    };
    cache.applyDelta(delta);

    expect(handler).toHaveBeenCalledOnce();
    expect(handler).toHaveBeenCalledWith(delta);
  });

  it("onChange unsubscribe stops notifications", () => {
    const cache = makeCache();
    const handler = vi.fn();
    const unsub = cache.onChange("users", handler);

    cache.applyDelta({
      table: "users",
      op: "insert",
      newRow: { id: "1", name: "Alice" },
    });
    expect(handler).toHaveBeenCalledOnce();

    unsub();
    cache.applyDelta({
      table: "users",
      op: "insert",
      newRow: { id: "2", name: "Bob" },
    });
    expect(handler).toHaveBeenCalledOnce(); // not called again
  });

  it("findBy returns matching row", () => {
    const cache = makeCache();
    cache.applySnapshot("users", [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);
    expect(cache.findBy("users", "name", "Bob")).toEqual({
      id: "2",
      name: "Bob",
    });
  });

  it("findBy returns undefined for no match", () => {
    const cache = makeCache();
    cache.applySnapshot("users", [{ id: "1", name: "Alice" }]);
    expect(cache.findBy("users", "name", "Charlie")).toBeUndefined();
  });

  it("filterBy returns all matching rows", () => {
    const cache = makeCache();
    cache.applySnapshot("users", [
      { id: "1", name: "Alice", role: "admin" },
      { id: "2", name: "Bob", role: "user" },
      { id: "3", name: "Charlie", role: "admin" },
    ]);
    const admins = cache.filterBy("users", "role", "admin");
    expect(admins).toHaveLength(2);
    expect(admins.map((r) => r["name"])).toEqual(
      expect.arrayContaining(["Alice", "Charlie"]),
    );
  });

  it("count returns number of rows", () => {
    const cache = makeCache();
    expect(cache.count("users")).toBe(0);
    cache.applySnapshot("users", [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);
    expect(cache.count("users")).toBe(2);
  });

  it("getRows returns empty array for unregistered table", () => {
    const cache = new TableCache();
    expect(cache.getRows("nonexistent")).toEqual([]);
  });

  it("applySnapshot replaces previous data", () => {
    const cache = makeCache();
    cache.applySnapshot("users", [{ id: "1", name: "Alice" }]);
    cache.applySnapshot("users", [{ id: "2", name: "Bob" }]);
    expect(cache.getRows("users")).toEqual([{ id: "2", name: "Bob" }]);
  });
});

// ---------------------------------------------------------------------------
// ClientTable tests
// ---------------------------------------------------------------------------

describe("ClientTable", () => {
  it("iter returns typed rows", () => {
    const cache = new TableCache();
    cache.registerTable("users", "id");
    cache.applySnapshot("users", [{ id: "1", name: "Alice" }]);

    interface User {
      id: string;
      name: string;
    }
    const table = new ClientTable<User>(cache, "users");
    const rows = table.iter();
    expect(rows).toHaveLength(1);
    expect(rows[0].name).toBe("Alice");
  });

  it("findBy returns typed result", () => {
    const cache = new TableCache();
    cache.registerTable("users", "id");
    cache.applySnapshot("users", [{ id: "1", name: "Alice" }]);

    interface User {
      id: string;
      name: string;
    }
    const table = new ClientTable<User>(cache, "users");
    const user = table.findBy("id", "1");
    expect(user?.name).toBe("Alice");
  });

  it("filterBy returns typed results", () => {
    const cache = new TableCache();
    cache.registerTable("users", "id");
    cache.applySnapshot("users", [
      { id: "1", name: "Alice", role: "admin" },
      { id: "2", name: "Bob", role: "user" },
    ]);

    interface User {
      id: string;
      name: string;
      role: string;
    }
    const table = new ClientTable<User>(cache, "users");
    expect(table.filterBy("role", "admin")).toHaveLength(1);
  });

  it("count delegates to cache", () => {
    const cache = new TableCache();
    cache.registerTable("users", "id");
    cache.applySnapshot("users", [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);

    const table = new ClientTable<Record<string, unknown>>(cache, "users");
    expect(table.count()).toBe(2);
  });

  it("onChange fires on delta", () => {
    const cache = new TableCache();
    cache.registerTable("users", "id");

    const table = new ClientTable<Record<string, unknown>>(cache, "users");
    const handler = vi.fn();
    table.onChange(handler);

    cache.applyDelta({
      table: "users",
      op: "insert",
      newRow: { id: "1", name: "Alice" },
    });
    expect(handler).toHaveBeenCalledOnce();
  });
});

// ---------------------------------------------------------------------------
// SubscriptionBuilder tests
// ---------------------------------------------------------------------------

describe("SubscriptionBuilder", () => {
  it("onApplied callback fires when _notifyApplied is called", () => {
    const conn = new MockConnection() as unknown as import("./connection.js").Connection;
    const builder = new SubscriptionBuilder(
      [{ table: "users" }],
      "sub-1",
      conn,
    );

    const handler = vi.fn();
    builder.onApplied(handler);

    expect(handler).not.toHaveBeenCalled();
    builder._notifyApplied();
    expect(handler).toHaveBeenCalledOnce();
  });

  it("onError callback fires when _notifyError is called", () => {
    const conn = new MockConnection() as unknown as import("./connection.js").Connection;
    const builder = new SubscriptionBuilder(
      [{ table: "users" }],
      "sub-1",
      conn,
    );

    const handler = vi.fn();
    builder.onError(handler);

    const err = new Error("subscription failed");
    builder._notifyError(err);
    expect(handler).toHaveBeenCalledWith(err);
  });

  it("subscribe sends subscribe message via connection", () => {
    const conn = new MockConnection();
    const builder = new SubscriptionBuilder(
      [{ table: "users" }],
      "sub-1",
      conn as unknown as import("./connection.js").Connection,
    );

    builder.subscribe();

    expect(conn.sent).toHaveLength(1);
    const parsed = JSON.parse(conn.sent[0]) as Record<string, unknown>;
    expect(parsed["type"]).toBe("subscribe");
    expect(parsed["id"]).toBe("sub-1");
  });

  it("unsubscribe sends unsubscribe message", () => {
    const conn = new MockConnection();
    const builder = new SubscriptionBuilder(
      [{ table: "users" }],
      "sub-1",
      conn as unknown as import("./connection.js").Connection,
    );

    const handle = builder.subscribe();
    handle.unsubscribe();

    expect(conn.sent).toHaveLength(2);
    const parsed = JSON.parse(conn.sent[1]) as Record<string, unknown>;
    expect(parsed["type"]).toBe("unsubscribe");
    expect(parsed["subscriptionId"]).toBe("sub-1");
  });
});

// ---------------------------------------------------------------------------
// SpikeDbClient integration test (with mock connection)
// ---------------------------------------------------------------------------

describe("SpikeDbClient message handling", () => {
  // We test the message handling logic by importing and using the client
  // with a controlled handleMessage flow via the cache + internal wiring.
  // Since Connection requires real WebSocket, we test the cache-based flow.

  it("full flow: snapshot → delta → query", () => {
    const cache = new TableCache();
    cache.registerTable("users", "id");

    // Simulate initial snapshot
    cache.applySnapshot("users", [
      { id: "1", name: "Alice" },
      { id: "2", name: "Bob" },
    ]);

    // Simulate transaction update with insert
    const handler = vi.fn();
    cache.onChange("users", handler);

    cache.applyDelta({
      table: "users",
      op: "insert",
      newRow: { id: "3", name: "Charlie" },
    });

    expect(handler).toHaveBeenCalledOnce();
    expect(cache.count("users")).toBe(3);

    // Simulate update
    cache.applyDelta({
      table: "users",
      op: "update",
      oldRow: { id: "1", name: "Alice" },
      newRow: { id: "1", name: "Alice v2" },
    });

    expect(cache.findBy("users", "id", "1")).toEqual({
      id: "1",
      name: "Alice v2",
    });

    // Simulate delete
    cache.applyDelta({
      table: "users",
      op: "delete",
      oldRow: { id: "2", name: "Bob" },
    });

    expect(cache.count("users")).toBe(2);
    expect(cache.findBy("users", "id", "2")).toBeUndefined();
  });
});
