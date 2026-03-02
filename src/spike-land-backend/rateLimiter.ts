import { handleErrors } from "./handleErrors";

export class CodeRateLimiter {
  private nextAllowedTime = 0;
  private requestCount = 0;
  private readonly GRACE_LIMIT = 4; // Allow 4 requests before applying cooldown
  private readonly GRACE_PERIOD = 20; // 20 seconds grace period
  private readonly RATE_LIMIT = 0.5; // 0.5 seconds cooldown after grace period

  async fetch(request: Request) {
    return await handleErrors(request, async () => {
      const now = Date.now() / 1000;

      // Reset counts if grace period has expired
      if (now > this.nextAllowedTime + this.GRACE_PERIOD) {
        this.requestCount = 0;
        this.nextAllowedTime = now;
      }

      if (request.method === "POST") {
        this.requestCount++;

        // Apply rate limiting after grace limit is exceeded
        if (this.requestCount > this.GRACE_LIMIT) {
          const cooldown = this.RATE_LIMIT;
          this.nextAllowedTime = now + cooldown;
          return new Response(String(cooldown));
        }
      }

      return new Response("0");
    });
  }

  public reset() {
    this.requestCount = 0;
  }
}
