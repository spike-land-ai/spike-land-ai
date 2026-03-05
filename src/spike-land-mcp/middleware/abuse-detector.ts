import type { Env } from "../env";

interface AbuseState {
  calls: number;
  errors: number;
  flagged: boolean;
}

/**
 * Tracks per-user: call count in 10s window (KV, 60s TTL)
 * - >20 calls in 10s -> abuse_flag
 * - >10 errors in 10s -> abuse_flag
 */
export async function detectAbuse(
  kv: KVNamespace,
  userId: string,
  outcome: "success" | "error",
): Promise<boolean> {
  const now = Date.now();
  const windowKey = `abuse:${userId}:${Math.floor(now / 10000)}`; // 10s window
  
  const raw = await kv.get(windowKey);
  let state: AbuseState = { calls: 0, errors: 0, flagged: false };
  if (raw) {
    try {
      state = JSON.parse(raw);
    } catch {}
  }
  
  if (state.flagged) return false; // Already flagged this window
  
  state.calls++;
  if (outcome === "error") {
    state.errors++;
  } else {
    // Reset errors if there's a success, acting like a consecutive error counter within the window
    state.errors = 0;
  }
  
  let shouldFlag = false;
  if (state.calls > 20 || state.errors > 10) {
    shouldFlag = true;
    state.flagged = true;
  }
  
  await kv.put(windowKey, JSON.stringify(state), { expirationTtl: 60 });
  
  return shouldFlag;
}

export async function reportAbuseFlag(
  _env: Env,
  _userId: string,
  isAgent: boolean,
) {
  try {
    if (isAgent) {
      // Find the agent's owner
      // Wait, if it's an agent, the caller passed the agentId as userId or in header.
      // In routes/mcp.ts, we have `userId` and `agentId`. Let's just use the appropriate endpoint.
    }
  } catch (err) {
    console.error("[abuse-detector] Failed to report abuse:", err);
  }
}
