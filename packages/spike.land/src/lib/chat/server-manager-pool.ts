/**
 * Pool of ServerManager instances keyed by user ID.
 *
 * Avoids spawning new MCP server processes per request.
 * Idle instances are closed after TTL expiry.
 *
 * In Docker/production, uses InProcessToolProvider (in-process tool handlers)
 * instead of spawning external child processes.
 */

import { existsSync } from "node:fs";
import { discoverConfig, ServerManager } from "@spike-land-ai/spike-cli";
import { InProcessToolProvider } from "./in-process-tool-provider";
import logger from "@/lib/logger";

/** Duck-type interface covering what runAgentLoop actually uses. */
type ToolProvider = Pick<ServerManager, "getAllTools" | "callTool" | "closeAll">;

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface PoolEntry {
  provider: ToolProvider;
  lastUsed: number;
  connecting?: Promise<void>;
}

const pool = new Map<string, PoolEntry>();
let cleanupTimer: ReturnType<typeof setInterval> | null = null;

/**
 * Detect whether to use in-process tools instead of external multiplexer.
 * Returns true in production, Docker, or when explicitly configured.
 */
function shouldUseInProcessTools(): boolean {
  if (process.env.USE_INPROCESS_MCP === "1") return true;
  if (process.env.NODE_ENV === "production") return true;
  try {
    return existsSync("/.dockerenv");
  } catch {
    return false;
  }
}

function startCleanupTimer() {
  if (cleanupTimer) return;
  cleanupTimer = setInterval(() => {
    const now = Date.now();
    for (const [key, entry] of pool) {
      if (now - entry.lastUsed > DEFAULT_TTL_MS) {
        entry.provider.closeAll().catch((err: unknown) => {
          logger.error("Error closing idle provider", {
            key,
            error: err instanceof Error ? err.message : String(err),
          });
        });
        pool.delete(key);
      }
    }
    if (pool.size === 0 && cleanupTimer) {
      clearInterval(cleanupTimer);
      cleanupTimer = null;
    }
  }, 60_000);
}

/**
 * Get or create a tool provider (ServerManager or InProcessToolProvider) for the given user.
 * The provider is cached and reused across requests.
 */
export async function getServerManager(userId: string): Promise<ServerManager> {
  const existing = pool.get(userId);
  if (existing) {
    existing.lastUsed = Date.now();
    if (existing.connecting) await existing.connecting;
    return existing.provider as ServerManager;
  }

  // In-process path: Docker, production, or explicit opt-in
  if (shouldUseInProcessTools()) {
    const provider = await InProcessToolProvider.create(userId);
    const entry: PoolEntry = { provider, lastUsed: Date.now() };
    pool.set(userId, entry);
    startCleanupTimer();
    return provider as unknown as ServerManager;
  }

  // External multiplexer path: local development
  const manager = new ServerManager();
  const entry: PoolEntry = { provider: manager, lastUsed: Date.now() };

  entry.connecting = (async () => {
    try {
      const config = await discoverConfig();
      await manager.connectAll(config);
    } catch (err) {
      logger.warn("External multiplexer failed, falling back to in-process", {
        error: err instanceof Error ? err.message : String(err),
      });
      // Replace with in-process provider
      entry.provider = await InProcessToolProvider.create(userId);
    }
  })();

  pool.set(userId, entry);
  startCleanupTimer();

  try {
    await entry.connecting;
  } finally {
    delete entry.connecting;
  }

  return entry.provider as ServerManager;
}

/** Close and remove a specific user's manager. */
export async function removeServerManager(userId: string): Promise<void> {
  const entry = pool.get(userId);
  if (entry) {
    await entry.provider.closeAll();
    pool.delete(userId);
  }
}

/** Close all managers (for graceful shutdown). */
export async function closeAllManagers(): Promise<void> {
  await Promise.allSettled([...pool.values()].map((e) => e.provider.closeAll()));
  pool.clear();
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }
}

/** Number of currently pooled managers (for testing/monitoring). */
export function poolSize(): number {
  return pool.size;
}
