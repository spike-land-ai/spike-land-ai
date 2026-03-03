import {
  ENHANCEMENT_COSTS,
  type EnhancementTier,
  type ImageStudioDeps,
} from "@spike-land-ai/mcp-image-studio";
import type { Env } from "../env.d.ts";
import { nanoid } from "./nanoid.ts";

const WEEKLY_CREDITS = 100;

export function createD1Credits(env: Env): ImageStudioDeps["credits"] {
  const db = env.IMAGE_DB;

  async function ensureUser(userId: string): Promise<void> {
    const now = new Date().toISOString();
    // Create if not exists
    await db
      .prepare("INSERT OR IGNORE INTO credits (userId, remaining, updatedAt) VALUES (?, ?, ?)")
      .bind(userId, WEEKLY_CREDITS, now)
      .run();
    // Reset if older than 7 days
    await db
      .prepare(
        "UPDATE credits SET remaining = ?, updatedAt = ? WHERE userId = ? AND datetime(updatedAt) <= datetime(?, '-7 days')",
      )
      .bind(WEEKLY_CREDITS, now, userId, now)
      .run();
  }

  return {
    async hasEnough(userId, amount) {
      await ensureUser(userId);
      const row = await db
        .prepare("SELECT remaining FROM credits WHERE userId = ?")
        .bind(userId)
        .first<{ remaining: number }>();
      return (row?.remaining ?? 0) >= amount;
    },

    async consume(opts) {
      await ensureUser(opts.userId);
      const now = new Date().toISOString();

      const result = await db
        .prepare(
          "UPDATE credits SET remaining = remaining - ?, updatedAt = ? WHERE userId = ? AND remaining >= ?",
        )
        .bind(opts.amount, now, opts.userId, opts.amount)
        .run();

      if (!result.meta.changes) {
        return { success: false, remaining: 0, error: "Insufficient credits" };
      }

      await db
        .prepare(
          "INSERT INTO credit_transactions (id, userId, amount, source, sourceId, createdAt) VALUES (?, ?, ?, ?, ?, ?)",
        )
        .bind(nanoid(), opts.userId, -opts.amount, opts.source, opts.sourceId ?? null, now)
        .run();

      const row = await db
        .prepare("SELECT remaining FROM credits WHERE userId = ?")
        .bind(opts.userId)
        .first<{ remaining: number }>();

      return { success: true, remaining: row?.remaining ?? 0 };
    },

    async refund(userId, amount) {
      const now = new Date().toISOString();
      await db
        .prepare("UPDATE credits SET remaining = remaining + ?, updatedAt = ? WHERE userId = ?")
        .bind(amount, now, userId)
        .run();

      await db
        .prepare(
          "INSERT INTO credit_transactions (id, userId, amount, source, sourceId, createdAt) VALUES (?, ?, ?, 'refund', NULL, ?)",
        )
        .bind(nanoid(), userId, amount, now)
        .run();

      return true;
    },

    async getBalance(userId) {
      await ensureUser(userId);
      const row = await db
        .prepare("SELECT remaining FROM credits WHERE userId = ?")
        .bind(userId)
        .first<{ remaining: number }>();
      return row ? { remaining: row.remaining } : null;
    },

    estimate(tier: EnhancementTier, count = 1) {
      return ENHANCEMENT_COSTS[tier] * count;
    },
    calculateGenerationCost(opts) {
      return (ENHANCEMENT_COSTS[opts.tier] || 1) * (opts.numImages || 1);
    },
  };
}
