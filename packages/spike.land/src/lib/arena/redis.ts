/**
 * Arena Redis Caching
 *
 * Redis key management for arena state, SSE events, and caching.
 * Follows the pattern from src/lib/upstash/client.ts.
 */

import { getSSEEvents, publishSSEEvent, redis } from "@/lib/upstash";
import type { ArenaSSEEvent } from "./types";

export const ARENA_KEYS = {
  SUBMISSION_STATE: (id: string) => `arena:submission:${id}:state`,
  SUBMISSION_WORKING: (id: string) => `arena:submission:${id}:working`,
  SSE_EVENTS: (id: string) => `arena:sse:${id}:events`,
  LEADERBOARD_CACHE: "arena:leaderboard:top50",
  CHALLENGE_LIST_CACHE: "arena:challenges:open",
} as const;

/**
 * Set submission state in Redis with 5min TTL.
 */
export async function setSubmissionState(submissionId: string, state: string): Promise<void> {
  await redis.set(ARENA_KEYS.SUBMISSION_STATE(submissionId), state, {
    ex: 300,
  });
}

/**
 * Get submission state from Redis.
 */
export async function getSubmissionState(submissionId: string): Promise<string | null> {
  return redis.get<string>(ARENA_KEYS.SUBMISSION_STATE(submissionId));
}

/**
 * Mark a submission as being worked on (for UI indicator).
 */
export async function setSubmissionWorking(
  submissionId: string,
  isWorking: boolean,
): Promise<void> {
  if (isWorking) {
    await redis.set(ARENA_KEYS.SUBMISSION_WORKING(submissionId), "1", {
      ex: 300,
    });
  } else {
    await redis.del(ARENA_KEYS.SUBMISSION_WORKING(submissionId));
  }
}

/**
 * Check if a submission is currently being processed.
 */
export async function isSubmissionWorking(submissionId: string): Promise<boolean> {
  const value = await redis.get(ARENA_KEYS.SUBMISSION_WORKING(submissionId));
  return value === "1";
}

/**
 * Publish an arena SSE event using the hybrid pub/sub + list pattern.
 */
export async function publishArenaEvent(
  submissionId: string,
  event: Omit<ArenaSSEEvent, "timestamp">,
): Promise<void> {
  await publishSSEEvent(`arena:${submissionId}`, {
    ...event,
    timestamp: Date.now(),
  });
}

/**
 * Get arena SSE events after a timestamp.
 */
export async function getArenaEvents(submissionId: string, afterTimestamp: number) {
  return getSSEEvents(`arena:${submissionId}`, afterTimestamp);
}

/**
 * Cache leaderboard data (60s TTL).
 */
export async function cacheLeaderboard(data: unknown): Promise<void> {
  await redis.set(ARENA_KEYS.LEADERBOARD_CACHE, JSON.stringify(data), {
    ex: 60,
  });
}

/**
 * Get cached leaderboard data.
 */
export async function getCachedLeaderboard<T>(): Promise<T | null> {
  const cached = await redis.get<string>(ARENA_KEYS.LEADERBOARD_CACHE);
  if (!cached) return null;
  return (typeof cached === "string" ? JSON.parse(cached) : cached) as T;
}

/**
 * Cache challenge list (30s TTL).
 */
export async function cacheChallengeList(data: unknown): Promise<void> {
  await redis.set(ARENA_KEYS.CHALLENGE_LIST_CACHE, JSON.stringify(data), {
    ex: 30,
  });
}

/**
 * Get cached challenge list.
 */
export async function getCachedChallengeList<T>(): Promise<T | null> {
  const cached = await redis.get<string>(ARENA_KEYS.CHALLENGE_LIST_CACHE);
  if (!cached) return null;
  return (typeof cached === "string" ? JSON.parse(cached) : cached) as T;
}
