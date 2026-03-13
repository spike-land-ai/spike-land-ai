import { describe, expect, it, vi } from "vitest";
import { detectIncidents } from "../core-logic/incident-detector";
import type { ProbeResult } from "../core-logic/monitor";
import { openIncident, resolveIncident } from "../core-logic/incidents";

// Minimal D1 mock
function createMockDb() {
  const rows: Record<string, unknown>[] = [];
  let nextId = 1;

  const db = {
    prepare: vi.fn().mockReturnValue({
      bind: vi.fn().mockReturnValue({
        run: vi.fn().mockImplementation(async () => {
          const id = nextId++;
          return { meta: { last_row_id: id } };
        }),
        all: vi.fn().mockImplementation(async () => {
          return { results: rows.filter((r) => r.status === "open") };
        }),
      }),
      run: vi.fn().mockResolvedValue({}),
      all: vi.fn().mockImplementation(async () => {
        return { results: rows };
      }),
    }),
    _rows: rows,
    _addRow: (row: Record<string, unknown>) => rows.push(row),
  };

  return db as unknown as D1Database & {
    _rows: Record<string, unknown>[];
    _addRow: (row: Record<string, unknown>) => void;
  };
}

describe("incidents", () => {
  it("opens an incident for a new service failure", async () => {
    const db = createMockDb();
    const incident = await openIncident(db, "Main Site", "down", "HTTP 500");
    expect(incident.service_name).toBe("Main Site");
    expect(incident.status).toBe("open");
    expect(incident.severity).toBe("down");
    expect(incident.notes).toBe("HTTP 500");
    expect(incident.id).toBe(1);
  });

  it("resolves an incident", async () => {
    const db = createMockDb();
    await resolveIncident(db, 1, "Recovered");
    expect(db.prepare).toHaveBeenCalled();
  });
});

describe("incident-detector", () => {
  it("opens incidents for down services and skips up services", async () => {
    const db = createMockDb();
    const probes: ProbeResult[] = [
      {
        label: "Main Site",
        url: "https://spike.land/health",
        status: "up",
        httpStatus: 200,
        latencyMs: 50,
        error: null,
      },
      {
        label: "Transpile",
        url: "https://js.spike.land/health",
        status: "down",
        httpStatus: null,
        latencyMs: 3000,
        error: "Timeout",
      },
    ];

    const result = await detectIncidents(db, probes);
    expect(result.opened).toHaveLength(1);
    expect(result.opened[0].service_name).toBe("Transpile");
    expect(result.opened[0].severity).toBe("down");
    expect(result.resolved).toHaveLength(0);
  });

  it("resolves incidents when services recover", async () => {
    const db = createMockDb();
    // Pre-populate an active incident
    db._addRow({
      id: 42,
      service_name: "Transpile",
      status: "open",
      severity: "down",
      opened_at: Date.now() - 60000,
      updated_at: Date.now() - 60000,
      resolved_at: null,
      notes: "Timeout",
    });

    const probes: ProbeResult[] = [
      {
        label: "Transpile",
        url: "https://js.spike.land/health",
        status: "up",
        httpStatus: 200,
        latencyMs: 50,
        error: null,
      },
    ];

    const result = await detectIncidents(db, probes);
    expect(result.resolved).toContain(42);
    expect(result.opened).toHaveLength(0);
  });
});
