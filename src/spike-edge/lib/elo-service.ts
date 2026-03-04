/**
 * ELO service: business logic for user/agent ELO reputation.
 * Operates on the D1 database directly (no ORM — spike-edge uses raw SQL).
 */

import { applyEloDelta, eloToTier } from "./elo.js";

export type EloEventType =
  | "report_valid_bug"
  | "bug_confirmed"
  | "successful_tool_use"
  | "false_bug_report"
  | "rate_limit_hit"
  | "abuse_flag"
  | "whatsapp_productive_use"
  | "bug_bounty_granted";

const ELO_DELTAS: Record<EloEventType, number> = {
  report_valid_bug: 25,
  bug_confirmed: 10,
  successful_tool_use: 1,
  false_bug_report: -15,
  rate_limit_hit: -5,
  abuse_flag: -50,
  whatsapp_productive_use: 2,
  bug_bounty_granted: 50,
};

const DAILY_GAIN_CAP = 100;
const DEFAULT_ELO = 1200;

export interface UserElo {
  userId: string;
  elo: number;
  eventCount: number;
  dailyGains: number;
  dailyResetAt: number;
  tier: "free" | "pro" | "elite";
}

/** In-memory cache for hot-path ELO lookups (60s TTL per isolate). */
const eloCache = new Map<string, { data: UserElo; expiresAt: number }>();
const CACHE_TTL_MS = 60_000;

function getCached(userId: string): UserElo | null {
  const entry = eloCache.get(userId);
  if (entry && entry.expiresAt > Date.now()) return entry.data;
  if (entry) eloCache.delete(userId);
  return null;
}

function setCache(data: UserElo): void {
  eloCache.set(data.userId, { data, expiresAt: Date.now() + CACHE_TTL_MS });
}

function invalidateCache(userId: string): void {
  eloCache.delete(userId);
}

/** Get user ELO, creating the row if it doesn't exist. */
export async function ensureUserElo(db: D1Database, userId: string): Promise<UserElo> {
  const cached = getCached(userId);
  if (cached) return cached;

  // Try to fetch existing row
  const row = await db.prepare(
    "SELECT user_id, elo, event_count, daily_gains, daily_reset_at, tier FROM user_elo WHERE user_id = ?",
  ).bind(userId).first<{
    user_id: string;
    elo: number;
    event_count: number;
    daily_gains: number;
    daily_reset_at: number;
    tier: string;
  }>();

  if (row) {
    const data: UserElo = {
      userId: row.user_id,
      elo: row.elo,
      eventCount: row.event_count,
      dailyGains: row.daily_gains,
      dailyResetAt: row.daily_reset_at,
      tier: row.tier as UserElo["tier"],
    };
    setCache(data);
    return data;
  }

  // Create new user with default ELO
  const now = Date.now();
  const tier = eloToTier(DEFAULT_ELO);
  await db.prepare(
    "INSERT INTO user_elo (user_id, elo, event_count, daily_gains, daily_reset_at, tier, created_at, updated_at) VALUES (?, ?, 0, 0, ?, ?, ?, ?)",
  ).bind(userId, DEFAULT_ELO, now, tier, now, now).run();

  const data: UserElo = {
    userId,
    elo: DEFAULT_ELO,
    eventCount: 0,
    dailyGains: 0,
    dailyResetAt: now,
    tier,
  };
  setCache(data);
  return data;
}

/** Check if daily gains should be reset (new UTC day). */
function shouldResetDaily(dailyResetAt: number, now: number): boolean {
  const resetDate = new Date(dailyResetAt);
  const nowDate = new Date(now);
  return (
    resetDate.getUTCFullYear() !== nowDate.getUTCFullYear() ||
    resetDate.getUTCMonth() !== nowDate.getUTCMonth() ||
    resetDate.getUTCDate() !== nowDate.getUTCDate()
  );
}

export interface EloEventResult {
  newElo: number;
  delta: number;
  tier: "free" | "pro" | "elite";
  capped: boolean;
}

/**
 * Record an ELO event for a user.
 * Respects daily gain cap for positive deltas.
 */
export async function recordEloEvent(
  db: D1Database,
  userId: string,
  eventType: EloEventType,
  referenceId?: string,
): Promise<EloEventResult> {
  const user = await ensureUserElo(db, userId);
  const now = Date.now();
  let baseDelta = ELO_DELTAS[eventType];

  // Reset daily gains if new day
  let dailyGains = user.dailyGains;
  let dailyResetAt = user.dailyResetAt;
  if (shouldResetDaily(user.dailyResetAt, now)) {
    dailyGains = 0;
    dailyResetAt = now;
  }

  // Apply daily gain cap for positive deltas
  let capped = false;
  if (baseDelta > 0) {
    const remainingCap = Math.max(0, DAILY_GAIN_CAP - dailyGains);
    if (baseDelta > remainingCap) {
      baseDelta = remainingCap;
      capped = true;
    }
    if (baseDelta === 0) {
      return { newElo: user.elo, delta: 0, tier: user.tier, capped: true };
    }
    dailyGains += baseDelta;
  }

  const newElo = applyEloDelta(user.elo, baseDelta);
  const newTier = eloToTier(newElo);

  // Update user_elo and insert elo_events in a batch
  await db.batch([
    db.prepare(
      "UPDATE user_elo SET elo = ?, event_count = event_count + 1, daily_gains = ?, daily_reset_at = ?, tier = ?, updated_at = ? WHERE user_id = ?",
    ).bind(newElo, dailyGains, dailyResetAt, newTier, now, userId),
    db.prepare(
      "INSERT INTO elo_events (id, user_id, event_type, delta, old_elo, new_elo, reference_id, created_at) VALUES (lower(hex(randomblob(16))), ?, ?, ?, ?, ?, ?, ?)",
    ).bind(userId, eventType, baseDelta, user.elo, newElo, referenceId ?? null, now),
  ]);

  invalidateCache(userId);

  return { newElo, delta: baseDelta, tier: newTier, capped };
}

/** Get user ELO (read-only, uses cache). Returns null if user has no ELO record. */
export async function getUserElo(db: D1Database, userId: string): Promise<UserElo | null> {
  const cached = getCached(userId);
  if (cached) return cached;

  const row = await db.prepare(
    "SELECT user_id, elo, event_count, daily_gains, daily_reset_at, tier FROM user_elo WHERE user_id = ?",
  ).bind(userId).first<{
    user_id: string;
    elo: number;
    event_count: number;
    daily_gains: number;
    daily_reset_at: number;
    tier: string;
  }>();

  if (!row) return null;

  const data: UserElo = {
    userId: row.user_id,
    elo: row.elo,
    eventCount: row.event_count,
    dailyGains: row.daily_gains,
    dailyResetAt: row.daily_reset_at,
    tier: row.tier as UserElo["tier"],
  };
  setCache(data);
  return data;
}

/** Clear the in-memory cache (useful for testing). */
export function clearEloCache(): void {
  eloCache.clear();
}

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * Grant a bug bounty reward to a user:
 * - Inserts an access_grant with tier="pro" expiring in 7 days
 * - Records a "bug_bounty_granted" ELO event
 */
export async function grantBugBounty(
  db: D1Database,
  userId: string,
  bugId: string,
): Promise<void> {
  const now = Date.now();
  const expiresAt = now + SEVEN_DAYS_MS;

  await db
    .prepare(
      "INSERT INTO access_grants (id, user_id, grant_type, tier, reason, reference_id, expires_at, created_at) VALUES (lower(hex(randomblob(16))), ?, 'bug_bounty', 'pro', 'Bug bounty reward', ?, ?, ?)",
    )
    .bind(userId, bugId, expiresAt, now)
    .run();

  await recordEloEvent(db, userId, "bug_bounty_granted", bugId);
}
