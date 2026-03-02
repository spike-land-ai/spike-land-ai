/**
 * Redis client for vibe-dev agent polling
 *
 * Mirrors key structure from src/lib/upstash/client.ts
 * Uses Upstash REST API for Redis access (no @upstash/redis dependency needed)
 */

// Redis key helpers - mirror from src/lib/upstash/client.ts
const KEYS = {
  APP_PENDING_MESSAGES: (appId: string) => `app:${appId}:pending_messages`,
  APPS_WITH_PENDING: "apps:with_pending",
  AGENT_WORKING: (appId: string) => `app:${appId}:agent_working`,
} as const;

export { KEYS };

export interface RedisConfig {
  url: string;
  token: string;
}

/**
 * Get Redis configuration from environment
 */
export function getRedisConfig(): RedisConfig {
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    throw new Error(
      "Redis credentials not configured. Set UPSTASH_REDIS_REST_URL/TOKEN or KV_REST_API_URL/TOKEN",
    );
  }

  return { url, token };
}

/**
 * Execute a Redis command via Upstash REST API
 */
async function redisCommand<T>(config: RedisConfig, command: string[]): Promise<T> {
  const response = await fetch(config.url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(command),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Redis command failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.result as T;
}

/**
 * Get all app IDs that have pending messages
 */
export async function getAppsWithPending(config: RedisConfig): Promise<string[]> {
  return redisCommand<string[]>(config, ["SMEMBERS", KEYS.APPS_WITH_PENDING]);
}

/**
 * Execute a Redis pipeline (MULTI/EXEC) via Upstash REST API
 * Used for atomic operations that need to happen together
 */
async function redisPipeline<T>(config: RedisConfig, commands: string[][]): Promise<T[]> {
  const response = await fetch(`${config.url}/pipeline`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${config.token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(commands),
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`Redis pipeline failed: ${response.status} - ${error}`);
  }

  const data = await response.json();
  return data.map((r: { result: T }) => r.result);
}

/**
 * Lua script to atomically dequeue a message and clean up if queue is empty.
 * This prevents race conditions where another process could modify the queue
 * between RPOP and LLEN operations.
 *
 * KEYS[1] = app pending messages list
 * KEYS[2] = apps with pending set
 * ARGV[1] = appId (for SREM)
 *
 * Returns the message ID or nil
 */
const DEQUEUE_SCRIPT = `
local messageId = redis.call('RPOP', KEYS[1])
if messageId then
  local remaining = redis.call('LLEN', KEYS[1])
  if remaining == 0 then
    redis.call('SREM', KEYS[2], ARGV[1])
  end
end
return messageId
`;

/**
 * Dequeue oldest message from an app's queue atomically.
 * Uses a Lua script to prevent race conditions between RPOP and cleanup.
 *
 * Race condition fixed: Previously, RPOP + LLEN + SREM were separate commands.
 * If two processes dequeued the last two messages simultaneously, both could
 * see remaining=0 and try to SREM, or worse, one might SREM while another
 * process was adding a new message.
 */
export async function dequeueMessage(config: RedisConfig, appId: string): Promise<string | null> {
  try {
    // Use EVAL to run the Lua script atomically
    const messageId = await redisCommand<string | null>(config, [
      "EVAL",
      DEQUEUE_SCRIPT,
      "2", // number of keys
      KEYS.APP_PENDING_MESSAGES(appId),
      KEYS.APPS_WITH_PENDING,
      appId,
    ]);
    return messageId;
  } catch (error) {
    // Fallback to pipeline if EVAL is not supported (some Redis proxies)
    // Pipeline provides atomicity guarantees similar to MULTI/EXEC
    console.warn(
      "EVAL not supported, falling back to pipeline:",
      error instanceof Error ? error.message : error,
    );
    const [messageId, remaining] = await redisPipeline<string | null | number>(config, [
      ["RPOP", KEYS.APP_PENDING_MESSAGES(appId)],
      ["LLEN", KEYS.APP_PENDING_MESSAGES(appId)],
    ]);

    if (remaining === 0) {
      await redisCommand(config, ["SREM", KEYS.APPS_WITH_PENDING, appId]);
    }

    return messageId as string | null;
  }
}

/**
 * Get count of pending messages for an app
 */
export async function getPendingCount(config: RedisConfig, appId: string): Promise<number> {
  return redisCommand<number>(config, ["LLEN", KEYS.APP_PENDING_MESSAGES(appId)]);
}

/**
 * Mark agent as working on an app
 */
export async function setAgentWorking(
  config: RedisConfig,
  appId: string,
  isWorking: boolean,
): Promise<void> {
  if (isWorking) {
    // Set with 5 minute TTL
    await redisCommand(config, ["SET", KEYS.AGENT_WORKING(appId), "1", "EX", "300"]);
  } else {
    await redisCommand(config, ["DEL", KEYS.AGENT_WORKING(appId)]);
  }
}

/**
 * Check if agent is currently working on an app
 */
export async function isAgentWorking(config: RedisConfig, appId: string): Promise<boolean> {
  const value = await redisCommand<string | null>(config, ["GET", KEYS.AGENT_WORKING(appId)]);
  return value === "1";
}

/**
 * Get queue statistics
 */
export async function getQueueStats(config: RedisConfig): Promise<{
  appsWithPending: number;
  totalPendingMessages: number;
  apps: Array<{ appId: string; count: number }>;
}> {
  const appIds = await getAppsWithPending(config);
  let totalPendingMessages = 0;
  const apps: Array<{ appId: string; count: number }> = [];

  for (const appId of appIds) {
    const count = await getPendingCount(config, appId);
    apps.push({ appId, count });
    totalPendingMessages += count;
  }

  return {
    appsWithPending: appIds.length,
    totalPendingMessages,
    apps,
  };
}
