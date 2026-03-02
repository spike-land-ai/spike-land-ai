import type { ColumnType, DatabaseSchema, TableDefinition } from "./types.js";

/** Map a ColumnType to its SQL column definition fragment. */
function columnToSql(name: string, col: ColumnType, isPrimaryKey: boolean): string {
  const parts = [name, col.sqlType];

  if (isPrimaryKey) {
    parts.push("PRIMARY KEY");
  }

  if (!col.nullable && !isPrimaryKey) {
    parts.push("NOT NULL");
  }

  return parts.join(" ");
}

/** Generate a CREATE TABLE IF NOT EXISTS statement for a single table. */
export function generateCreateTable(table: TableDefinition): string {
  const columnDefs: string[] = [];

  for (const [name, col] of Object.entries(table.columns)) {
    columnDefs.push(columnToSql(name, col, name === table.primaryKey));
  }

  return `CREATE TABLE IF NOT EXISTS ${table.name} (\n  ${columnDefs.join(",\n  ")}\n);`;
}

/** Generate CREATE INDEX statements for a table's indexes. */
export function generateCreateIndexes(table: TableDefinition): string[] {
  return table.indexes.map((idx) => {
    const unique = idx.unique ? "UNIQUE " : "";
    const cols = idx.columns.join(", ");
    return `CREATE ${unique}INDEX IF NOT EXISTS ${idx.name} ON ${table.name} (${cols});`;
  });
}

/** Generate all DDL (CREATE TABLE + CREATE INDEX) for an entire database schema. */
export function generateAllTables(schema: DatabaseSchema): string {
  const statements: string[] = [];

  for (const table of Object.values(schema.tables)) {
    statements.push(generateCreateTable(table));
    const indexStatements = generateCreateIndexes(table);
    statements.push(...indexStatements);
  }

  return statements.join("\n\n");
}
