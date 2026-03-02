import { describe, expect, it } from "vitest";
import { z } from "zod";
import {
  defineDatabase,
  defineReducer,
  defineTable,
  generateAllTables,
  generateCreateIndexes,
  generateCreateTable,
  t,
} from "./index.js";
import { diffSchemas, generateMigrationSql } from "./migrations.js";

describe("type builders (t.*)", () => {
  it("t.string() returns correct ColumnType", () => {
    const col = t.string();
    expect(col.kind).toBe("string");
    expect(col.sqlType).toBe("TEXT");
    expect(col.nullable).toBe(false);
  });

  it("t.u64() returns correct ColumnType", () => {
    const col = t.u64();
    expect(col.kind).toBe("u64");
    expect(col.sqlType).toBe("INTEGER");
    expect(col.nullable).toBe(false);
  });

  it("t.i64() returns correct ColumnType", () => {
    const col = t.i64();
    expect(col.kind).toBe("i64");
    expect(col.sqlType).toBe("INTEGER");
  });

  it("t.u32() returns correct ColumnType", () => {
    const col = t.u32();
    expect(col.kind).toBe("u32");
    expect(col.sqlType).toBe("INTEGER");
  });

  it("t.identity() returns TEXT column", () => {
    const col = t.identity();
    expect(col.kind).toBe("identity");
    expect(col.sqlType).toBe("TEXT");
  });

  it("t.bool() maps to INTEGER", () => {
    const col = t.bool();
    expect(col.kind).toBe("bool");
    expect(col.sqlType).toBe("INTEGER");
  });

  it("t.array(inner) maps to TEXT (JSON-serialized)", () => {
    const col = t.array(t.string());
    expect(col.kind).toBe("array");
    expect(col.sqlType).toBe("TEXT");
    expect(col.inner?.kind).toBe("string");
  });

  it("t.option(inner) makes column nullable", () => {
    const col = t.option(t.string());
    expect(col.kind).toBe("option");
    expect(col.nullable).toBe(true);
    expect(col.inner?.kind).toBe("string");
  });
});

describe("Zod validation", () => {
  it("t.string() validates strings", () => {
    const col = t.string();
    expect(col.zodSchema.safeParse("hello").success).toBe(true);
    expect(col.zodSchema.safeParse(123).success).toBe(false);
  });

  it("t.u64() validates non-negative integers and bigints", () => {
    const col = t.u64();
    expect(col.zodSchema.safeParse(42).success).toBe(true);
    expect(col.zodSchema.safeParse(BigInt(100)).success).toBe(true);
    expect(col.zodSchema.safeParse("not a number").success).toBe(false);
  });

  it("t.bool() validates booleans", () => {
    const col = t.bool();
    expect(col.zodSchema.safeParse(true).success).toBe(true);
    expect(col.zodSchema.safeParse("true").success).toBe(false);
  });

  it("t.array(t.string()) validates string arrays", () => {
    const col = t.array(t.string());
    expect(col.zodSchema.safeParse(["a", "b"]).success).toBe(true);
    expect(col.zodSchema.safeParse([1, 2]).success).toBe(false);
  });

  it("t.option(t.string()) allows null", () => {
    const col = t.option(t.string());
    expect(col.zodSchema.safeParse(null).success).toBe(true);
    expect(col.zodSchema.safeParse("hello").success).toBe(true);
    expect(col.zodSchema.safeParse(123).success).toBe(false);
  });

  it("validates a full row object against table columns", () => {
    const table = defineTable("users", {
      columns: {
        id: t.u64(),
        name: t.string(),
        online: t.bool(),
        bio: t.option(t.string()),
      },
      primaryKey: "id",
    });

    // Build a Zod object schema from the table columns
    const shape: Record<string, z.ZodType> = {};
    for (const [col, def] of Object.entries(table.columns)) {
      shape[col] = def.zodSchema;
    }
    const rowSchema = z.object(shape);

    // Valid row
    const valid = rowSchema.safeParse({ id: 1, name: "Alice", online: true, bio: null });
    expect(valid.success).toBe(true);

    // Invalid row (wrong type for name)
    const invalid = rowSchema.safeParse({ id: 1, name: 42, online: true, bio: null });
    expect(invalid.success).toBe(false);
  });
});

describe("defineTable", () => {
  it("creates a table definition with columns and primary key", () => {
    const table = defineTable("agents", {
      columns: {
        identity: t.identity(),
        displayName: t.string(),
        capabilities: t.array(t.string()),
        online: t.bool(),
        lastSeen: t.u64(),
      },
      primaryKey: "identity",
    });

    expect(table.name).toBe("agents");
    expect(table.primaryKey).toBe("identity");
    expect(Object.keys(table.columns)).toHaveLength(5);
    expect(table.indexes).toEqual([]);
  });

  it("creates a table with indexes", () => {
    const table = defineTable("events", {
      columns: {
        id: t.u64(),
        source: t.string(),
        eventType: t.string(),
        timestamp: t.u64(),
      },
      primaryKey: "id",
      indexes: [
        { name: "idx_events_source", columns: ["source"], unique: false },
        { name: "idx_events_type_time", columns: ["eventType", "timestamp"], unique: false },
      ],
    });

    expect(table.indexes).toHaveLength(2);
    expect(table.indexes[0].name).toBe("idx_events_source");
    expect(table.indexes[1].columns).toEqual(["eventType", "timestamp"]);
  });
});

describe("defineReducer", () => {
  it("creates a reducer definition", () => {
    const handler = (name: unknown) => ({ name });
    const reducer = defineReducer("register_user", handler);
    expect(reducer.name).toBe("register_user");
    expect(reducer.handler).toBe(handler);
  });
});

describe("defineDatabase", () => {
  it("combines tables and reducers into a schema", () => {
    const users = defineTable("users", {
      columns: { id: t.u64(), name: t.string() },
      primaryKey: "id",
    });
    const apps = defineTable("apps", {
      columns: { id: t.u64(), slug: t.string() },
      primaryKey: "id",
    });
    const register = defineReducer("register_user", () => {});

    const db = defineDatabase("platform", {
      tables: [users, apps],
      reducers: [register],
    });

    expect(db.name).toBe("platform");
    expect(Object.keys(db.tables)).toEqual(["users", "apps"]);
    expect(Object.keys(db.reducers)).toEqual(["register_user"]);
    expect(db.tables["users"]).toBe(users);
    expect(db.reducers["register_user"]).toBe(register);
  });

  it("handles empty reducers", () => {
    const db = defineDatabase("empty", {
      tables: [],
    });
    expect(db.name).toBe("empty");
    expect(Object.keys(db.tables)).toHaveLength(0);
    expect(Object.keys(db.reducers)).toHaveLength(0);
  });
});

describe("SQL generation", () => {
  it("generates CREATE TABLE with all column types", () => {
    const table = defineTable("full_test", {
      columns: {
        id: t.u64(),
        name: t.string(),
        identity: t.identity(),
        active: t.bool(),
        score: t.i64(),
        rank: t.u32(),
        tags: t.array(t.string()),
        bio: t.option(t.string()),
      },
      primaryKey: "id",
    });

    const sql = generateCreateTable(table);
    expect(sql).toContain("CREATE TABLE IF NOT EXISTS full_test");
    expect(sql).toContain("id INTEGER PRIMARY KEY");
    expect(sql).toContain("name TEXT NOT NULL");
    expect(sql).toContain("identity TEXT NOT NULL");
    expect(sql).toContain("active INTEGER NOT NULL");
    expect(sql).toContain("score INTEGER NOT NULL");
    expect(sql).toContain("rank INTEGER NOT NULL");
    expect(sql).toContain("tags TEXT NOT NULL");
    // bio is option → should NOT have NOT NULL
    expect(sql).not.toContain("bio TEXT NOT NULL");
    expect(sql).toContain("bio TEXT");
  });

  it("generates CREATE INDEX statements", () => {
    const table = defineTable("events", {
      columns: {
        id: t.u64(),
        source: t.string(),
        eventType: t.string(),
      },
      primaryKey: "id",
      indexes: [
        { name: "idx_source", columns: ["source"], unique: false },
        { name: "idx_type_unique", columns: ["eventType"], unique: true },
      ],
    });

    const indexes = generateCreateIndexes(table);
    expect(indexes).toHaveLength(2);
    expect(indexes[0]).toBe("CREATE INDEX IF NOT EXISTS idx_source ON events (source);");
    expect(indexes[1]).toBe(
      "CREATE UNIQUE INDEX IF NOT EXISTS idx_type_unique ON events (eventType);"
    );
  });

  it("generates all DDL for a database schema", () => {
    const users = defineTable("users", {
      columns: { id: t.u64(), name: t.string() },
      primaryKey: "id",
      indexes: [{ name: "idx_users_name", columns: ["name"], unique: true }],
    });
    const apps = defineTable("apps", {
      columns: { id: t.u64(), slug: t.string() },
      primaryKey: "id",
    });

    const db = defineDatabase("platform", { tables: [users, apps] });
    const ddl = generateAllTables(db);

    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(ddl).toContain("CREATE TABLE IF NOT EXISTS apps");
    expect(ddl).toContain("CREATE UNIQUE INDEX IF NOT EXISTS idx_users_name ON users (name);");
  });
});

describe("schema diffing and migrations", () => {
  it("detects add_table migration", () => {
    const oldDb = defineDatabase("v1", { tables: [] });
    const newTable = defineTable("users", {
      columns: { id: t.u64(), name: t.string() },
      primaryKey: "id",
    });
    const newDb = defineDatabase("v2", { tables: [newTable] });

    const migrations = diffSchemas(oldDb, newDb);
    expect(migrations).toHaveLength(1);
    expect(migrations[0].kind).toBe("add_table");
    expect(migrations[0].table).toBe("users");
    expect(migrations[0].tableDefinition).toBe(newTable);
  });

  it("detects add_column migration", () => {
    const oldTable = defineTable("users", {
      columns: { id: t.u64(), name: t.string() },
      primaryKey: "id",
    });
    const newTable = defineTable("users", {
      columns: { id: t.u64(), name: t.string(), email: t.string() },
      primaryKey: "id",
    });

    const oldDb = defineDatabase("v1", { tables: [oldTable] });
    const newDb = defineDatabase("v2", { tables: [newTable] });

    const migrations = diffSchemas(oldDb, newDb);
    expect(migrations).toHaveLength(1);
    expect(migrations[0].kind).toBe("add_column");
    expect(migrations[0].table).toBe("users");
    expect(migrations[0].column).toBe("email");
  });

  it("detects add_index migration", () => {
    const oldTable = defineTable("users", {
      columns: { id: t.u64(), name: t.string() },
      primaryKey: "id",
    });
    const newTable = defineTable("users", {
      columns: { id: t.u64(), name: t.string() },
      primaryKey: "id",
      indexes: [{ name: "idx_name", columns: ["name"], unique: true }],
    });

    const oldDb = defineDatabase("v1", { tables: [oldTable] });
    const newDb = defineDatabase("v2", { tables: [newTable] });

    const migrations = diffSchemas(oldDb, newDb);
    expect(migrations).toHaveLength(1);
    expect(migrations[0].kind).toBe("add_index");
    expect(migrations[0].index?.name).toBe("idx_name");
  });

  it("generates migration SQL for add_table", () => {
    const table = defineTable("users", {
      columns: { id: t.u64(), name: t.string() },
      primaryKey: "id",
    });
    const oldDb = defineDatabase("v1", { tables: [] });
    const newDb = defineDatabase("v2", { tables: [table] });

    const migrations = diffSchemas(oldDb, newDb);
    const sql = generateMigrationSql(migrations);
    expect(sql).toHaveLength(1);
    expect(sql[0]).toContain("CREATE TABLE IF NOT EXISTS users");
    expect(sql[0]).toContain("id INTEGER PRIMARY KEY");
    expect(sql[0]).toContain("name TEXT NOT NULL");
  });

  it("generates migration SQL for add_column", () => {
    const oldTable = defineTable("users", {
      columns: { id: t.u64() },
      primaryKey: "id",
    });
    const newTable = defineTable("users", {
      columns: { id: t.u64(), bio: t.option(t.string()) },
      primaryKey: "id",
    });

    const oldDb = defineDatabase("v1", { tables: [oldTable] });
    const newDb = defineDatabase("v2", { tables: [newTable] });

    const migrations = diffSchemas(oldDb, newDb);
    const sql = generateMigrationSql(migrations);
    expect(sql).toHaveLength(1);
    expect(sql[0]).toBe("ALTER TABLE users ADD COLUMN bio TEXT;");
  });

  it("generates migration SQL for add_index", () => {
    const oldTable = defineTable("users", {
      columns: { id: t.u64(), name: t.string() },
      primaryKey: "id",
    });
    const newTable = defineTable("users", {
      columns: { id: t.u64(), name: t.string() },
      primaryKey: "id",
      indexes: [{ name: "idx_name", columns: ["name"], unique: false }],
    });

    const oldDb = defineDatabase("v1", { tables: [oldTable] });
    const newDb = defineDatabase("v2", { tables: [newTable] });

    const migrations = diffSchemas(oldDb, newDb);
    const sql = generateMigrationSql(migrations);
    expect(sql).toHaveLength(1);
    expect(sql[0]).toBe("CREATE INDEX IF NOT EXISTS idx_name ON users (name);");
  });
});
