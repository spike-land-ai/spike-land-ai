import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mockEngine = vi.hoisted(() => ({
  clearSystems: vi.fn(),
  createSystem: vi.fn(),
  destroySystem: vi.fn(),
  listSystems: vi.fn(),
  localEvent: vi.fn(),
  sendEvent: vi.fn(),
  compareEvents: vi.fn(),
  inspect: vi.fn(),
  getTimeline: vi.fn(),
}));

vi.mock("@/lib/causality/engine", () => mockEngine);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerCausalityTools } from "./causality";

describe("causality MCP tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCausalityTools(registry, userId);
  });

  it("should register 6 causality tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
    expect(registry.handlers.has("causality_create_system")).toBe(true);
    expect(registry.handlers.has("causality_local_event")).toBe(true);
    expect(registry.handlers.has("causality_send_event")).toBe(true);
    expect(registry.handlers.has("causality_compare_events")).toBe(true);
    expect(registry.handlers.has("causality_inspect")).toBe(true);
    expect(registry.handlers.has("causality_timeline")).toBe(true);
  });

  describe("causality_create_system", () => {
    it("should create system with Lamport clocks", async () => {
      mockEngine.createSystem.mockReturnValue({
        id: "causal-abc-1",
        name: "my-system",
        clockType: "lamport",
        processOrder: ["proc-1", "proc-2", "proc-3"],
      });

      const handler = registry.handlers.get("causality_create_system")!;
      const result = await handler({
        name: "my-system",
        process_count: 3,
        clock_type: "lamport",
      });

      const text = getText(result);
      expect(text).toContain("Causal System Created");
      expect(text).toContain("causal-abc-1");
      expect(text).toContain("lamport");
      expect(text).toContain("proc-1, proc-2, proc-3");
      expect(mockEngine.createSystem).toHaveBeenCalledWith({
        userId,
        name: "my-system",
        processCount: 3,
        clockType: "lamport",
      });
    });

    it("should create system with Vector clocks", async () => {
      mockEngine.createSystem.mockReturnValue({
        id: "causal-abc-2",
        name: "vec-system",
        clockType: "vector",
        processOrder: ["proc-1", "proc-2"],
      });

      const handler = registry.handlers.get("causality_create_system")!;
      const result = await handler({
        name: "vec-system",
        process_count: 2,
        clock_type: "vector",
      });

      expect(getText(result)).toContain("vector");
    });
  });

  describe("causality_local_event", () => {
    it("should record local event with Lamport clock", async () => {
      mockEngine.localEvent.mockReturnValue({
        id: "evt-1",
        processId: "proc-1",
        label: "compute",
        clock: { type: "lamport", time: 1 },
        causalParents: [],
        timestamp: 1,
      });

      const handler = registry.handlers.get("causality_local_event")!;
      const result = await handler({
        system_id: "causal-abc-1",
        process_id: "proc-1",
        label: "compute",
      });

      const text = getText(result);
      expect(text).toContain("Local Event Recorded");
      expect(text).toContain("evt-1");
      expect(text).toContain("proc-1");
      expect(text).toContain("compute");
      expect(text).toContain("Lamport(1)");
    });

    it("should record local event with Vector clock", async () => {
      mockEngine.localEvent.mockReturnValue({
        id: "evt-2",
        processId: "proc-1",
        label: "write",
        clock: { type: "vector", entries: { "proc-1": 1, "proc-2": 0 } },
        causalParents: [],
        timestamp: 1,
      });

      const handler = registry.handlers.get("causality_local_event")!;
      const result = await handler({
        system_id: "causal-abc-2",
        process_id: "proc-1",
        label: "write",
      });

      const text = getText(result);
      expect(text).toContain("Vector{");
      expect(text).toContain("proc-1: 1");
    });
  });

  describe("causality_send_event", () => {
    it("should create send and receive events", async () => {
      mockEngine.sendEvent.mockReturnValue({
        sendEvent: {
          id: "evt-3",
          processId: "proc-1",
          label: "send:request",
          clock: { type: "lamport", time: 2 },
        },
        receiveEvent: {
          id: "evt-4",
          processId: "proc-2",
          label: "recv:request",
          clock: { type: "lamport", time: 3 },
        },
      });

      const handler = registry.handlers.get("causality_send_event")!;
      const result = await handler({
        system_id: "causal-abc-1",
        from_process: "proc-1",
        to_process: "proc-2",
        label: "request",
      });

      const text = getText(result);
      expect(text).toContain("Message Send Simulated");
      expect(text).toContain("evt-3");
      expect(text).toContain("evt-4");
      expect(text).toContain("proc-1");
      expect(text).toContain("proc-2");
      expect(mockEngine.sendEvent).toHaveBeenCalledWith(
        "causal-abc-1",
        userId,
        "proc-1",
        "proc-2",
        "request",
      );
    });
  });

  describe("causality_compare_events", () => {
    it("should show happens_before relation", async () => {
      mockEngine.compareEvents.mockReturnValue({
        eventA: "evt-1",
        eventB: "evt-2",
        relation: "happens_before",
        explanation: "evt-1 has a lower Lamport timestamp than evt-2.",
      });

      const handler = registry.handlers.get("causality_compare_events")!;
      const result = await handler({
        system_id: "causal-abc-1",
        event_a: "evt-1",
        event_b: "evt-2",
      });

      const text = getText(result);
      expect(text).toContain("Causal Comparison");
      expect(text).toContain("happens_before");
      expect(text).toContain("->");
    });

    it("should show concurrent relation", async () => {
      mockEngine.compareEvents.mockReturnValue({
        eventA: "evt-1",
        eventB: "evt-3",
        relation: "concurrent",
        explanation: "Neither event causally precedes the other.",
      });

      const handler = registry.handlers.get("causality_compare_events")!;
      const result = await handler({
        system_id: "causal-abc-1",
        event_a: "evt-1",
        event_b: "evt-3",
      });

      const text = getText(result);
      expect(text).toContain("concurrent");
      expect(text).toContain("||");
    });

    it("should show same relation", async () => {
      mockEngine.compareEvents.mockReturnValue({
        eventA: "evt-1",
        eventB: "evt-1",
        relation: "same",
        explanation: "Both refer to the same event.",
      });

      const handler = registry.handlers.get("causality_compare_events")!;
      const result = await handler({
        system_id: "causal-abc-1",
        event_a: "evt-1",
        event_b: "evt-1",
      });

      expect(getText(result)).toContain("==");
    });
  });

  describe("causality_inspect", () => {
    it("should show process states and events", async () => {
      mockEngine.inspect.mockReturnValue({
        id: "causal-abc-1",
        name: "my-system",
        clockType: "lamport",
        processes: [
          { id: "proc-1", clock: { type: "lamport", time: 3 } },
          { id: "proc-2", clock: { type: "lamport", time: 2 } },
        ],
        events: [
          {
            id: "evt-1",
            processId: "proc-1",
            label: "compute",
            clock: { type: "lamport", time: 1 },
          },
        ],
      });

      const handler = registry.handlers.get("causality_inspect")!;
      const result = await handler({ system_id: "causal-abc-1" });

      const text = getText(result);
      expect(text).toContain("my-system");
      expect(text).toContain("lamport");
      expect(text).toContain("proc-1");
      expect(text).toContain("Lamport(3)");
      expect(text).toContain("compute");
    });

    it("should pass process_id when specified", async () => {
      mockEngine.inspect.mockReturnValue({
        id: "causal-abc-1",
        name: "my-system",
        clockType: "lamport",
        processes: [{ id: "proc-1", clock: { type: "lamport", time: 3 } }],
        events: [],
      });

      const handler = registry.handlers.get("causality_inspect")!;
      await handler({ system_id: "causal-abc-1", process_id: "proc-1" });

      expect(mockEngine.inspect).toHaveBeenCalledWith(
        "causal-abc-1",
        userId,
        "proc-1",
      );
    });

    it("should handle empty events", async () => {
      mockEngine.inspect.mockReturnValue({
        id: "s1",
        name: "sys",
        clockType: "vector",
        processes: [{
          id: "p1",
          clock: { type: "vector", entries: { p1: 0 } },
        }],
        events: [],
      });

      const text = getText(
        await registry.handlers.get("causality_inspect")!({ system_id: "s1" }),
      );
      expect(text).toContain("Vector{");
      expect(text).not.toContain("Events:");
    });
  });

  describe("causality_timeline", () => {
    it("should show events in causal order", async () => {
      mockEngine.getTimeline.mockReturnValue([
        {
          id: "evt-1",
          processId: "proc-1",
          label: "start",
          clock: { type: "lamport", time: 1 },
        },
        {
          id: "evt-2",
          processId: "proc-2",
          label: "respond",
          clock: { type: "lamport", time: 2 },
        },
      ]);

      const handler = registry.handlers.get("causality_timeline")!;
      const result = await handler({ system_id: "causal-abc-1" });

      const text = getText(result);
      expect(text).toContain("Timeline");
      expect(text).toContain("2 events");
      expect(text).toContain("evt-1");
      expect(text).toContain("evt-2");
    });

    it("should handle empty timeline", async () => {
      mockEngine.getTimeline.mockReturnValue([]);

      const handler = registry.handlers.get("causality_timeline")!;
      const result = await handler({ system_id: "causal-abc-1" });

      expect(getText(result)).toContain("No events recorded");
    });
  });

  describe("authorization", () => {
    it("should pass userId to engine for access control", async () => {
      mockEngine.inspect.mockImplementation(() => {
        throw new Error("Access denied");
      });

      const handler = registry.handlers.get("causality_inspect")!;
      const result = await handler({ system_id: "someone-elses" });

      expect(isError(result)).toBe(true);
    });
  });
});
