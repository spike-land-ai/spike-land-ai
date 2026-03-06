/**
 * Spike Review — Cloudflare Worker
 *
 * Receives GitHub webhooks and triggers AI code reviews
 * with BAZDMEG quality gates.
 */

import type { Env } from "./env.js";
import { handleWebhook } from "./webhook-handler.js";
import { runReviewJob } from "./review-job.js";

interface CFExecutionContext {
  waitUntil(promise: Promise<unknown>): void;
  passThroughOnException(): void;
}

export default {
  async fetch(request: Request, env: Env, ctx: CFExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check
    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({
          status: "ok",
          service: "spike-review",
          version: "0.1.0",
        }),
        { headers: { "content-type": "application/json" } },
      );
    }

    // Webhook endpoint
    if (url.pathname === "/webhook" && request.method === "POST") {
      const result = await handleWebhook(request, env);

      if (result.context) {
        // Fire and forget — don't block the webhook response
        ctx.waitUntil(
          runReviewJob(result.context, env).catch((err) => {
            process.stderr.write(`Review job failed: ${err instanceof Error ? err.message : String(err)}\n`);
          }),
        );
      }

      return new Response(JSON.stringify({ message: result.body }), {
        status: result.status,
        headers: { "content-type": "application/json" },
      });
    }

    return new Response("Not found", { status: 404 });
  },
};
