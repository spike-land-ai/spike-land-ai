import { useSyncExternalStore, useCallback, useRef } from "react";

type TableRow = object;

interface TableStore<T extends TableRow> {
  rows: T[];
  subscribe: (listener: () => void) => () => void;
  getSnapshot: () => T[];
}

const tableStores = new Map<string, TableStore<TableRow>>();

function getOrCreateStore<T extends TableRow>(
  tableName: string,
  filter?: (row: T) => boolean,
): TableStore<T> {
  const key = `${tableName}:${filter?.toString() ?? "all"}`;
  if (!tableStores.has(key)) {
    let rows: T[] = [];
    const listeners = new Set<() => void>();

    const store: TableStore<T> = {
      get rows() {
        return rows;
      },
      subscribe(listener: () => void) {
        listeners.add(listener);
        return () => listeners.delete(listener);
      },
      getSnapshot() {
        return rows;
      },
    };

    // Listen for table updates via custom events
    const handler = (event: Event) => {
      const detail = (event as CustomEvent).detail as T[];
      rows = filter ? detail.filter(filter) : detail;
      for (const listener of listeners) listener();
    };

    window.addEventListener(`stdb:table:${tableName}`, handler);
    tableStores.set(key, store as TableStore<TableRow>);
  }

  return tableStores.get(key) as TableStore<T>;
}

export function useTable<T extends TableRow>(tableName: string, filter?: (row: T) => boolean): T[] {
  const filterRef = useRef(filter);
  filterRef.current = filter;

  const store = getOrCreateStore<T>(tableName, filter);

  const subscribe = useCallback((listener: () => void) => store.subscribe(listener), [store]);

  const getSnapshot = useCallback(() => store.getSnapshot(), [store]);

  return useSyncExternalStore(subscribe, getSnapshot);
}
