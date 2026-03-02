import type { ZodType } from "zod";

/** Describes a single column's type, including SQL mapping and Zod validation. */
export interface ColumnType {
  kind: string;
  zodSchema: ZodType;
  sqlType: string;
  nullable: boolean;
  inner?: ColumnType;
}

/** Index definition for a table. */
export interface IndexDef {
  name: string;
  columns: string[];
  unique: boolean;
}

/** Full definition of a table: columns, primary key, indexes. */
export interface TableDefinition {
  name: string;
  columns: Record<string, ColumnType>;
  primaryKey: string;
  indexes: IndexDef[];
}

/** Handler type for reducers — accepts unknown args and returns unknown. */
export type ReducerHandler = (...args: unknown[]) => unknown;

/** Definition of a reducer (action/mutation). */
export interface ReducerDefinition {
  name: string;
  handler: ReducerHandler;
}

/** Top-level database schema combining tables and reducers. */
export interface DatabaseSchema {
  name: string;
  tables: Record<string, TableDefinition>;
  reducers: Record<string, ReducerDefinition>;
}

/** Migration operation types. */
export type MigrationKind = "add_table" | "add_column" | "add_index";

/** A single migration step. */
export interface Migration {
  kind: MigrationKind;
  table: string;
  column?: string;
  columnType?: ColumnType;
  index?: IndexDef;
  tableDefinition?: TableDefinition;
}

export const MIGRATION_KINDS: MigrationKind[] = ["add_table", "add_column", "add_index"];
