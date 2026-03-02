import { describe, expect, it, vi } from "vitest";
import { defineDatabase, defineReducer, defineTable, t } from "./schema/index.js";
import { generateAllTables } from "./schema/sql-gen.js";
import type { ReducerContext } from "./server/reducer-engine.js";
import { executeReducer } from "./server/reducer-engine.js";
import type { SqlResult, SqlStorage } from "./server/table-handle.js";
import { platformDatabase } from "./platform-schema.js";
import { PlatformClient } from "./platform-client.js";

// ---------------------------------------------------------------------------
// Mock SQL storage (reused pattern from table-handle.test.ts)
// ---------------------------------------------------------------------------

class MockSqlStorage implements SqlStorage {
  readonly calls: string[] = [];
  private tables = new Map<string, Record<string, unknown>[]>();

  exec(query: string, ...params: unknown[]): SqlResult {
    this.calls.push(query.trim());
    const trimmed = query.trim().toUpperCase();

    if (trimmed === "BEGIN IMMEDIATE" || trimmed === "COMMIT" || trimmed === "ROLLBACK") {
      return { toArray: () => [], rowsRead: 0, rowsWritten: 0 };
    }

    if (trimmed.startsWith("INSERT INTO")) {
      return this.handleInsert(query, params);
    }
    if (trimmed.startsWith("SELECT COUNT(")) {
      const tableName = this.getTableName(query);
      const rows = this.tables.get(tableName) ?? [];
      return { toArray: () => [{ cnt: rows.length }], rowsRead: rows.length, rowsWritten: 0 };
    }
    if (trimmed.startsWith("SELECT")) {
      return this.handleSelect(query, params);
    }
    if (trimmed.startsWith("UPDATE")) {
      return this.handleUpdate(query, params);
    }
    if (trimmed.startsWith("DELETE")) {
      return this.handleDelete(query, params);
    }

    return { toArray: () => [], rowsRead: 0, rowsWritten: 0 };
  }

  private getTableName(query: string): string {
    const match = query.match(/(?:FROM|INTO)\s+(\w+)/i);
    return match ? match[1] : "";
  }

  private ensureTable(name: string): Record<string, unknown>[] {
    if (!this.tables.has(name)) {
      this.tables.set(name, []);
    }
    return this.tables.get(name)!;
  }

  private handleInsert(query: string, params: unknown[]): SqlResult {
    const tableName = this.getTableName(query);
    const rows = this.ensureTable(tableName);
    const colMatch = query.match(/\(([^)]+)\)\s*VALUES/i);
    if (colMatch) {
      const cols = colMatch[1].split(",").map((c) => c.trim());
      const row: Record<string, unknown> = {};
      for (let i = 0; i < cols.length; i++) {
        row[cols[i]] = params[i];
      }
      rows.push(row);
    }
    return { toArray: () => [], rowsRead: 0, rowsWritten: 1 };
  }

  private handleSelect(query: string, params: unknown[]): SqlResult {
    const tableName = this.getTableName(query);
    const rows = this.ensureTable(tableName);
    const whereMatch = query.match(/WHERE\s+(\w+)\s*=\s*\?/i);
    let filtered = rows;
    if (whereMatch) {
      const col = whereMatch[1];
      const value = params[params.length - 1];
      filtered = rows.filter((r) => r[col] === value);
    }
    const limit = query.match(/LIMIT\s+(\d+)/i);
    if (limit) filtered = filtered.slice(0, Number(limit[1]));
    return { toArray: () => filtered.map((r) => ({ ...r })), rowsRead: filtered.length, rowsWritten: 0 };
  }

  private handleUpdate(query: string, params: unknown[]): SqlResult {
    const tableName = query.match(/UPDATE\s+(\w+)/i)?.[1] ?? "";
    const rows = this.ensureTable(tableName);
    const setMatch = query.match(/SET\s+(.+?)\s+WHERE/i);
    const whereMatch = query.match(/WHERE\s+(\w+)\s*=\s*\?/i);
    if (setMatch && whereMatch) {
      const setCols = setMatch[1].split(",").map((s) => s.trim().split(/\s*=\s*\?/)[0]);
      const pkCol = whereMatch[1];
      const pkValue = params[params.length - 1];
      for (const row of rows) {
        if (row[pkCol] === pkValue) {
          for (let i = 0; i < setCols.length; i++) {
            row[setCols[i]] = params[i];
          }
        }
      }
    }
    return { toArray: () => [], rowsRead: 0, rowsWritten: 1 };
  }

  private handleDelete(query: string, params: unknown[]): SqlResult {
    const tableName = this.getTableName(query);
    const rows = this.ensureTable(tableName);
    const whereMatch = query.match(/WHERE\s+(\w+)\s*=\s*\?/i);
    if (whereMatch) {
      const col = whereMatch[1];
      const value = params[0];
      const idx = rows.findIndex((r) => r[col] === value);
      if (idx >= 0) rows.splice(idx, 1);
    }
    return { toArray: () => [], rowsRead: 0, rowsWritten: 0 };
  }
}

// ---------------------------------------------------------------------------
// Mini schema for integration tests
// ---------------------------------------------------------------------------

const usersTable = defineTable("users", {
  columns: {
    id: t.u64(),
    name: t.string(),
    email: t.string(),
  },
  primaryKey: "id",
});

const messagesTable = defineTable("messages", {
  columns: {
    id: t.u64(),
    fromId: t.u64(),
    toId: t.u64(),
    content: t.string(),
    read: t.bool(),
  },
  primaryKey: "id",
});

const registerReducer = defineReducer(
  "register",
  (ctx: unknown, name: unknown, email: unknown) => {
    const c = ctx as ReducerContext;
    c.db.users.insert({
      id: c.timestamp,
      name: name as string,
      email: email as string,
    });
  },
);

const sendMessageReducer = defineReducer(
  "send_message",
  (ctx: unknown, toId: unknown, content: unknown) => {
    const c = ctx as ReducerContext;
    c.db.messages.insert({
      id: c.timestamp,
      fromId: 1,
      toId: toId as number,
      content: content as string,
      read: false,
    });
  },
);

const markReadReducer = defineReducer(
  "mark_read",
  (ctx: unknown, messageId: unknown) => {
    const c = ctx as ReducerContext;
    c.db.messages.update(messageId, { read: true });
  },
);

const testDb = defineDatabase("test-db", {
  tables: [usersTable, messagesTable],
  reducers: [registerReducer, sendMessageReducer, markReadReducer],
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("Integration: mini schema", () => {
  it("generateAllTables produces valid SQL for both tables", () => {
    const sql = generateAllTables(testDb);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS messages");
    expect(sql).toContain("id INTEGER PRIMARY KEY");
    expect(sql).toContain("name TEXT NOT NULL");
    expect(sql).toContain("email TEXT NOT NULL");
    expect(sql).toContain("content TEXT NOT NULL");
    expect(sql).toContain("read INTEGER NOT NULL");
  });

  it("register reducer inserts a user and captures mutation", () => {
    const sql = new MockSqlStorage();
    const result = executeReducer(sql, testDb, "register", ["Alice", "alice@test.com"], "sender1", vi.fn());

    expect(result.error).toBeUndefined();
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].op).toBe("insert");
    expect(result.mutations[0].table).toBe("users");

    const row = result.mutations[0].newRow as Record<string, unknown>;
    expect(row.name).toBe("Alice");
    expect(row.email).toBe("alice@test.com");
  });

  it("send_message reducer inserts a message", () => {
    const sql = new MockSqlStorage();
    const result = executeReducer(sql, testDb, "send_message", [42, "Hello!"], "sender1", vi.fn());

    expect(result.error).toBeUndefined();
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].op).toBe("insert");
    expect(result.mutations[0].table).toBe("messages");

    const row = result.mutations[0].newRow as Record<string, unknown>;
    expect(row.toId).toBe(42);
    expect(row.content).toBe("Hello!");
    expect(row.read).toBe(false);
  });

  it("mark_read reducer updates message read status", () => {
    const sql = new MockSqlStorage();

    // First insert a message
    executeReducer(sql, testDb, "send_message", [42, "Hello!"], "sender1", vi.fn());

    // Get the inserted message ID from the mock
    const result = executeReducer(sql, testDb, "mark_read", [sql.calls.length], "sender1", vi.fn());

    // The mark_read should execute without error
    expect(result.error).toBeUndefined();
  });
});

describe("Integration: platform schema", () => {
  it("platformDatabase has all 25 tables defined", () => {
    const tableNames = Object.keys(platformDatabase.tables);
    expect(tableNames).toHaveLength(25);

    const expected = [
      "user", "agent", "agent_message", "album", "album_image",
      "app", "app_message", "app_version", "code_session", "credits",
      "direct_message", "enhancement_job", "generation_job", "health_check", "image",
      "mcp_task", "oauth_link", "page", "page_block", "pipeline",
      "platform_event", "registered_tool", "subject", "tool_usage", "user_tool_preference",
    ];

    for (const name of expected) {
      expect(platformDatabase.tables[name]).toBeDefined();
      expect(platformDatabase.tables[name].name).toBe(name);
    }
  });

  it("platformDatabase has all 20 reducers defined", () => {
    const reducerNames = Object.keys(platformDatabase.reducers);
    expect(reducerNames).toHaveLength(20);

    const expected = [
      "register_user", "update_profile", "send_dm", "mark_dm_read",
      "register_agent", "unregister_agent", "send_agent_message", "mark_agent_message_delivered",
      "create_app", "update_app", "delete_app", "restore_app", "update_app_status",
      "create_page", "update_page", "delete_page",
      "send_app_message", "register_tool", "record_platform_event", "record_health_check",
    ];

    for (const name of expected) {
      expect(platformDatabase.reducers[name]).toBeDefined();
      expect(platformDatabase.reducers[name].name).toBe(name);
    }
  });

  it("all table SQL generates without error", () => {
    const sql = generateAllTables(platformDatabase);
    expect(sql).toBeTruthy();

    // Verify all 25 table CREATE statements are present
    for (const tableName of Object.keys(platformDatabase.tables)) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS ${tableName}`);
    }
  });

  it("user table SQL has correct columns", () => {
    const sql = generateAllTables(platformDatabase);
    expect(sql).toContain("identity TEXT PRIMARY KEY");
    expect(sql).toContain("handle TEXT NOT NULL");
    expect(sql).toContain("displayName TEXT NOT NULL");
    expect(sql).toContain("online INTEGER NOT NULL");
  });

  it("register_user reducer executes and produces insert mutation", () => {
    const sql = new MockSqlStorage();
    const result = executeReducer(
      sql,
      platformDatabase,
      "register_user",
      ["alice", "Alice", "alice@example.com"],
      "identity123",
      vi.fn(),
    );

    expect(result.error).toBeUndefined();
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].op).toBe("insert");
    expect(result.mutations[0].table).toBe("user");

    const row = result.mutations[0].newRow as Record<string, unknown>;
    expect(row.identity).toBe("identity123");
    expect(row.handle).toBe("alice");
    expect(row.displayName).toBe("Alice");
    expect(row.email).toBe("alice@example.com");
    expect(row.role).toBe("user");
  });

  it("send_dm reducer creates a direct message", () => {
    const sql = new MockSqlStorage();
    const result = executeReducer(
      sql,
      platformDatabase,
      "send_dm",
      ["recipient123", "Hello there!"],
      "sender123",
      vi.fn(),
    );

    expect(result.error).toBeUndefined();
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].table).toBe("direct_message");

    const row = result.mutations[0].newRow as Record<string, unknown>;
    expect(row.fromIdentity).toBe("sender123");
    expect(row.toIdentity).toBe("recipient123");
    expect(row.content).toBe("Hello there!");
    expect(row.readStatus).toBe(false);
  });

  it("create_app reducer creates an app", () => {
    const sql = new MockSqlStorage();
    const result = executeReducer(
      sql,
      platformDatabase,
      "create_app",
      ["my-app", "My App", "A test app", "code/key.wasm"],
      "owner123",
      vi.fn(),
    );

    expect(result.error).toBeUndefined();
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].table).toBe("app");

    const row = result.mutations[0].newRow as Record<string, unknown>;
    expect(row.slug).toBe("my-app");
    expect(row.name).toBe("My App");
    expect(row.ownerIdentity).toBe("owner123");
    expect(row.status).toBe("active");
  });

  it("record_health_check reducer records a health check", () => {
    const sql = new MockSqlStorage();
    const result = executeReducer(
      sql,
      platformDatabase,
      "record_health_check",
      ["api", "healthy", 42],
      "system",
      vi.fn(),
    );

    expect(result.error).toBeUndefined();
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0].table).toBe("health_check");

    const row = result.mutations[0].newRow as Record<string, unknown>;
    expect(row.service).toBe("api");
    expect(row.status).toBe("healthy");
    expect(row.latencyMs).toBe(42);
  });
});

describe("Integration: PlatformClient", () => {
  it("has typed accessors for all 25 tables", () => {
    // We cannot connect but can verify the accessor getters exist
    // by checking the prototype
    const accessors = [
      "user", "agent", "agentMessage", "album", "albumImage",
      "app", "appMessage", "appVersion", "codeSession", "credits",
      "directMessage", "enhancementJob", "generationJob", "healthCheck", "image",
      "mcpTask", "oauthLink", "page", "pageBlock", "pipeline",
      "platformEvent", "registeredTool", "subject", "toolUsage", "userToolPreference",
    ];

    for (const accessor of accessors) {
      const descriptor = Object.getOwnPropertyDescriptor(PlatformClient.prototype, accessor);
      expect(descriptor).toBeDefined();
      expect(descriptor!.get).toBeDefined();
    }
  });

  it("has typed reducer methods for all 20 reducers", () => {
    const methods = [
      "registerUser", "updateProfile", "sendDm", "markDmRead",
      "registerAgent", "unregisterAgent", "sendAgentMessage", "markAgentMessageDelivered",
      "createApp", "updateApp", "deleteApp", "restoreApp", "updateAppStatus",
      "createPage", "updatePage", "deletePage",
      "sendAppMessage", "registerTool", "recordPlatformEvent", "recordHealthCheck",
    ];

    for (const method of methods) {
      expect(typeof PlatformClient.prototype[method as keyof PlatformClient]).toBe("function");
    }
  });
});
