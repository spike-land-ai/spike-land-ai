import type { Delta } from "../protocol/messages.js";
import type { DatabaseSchema } from "../schema/types.js";
import type { SqlStorage } from "./table-handle.js";

/** Row shape for the __scheduled_reducers internal table. */
interface ScheduledRow {
  id: number;
  reducer: string;
  args_json: string;
  run_at: number;
}

/** Create the internal scheduling table if it doesn't exist. */
export function ensureSchedulerTable(sql: SqlStorage): void {
  sql.exec(`CREATE TABLE IF NOT EXISTS __scheduled_reducers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  reducer TEXT NOT NULL,
  args_json TEXT NOT NULL,
  run_at INTEGER NOT NULL
);`);
}

/** Schedule a reducer to run after a delay. Returns the run_at timestamp. */
export function scheduleReducer(
  sql: SqlStorage,
  setAlarm: (time: number) => void,
  reducerName: string,
  delayMs: number,
  args: unknown[],
): number {
  const runAt = Date.now() + delayMs;
  sql.exec(
    "INSERT INTO __scheduled_reducers (reducer, args_json, run_at) VALUES (?, ?, ?)",
    reducerName,
    JSON.stringify(args),
    runAt,
  );
  setAlarm(runAt);
  return runAt;
}

/** Process all due scheduled reducers. Returns all mutations from executed reducers. */
export function processAlarm(
  sql: SqlStorage,
  schema: DatabaseSchema,
  executor: (
    sql: SqlStorage,
    schema: DatabaseSchema,
    reducerName: string,
    args: unknown[],
    sender: string,
    scheduleFn: (name: string, delay: number, args: unknown[]) => void,
  ) => { mutations: Delta[]; error?: string },
  setAlarm: (time: number) => void,
  scheduleFn: (name: string, delay: number, args: unknown[]) => void,
): Delta[] {
  const now = Date.now();
  const result = sql.exec(
    "SELECT * FROM __scheduled_reducers WHERE run_at <= ?",
    now,
  );
  const rows = result.toArray() as unknown as ScheduledRow[];
  const allMutations: Delta[] = [];

  for (const row of rows) {
    const args = JSON.parse(row.args_json) as unknown[];
    const execResult = executor(sql, schema, row.reducer, args, "__scheduler__", scheduleFn);
    allMutations.push(...execResult.mutations);
    sql.exec("DELETE FROM __scheduled_reducers WHERE id = ?", row.id);
  }

  // Check for remaining scheduled items and set next alarm
  const nextResult = sql.exec(
    "SELECT MIN(run_at) as next_run FROM __scheduled_reducers",
  );
  const nextRows = nextResult.toArray();
  const nextRun = nextRows[0]?.next_run as number | null;
  if (nextRun !== null && nextRun !== undefined) {
    setAlarm(nextRun);
  }

  return allMutations;
}
