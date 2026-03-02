/**
 * Codespace SSE Broadcast Utility
 *
 * Two-layer architecture for multi-instance support:
 *
 * 1. LOCAL LAYER (activeCodespaceConnections Map): Each Vercel instance
 *    maintains its own SSE connections. Fast local broadcasting.
 *
 * 2. REDIS LAYER: Cross-instance communication via hybrid Pub/Sub + Lists.
 *    When broadcasting, events are:
 *    - Published to Redis Pub/Sub channel (real-time notification)
 *    - Stored in Redis Lists (reliable delivery fallback)
 *    Each instance polls Redis every 2 seconds for events from other instances.
 */

import { redis } from "@/lib/upstash";
import { logger } from "@/lib/logger";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CodespaceSSEEventType =
  | "connected"
  | "session_update"
  | "version_created"
  | "heartbeat";

export interface CodespaceSSEEvent {
  type: CodespaceSSEEventType;
  data: unknown;
  timestamp: number;
}

export interface CodespaceSSEEventWithSource extends CodespaceSSEEvent {
  sourceInstanceId: string;
}

// ---------------------------------------------------------------------------
// Instance identity
// ---------------------------------------------------------------------------

/** Unique ID for this process, used to filter out self-published Redis events. */
const INSTANCE_ID = crypto.randomUUID();

export function getCodespaceInstanceId(): string {
  return INSTANCE_ID;
}

// ---------------------------------------------------------------------------
// Redis key helpers
// ---------------------------------------------------------------------------

function redisChannel(codeSpace: string): string {
  return `codespace:${codeSpace}:updates`;
}

function redisListKey(codeSpace: string): string {
  return `codespace:${codeSpace}:events`;
}

// ---------------------------------------------------------------------------
// Local connection store
// ---------------------------------------------------------------------------

const activeCodespaceConnections = new Map<
  string,
  Set<ReadableStreamDefaultController<Uint8Array>>
>();

export function getConnections(
  codeSpace: string,
): Set<ReadableStreamDefaultController<Uint8Array>> | undefined {
  return activeCodespaceConnections.get(codeSpace);
}

export function addConnection(
  codeSpace: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): void {
  if (!activeCodespaceConnections.has(codeSpace)) {
    activeCodespaceConnections.set(codeSpace, new Set());
  }
  activeCodespaceConnections.get(codeSpace)!.add(controller);
}

export function removeConnection(
  codeSpace: string,
  controller: ReadableStreamDefaultController<Uint8Array>,
): void {
  const connections = activeCodespaceConnections.get(codeSpace);
  if (connections) {
    connections.delete(controller);
    if (connections.size === 0) {
      activeCodespaceConnections.delete(codeSpace);
    }
  }
}

// ---------------------------------------------------------------------------
// Broadcast
// ---------------------------------------------------------------------------

/**
 * Broadcast an event to all SSE clients watching a codespace.
 *
 * Three-step process:
 * 1. Publish to Redis Pub/Sub channel (real-time cross-instance)
 * 2. Store in Redis List (reliable fallback)
 * 3. Broadcast to local connections in this instance
 */
export async function broadcastToCodespace(
  codeSpace: string,
  event: { type: CodespaceSSEEventType; data: unknown },
): Promise<void> {
  const fullEvent: CodespaceSSEEventWithSource = {
    ...event,
    timestamp: Date.now(),
    sourceInstanceId: INSTANCE_ID,
  };

  const channel = redisChannel(codeSpace);
  const key = redisListKey(codeSpace);
  const payload = JSON.stringify(fullEvent);

  // 1 & 2. Publish to Redis (Pub/Sub + List) in parallel
  await Promise.all([
    redis.publish(channel, payload).catch((err) => {
      logger.error(`[Codespace SSE] Failed to publish to channel ${channel}:`, err);
    }),
    (async () => {
      await redis.lpush(key, payload);
      await redis.expire(key, 60); // 60s TTL
      await redis.ltrim(key, 0, 99); // Keep last 100 events
    })().catch((err) => {
      logger.error(`[Codespace SSE] Failed to store event in list:`, err);
    }),
  ]);

  // 3. Broadcast to local connections
  const connections = activeCodespaceConnections.get(codeSpace);
  if (!connections || connections.size === 0) return;

  const eventString = `data: ${JSON.stringify(fullEvent)}\n\n`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(eventString);

  for (const controller of connections) {
    try {
      controller.enqueue(encoded);
    } catch {
      // Intentionally silent: Connection closed - controller will be cleaned up
      // by the stream cancel handler.
    }
  }
}

// ---------------------------------------------------------------------------
// Redis polling (used by stream route)
// ---------------------------------------------------------------------------

/**
 * Get codespace events published after a given timestamp.
 * Filters out events from this instance to prevent duplicates.
 */
export async function getCodespaceSSEEvents(
  codeSpace: string,
  afterTimestamp: number,
): Promise<CodespaceSSEEventWithSource[]> {
  const key = redisListKey(codeSpace);
  const events = await redis.lrange<string>(key, 0, -1);

  return events
    .map((e) => {
      if (typeof e === "string") {
        return JSON.parse(e) as CodespaceSSEEventWithSource;
      }
      return e as unknown as CodespaceSSEEventWithSource;
    })
    .filter((e) => e.timestamp > afterTimestamp && e.sourceInstanceId !== INSTANCE_ID)
    .reverse(); // Oldest first for replay
}
