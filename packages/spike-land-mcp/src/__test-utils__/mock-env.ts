/**
 * Test utilities: mock Cloudflare Workers bindings.
 */

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
    getWithMetadata: async () => ({ value: null, metadata: null, cacheStatus: null }),
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
        const result = handler(sql, boundValues);
        return result.results[0] ?? null;
      },
      all: async () => handler(sql, boundValues),
      run: async () => handler(sql, boundValues),
      raw: async () => handler(sql, boundValues).results,
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
