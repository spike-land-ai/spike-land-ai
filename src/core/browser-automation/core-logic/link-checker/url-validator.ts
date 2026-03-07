import type { ExtractedLink, LinkValidationResult } from "./types.js";

class Semaphore {
  private queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly max: number) {}

  async acquire(): Promise<void> {
    if (this.active < this.max) {
      this.active++;
      return;
    }
    return new Promise<void>((resolve) => {
      this.queue.push(resolve);
    });
  }

  release(): void {
    this.active--;
    const next = this.queue.shift();
    if (next) {
      this.active++;
      next();
    }
  }
}

export interface UrlValidatorOptions {
  concurrency?: number;
  timeout?: number;
}

export interface UrlValidator {
  validate(link: ExtractedLink): Promise<LinkValidationResult>;
}

export function createUrlValidator(options: UrlValidatorOptions = {}): UrlValidator {
  const { concurrency = 5, timeout = 10_000 } = options;
  const semaphore = new Semaphore(concurrency);

  async function validate(link: ExtractedLink): Promise<LinkValidationResult> {
    const start = Date.now();
    await semaphore.acquire();
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), timeout);

      try {
        // Try HEAD first
        let response = await fetch(link.target, {
          method: "HEAD",
          signal: controller.signal,
          redirect: "follow",
          headers: { "User-Agent": "spike-land-ai-link-checker/1.0" },
        });

        // Fallback to GET if HEAD returns 405
        if (response.status === 405) {
          response = await fetch(link.target, {
            method: "GET",
            signal: controller.signal,
            redirect: "follow",
            headers: { "User-Agent": "spike-land-ai-link-checker/1.0" },
          });
        }

        clearTimeout(timer);

        // Handle redirects as warnings
        if (response.redirected && response.url !== link.target) {
          return {
            link,
            status: "warning",
            httpStatus: response.status,
            reason: `Redirected to ${response.url}`,
            suggestion: response.url,
            durationMs: Date.now() - start,
          };
        }

        if (response.ok) {
          return {
            link,
            status: "ok",
            httpStatus: response.status,
            reason: `HTTP ${response.status}`,
            durationMs: Date.now() - start,
          };
        }

        // Rate limiting - retry with backoff
        if (response.status === 429) {
          const retryAfter = response.headers.get("Retry-After");
          const waitMs = retryAfter ? parseInt(retryAfter, 10) * 1000 : 2000;
          await new Promise((r) => setTimeout(r, Math.min(waitMs, 10000)));

          const retryResponse = await fetch(link.target, {
            method: "HEAD",
            headers: { "User-Agent": "spike-land-ai-link-checker/1.0" },
          });

          if (retryResponse.ok) {
            return {
              link,
              status: "ok",
              httpStatus: retryResponse.status,
              reason: `HTTP ${retryResponse.status} (after rate limit retry)`,
              durationMs: Date.now() - start,
            };
          }
        }

        return {
          link,
          status: response.status === 404 ? "broken" : "error",
          httpStatus: response.status,
          reason: `HTTP ${response.status}`,
          durationMs: Date.now() - start,
        };
      } catch (err: unknown) {
        clearTimeout(timer);
        const message = err instanceof Error ? err.message : String(err);
        if (message.includes("abort")) {
          return {
            link,
            status: "error",
            reason: `Timeout after ${timeout}ms`,
            durationMs: Date.now() - start,
          };
        }
        return {
          link,
          status: "error",
          reason: `Network error: ${message}`,
          durationMs: Date.now() - start,
        };
      }
    } finally {
      semaphore.release();
    }
  }

  return { validate };
}
