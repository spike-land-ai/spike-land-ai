import type { Delta } from "../protocol/messages.js";
import type { ColumnType, TableDefinition } from "../schema/types.js";

/** SqlStorage interface matching Cloudflare DO's sql property. */
export interface SqlStorage {
  exec(query: string, ...params: unknown[]): SqlResult;
}

export interface SqlResult {
  toArray(): Record<string, unknown>[];
  rowsRead: number;
  rowsWritten: number;
}

/** Serialize a JS value to SQLite-compatible storage format. */
function serializeValue(value: unknown, col: ColumnType): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (col.kind === "array") {
    return JSON.stringify(value);
  }
  if (col.kind === "bool") {
    return value ? 1 : 0;
  }
  if (col.kind === "option" && col.inner) {
    return serializeValue(value, col.inner);
  }
  return value;
}

/** Deserialize a SQLite value back to a JS value. */
function deserializeValue(value: unknown, col: ColumnType): unknown {
  if (value === null || value === undefined) {
    return null;
  }
  if (col.kind === "array") {
    return typeof value === "string" ? JSON.parse(value) as unknown : value;
  }
  if (col.kind === "bool") {
    return value === 1 || value === true;
  }
  if (col.kind === "option" && col.inner) {
    return deserializeValue(value, col.inner);
  }
  return value;
}

/** Deserialize an entire row from SQLite format to JS objects. */
function deserializeRow<T extends Record<string, unknown>>(
  raw: Record<string, unknown>,
  columns: Record<string, ColumnType>,
): T {
  const result: Record<string, unknown> = {};
  for (const [name, col] of Object.entries(columns)) {
    result[name] = deserializeValue(raw[name], col);
  }
  return result as T;
}

/**
 * TableHandle provides typed CRUD access to a single SQLite table,
 * tracking all mutations as Delta objects for broadcast.
 */
export class TableHandle<T extends Record<string, unknown>> {
  readonly mutations: Delta[] = [];

  constructor(
    private sql: SqlStorage,
    private tableDef: TableDefinition,
  ) {}

  /** Insert a row, record mutation, return the row. */
  insert(row: T): T {
    const colNames = Object.keys(this.tableDef.columns);
    const values = colNames.map((name) =>
      serializeValue(row[name], this.tableDef.columns[name]),
    );
    const placeholders = colNames.map(() => "?").join(", ");

    this.sql.exec(
      `INSERT INTO ${this.tableDef.name} (${colNames.join(", ")}) VALUES (${placeholders})`,
      ...values,
    );

    this.mutations.push({
      table: this.tableDef.name,
      op: "insert",
      newRow: { ...row },
    });

    return row;
  }

  /** Find a single row matching column = value. */
  findBy(column: string, value: unknown): T | undefined {
    const col = this.tableDef.columns[column];
    const serialized = col ? serializeValue(value, col) : value;

    const result = this.sql.exec(
      `SELECT * FROM ${this.tableDef.name} WHERE ${column} = ? LIMIT 1`,
      serialized,
    );
    const rows = result.toArray();
    if (rows.length === 0) return undefined;
    return deserializeRow<T>(rows[0], this.tableDef.columns);
  }

  /** Find all rows matching column = value. */
  filterBy(column: string, value: unknown): T[] {
    const col = this.tableDef.columns[column];
    const serialized = col ? serializeValue(value, col) : value;

    const result = this.sql.exec(
      `SELECT * FROM ${this.tableDef.name} WHERE ${column} = ?`,
      serialized,
    );
    return result.toArray().map((raw) => deserializeRow<T>(raw, this.tableDef.columns));
  }

  /** Update a row by primary key, record mutation with old + new, return updated row. */
  update(primaryKeyValue: unknown, updates: Partial<T>): T | undefined {
    const pk = this.tableDef.primaryKey;
    const oldRow = this.findBy(pk, primaryKeyValue);
    if (!oldRow) return undefined;

    const updateEntries = Object.entries(updates).filter(
      ([key]) => key in this.tableDef.columns,
    );
    if (updateEntries.length === 0) return oldRow;

    const setClauses = updateEntries.map(([key]) => `${key} = ?`).join(", ");
    const setValues = updateEntries.map(([key, val]) =>
      serializeValue(val, this.tableDef.columns[key]),
    );

    const pkCol = this.tableDef.columns[pk];
    const serializedPk = pkCol ? serializeValue(primaryKeyValue, pkCol) : primaryKeyValue;

    this.sql.exec(
      `UPDATE ${this.tableDef.name} SET ${setClauses} WHERE ${pk} = ?`,
      ...setValues,
      serializedPk,
    );

    const newRow = { ...oldRow, ...updates } as T;

    this.mutations.push({
      table: this.tableDef.name,
      op: "update",
      oldRow: { ...oldRow },
      newRow: { ...newRow },
    });

    return newRow;
  }

  /** Delete a row by primary key, record mutation, return success. */
  delete(primaryKeyValue: unknown): boolean {
    const pk = this.tableDef.primaryKey;
    const oldRow = this.findBy(pk, primaryKeyValue);
    if (!oldRow) return false;

    const pkCol = this.tableDef.columns[pk];
    const serializedPk = pkCol ? serializeValue(primaryKeyValue, pkCol) : primaryKeyValue;

    this.sql.exec(
      `DELETE FROM ${this.tableDef.name} WHERE ${pk} = ?`,
      serializedPk,
    );

    this.mutations.push({
      table: this.tableDef.name,
      op: "delete",
      oldRow: { ...oldRow },
    });

    return true;
  }

  /** Return all rows in the table. */
  iter(): T[] {
    const result = this.sql.exec(`SELECT * FROM ${this.tableDef.name}`);
    return result.toArray().map((raw) => deserializeRow<T>(raw, this.tableDef.columns));
  }

  /** Return the number of rows in the table. */
  count(): number {
    const result = this.sql.exec(`SELECT COUNT(*) as cnt FROM ${this.tableDef.name}`);
    const rows = result.toArray();
    return (rows[0]?.cnt as number) ?? 0;
  }
}
