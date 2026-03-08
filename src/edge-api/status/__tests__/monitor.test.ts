import { describe, expect, it, vi, afterEach } from "vitest";
import app from "../api/app";
import type { Env } from "../core-logic/env";
import {
  createStatusSnapshot,
  probeAll,
  probeService,
  SERVICES,
  type ServiceProbe,
} from "../core-logic/monitor";

function createFetcher(
  handler: (request: Request) => Response | Promise<Response>,
): Fetcher {
  return {
    fetch: vi.fn(handler),
  };
}

function createEnv(overrides: Partial<Env> = {}): Env {
  const okFetcher = createFetcher(() => new Response(JSON.stringify({ status: "ok" }), { status: 200 }));

  return {
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
  it("returns the computed summary payload", async () => {
    const env = createEnv({
      MCP_REGISTRY: createFetcher(() => new Response("unavailable", { status: 503 })),
    });
    vi.spyOn(Date, "now").mockImplementation(() => 0);

    const response = await app.fetch(new Request("https://status.spike.land/api/status"), env);
    const body = await response.json() as {
      overall: string;
      summary: { up: number; degraded: number; down: number; total: number };
      services: Array<{ label: string; status: string; httpStatus: number | null }>;
    };

    expect(response.status).toBe(200);
    expect(body.overall).toBe("major_outage");
    expect(body.summary).toEqual({ up: 5, degraded: 0, down: 1, total: 6 });
    expect(body.services.find((service) => service.label === "MCP Registry")).toMatchObject({
      status: "down",
      httpStatus: 503,
    });
  });
});
