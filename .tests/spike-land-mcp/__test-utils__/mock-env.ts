/**
 * Test utilities: mock Cloudflare Workers bindings.
 */

import Database from "better-sqlite3";

/** In-memory mock for KVNamespace. */
export function createMockKV(): KVNamespace {
  const store = new Map<string, { value: string; expiration?: number }>();

  return {
    get: async (key: string) => {
      const entry = store.get(key);
      if (!entry) return null;
      if (entry.expiration && Date.now() / 1000 > entry.expiration) {
        store.delete(key);
        return null;
      }
      return entry.value;
    },
    put: async (key: string, value: string, opts?: { expirationTtl?: number }) => {
      const expiration = opts?.expirationTtl ? Date.now() / 1000 + opts.expirationTtl : undefined;
      store.set(key, { value, expiration });
    },
    delete: async (key: string) => {
      store.delete(key);
    },
    list: async () => ({
      keys: Array.from(store.keys()).map((name) => ({ name })),
      list_complete: true,
      cacheStatus: null,
    }),
    getWithMetadata: async () => ({
      value: null,
      metadata: null,
      cacheStatus: null,
    }),
  } as unknown as KVNamespace;
}

/** Minimal mock for D1Database that captures queries for assertion. */
export interface MockD1Result {
  results: Record<string, unknown>[];
  success: boolean;
  meta: Record<string, unknown>;
}

export function createMockD1(
  queryHandler?: (sql: string, bindings: unknown[]) => MockD1Result,
): D1Database {
  const defaultHandler = (): MockD1Result => ({
    results: [],
    success: true,
    meta: {},
  });

  const handler = queryHandler ?? defaultHandler;

  const prepare = (sql: string) => {
    let boundValues: unknown[] = [];

    const stmt = {
      bind: (...values: unknown[]) => {
        boundValues = values;
        return stmt;
      },
      first: async () => {
        console.log("D1 first:", sql, boundValues);
        const result = handler(sql, boundValues);
        return result.results[0] ?? null;
      },
      all: async () => {
        console.log("D1 all:", sql, boundValues);
        return handler(sql, boundValues);
      },
      run: async () => {
        console.log("D1 run:", sql, boundValues);
        return handler(sql, boundValues);
      },
      raw: async () => {
        console.log("D1 raw:", sql, boundValues);
        const result = handler(sql, boundValues);
        // D1 raw() returns array of arrays (rows)
        return result.results.map((row) => Object.values(row));
      },
    };

    return stmt;
  };

  return {
    prepare,
    dump: async () => new ArrayBuffer(0),
    batch: async (stmts: unknown[]) => stmts.map(() => handler("", [])),
    exec: async () => ({ count: 0, duration: 0 }),
  } as unknown as D1Database;
}

/** Alias for createMockKV for brevity in tests. */
export const mockKV = createMockKV;

export function createSqliteD1(): {
  d1: D1Database;
  sqlite: InstanceType<typeof Database>;
} {
  const sqlite = new Database(":memory:");
  sqlite.pragma("journal_mode = WAL");
  sqlite.pragma("foreign_keys = ON");

  const prepare = (sql: string) => {
    let boundValues: unknown[] = [];

    const stmt = {
      bind: (...values: unknown[]) => {
        boundValues = values;
        return stmt;
      },
      first: async () => {
        const row = sqlite.prepare(sql).get(...boundValues) as Record<string, unknown> | undefined;
        return row ?? null;
      },
      all: async (): Promise<MockD1Result> => {
        const rows = sqlite.prepare(sql).all(...boundValues) as Record<string, unknown>[];
        return { results: rows, success: true, meta: {} };
      },
      run: async (): Promise<MockD1Result> => {
        const result = sqlite.prepare(sql).run(...boundValues);
        return {
          results: [],
          success: true,
          meta: {
            changes: result.changes,
            lastRowId: Number(result.lastInsertRowid),
          },
        };
      },
      raw: async () => {
        return sqlite.prepare(sql).raw(true).all(...boundValues) as unknown[][];
      },
    };

    return stmt;
  };

  const d1 = {
    prepare,
    dump: async () => new ArrayBuffer(0),
    batch: async (stmts: unknown[]) => {
      const results: MockD1Result[] = [];

      for (const stmt of stmts as Array<{
        all?: () => Promise<MockD1Result>;
        first?: () => Promise<Record<string, unknown> | null>;
        run?: () => Promise<MockD1Result>;
      }>) {
        if (typeof stmt.run === "function") {
          results.push(await stmt.run());
          continue;
        }
        if (typeof stmt.all === "function") {
          results.push(await stmt.all());
          continue;
        }
        if (typeof stmt.first === "function") {
          const row = await stmt.first();
          results.push({
            results: row ? [row] : [],
            success: true,
            meta: {},
          });
          continue;
        }

        results.push({ results: [], success: true, meta: {} });
      }

      return results;
    },
    exec: async (sql: string) => {
      sqlite.exec(sql);
      return { count: 0, duration: 0 };
    },
  } as unknown as D1Database;

  return { d1, sqlite };
}

/** Create a full mock Env object. */
export function mockEnv(
  overrides?: Partial<{
    DB: D1Database;
    KV: KVNamespace;
    MCP_JWT_SECRET: string;
    MCP_INTERNAL_SECRET: string;
    ANTHROPIC_API_KEY: string;
    OPENAI_API_KEY: string;
    GEMINI_API_KEY: string;
    ELEVENLABS_API_KEY: string;
    APP_ENV: string;
    SPIKE_LAND_URL: string;
  }>,
) {
  return {
    DB: overrides?.DB ?? createMockD1(),
    KV: overrides?.KV ?? createMockKV(),
    MCP_JWT_SECRET: overrides?.MCP_JWT_SECRET ?? "test-jwt-secret-at-least-32-chars-long",
    MCP_INTERNAL_SECRET: overrides?.MCP_INTERNAL_SECRET ?? "test-internal-secret",
    ANTHROPIC_API_KEY: overrides?.ANTHROPIC_API_KEY ?? "sk-ant-test",
    OPENAI_API_KEY: overrides?.OPENAI_API_KEY ?? "sk-test",
    GEMINI_API_KEY: overrides?.GEMINI_API_KEY ?? "gemini-test",
    ELEVENLABS_API_KEY: overrides?.ELEVENLABS_API_KEY ?? "el-test",
    APP_ENV: overrides?.APP_ENV ?? "test",
    SPIKE_LAND_URL: overrides?.SPIKE_LAND_URL ?? "https://spike.land",
  };
}
