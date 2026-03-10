import { afterEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { StatusPage } from "@/routes/status";

type StatusRangeKey = "60m" | "6h" | "24h";

function createPayload(range: StatusRangeKey) {
  return {
    overall: "operational" as const,
    timestamp: "2026-03-10T10:00:00.000Z",
    range: {
      key: range,
      label: range === "60m" ? "Last 60 min" : range === "24h" ? "Last 24 hours" : "Last 6 hours",
      windowMinutes: range === "60m" ? 60 : range === "24h" ? 1440 : 360,
    },
    summary: { up: 6, degraded: 0, down: 0, total: 6 },
    platform: {
      currentRpm: 12,
      totalRequests: 420,
      peakRpm: 19,
      meanLatencyMs: 142,
    },
    services: [
      {
        label: "Edge API",
        url: "https://api.spike.land/health",
        status: "up" as const,
        httpStatus: 200,
        latencyMs: 91,
        error: null,
        history: {
          summary: {
            totalRequests: 120,
            currentRpm: 5,
            averageRpm: 2.5,
            currentRpmDelta: 2.5,
            peakRpm: 7,
            minLatencyMs: 40,
            maxLatencyMs: 310,
            meanLatencyMs: 118,
            stddevLatencyMs: 28,
            latestAvgLatencyMs: 126,
            latestLatencyDeltaMs: 8,
          },
          chartPoints: [
            { bucketStartMs: 1, requestCount: 1 },
            { bucketStartMs: 2, requestCount: 3 },
            { bucketStartMs: 3, requestCount: 5 },
          ],
        },
      },
    ],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("StatusPage", () => {
  it("loads and renders historical service telemetry", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const range = (new URL(url).searchParams.get("range") as StatusRangeKey | null) ?? "6h";

      return {
        ok: true,
        json: async () => createPayload(range),
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<StatusPage />);

    expect(
      screen.getByRole("heading", {
        name: "Historical request pressure and latency spread per service.",
      }),
    ).toBeInTheDocument();

    expect(await screen.findByText("Edge API")).toBeInTheDocument();
    expect(
      screen.getByText("Requests, request time floor and ceiling, mean, and deviation."),
    ).toBeInTheDocument();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://status.spike.land/api/status?range=6h",
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it("requests a new telemetry window when the range changes", async () => {
    const fetchMock = vi.fn(async (input: string | URL | Request) => {
      const url =
        typeof input === "string" ? input : input instanceof URL ? input.toString() : input.url;
      const range = (new URL(url).searchParams.get("range") as StatusRangeKey | null) ?? "6h";

      return {
        ok: true,
        json: async () => createPayload(range),
      } as Response;
    });

    vi.stubGlobal("fetch", fetchMock);

    render(<StatusPage />);
    await screen.findByText("Edge API");

    fireEvent.click(screen.getByRole("button", { name: "24h" }));

    await waitFor(() =>
      expect(fetchMock).toHaveBeenLastCalledWith(
        "https://status.spike.land/api/status?range=24h",
        expect.objectContaining({ signal: expect.any(AbortSignal) }),
      ),
    );
  });
});
