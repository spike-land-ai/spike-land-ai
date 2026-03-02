import { describe, expect, it } from "vitest";
import { t, defineTable } from "../schema/index.js";
import type { SqlResult, SqlStorage } from "./table-handle.js";
import { TableHandle } from "./table-handle.js";

/** In-memory mock of SqlStorage that tracks SQL calls and stores rows. */
class MockSqlStorage implements SqlStorage {
  readonly calls: { query: string; params: unknown[] }[] = [];
  private tables = new Map<string, Record<string, unknown>[]>();

  exec(query: string, ...params: unknown[]): SqlResult {
    this.calls.push({ query, params });
    const trimmed = query.trim().toUpperCase();

    if (trimmed.startsWith("INSERT INTO")) {
      return this.handleInsert(query, params);
    }
    if (trimmed.startsWith("SELECT COUNT(")) {
      return this.handleCount(query);
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
    // Match FROM/INTO table_name
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

    // Extract column names from INSERT INTO table (col1, col2, ...) VALUES (?, ?, ...)
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

    if (whereMatch && params.length > 0) {
      const col = whereMatch[1];
      // For SELECT after UPDATE/DELETE the param is the last one after SET params
      const value = params[params.length - 1];
      filtered = rows.filter((r) => r[col] === value);
    }

    const limit = query.match(/LIMIT\s+(\d+)/i);
    if (limit) {
      filtered = filtered.slice(0, Number(limit[1]));
    }

    return {
      toArray: () => filtered.map((r) => ({ ...r })),
      rowsRead: filtered.length,
      rowsWritten: 0,
    };
  }

  private handleCount(query: string): SqlResult {
    const tableName = this.getTableName(query);
    const rows = this.ensureTable(tableName);
    return {
      toArray: () => [{ cnt: rows.length }],
      rowsRead: rows.length,
      rowsWritten: 0,
    };
  }

  private handleUpdate(query: string, params: unknown[]): SqlResult {
    const tableName = query.match(/UPDATE\s+(\w+)/i)?.[1] ?? "";
    const rows = this.ensureTable(tableName);

    // Parse SET col1 = ?, col2 = ? WHERE pk = ?
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
      if (idx >= 0) {
        rows.splice(idx, 1);
        return { toArray: () => [], rowsRead: 0, rowsWritten: 1 };
      }
    }

    return { toArray: () => [], rowsRead: 0, rowsWritten: 0 };
  }
}

const userTable = defineTable("users", {
  columns: {
    id: t.string(),
    name: t.string(),
    age: t.u32(),
    active: t.bool(),
    tags: t.array(t.string()),
    bio: t.option(t.string()),
  },
  primaryKey: "id",
});

type UserRow = {
  id: string;
  name: string;
  age: number;
  active: boolean;
  tags: string[];
  bio: string | null;
};

describe("TableHandle", () => {
  function setup() {
    const sql = new MockSqlStorage();
    const handle = new TableHandle<UserRow>(sql, userTable);
    return { sql, handle };
  }

  it("insert() adds row and records insert mutation", () => {
    const { handle } = setup();
    const row: UserRow = {
      id: "u1",
      name: "Alice",
      age: 30,
      active: true,
      tags: ["admin", "user"],
      bio: null,
    };

    const result = handle.insert(row);

    expect(result).toEqual(row);
    expect(handle.mutations).toHaveLength(1);
    expect(handle.mutations[0]).toEqual({
      table: "users",
      op: "insert",
      newRow: row,
    });
  });

  it("findBy() returns matching row", () => {
    const { handle } = setup();
    const row: UserRow = { id: "u1", name: "Alice", age: 30, active: true, tags: ["a"], bio: "hi" };
    handle.insert(row);

    const found = handle.findBy("id", "u1");
    expect(found).toBeDefined();
    expect(found!.id).toBe("u1");
    expect(found!.name).toBe("Alice");
    // Bool deserialization: stored as 1, read back as true
    expect(found!.active).toBe(true);
    // Array deserialization: stored as JSON string, read back as array
    expect(found!.tags).toEqual(["a"]);
  });

  it("findBy() returns undefined for no match", () => {
    const { handle } = setup();
    const found = handle.findBy("id", "nonexistent");
    expect(found).toBeUndefined();
  });

  it("filterBy() returns all matching rows", () => {
    const { handle } = setup();
    handle.insert({ id: "u1", name: "Alice", age: 30, active: true, tags: [], bio: null });
    handle.insert({ id: "u2", name: "Bob", age: 30, active: false, tags: [], bio: null });

    const results = handle.filterBy("age", 30);
    expect(results).toHaveLength(2);
  });

  it("update() modifies row and records update mutation with old+new", () => {
    const { handle } = setup();
    const original: UserRow = { id: "u1", name: "Alice", age: 30, active: true, tags: [], bio: null };
    handle.insert(original);

    // Clear insert mutation
    handle.mutations.length = 0;

    const updated = handle.update("u1", { name: "Alicia", age: 31 });

    expect(updated).toBeDefined();
    expect(updated!.name).toBe("Alicia");
    expect(updated!.age).toBe(31);
    expect(handle.mutations).toHaveLength(1);
    expect(handle.mutations[0].op).toBe("update");
    expect((handle.mutations[0].oldRow as UserRow).name).toBe("Alice");
    expect((handle.mutations[0].newRow as UserRow).name).toBe("Alicia");
  });

  it("update() returns undefined for missing row", () => {
    const { handle } = setup();
    const result = handle.update("nonexistent", { name: "X" });
    expect(result).toBeUndefined();
    expect(handle.mutations).toHaveLength(0);
  });

  it("delete() removes row and records delete mutation", () => {
    const { handle } = setup();
    handle.insert({ id: "u1", name: "Alice", age: 30, active: true, tags: [], bio: null });
    handle.mutations.length = 0;

    const deleted = handle.delete("u1");

    expect(deleted).toBe(true);
    expect(handle.mutations).toHaveLength(1);
    expect(handle.mutations[0].op).toBe("delete");
    expect((handle.mutations[0].oldRow as UserRow).id).toBe("u1");
  });

  it("delete() returns false for missing row", () => {
    const { handle } = setup();
    const deleted = handle.delete("nonexistent");
    expect(deleted).toBe(false);
    expect(handle.mutations).toHaveLength(0);
  });

  it("iter() returns all rows", () => {
    const { handle } = setup();
    handle.insert({ id: "u1", name: "Alice", age: 30, active: true, tags: [], bio: null });
    handle.insert({ id: "u2", name: "Bob", age: 25, active: false, tags: [], bio: "hey" });

    const all = handle.iter();
    expect(all).toHaveLength(2);
  });

  it("count() returns row count", () => {
    const { handle } = setup();
    expect(handle.count()).toBe(0);

    handle.insert({ id: "u1", name: "Alice", age: 30, active: true, tags: [], bio: null });
    expect(handle.count()).toBe(1);

    handle.insert({ id: "u2", name: "Bob", age: 25, active: true, tags: [], bio: null });
    expect(handle.count()).toBe(2);
  });

  it("serializes booleans as 0/1 and arrays as JSON", () => {
    const { sql, handle } = setup();
    handle.insert({ id: "u1", name: "Alice", age: 30, active: true, tags: ["a", "b"], bio: null });

    // Check INSERT call params
    const insertCall = sql.calls.find((c) => c.query.includes("INSERT"));
    expect(insertCall).toBeDefined();
    const params = insertCall!.params;
    // active should be 1
    expect(params[3]).toBe(1);
    // tags should be JSON string
    expect(params[4]).toBe('["a","b"]');
    // bio (option null) should be null
    expect(params[5]).toBeNull();
  });
});
