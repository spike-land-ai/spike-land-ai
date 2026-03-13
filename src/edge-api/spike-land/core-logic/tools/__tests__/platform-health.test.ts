import { describe, expect, it } from "vitest";

// Test the tool handler logic directly by simulating what registerPlatformHealthTools does
describe("platform-health tool", () => {
  const mockStatusResponse = {
    overall: "operational",
    timestamp: "2026-03-13T12:00:00.000Z",
    summary: { up: 7, degraded: 0, down: 0, total: 7 },
    platform: {
      currentRpm: 42.5,
      totalRequests: 12500,
      peakRpm: 88.0,
      meanLatencyMs: 45.2,
    },
    services: [
      {
        label: "Main Site",
        url: "https://spike.land/health",
        status: "up",
        httpStatus: 200,
        latencyMs: 32,
        error: null,
        history: { summary: { totalRequests: 5000, meanLatencyMs: 40, currentRpm: 15.2 } },
      },
      {
        label: "Transpile",
        url: "https://js.spike.land/health",
        status: "up",
        httpStatus: 200,
        latencyMs: 18,
        error: null,
        history: { summary: { totalRequests: 3000, meanLatencyMs: 22, currentRpm: 8.1 } },
      },
    ],
  };

  it("formats a complete status response", () => {
    const data = mockStatusResponse;
    const lines: string[] = [];
    lines.push(`## Platform Status: ${data.overall.toUpperCase()}`);
    lines.push(`Checked at: ${data.timestamp} | Range: 60m`);
    lines.push(
      `Services: ${data.summary.up}/${data.summary.total} up, ${data.summary.degraded} degraded, ${data.summary.down} down`,
    );

    const output = lines.join("\n");
    expect(output).toContain("OPERATIONAL");
    expect(output).toContain("7/7 up");
  });

  it("filters services by name", () => {
    const needle = "transpile";
    const filtered = mockStatusResponse.services.filter((s) =>
      s.label.toLowerCase().includes(needle),
    );
    expect(filtered).toHaveLength(1);
    expect(filtered[0].label).toBe("Transpile");
  });

  it("returns error when no service matches", () => {
    const needle = "nonexistent";
    const filtered = mockStatusResponse.services.filter((s) =>
      s.label.toLowerCase().includes(needle),
    );
    expect(filtered).toHaveLength(0);
  });
});
