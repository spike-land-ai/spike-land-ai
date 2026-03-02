import { DurableObject } from "cloudflare:workers";

export class RateLimiter extends DurableObject {
  private nextAllowedTime = 0;
  private requestCount = 0;
  private readonly GRACE_LIMIT = 4;
  private readonly GRACE_PERIOD = 20;
  private readonly RATE_LIMIT = 0.5;

  async fetch(request: Request): Promise<Response> {
    try {
      const now = Date.now() / 1000;

      if (now > this.nextAllowedTime + this.GRACE_PERIOD) {
        this.requestCount = 0;
        this.nextAllowedTime = now;
      }

      if (request.method === "POST") {
        this.requestCount++;

        if (this.requestCount > this.GRACE_LIMIT) {
          const cooldown = this.RATE_LIMIT;
          this.nextAllowedTime = now + cooldown;
          return new Response(String(cooldown));
        }
      }

      return new Response("0");
    } catch (err) {
      const message = err instanceof Error ? err.message : "Rate limiter error";
      return new Response(message, { status: 500 });
    }
  }
}
