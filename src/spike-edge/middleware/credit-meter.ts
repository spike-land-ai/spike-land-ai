/**
 * Credit Metering Middleware
 *
 * Runs before /proxy/ai to check credit balance.
 * Business tier users bypass metering (unlimited).
 * Deducts 1 credit after a successful proxy call.
 */

import type { MiddlewareHandler } from "hono";
import type { Env } from "../env.js";
import { getBalance, deductCredit } from "../lib/credit-service.js";
import { resolveEffectiveTier } from "../lib/tier-service.js";
import { createLogger } from "@spike-land-ai/shared";

const log = createLogger("spike-edge");

export const creditMeterMiddleware: MiddlewareHandler<{ Bindings: Env }> = async (c, next) => {
  const userId = c.get("userId" as never) as string | undefined;

  // No userId — auth middleware should have already rejected, but be defensive
  if (!userId) {
    return c.json({ error: "Unauthorized" }, 401);
  }

  const tier = await resolveEffectiveTier(c.env.DB, userId);

  // Business tier is unlimited — skip metering
  if (tier === "business") {
    return next();
  }

  const { balance } = await getBalance(c.env.DB, userId);
  const required = 1;

  if (balance < required) {
    return c.json(
      {
        error: "insufficient_credits",
        balance,
        required,
      },
      402,
    );
  }

  // Run the actual handler
  await next();

  // Deduct only on success (2xx)
  if (c.res.status >= 200 && c.res.status < 300) {
    const requestId = (c.get("requestId" as never) as string | undefined) ?? crypto.randomUUID();
    try {
      await deductCredit(c.env.DB, userId, required, "AI proxy call", requestId);
    } catch {
      // Non-fatal — log but don't fail the response
      log.error("Failed to deduct credit", { userId });
    }
  }
};
