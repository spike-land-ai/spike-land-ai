/**
 * Unified Health Response Contract
 *
 * Standard health response type + factory used by all spike.land workers.
 * Ensures every /health endpoint returns the same shape.
 */

export type HealthStatus = "ok" | "degraded";

export interface HealthCheckResult {
  status: HealthStatus;
  latency_ms: number;
  detail?: string;
}

export interface HealthResponse {
  status: HealthStatus;
  service: string;
  timestamp: string;
  version: string;
  uptime_ms: number;
  checks?: Record<string, HealthCheckResult>;
}

/** Module-level boot timestamp — set once per isolate. */
const BOOT_TIME = Date.now();

declare const __BUILD_SHA__: string;

function getBuildSha(): string {
  try {
    return typeof __BUILD_SHA__ !== "undefined" ? __BUILD_SHA__ : "dev";
  } catch {
    return "dev";
  }
}

export interface BuildHealthResponseOptions {
  service: string;
  checks?: Record<string, HealthCheckResult>;
  version?: string;
  timestamp?: string;
}

/**
 * Build a standard health response. Overall status is "degraded" if any check
 * is degraded; "ok" otherwise.
 */
export function buildStandardHealthResponse(options: BuildHealthResponseOptions): HealthResponse {
  const checks = options.checks;
  let overall: HealthStatus = "ok";
  if (checks) {
    for (const check of Object.values(checks)) {
      if (check.status === "degraded") {
        overall = "degraded";
        break;
      }
    }
  }

  return {
    status: overall,
    service: options.service,
    timestamp: options.timestamp ?? new Date().toISOString(),
    version: options.version ?? getBuildSha(),
    uptime_ms: Date.now() - BOOT_TIME,
    ...(checks && Object.keys(checks).length > 0 ? { checks } : {}),
  };
}

/**
 * Measure the latency and status of an async dependency check.
 * Returns a HealthCheckResult with timing.
 */
export async function timedCheck(
  fn: () => Promise<void>,
  detail?: string,
): Promise<HealthCheckResult> {
  const start = Date.now();
  try {
    await fn();
    return {
      status: "ok",
      latency_ms: Date.now() - start,
      ...(detail ? { detail } : {}),
    };
  } catch (err) {
    return {
      status: "degraded",
      latency_ms: Date.now() - start,
      detail: err instanceof Error ? err.message : "unknown error",
    };
  }
}

/**
 * Measure the latency and status of a fetch-based service binding check.
 */
export async function timedFetchCheck(
  binding: { fetch(request: Request, init?: RequestInit): Promise<Response> },
  options: { requestUrl?: string; timeoutMs?: number; label?: string } = {},
): Promise<HealthCheckResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 3_000);

  try {
    const response = await binding.fetch(
      new Request(options.requestUrl ?? "https://internal/health"),
      { signal: controller.signal },
    );
    const latency_ms = Date.now() - start;
    return {
      status: response.ok ? "ok" : "degraded",
      latency_ms,
      ...(options.label ? { detail: options.label } : {}),
      ...(!response.ok ? { detail: `HTTP ${response.status}` } : {}),
    };
  } catch (err) {
    return {
      status: "degraded",
      latency_ms: Date.now() - start,
      detail: err instanceof Error ? err.message : "fetch failed",
    };
  } finally {
    clearTimeout(timeout);
  }
}

/**
 * Get the HTTP status code for a health response.
 */
export function getHealthHttpStatus(response: Pick<HealthResponse, "status">): 200 | 503 {
  return response.status === "ok" ? 200 : 503;
}
