import type { DatabaseSchema, Migration } from "./types.js";

/**
 * Diff two database schemas and produce a list of migrations needed
 * to go from oldSchema to newSchema.
 *
 * Supported migration kinds: add_table, add_column, add_index.
 */
export function diffSchemas(oldSchema: DatabaseSchema, newSchema: DatabaseSchema): Migration[] {
  const migrations: Migration[] = [];

  for (const [tableName, newTable] of Object.entries(newSchema.tables)) {
    const oldTable = oldSchema.tables[tableName];

    if (!oldTable) {
      // Entire table is new
      migrations.push({
        kind: "add_table",
        table: tableName,
        tableDefinition: newTable,
      });
      continue;
    }

    // Check for new columns
    for (const [colName, colType] of Object.entries(newTable.columns)) {
      if (!(colName in oldTable.columns)) {
        migrations.push({
          kind: "add_column",
          table: tableName,
          column: colName,
          columnType: colType,
        });
      }
    }

    // Check for new indexes
    const oldIndexNames = new Set(oldTable.indexes.map((idx) => idx.name));
    for (const idx of newTable.indexes) {
      if (!oldIndexNames.has(idx.name)) {
        migrations.push({
          kind: "add_index",
          table: tableName,
          index: idx,
        });
      }
    }
  }

  return migrations;
}

/** Generate SQL statements for a list of migrations. */
export function generateMigrationSql(migrations: Migration[]): string[] {
  const statements: string[] = [];

  for (const m of migrations) {
    switch (m.kind) {
      case "add_table": {
        if (!m.tableDefinition) break;
        const cols = Object.entries(m.tableDefinition.columns).map(([name, col]) => {
          const parts = [name, col.sqlType];
          if (name === m.tableDefinition!.primaryKey) {
            parts.push("PRIMARY KEY");
          } else if (!col.nullable) {
            parts.push("NOT NULL");
          }
          return parts.join(" ");
        });
        statements.push(
          `CREATE TABLE IF NOT EXISTS ${m.table} (\n  ${cols.join(",\n  ")}\n);`
        );
        break;
      }
      case "add_column": {
        if (!m.column || !m.columnType) break;
        const nullable = m.columnType.nullable ? "" : " NOT NULL DEFAULT ''";
        statements.push(
          `ALTER TABLE ${m.table} ADD COLUMN ${m.column} ${m.columnType.sqlType}${nullable};`
        );
        break;
      }
      case "add_index": {
        if (!m.index) break;
        const unique = m.index.unique ? "UNIQUE " : "";
        const cols = m.index.columns.join(", ");
        statements.push(
          `CREATE ${unique}INDEX IF NOT EXISTS ${m.index.name} ON ${m.table} (${cols});`
        );
        break;
      }
    }
  }

  return statements;
}
