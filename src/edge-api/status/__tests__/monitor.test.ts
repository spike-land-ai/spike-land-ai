import { describe, expect, it, vi, afterEach } from "vitest";
import app from "../api/app";
import { STATUS_PROBE_HEADER } from "../../common/core-logic/service-metrics";
import type { Env } from "../core-logic/env";
import {
  createStatusSnapshot,
  probeAll,
  probeService,
  SERVICES,
  type ServiceProbe,
} from "../core-logic/monitor";

function createFetcher(handler: (request: Request) => Response | Promise<Response>): Fetcher {
  return {
    fetch: vi.fn(handler),
  };
}

function createStatusDb(
  rowsByService: Record<
    string,
    Array<{
      minute_bucket: number;
      request_count: number;
      latency_min_ms: number;
      latency_max_ms: number;
      latency_sum_ms: number;
      latency_sum_sq_ms: number;
    }>
  > = {},
): D1Database {
  return {
    exec: vi.fn(async () => undefined),
    prepare: vi.fn(() => ({
      bind: (...params: unknown[]) => {
        const [serviceName, cutoff] = params;
        const rows =
          typeof serviceName === "string"
            ? (rowsByService[serviceName] ?? []).filter(
                (row) => row.minute_bucket >= Number(cutoff ?? 0),
              )
            : [];

        return {
          all: vi.fn(async () => ({ results: rows })),
          run: vi.fn(async () => ({ success: true })),
          first: vi.fn(async () => rows[0] ?? null),
        };
      },
    })),
  } as unknown as D1Database;
}

function createEnv(overrides: Partial<Env> = {}): Env {
  const okFetcher = createFetcher(
    () => new Response(JSON.stringify({ status: "ok" }), { status: 200 }),
  );

  return {
    STATUS_DB: createStatusDb(),
    SPIKE_EDGE: okFetcher,
    TRANSPILE: okFetcher,
    MCP_REGISTRY: okFetcher,
    AUTH_MCP: okFetcher,
    IMAGE_STUDIO: okFetcher,
    ...overrides,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe("probeService", () => {
  it("uses the service binding health endpoint and marks fast successes as up", async () => {
    const service: ServiceProbe = {
      label: "Edge API",
      url: "https://api.spike.land/health",
      binding: "SPIKE_EDGE",
      path: "/api/health",
    };
    const fetcher = createFetcher((request) => {
      expect(new URL(request.url).pathname).toBe("/api/health");
      expect(request.headers.get(STATUS_PROBE_HEADER)).toBe("1");
      return new Response(JSON.stringify({ status: "ok" }), { status: 200 });
    });
    const env = createEnv({ SPIKE_EDGE: fetcher });

    vi.spyOn(Date, "now").mockReturnValueOnce(100).mockReturnValueOnce(250);

    await expect(probeService(service, env)).resolves.toEqual({
      label: "Edge API",
      url: "https://api.spike.land/health",
      status: "up",
      httpStatus: 200,
      latencyMs: 150,
      error: null,
    });
  });

  it("marks slow successes as degraded", async () => {
    const env = createEnv();

    vi.spyOn(Date, "now").mockReturnValueOnce(0).mockReturnValueOnce(1500);

    await expect(probeService(SERVICES[0]!, env)).resolves.toMatchObject({
      status: "degraded",
      httpStatus: 200,
      latencyMs: 1500,
    });
  });

  it("marks failed binding fetches as down", async () => {
    const env = createEnv({
      AUTH_MCP: createFetcher(() => {
        throw new Error("boom");
      }),
    });

    vi.spyOn(Date, "now").mockReturnValueOnce(10).mockReturnValueOnce(25);

    await expect(probeService(SERVICES[4]!, env)).resolves.toMatchObject({
      status: "down",
      httpStatus: null,
      latencyMs: 15,
      error: "boom",
    });
  });
});

describe("status snapshot", () => {
  it("tracks the deployed services instead of the dead chat and esm probes", async () => {
    const results = await probeAll(createEnv());
    const labels = results.map((result) => result.label);

    expect(labels).toEqual([
      "Main Site",
      "Edge API",
      "Transpile",
      "MCP Registry",
      "Auth MCP",
      "Image Studio",
    ]);

    const snapshot = createStatusSnapshot(results);
    expect(snapshot.summary).toEqual({ up: 6, degraded: 0, down: 0, total: 6 });
    expect(snapshot.overall).toBe("operational");
  });
});

describe("/api/status", () => {
  it("returns live status together with historical request telemetry", async () => {
    const now = 6 * 60 * 60 * 1000;
    const env = createEnv({
      STATUS_DB: createStatusDb({
        "MCP Registry": [
          {
            minute_bucket: now - 60_000,
            request_count: 4,
            latency_min_ms: 80,
            latency_max_ms: 240,
            latency_sum_ms: 520,
            latency_sum_sq_ms: 83_600,
          },
          {
            minute_bucket: now,
            request_count: 2,
            latency_min_ms: 60,
            latency_max_ms: 120,
            latency_sum_ms: 180,
            latency_sum_sq_ms: 18_000,
          },
        ],
      }),
      MCP_REGISTRY: createFetcher(() => new Response("unavailable", { status: 503 })),
    });
    vi.spyOn(Date, "now").mockImplementation(() => now);

    const response = await app.fetch(
      new Request("https://status.spike.land/api/status?range=60m"),
      env,
    );
    const body = (await response.json()) as {
      overall: string;
      range: { key: string; label: string; windowMinutes: number };
      summary: { up: number; degraded: number; down: number; total: number };
      services: Array<{
        label: string;
        status: string;
        httpStatus: number | null;
        history: {
          summary: {
            totalRequests: number;
            currentRpm: number;
            meanLatencyMs: number | null;
          };
        };
      }>;
    };

    expect(response.status).toBe(200);
    expect(body.overall).toBe("major_outage");
    expect(body.range).toEqual({ key: "60m", label: "Last 60 min", windowMinutes: 60 });
    expect(body.summary).toEqual({ up: 5, degraded: 0, down: 1, total: 6 });
    expect(body.services.find((service) => service.label === "MCP Registry")).toMatchObject({
      status: "down",
      httpStatus: 503,
      history: {
        summary: {
          totalRequests: 6,
          currentRpm: 2,
          meanLatencyMs: 116.66666666666667,
        },
      },
    });
  });
});
