import { Redis } from "@upstash/redis";
import { logger } from "@/lib/logger";

/**
 * Create the Redis client based on available env vars:
 * 1. UPSTASH_REDIS_REST_URL / KV_REST_API_URL → Upstash REST
 * 2. Neither → no-op proxy (features disabled)
 */
let _redisPromise: Promise<Redis> | null = null;

// Timeout for resolving the Redis client (prevents indefinite hangs)
const REDIS_CONNECT_TIMEOUT_MS = 5_000;

async function createRedisClient(): Promise<Redis> {
  // Upstash REST
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;
  if (url && token) {
    return new Redis({ url, token });
  }

  // No Redis configured — no-op proxy
  return new Proxy({} as Redis, {
    get(_, prop) {
      return () => {
        logger.warn(
          `[Redis] Not configured - ${String(prop)} called but Redis credentials missing`,
        );
        return Promise.resolve(null);
      };
    },
  }) as Redis;
}

function getRedisPromise(): Promise<Redis> {
  if (!_redisPromise) {
    _redisPromise = createRedisClient();
  }
  return _redisPromise;
}

/**
 * Race a promise against a timeout. If the timeout fires first,
 * the promise is left dangling but the caller gets a rejection.
 */
function withConnectTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Redis client resolution timed out after ${ms}ms`)), ms),
    ),
  ]);
}

// Lazy singleton — methods resolve the client on first call.
// The proxy wraps getRedisPromise() with a connection timeout so that
// if the Redis client never resolves (e.g. network partition, bad auth),
// callers get a fast rejection instead of hanging until ALB kills the request.
export const redis: Redis = new Proxy({} as Redis, {
  get(_, prop) {
    return async (...args: unknown[]) => {
      const client = await withConnectTimeout(getRedisPromise(), REDIS_CONNECT_TIMEOUT_MS);
      const fn = (client as unknown as Record<string | symbol, unknown>)[prop];
      if (typeof fn === "function") {
        return (fn as (...a: unknown[]) => unknown).apply(client, args);
      }
      return fn;
    };
  },
});

// Key prefixes for organization
const KEYS = {
  APP_PENDING_MESSAGES: (appId: string) => `app:${appId}:pending_messages`,
  APPS_WITH_PENDING: "apps:with_pending",
  APP_STATUS: (appId: string) => `app:${appId}:status`,
  AGENT_WORKING: (appId: string) => `app:${appId}:agent_working`,
  APP_CODE_HASH: (appId: string) => `app:${appId}:code_hash`,
  SSE_EVENTS: (appId: string) => `sse:${appId}:events`,
  MCP_AGENT_ACTIVE: (appId: string) => `mcp_agent_active:${appId}`,
} as const;

// Generate a unique instance ID for this process
// Used to prevent instances from processing their own events
const INSTANCE_ID = crypto.randomUUID();

/**
 * Add a message to the pending queue for an app
 * Called when a user sends a new message
 */
export async function enqueueMessage(appId: string, messageId: string): Promise<void> {
  await Promise.all([
    // Add message to the app's pending queue (newest first)
    redis.lpush(KEYS.APP_PENDING_MESSAGES(appId), messageId),
    // Set a 24-hour TTL on the queue to prevent orphaned keys if clearPendingMessages is never called
    redis.expire(KEYS.APP_PENDING_MESSAGES(appId), 24 * 60 * 60),
    // Track this app as having pending work
    redis.sadd(KEYS.APPS_WITH_PENDING, appId),
  ]);
}

/**
 * Remove a message from the pending queue (mark as processed)
 */
export async function dequeueMessage(appId: string): Promise<string | null> {
  // Pop oldest message from the queue
  const messageId = await redis.rpop<string>(KEYS.APP_PENDING_MESSAGES(appId));

  // Check if queue is now empty
  const remaining = await redis.llen(KEYS.APP_PENDING_MESSAGES(appId));
  if (remaining === 0) {
    // Remove app from pending set
    await redis.srem(KEYS.APPS_WITH_PENDING, appId);
  }

  return messageId;
}

/**
 * Get all message IDs in the pending queue for an app
 */
export async function getPendingMessages(appId: string): Promise<string[]> {
  return redis.lrange(KEYS.APP_PENDING_MESSAGES(appId), 0, -1);
}

/**
 * Get all app IDs that have pending messages
 */
export async function getAppsWithPending(): Promise<string[]> {
  return redis.smembers(KEYS.APPS_WITH_PENDING);
}

/**
 * Check if an app has any pending messages
 */
export async function hasPendingMessages(appId: string): Promise<boolean> {
  const result = await redis.sismember(KEYS.APPS_WITH_PENDING, appId);
  return result === 1;
}

/**
 * Get the count of pending messages for an app
 */
export async function getPendingCount(appId: string): Promise<number> {
  return redis.llen(KEYS.APP_PENDING_MESSAGES(appId));
}

/**
 * Mark an agent as working on an app (for UI indicator)
 * TTL of 5 minutes to auto-expire if agent crashes
 */
export async function setAgentWorking(appId: string, isWorking: boolean): Promise<void> {
  if (isWorking) {
    await redis.set(KEYS.AGENT_WORKING(appId), "1", { ex: 300 }); // 5 min TTL
  } else {
    await redis.del(KEYS.AGENT_WORKING(appId));
  }
}

/**
 * Check if an agent is currently working on an app
 */
export async function isAgentWorking(appId: string): Promise<boolean> {
  const value = await redis.get(KEYS.AGENT_WORKING(appId));
  return value === "1";
}

/**
 * Clear all pending messages for an app (e.g., on app deletion)
 */
export async function clearPendingMessages(appId: string): Promise<void> {
  await redis.del(KEYS.APP_PENDING_MESSAGES(appId));
  await redis.srem(KEYS.APPS_WITH_PENDING, appId);
  await redis.del(KEYS.AGENT_WORKING(appId));
}

/**
 * Get queue stats for monitoring
 */
export async function getQueueStats(): Promise<{
  appsWithPending: number;
  totalPendingMessages: number;
}> {
  // Use Lua script to calculate stats server-side
  // This reduces N+1 network roundtrips to 1
  const script = `
    local apps = redis.call("SMEMBERS", KEYS[1])
    local total_pending = 0

    for i, app_id in ipairs(apps) do
      local pending_key = "app:" .. app_id .. ":pending_messages"
      local count = redis.call("LLEN", pending_key)
      total_pending = total_pending + count
    end

    return {#apps, total_pending}
  `;

  try {
    const [appsCount, totalPending] = (await redis.eval(script, [KEYS.APPS_WITH_PENDING], [])) as [
      number,
      number,
    ];

    return {
      appsWithPending: appsCount,
      totalPendingMessages: totalPending,
    };
  } catch (error) {
    // Fallback to client-side aggregation if Lua script fails
    logger.error("[QueueStats] Lua script failed, falling back to client-side aggregation", error);

    const appIds = await getAppsWithPending();

    if (appIds.length === 0) {
      return { appsWithPending: 0, totalPendingMessages: 0 };
    }

    // Use Promise.all to parallelize all llen calls instead of sequential N+1 loop
    const counts = await Promise.all(appIds.map((appId) => getPendingCount(appId)));
    const totalPendingMessages = counts.reduce((sum, c) => sum + c, 0);

    return {
      appsWithPending: appIds.length,
      totalPendingMessages,
    };
  }
}

/**
 * Get the stored code hash for an app (for token optimization)
 * Returns null if no hash is stored or Redis is not configured
 */
export async function getCodeHash(appId: string): Promise<string | null> {
  return redis.get<string>(KEYS.APP_CODE_HASH(appId));
}

/**
 * Set the code hash for an app (for token optimization)
 * TTL of 1 hour to auto-expire old hashes
 */
export async function setCodeHash(appId: string, hash: string): Promise<void> {
  await redis.set(KEYS.APP_CODE_HASH(appId), hash, { ex: 3600 }); // 1 hour TTL
}

/**
 * SSE Event structure for cross-instance broadcasting
 */
export interface SSEEventWithSource {
  type: string;
  data: unknown;
  timestamp: number;
  sourceInstanceId: string;
}

/**
 * Publish an SSE event to Redis using a hybrid approach:
 * 1. Pub/Sub for real-time notifications
 * 2. List for reliable delivery (fallback)
 *
 * This hybrid approach ensures:
 * - Real-time delivery via Pub/Sub when instances are listening
 * - Reliable delivery via List for instances that weren't subscribed
 * - Backward compatibility with polling clients
 *
 * See: https://upstash.com/docs/redis/features/pubsub
 */
export async function publishSSEEvent(
  appId: string,
  event: { type: string; data: unknown; timestamp: number },
): Promise<void> {
  const eventWithSource: SSEEventWithSource = {
    ...event,
    sourceInstanceId: INSTANCE_ID,
  };

  const channel = `sse:${appId}`;
  const key = KEYS.SSE_EVENTS(appId);
  const payload = JSON.stringify(eventWithSource);

  // Use Lua script to atomically publish and store in list
  // This reduces network round-trips from ~4 to 1
  const script = `
    redis.call("PUBLISH", ARGV[1], ARGV[2])
    redis.call("LPUSH", KEYS[1], ARGV[2])
    redis.call("EXPIRE", KEYS[1], tonumber(ARGV[3]))
    redis.call("LTRIM", KEYS[1], tonumber(ARGV[4]), tonumber(ARGV[5]))
  `;

  try {
    await redis.eval(script, [key], [channel, payload, "60", "0", "99"]);
  } catch (err) {
    logger.error(`[SSE] Failed to publish event:`, err);
  }
}

/**
 * Get SSE events published after a given timestamp
 * Used by instances to poll for new events from other instances
 *
 * This provides backward compatibility with the polling pattern
 * and ensures reliable delivery even if Pub/Sub messages are missed.
 *
 * Events from the current instance (matching INSTANCE_ID) are filtered out
 * to prevent duplicate processing.
 */
export async function getSSEEvents(
  appId: string,
  afterTimestamp: number,
): Promise<SSEEventWithSource[]> {
  const key = KEYS.SSE_EVENTS(appId);

  // Use Lua script to filter events on the server side
  // This avoids transferring and parsing old events, significantly reducing bandwidth and CPU
  // especially when the list is full (100 items) and clients are polling frequently.
  const script = `
    local items = redis.call("LRANGE", KEYS[1], 0, -1)
    local matches = {}
    local min_ts = tonumber(ARGV[1])
    local instance_id = ARGV[2]

    for i, item in ipairs(items) do
        -- Safe JSON decode
        local status, decoded = pcall(cjson.decode, item)
        if status and decoded then
            if decoded.timestamp > min_ts and decoded.sourceInstanceId ~= instance_id then
                table.insert(matches, item)
            end
        end
    end
    return matches
  `;

  try {
    const events = (await redis.eval(script, [key], [afterTimestamp, INSTANCE_ID])) as string[];

    // Parse only the filtered events
    return events.map((e) => JSON.parse(e) as SSEEventWithSource).reverse(); // Oldest first for replay
  } catch (error) {
    // Fallback in case of Lua script failure (e.g. strict CSP or environment issues)
    // although cjson is standard in Redis.
    logger.error("[SSE] Lua script failed, falling back to client-side filtering", error);

    const events = await redis.lrange<string>(key, 0, -1);
    return events
      .map((e) => {
        if (typeof e === "string") {
          return JSON.parse(e) as SSEEventWithSource;
        }
        return e as unknown as SSEEventWithSource;
      })
      .filter((e) => e.timestamp > afterTimestamp && e.sourceInstanceId !== INSTANCE_ID)
      .reverse();
  }
}

/**
 * Mark the MCP agent as active for an app (5-minute TTL).
 * Called by agent_inbox_poll to signal that an external agent is handling this app.
 */
export async function setMcpAgentActive(appId: string): Promise<void> {
  await redis.set(KEYS.MCP_AGENT_ACTIVE(appId), "1", { ex: 300 }); // 5 min TTL
}

/**
 * Check if an MCP agent is currently active for an app.
 * Used by built-in agent routes to defer to the external MCP agent.
 */
export async function isMcpAgentActive(appId: string): Promise<boolean> {
  const value = await redis.get(KEYS.MCP_AGENT_ACTIVE(appId));
  return value === "1";
}

/**
 * Get the current instance ID (for testing/debugging)
 */
export function getInstanceId(): string {
  return INSTANCE_ID;
}
