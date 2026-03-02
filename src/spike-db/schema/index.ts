import { z } from "zod";
import type {
  ColumnType,
  DatabaseSchema,
  IndexDef,
  ReducerDefinition,
  ReducerHandler,
  TableDefinition,
} from "./types.js";

// Re-export all types
export type {
  ColumnType,
  DatabaseSchema,
  IndexDef,
  Migration,
  MigrationKind,
  ReducerDefinition,
  ReducerHandler,
  TableDefinition,
} from "./types.js";

export { generateCreateTable, generateCreateIndexes, generateAllTables } from "./sql-gen.js";
export { diffSchemas, generateMigrationSql } from "./migrations.js";

/**
 * Type builder namespace — mirrors SpacetimeDB's `t.*` pattern.
 * Each builder returns a ColumnType with an embedded Zod schema.
 */
export const t = {
  string(): ColumnType {
    return { kind: "string", zodSchema: z.string(), sqlType: "TEXT", nullable: false };
  },

  u64(): ColumnType {
    return {
      kind: "u64",
      zodSchema: z.union([z.number().int().nonnegative(), z.bigint()]),
      sqlType: "INTEGER",
      nullable: false,
    };
  },

  i64(): ColumnType {
    return {
      kind: "i64",
      zodSchema: z.union([z.number().int(), z.bigint()]),
      sqlType: "INTEGER",
      nullable: false,
    };
  },

  u32(): ColumnType {
    return {
      kind: "u32",
      zodSchema: z.number().int().nonnegative().max(4294967295),
      sqlType: "INTEGER",
      nullable: false,
    };
  },

  identity(): ColumnType {
    return {
      kind: "identity",
      zodSchema: z.string().min(1).max(128),
      sqlType: "TEXT",
      nullable: false,
    };
  },

  bool(): ColumnType {
    return { kind: "bool", zodSchema: z.boolean(), sqlType: "INTEGER", nullable: false };
  },

  array(inner: ColumnType): ColumnType {
    return {
      kind: "array",
      zodSchema: z.array(inner.zodSchema),
      sqlType: "TEXT",
      nullable: false,
      inner,
    };
  },

  option(inner: ColumnType): ColumnType {
    return {
      kind: "option",
      zodSchema: inner.zodSchema.nullable(),
      sqlType: inner.sqlType,
      nullable: true,
      inner,
    };
  },
};

/** Configuration for defineTable. */
interface TableConfig {
  columns: Record<string, ColumnType>;
  primaryKey: string;
  indexes?: IndexDef[];
}

/** Define a table with columns, primary key, and optional indexes. */
export function defineTable(name: string, config: TableConfig): TableDefinition {
  return {
    name,
    columns: config.columns,
    primaryKey: config.primaryKey,
    indexes: config.indexes ?? [],
  };
}

/** Define a reducer (action/mutation handler). */
export function defineReducer(name: string, handler: ReducerHandler): ReducerDefinition {
  return { name, handler };
}

/** Configuration for defineDatabase. */
interface DatabaseConfig {
  tables: TableDefinition[];
  reducers?: ReducerDefinition[];
}

/** Define a database schema combining tables and reducers. */
export function defineDatabase(name: string, config: DatabaseConfig): DatabaseSchema {
  const tables: Record<string, TableDefinition> = {};
  for (const table of config.tables) {
    tables[table.name] = table;
  }

  const reducers: Record<string, ReducerDefinition> = {};
  for (const reducer of config.reducers ?? []) {
    reducers[reducer.name] = reducer;
  }

  return { name, tables, reducers };
}
