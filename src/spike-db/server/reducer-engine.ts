import type { Delta } from "../protocol/messages.js";
import type { DatabaseSchema } from "../schema/types.js";
import type { SqlStorage } from "./table-handle.js";
import { TableHandle } from "./table-handle.js";

/** Context passed to every reducer handler. */
export interface ReducerContext {
  sender: string;
  timestamp: number;
  db: Record<string, TableHandle<Record<string, unknown>>>;
  schedule: (reducerName: string, delayMs: number, args: unknown[]) => void;
}

/** Result of executing a reducer. */
export interface ReducerResult {
  mutations: Delta[];
  error?: string;
}

/**
 * Execute a reducer within a SQLite transaction.
 * On success: COMMIT and return collected mutations.
 * On error: ROLLBACK and return the error message.
 */
export function executeReducer(
  sql: SqlStorage,
  schema: DatabaseSchema,
  reducerName: string,
  args: unknown[],
  sender: string,
  scheduleFn: (name: string, delay: number, args: unknown[]) => void,
): ReducerResult {
  const reducer = schema.reducers[reducerName];
  if (!reducer) {
    return { mutations: [], error: `Unknown reducer: ${reducerName}` };
  }

  sql.exec("BEGIN IMMEDIATE");

  const db: Record<string, TableHandle<Record<string, unknown>>> = {};
  for (const [tableName, tableDef] of Object.entries(schema.tables)) {
    db[tableName] = new TableHandle(sql, tableDef);
  }

  const ctx: ReducerContext = {
    sender,
    timestamp: Date.now(),
    db,
    schedule: scheduleFn,
  };

  try {
    reducer.handler(ctx, ...args);
    sql.exec("COMMIT");

    const mutations: Delta[] = [];
    for (const table of Object.values(db)) {
      mutations.push(...table.mutations);
    }

    return { mutations };
  } catch (err: unknown) {
    sql.exec("ROLLBACK");
    const message = err instanceof Error ? err.message : String(err);
    return { mutations: [], error: message };
  }
}
