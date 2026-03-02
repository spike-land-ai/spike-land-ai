import type { Delta } from "../protocol/messages.js";

export class TableCache {
  private tables: Map<string, Map<string, Record<string, unknown>>> =
    new Map();
  private primaryKeys: Map<string, string> = new Map();
  private listeners: Map<string, Set<(delta: Delta) => void>> = new Map();

  registerTable(name: string, primaryKey: string): void {
    if (!this.tables.has(name)) {
      this.tables.set(name, new Map());
    }
    this.primaryKeys.set(name, primaryKey);
  }

  applySnapshot(table: string, rows: Record<string, unknown>[]): void {
    const pk = this.primaryKeys.get(table);
    if (!pk) return;

    const tableMap = new Map<string, Record<string, unknown>>();
    for (const row of rows) {
      const key = String(row[pk]);
      tableMap.set(key, row);
    }
    this.tables.set(table, tableMap);
  }

  applyDelta(delta: Delta): void {
    const pk = this.primaryKeys.get(delta.table);
    if (!pk) return;

    const tableMap = this.tables.get(delta.table);
    if (!tableMap) return;

    switch (delta.op) {
      case "insert": {
        const row = delta.newRow as Record<string, unknown> | undefined;
        if (row) {
          tableMap.set(String(row[pk]), row);
        }
        break;
      }
      case "update": {
        const row = delta.newRow as Record<string, unknown> | undefined;
        if (row) {
          tableMap.set(String(row[pk]), row);
        }
        break;
      }
      case "delete": {
        const row = delta.oldRow as Record<string, unknown> | undefined;
        if (row) {
          tableMap.delete(String(row[pk]));
        }
        break;
      }
    }

    this.notifyListeners(delta.table, delta);
  }

  getRows(table: string): Record<string, unknown>[] {
    const tableMap = this.tables.get(table);
    if (!tableMap) return [];
    return Array.from(tableMap.values());
  }

  findBy(
    table: string,
    column: string,
    value: unknown,
  ): Record<string, unknown> | undefined {
    const tableMap = this.tables.get(table);
    if (!tableMap) return undefined;
    for (const row of tableMap.values()) {
      if (row[column] === value) return row;
    }
    return undefined;
  }

  filterBy(
    table: string,
    column: string,
    value: unknown,
  ): Record<string, unknown>[] {
    const tableMap = this.tables.get(table);
    if (!tableMap) return [];
    const results: Record<string, unknown>[] = [];
    for (const row of tableMap.values()) {
      if (row[column] === value) results.push(row);
    }
    return results;
  }

  count(table: string): number {
    const tableMap = this.tables.get(table);
    return tableMap ? tableMap.size : 0;
  }

  onChange(table: string, handler: (delta: Delta) => void): () => void {
    let handlers = this.listeners.get(table);
    if (!handlers) {
      handlers = new Set();
      this.listeners.set(table, handlers);
    }
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  private notifyListeners(table: string, delta: Delta): void {
    const handlers = this.listeners.get(table);
    if (!handlers) return;
    for (const handler of handlers) {
      handler(delta);
    }
  }
}

export class ClientTable<T> {
  constructor(
    private cache: TableCache,
    private tableName: string,
  ) {}

  iter(): T[] {
    return this.cache.getRows(this.tableName) as T[];
  }

  findBy(column: string, value: unknown): T | undefined {
    return this.cache.findBy(this.tableName, column, value) as T | undefined;
  }

  filterBy(column: string, value: unknown): T[] {
    return this.cache.filterBy(this.tableName, column, value) as T[];
  }

  count(): number {
    return this.cache.count(this.tableName);
  }

  onChange(handler: (delta: Delta) => void): () => void {
    return this.cache.onChange(this.tableName, handler);
  }
}
