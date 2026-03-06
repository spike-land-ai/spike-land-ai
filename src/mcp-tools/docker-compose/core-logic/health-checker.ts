import type { HealthResult } from "./types.js";

export class HealthChecker {
  async check(service: string, upstream: string, port: number): Promise<HealthResult> {
    const start = Date.now();

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 5_000);

      const res = await fetch(`http://${upstream}:${port}/health`, {
        signal: controller.signal,
      });

      clearTimeout(timeout);
      const latencyMs = Date.now() - start;

      return {
        service,
        healthy: res.ok,
        statusCode: res.status,
        latencyMs,
        ...(res.ok ? {} : { error: `HTTP ${res.status}` }),
      };
    } catch (err: unknown) {
      const latencyMs = Date.now() - start;
      const message = err instanceof Error ? err.message : String(err);
      return {
        service,
        healthy: false,
        latencyMs,
        error: message,
      };
    }
  }
}
