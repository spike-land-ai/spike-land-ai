import { createMiddleware } from "hono/factory";
import { getUserElo } from "../../core-logic/elo-service.js";
import type { Env, Variables } from "../../core-logic/env.js";

export const eloThrottleMiddleware = createMiddleware<{ Bindings: Env; Variables: Variables }>(async (c, next) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return next();
  }

  const user = await getUserElo(c.env.DB, userId);
  const elo = user?.elo ?? 1200;

  let delayMs = 0;
  if (elo < 100) {
    delayMs = 2000;
  } else if (elo < 300) {
    delayMs = 1000;
  } else if (elo < 500) {
    delayMs = 500;
  }

  if (delayMs > 0) {
    await new Promise((resolve) => setTimeout(resolve, delayMs));
  }

  return next();
});
