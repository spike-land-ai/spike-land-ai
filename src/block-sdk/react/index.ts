/**
 * React bindings for full-stack blocks.
 *
 * Provides hooks for subscribing to block storage and calling procedures.
 * Uses useSyncExternalStore for concurrent-safe subscriptions.
 */

import { useSyncExternalStore } from "react";
import type { BuiltTool, CallToolResult } from "@spike-land-ai/shared/tool-builder";
import type { Block, BlockComponents } from "../define-block.js";
import type { Row, StorageAdapter } from "../storage/types.js";
import type { TableDef } from "../schema/types.js";

// ─── Block Client ──────────────────────────────────────────────────────────

/** A client for interacting with a block from React components */
export interface BlockClient<TProcedures extends Record<string, BuiltTool<never, CallToolResult>>> {
  /** Call a block procedure by name */
  call<K extends keyof TProcedures>(
    name: K,
    input: TProcedures[K] extends BuiltTool<infer TInput> ? TInput : never,
  ): Promise<CallToolResult>;

  /** Subscribe to a table — returns rows matching an optional filter */
  subscribe<T extends Row>(
    tableName: string,
    filter?: Partial<T>,
  ): SubscriptionHandle<T>;

  /** Get all rows from a table (one-shot read) */
  query<T extends Row>(tableName: string, filter?: Partial<T>): Promise<T[]>;

  /** The underlying storage adapter */
  storage: StorageAdapter;
}

/** Handle returned by subscribe() */
export interface SubscriptionHandle<T extends Row> {
  /** Current snapshot of rows */
  getSnapshot: () => T[];
  /** Subscribe to changes (returns unsubscribe fn) */
  subscribe: (listener: () => void) => () => void;
}

/** Options for creating a block client */
export interface BlockClientOptions {
  /** Polling interval in ms for subscription updates (default: 1000) */
  pollInterval?: number;
  /** User ID for procedure calls */
  userId: string;
}

/**
 * Create a BlockClient for a given block and storage adapter.
 *
 * The client handles procedure dispatch and storage subscriptions.
 * The client handles procedure dispatch and storage subscriptions via polling.
 */
export function createBlockClient<
  TStorage extends Record<string, TableDef>,
  TProcedures extends Record<string, BuiltTool<never, CallToolResult>>,
  TComponents extends BlockComponents,
>(
  block: Block<TStorage, TProcedures, TComponents>,
  storage: StorageAdapter,
  options: BlockClientOptions,
): BlockClient<TProcedures> {
  const procedures = block.createProcedures(storage, options.userId);
  const pollInterval = options.pollInterval ?? 1000;

  return {
    async call(name, input) {
      const tool = procedures[name];
      if (!tool || typeof tool !== "object" || !("handler" in tool)) {
        throw new Error(`Unknown procedure: ${String(name)}`);
      }
      const builtTool = tool as BuiltTool;
      return builtTool.handler(input, { storage, userId: options.userId });
    },

    subscribe<T extends Row>(tableName: string, filter?: Partial<T>): SubscriptionHandle<T> {
      let currentRows: T[] = [];
      const listeners = new Set<() => void>();

      // Build WHERE clause from filter
      function buildQuery(): { query: string; params: unknown[] } {
        if (!filter || Object.keys(filter).length === 0) {
          return { query: `SELECT * FROM ${tableName}`, params: [] };
        }
        const entries = Object.entries(filter);
        const where = entries.map(([k]) => `${k} = ?`).join(" AND ");
        const params = entries.map(([, v]) => v);
        return { query: `SELECT * FROM ${tableName} WHERE ${where}`, params };
      }

      // Poll for changes
      let timer: ReturnType<typeof setInterval> | null = null;

      async function refresh(): Promise<void> {
        const { query, params } = buildQuery();
        const result = await storage.sql.execute<T>(query, params);
        const newRows = result.rows;

        // Simple deep equality check (JSON comparison)
        const newJSON = JSON.stringify(newRows);
        const oldJSON = JSON.stringify(currentRows);
        if (newJSON !== oldJSON) {
          currentRows = newRows;
          for (const listener of listeners) {
            listener();
          }
        }
      }

      return {
        getSnapshot: () => currentRows,
        subscribe: (listener: () => void) => {
          listeners.add(listener);

          // Start polling on first subscriber
          if (listeners.size === 1) {
            // Initial fetch
            refresh().catch(() => {});
            timer = setInterval(() => {
              refresh().catch(() => {});
            }, pollInterval);
          }

          // Return unsubscribe
          return () => {
            listeners.delete(listener);
            if (listeners.size === 0 && timer) {
              clearInterval(timer);
              timer = null;
            }
          };
        },
      };
    },

    async query<T extends Row>(tableName: string, filter?: Partial<T>): Promise<T[]> {
      if (!filter || Object.keys(filter).length === 0) {
        const result = await storage.sql.execute<T>(`SELECT * FROM ${tableName}`);
        return result.rows;
      }
      const entries = Object.entries(filter);
      const where = entries.map(([k]) => `${k} = ?`).join(" AND ");
      const params = entries.map(([, v]) => v);
      const result = await storage.sql.execute<T>(
        `SELECT * FROM ${tableName} WHERE ${where}`,
        params,
      );
      return result.rows;
    },

    storage,
  };
}

// ─── React Hook Factories ──────────────────────────────────────────────────

/**
 * Create React hooks bound to a specific block client.
 *
 * Returns { useBlock, useSubscription } hooks that can be used in components.
 *
 * Note: These are hook factories, not hooks themselves. Call this once at module
 * level and export the resulting hooks.
 *
 * @example
 * ```ts
 * const { useBlock, useSubscription } = createBlockHooks(client);
 *
 * function TaskList() {
 *   const tasks = useSubscription("tasks", { status: "pending" });
 *   const block = useBlock();
 *   return <ul>{tasks.map(t => <li key={t.id}>{t.title}</li>)}</ul>;
 * }
 * ```
 */
export function createBlockHooks<TProcedures extends Record<string, BuiltTool<never, CallToolResult>>>(
  client: BlockClient<TProcedures>,
): {
  /** Get the block client for calling procedures */
  useBlock: () => BlockClient<TProcedures>;
  /** Subscribe to a table with optional filter — returns live rows */
  useSubscription: <T extends Row>(
    tableName: string,
    filter?: Partial<T>,
  ) => T[];
} {
  // Cache subscription handles to avoid re-creating on every render
  const subCache = new Map<string, SubscriptionHandle<Row>>();

  function getOrCreateSub<T extends Row>(
    tableName: string,
    filter?: Partial<T>,
  ): SubscriptionHandle<T> {
    const key = `${tableName}:${JSON.stringify(filter ?? {})}`;
    if (!subCache.has(key)) {
      subCache.set(key, client.subscribe(tableName, filter) as SubscriptionHandle<Row>);
    }
    return subCache.get(key) as SubscriptionHandle<T>;
  }

  return {
    useBlock: () => client,

    useSubscription: <T extends Row>(tableName: string, filter?: Partial<T>): T[] => {
      const sub = getOrCreateSub<T>(tableName, filter);
      return useSyncExternalStore(sub.subscribe, sub.getSnapshot, sub.getSnapshot);
    },
  };
}
