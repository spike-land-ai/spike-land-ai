import { describe, expect, it, vi } from "vitest";
import { defineDatabase, defineReducer, defineTable, t } from "../schema/index.js";
import type { ReducerContext } from "./reducer-engine.js";
import { executeReducer } from "./reducer-engine.js";
import type { SqlResult, SqlStorage } from "./table-handle.js";

/** Minimal mock SqlStorage for reducer tests. */
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

const itemsTable = defineTable("items", {
  columns: {
    id: t.string(),
    name: t.string(),
    qty: t.u32(),
  },
  primaryKey: "id",
});

describe("executeReducer", () => {
  it("executes reducer that inserts and returns insert mutation", () => {
    const schema = defineDatabase("test", {
      tables: [itemsTable],
      reducers: [
        defineReducer("add_item", (ctx: unknown, id: unknown, name: unknown, qty: unknown) => {
          const c = ctx as ReducerContext;
          c.db.items.insert({ id, name, qty } as Record<string, unknown>);
        }),
      ],
    });

    const sql = new MockSqlStorage();
    const scheduleFn = vi.fn();
    const result = executeReducer(sql, schema, "add_item", ["i1", "Widget", 5], "user1", scheduleFn);

    expect(result.error).toBeUndefined();
    expect(result.mutations).toHaveLength(1);
    expect(result.mutations[0]).toEqual({
      table: "items",
      op: "insert",
      newRow: { id: "i1", name: "Widget", qty: 5 },
    });

    // Transaction was committed
    expect(sql.calls).toContain("BEGIN IMMEDIATE");
    expect(sql.calls).toContain("COMMIT");
    expect(sql.calls).not.toContain("ROLLBACK");
  });

  it("rolls back on reducer error and returns error", () => {
    const schema = defineDatabase("test", {
      tables: [itemsTable],
      reducers: [
        defineReducer("fail_reducer", () => {
          throw new Error("Something went wrong");
        }),
      ],
    });

    const sql = new MockSqlStorage();
    const result = executeReducer(sql, schema, "fail_reducer", [], "user1", vi.fn());

    expect(result.error).toBe("Something went wrong");
    expect(result.mutations).toHaveLength(0);

    expect(sql.calls).toContain("BEGIN IMMEDIATE");
    expect(sql.calls).toContain("ROLLBACK");
    expect(sql.calls).not.toContain("COMMIT");
  });

  it("captures insert + update mutations in a single reducer", () => {
    const schema = defineDatabase("test", {
      tables: [itemsTable],
      reducers: [
        defineReducer("insert_and_update", (ctx: unknown) => {
          const c = ctx as ReducerContext;
          c.db.items.insert({ id: "i1", name: "Widget", qty: 5 } as Record<string, unknown>);
          c.db.items.update("i1", { qty: 10 } as Record<string, unknown>);
        }),
      ],
    });

    const sql = new MockSqlStorage();
    const result = executeReducer(sql, schema, "insert_and_update", [], "user1", vi.fn());

    expect(result.error).toBeUndefined();
    expect(result.mutations).toHaveLength(2);
    expect(result.mutations[0].op).toBe("insert");
    expect(result.mutations[1].op).toBe("update");
    expect((result.mutations[1].oldRow as Record<string, unknown>).qty).toBe(5);
    expect((result.mutations[1].newRow as Record<string, unknown>).qty).toBe(10);
  });

  it("provides correct sender and timestamp in context", () => {
    let capturedSender: string | undefined;
    let capturedTimestamp: number | undefined;

    const schema = defineDatabase("test", {
      tables: [itemsTable],
      reducers: [
        defineReducer("check_ctx", (ctx: unknown) => {
          const c = ctx as ReducerContext;
          capturedSender = c.sender;
          capturedTimestamp = c.timestamp;
        }),
      ],
    });

    const sql = new MockSqlStorage();
    const before = Date.now();
    executeReducer(sql, schema, "check_ctx", [], "alice", vi.fn());
    const after = Date.now();

    expect(capturedSender).toBe("alice");
    expect(capturedTimestamp).toBeGreaterThanOrEqual(before);
    expect(capturedTimestamp).toBeLessThanOrEqual(after);
  });

  it("returns error for unknown reducer", () => {
    const schema = defineDatabase("test", { tables: [itemsTable] });
    const sql = new MockSqlStorage();
    const result = executeReducer(sql, schema, "nonexistent", [], "user1", vi.fn());

    expect(result.error).toBe("Unknown reducer: nonexistent");
    expect(result.mutations).toHaveLength(0);
  });

  it("passes schedule function in context", () => {
    const scheduleFn = vi.fn();

    const schema = defineDatabase("test", {
      tables: [itemsTable],
      reducers: [
        defineReducer("use_schedule", (ctx: unknown) => {
          const c = ctx as ReducerContext;
          c.schedule("cleanup", 5000, ["arg1"]);
        }),
      ],
    });

    const sql = new MockSqlStorage();
    executeReducer(sql, schema, "use_schedule", [], "user1", scheduleFn);

    expect(scheduleFn).toHaveBeenCalledWith("cleanup", 5000, ["arg1"]);
  });
});
