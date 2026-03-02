import logger from "@/lib/logger";

export const maxDuration = 300;

import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import { getSSEEvents, isAgentWorking, publishSSEEvent } from "@/lib/upstash";
import type { NextRequest } from "next/server";

// Event types for SSE
export type SSEEventType =
  | "connected"
  | "message"
  | "status"
  | "agent_working"
  | "code_updated"
  | "sync_in_progress"
  | "heartbeat";

interface SSEEvent {
  type: SSEEventType;
  data: unknown;
  timestamp: number;
}

/**
 * SSE Connection Store
 *
 * Two-layer architecture for multi-instance support:
 *
 * 1. LOCAL LAYER (this Map): Each instance maintains its own SSE connections.
 *    Fast local broadcasting to connected clients.
 *
 * 2. REDIS LAYER: Cross-instance communication via hybrid Pub/Sub + Lists pattern.
 *    When broadcasting, events are:
 *    - Published to Redis Pub/Sub channel (for real-time notification)
 *    - Stored in Redis Lists (for reliable delivery fallback)
 *    Each instance polls Redis every 2 seconds for events from other instances.
 *
 * This hybrid approach provides:
 * - Real-time delivery via Pub/Sub when possible
 * - Reliable delivery via Lists as fallback
 * - Support for Upstash Redis REST API limitations
 *
 * This enables horizontal scaling across multiple Vercel instances while maintaining
 * real-time updates for all connected clients.
 */
const activeConnections = new Map<string, Set<ReadableStreamDefaultController<Uint8Array>>>();

/**
 * Broadcast an event to all connected clients for an app
 *
 * Three-step broadcast process:
 * 1. Publish to Redis Pub/Sub channel (real-time notification)
 * 2. Store in Redis Lists (reliable fallback)
 * 3. Broadcast to local connections in this instance
 */
export function broadcastToApp(appId: string, event: Omit<SSEEvent, "timestamp">) {
  const connections = activeConnections.get(appId);
  logger.info(
    `[SSE] Broadcasting ${event.type} to app ${appId}: ${connections?.size || 0} local connections`,
  );

  const fullEvent: SSEEvent = {
    ...event,
    timestamp: Date.now(),
  };

  // 1. Publish to Redis (Pub/Sub + Lists hybrid)
  // This will publish to Redis Pub/Sub channel AND store in a List
  // See: https://upstash.com/docs/redis/features/pubsub
  publishSSEEvent(appId, fullEvent).catch((error) => {
    logger.error(`[SSE] Failed to publish to Redis:`, error);
    // Don't fail the broadcast if Redis is down - continue with local broadcast
  });

  // 2. Broadcast to local connections (existing logic)
  if (!connections || connections.size === 0) return;

  const eventString = `data: ${JSON.stringify(fullEvent)}

`;
  const encoder = new TextEncoder();
  const encoded = encoder.encode(eventString);

  for (const controller of connections) {
    try {
      controller.enqueue(encoded);
    } catch {
      // Intentionally silent: Connection closed - controller will be cleaned up by stream cancel handler.
      // Logging here would be too noisy for normal SSE disconnections.
    }
  }
}

/**
 * GET /api/apps/[id]/messages/stream
 * SSE endpoint for real-time updates
 */
export async function GET(_request: NextRequest, context: { params: Promise<{ id: string }> }) {
  const { data: session, error: authError } = await tryCatch(auth());

  if (authError || !session?.user?.id) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const { data: params, error: paramsError } = await tryCatch(context.params);
  if (paramsError) {
    return new Response(JSON.stringify({ error: "Invalid parameters" }), {
      status: 400,
      headers: { "Content-Type": "application/json" },
    });
  }
  const { id } = params;

  // Verify user owns this app
  const { data: app, error: appError } = await tryCatch(
    prisma.app.findFirst({
      where: {
        id,
        userId: session.user.id,
      },
      select: {
        id: true,
        status: true,
      },
    }),
  );

  if (appError) {
    logger.error("Error fetching app:", appError);
    return new Response(JSON.stringify({ error: "Internal server error" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }

  if (!app) {
    return new Response(JSON.stringify({ error: "App not found" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  // Create readable stream for SSE
  const encoder = new TextEncoder();
  let controllerRef: ReadableStreamDefaultController<Uint8Array> | null = null;

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      controllerRef = controller;

      // Add to active connections
      if (!activeConnections.has(id)) {
        activeConnections.set(id, new Set());
      }
      activeConnections.get(id)!.add(controller);
      logger.info(
        `[SSE] Client connected to app ${id}. Total connections: ${
          activeConnections.get(id)!.size
        }`,
      );

      // Track last processed timestamp for Redis event deduplication
      let lastProcessedTimestamp = Date.now();

      // Send connected event
      const connectedEvent: SSEEvent = {
        type: "connected",
        data: { appId: id, status: app.status },
        timestamp: Date.now(),
      };
      controller.enqueue(encoder.encode(`data: ${JSON.stringify(connectedEvent)}

`));

      // Check and send agent working status
      isAgentWorking(id).then((working) => {
        if (working) {
          const workingEvent: SSEEvent = {
            type: "agent_working",
            data: { isWorking: true },
            timestamp: Date.now(),
          };
          try {
            controller.enqueue(encoder.encode(`data: ${JSON.stringify(workingEvent)}

`));
          } catch {
            // Intentionally silent: Client disconnected between agent status check and enqueue.
          }
        }
      });

      // Set up heartbeat interval (every 30 seconds)
      const heartbeatInterval = setInterval(() => {
        try {
          const heartbeat: SSEEvent = {
            type: "heartbeat",
            data: null,
            timestamp: Date.now(),
          };
          controller.enqueue(encoder.encode(`data: ${JSON.stringify(heartbeat)}

`));
        } catch {
          // Intentionally silent: Client disconnected - clean up heartbeat interval.
          clearInterval(heartbeatInterval);
        }
      }, 30000);

      // Set up Redis polling interval (every 2 seconds)
      // Poll for events from other instances and forward to this connection
      const redisInterval = setInterval(() => {
        getSSEEvents(id, lastProcessedTimestamp)
          .then((events) => {
            for (const event of events) {
              try {
                // Skip if we already processed this event
                if (event.timestamp <= lastProcessedTimestamp) continue;

                // Forward to local connection
                const eventString = `data: ${JSON.stringify(event)}

`;
                controller.enqueue(encoder.encode(eventString));

                // Update last processed timestamp
                lastProcessedTimestamp = Math.max(lastProcessedTimestamp, event.timestamp);
              } catch {
                // Intentionally silent: Connection closed
              }
            }
          })
          .catch((error) => {
            logger.error(`[SSE] Failed to poll Redis events:`, error);
            // Don't stop polling on errors - Redis might be temporarily unavailable
          });
      }, 2000); // Poll every 2 seconds

      // Clean up on close
      const cleanup = () => {
        clearInterval(heartbeatInterval);
        clearInterval(redisInterval);
        const connections = activeConnections.get(id);
        if (connections) {
          connections.delete(controller);
          if (connections.size === 0) {
            activeConnections.delete(id);
          }
        }
      };

      // Store cleanup function for cancel
      (controller as unknown as { cleanup: () => void }).cleanup = cleanup;
    },

    cancel() {
      if (controllerRef) {
        const cleanup = (controllerRef as unknown as { cleanup?: () => void }).cleanup;
        if (cleanup) cleanup();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-store, must-revalidate",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no", // Disable nginx buffering
    },
  });
}

/**
 * Helper to broadcast a new message to app clients
 */
export function broadcastMessage(
  appId: string,
  message: {
    id: string;
    role: string;
    content: string;
    createdAt: Date;
    attachments?: Array<{ imageId: string; url: string }>;
    codeVersion?: { id: string; createdAt: Date };
  },
) {
  broadcastToApp(appId, {
    type: "message",
    data: message,
  });
}

/**
 * Helper to broadcast status change to app clients
 */
export function broadcastStatus(appId: string, status: string, message?: string) {
  broadcastToApp(appId, {
    type: "status",
    data: { status, message },
  });
}

/**
 * Helper to broadcast agent working status to app clients
 */
export function broadcastAgentWorking(appId: string, isWorking: boolean) {
  broadcastToApp(appId, {
    type: "agent_working",
    data: { isWorking },
  });
}

/**
 * Helper to broadcast code update to app clients (triggers iframe reload)
 */
export function broadcastCodeUpdated(appId: string) {
  broadcastToApp(appId, {
    type: "code_updated",
    data: { reloadRequired: true },
  });
}
/**
 * Helper to broadcast sync in progress status to app clients
 */
export function broadcastSyncInProgress(appId: string, isSyncing: boolean) {
  broadcastToApp(appId, {
    type: "sync_in_progress",
    data: { isSyncing },
  });
}
