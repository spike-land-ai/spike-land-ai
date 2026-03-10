import type { Env } from "./env";
import { STATUS_PROBE_HEADER } from "../../common/core-logic/service-metrics";

export interface ServiceProbe {
  label: string;
  url: string;
  binding: Exclude<keyof Env, "STATUS_DB">;
  path: string;
}

export interface ProbeResult {
  label: string;
  url: string;
  status: "up" | "degraded" | "down";
  httpStatus: number | null;
  latencyMs: number;
  error: string | null;
}

export interface StatusSnapshot {
  overall: "operational" | "partial_degradation" | "major_outage";
  summary: {
    up: number;
    degraded: number;
    down: number;
    total: number;
  };
  services: ProbeResult[];
}

export const SERVICES: ServiceProbe[] = [
  { label: "Main Site", url: "https://spike.land/health", binding: "SPIKE_EDGE", path: "/health" },
  {
    label: "Edge API",
    url: "https://api.spike.land/health",
    binding: "SPIKE_EDGE",
    path: "/api/health",
  },
  {
    label: "Transpile",
    url: "https://js.spike.land/health",
    binding: "TRANSPILE",
    path: "/health",
  },
  {
    label: "MCP Registry",
    url: "https://mcp.spike.land/health",
    binding: "MCP_REGISTRY",
    path: "/health",
  },
  {
    label: "Auth MCP",
    url: "https://auth-mcp.spike.land/health",
    binding: "AUTH_MCP",
    path: "/health",
  },
  {
    label: "Image Studio",
    url: "https://image-studio-mcp.spike.land/health",
    binding: "IMAGE_STUDIO",
    path: "/health",
  },
];

export const TIMEOUT_MS = 3000;
export const DEGRADED_THRESHOLD_MS = 1200;

function getResultStatus(isOk: boolean, latencyMs: number): ProbeResult["status"] {
  if (!isOk) return "down";
  return latencyMs <= DEGRADED_THRESHOLD_MS ? "up" : "degraded";
}

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (error.name === "AbortError" || error.message.toLowerCase().includes("abort")) {
      return "Timeout";
    }
    return error.message;
  }

  return "Unknown error";
}

export async function probeService(service: ServiceProbe, env: Env): Promise<ProbeResult> {
  const start = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const request = new Request(`https://internal${service.path}`, {
      method: "GET",
      headers: {
        [STATUS_PROBE_HEADER]: "1",
      },
      signal: controller.signal,
    });
    const response = await env[service.binding].fetch(request);
    const latencyMs = Date.now() - start;
    clearTimeout(timer);

    return {
      label: service.label,
      url: service.url,
      status: getResultStatus(response.ok, latencyMs),
      httpStatus: response.status,
      latencyMs,
      error: response.ok ? null : `HTTP ${response.status}`,
    };
  } catch (error) {
    clearTimeout(timer);
    const latencyMs = Date.now() - start;

    return {
      label: service.label,
      url: service.url,
      status: "down",
      httpStatus: null,
      latencyMs,
      error: getErrorMessage(error),
    };
  }
}

export async function probeAll(env: Env): Promise<ProbeResult[]> {
  return Promise.all(SERVICES.map((service) => probeService(service, env)));
}

export function createStatusSnapshot(results: ProbeResult[]): StatusSnapshot {
  const up = results.filter((result) => result.status === "up").length;
  const degraded = results.filter((result) => result.status === "degraded").length;
  const down = results.filter((result) => result.status === "down").length;

  let overall: StatusSnapshot["overall"] = "operational";
  if (down > 0) overall = "major_outage";
  else if (degraded > 0) overall = "partial_degradation";

  return {
    overall,
    summary: {
      up,
      degraded,
      down,
      total: results.length,
    },
    services: results,
  };
}
