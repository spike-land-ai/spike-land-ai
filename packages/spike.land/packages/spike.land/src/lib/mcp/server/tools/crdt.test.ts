import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mockEngine = vi.hoisted(() => ({
  clearSets: vi.fn(),
  createSet: vi.fn(),
  update: vi.fn(),
  syncPair: vi.fn(),
  syncAll: vi.fn(),
  inspect: vi.fn(),
  checkConvergence: vi.fn(),
  compareWithConsensus: vi.fn(),
}));

vi.mock("@/lib/crdt/engine", () => mockEngine);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerCrdtTools } from "./crdt";

describe("crdt MCP tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCrdtTools(registry, userId);
  });

  it("should register 7 crdt tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(7);
    expect(registry.handlers.has("crdt_create_set")).toBe(true);
    expect(registry.handlers.has("crdt_update")).toBe(true);
    expect(registry.handlers.has("crdt_sync_pair")).toBe(true);
    expect(registry.handlers.has("crdt_sync_all")).toBe(true);
    expect(registry.handlers.has("crdt_inspect")).toBe(true);
    expect(registry.handlers.has("crdt_check_convergence")).toBe(true);
    expect(registry.handlers.has("crdt_compare_with_consensus")).toBe(true);
  });

  describe("crdt_create_set", () => {
    it("should create set and return details", async () => {
      mockEngine.createSet.mockReturnValue({
        id: "crdt-abc-1",
        name: "my-counter",
        crdtType: "g_counter",
        replicaOrder: ["replica-1", "replica-2", "replica-3"],
      });

      const handler = registry.handlers.get("crdt_create_set")!;
      const result = await handler({
        name: "my-counter",
        replica_count: 3,
        type: "g_counter",
      });

      const text = getText(result);
      expect(text).toContain("CRDT Set Created");
      expect(text).toContain("crdt-abc-1");
      expect(text).toContain("g_counter");
      expect(text).toContain("replica-1, replica-2, replica-3");
      expect(mockEngine.createSet).toHaveBeenCalledWith({
        userId,
        name: "my-counter",
        replicaCount: 3,
        crdtType: "g_counter",
      });
    });
  });

  describe("crdt_update", () => {
    it("should apply operation and return updated state", async () => {
      mockEngine.update.mockReturnValue({
        replica: {
          id: "replica-1",
          state: { type: "g_counter", counts: { "replica-1": 5 } },
          resolvedValue: "5",
        },
        opLog: {
          id: "op-1",
          replicaId: "replica-1",
          operation: "increment",
          value: "5",
          timestamp: 0,
        },
      });

      const handler = registry.handlers.get("crdt_update")!;
      const result = await handler({
        set_id: "crdt-abc-1",
        replica_id: "replica-1",
        operation: "increment",
        value: "5",
      });

      const text = getText(result);
      expect(text).toContain("Operation Applied");
      expect(text).toContain("replica-1");
      expect(text).toContain("increment");
      expect(text).toContain("5");
      expect(mockEngine.update).toHaveBeenCalledWith(
        "crdt-abc-1",
        userId,
        "replica-1",
        "increment",
        "5",
      );
    });

    it("should handle error for invalid operation", async () => {
      mockEngine.update.mockImplementation(() => {
        throw new Error(
          "Invalid operation \"decrement\" for G-Counter. Use \"increment\".",
        );
      });

      const handler = registry.handlers.get("crdt_update")!;
      const result = await handler({
        set_id: "crdt-abc-1",
        replica_id: "replica-1",
        operation: "decrement",
      });

      expect(isError(result)).toBe(true);
    });
  });

  describe("crdt_sync_pair", () => {
    it("should sync pair and return both replica states", async () => {
      mockEngine.syncPair.mockReturnValue({
        from: {
          id: "replica-1",
          state: { type: "g_counter", counts: { "replica-1": 3 } },
          resolvedValue: "3",
        },
        to: {
          id: "replica-2",
          state: {
            type: "g_counter",
            counts: { "replica-1": 3, "replica-2": 2 },
          },
          resolvedValue: "5",
        },
      });

      const handler = registry.handlers.get("crdt_sync_pair")!;
      const result = await handler({
        set_id: "crdt-abc-1",
        from_replica: "replica-1",
        to_replica: "replica-2",
      });

      const text = getText(result);
      expect(text).toContain("Sync Complete");
      expect(text).toContain("replica-1");
      expect(text).toContain("replica-2");
      expect(mockEngine.syncPair).toHaveBeenCalledWith(
        "crdt-abc-1",
        userId,
        "replica-1",
        "replica-2",
      );
    });
  });

  describe("crdt_sync_all", () => {
    it("should sync all replicas and confirm convergence", async () => {
      mockEngine.syncAll.mockReturnValue({
        replicas: [
          {
            id: "replica-1",
            state: {
              type: "g_counter",
              counts: { "replica-1": 3, "replica-2": 2 },
            },
            resolvedValue: "5",
          },
          {
            id: "replica-2",
            state: {
              type: "g_counter",
              counts: { "replica-1": 3, "replica-2": 2 },
            },
            resolvedValue: "5",
          },
        ],
        converged: true,
      });

      const handler = registry.handlers.get("crdt_sync_all")!;
      const result = await handler({ set_id: "crdt-abc-1" });

      const text = getText(result);
      expect(text).toContain("All Replicas Synchronized");
      expect(text).toContain("Yes");
      expect(text).toContain("replica-1");
      expect(text).toContain("replica-2");
    });
  });

  describe("crdt_inspect", () => {
    it("should return internal state for all replicas", async () => {
      mockEngine.inspect.mockReturnValue({
        id: "crdt-abc-1",
        name: "my-counter",
        crdtType: "g_counter",
        replicas: [
          {
            id: "replica-1",
            state: { type: "g_counter", counts: { "replica-1": 3 } },
            resolvedValue: "3",
          },
          {
            id: "replica-2",
            state: { type: "g_counter", counts: { "replica-2": 2 } },
            resolvedValue: "2",
          },
        ],
        operationCount: 5,
      });

      const handler = registry.handlers.get("crdt_inspect")!;
      const result = await handler({ set_id: "crdt-abc-1" });

      const text = getText(result);
      expect(text).toContain("my-counter");
      expect(text).toContain("g_counter");
      expect(text).toContain("replica-1");
      expect(text).toContain("replica-2");
      expect(text).toContain("5");
    });

    it("should pass replica_id when specified", async () => {
      mockEngine.inspect.mockReturnValue({
        id: "crdt-abc-1",
        name: "my-counter",
        crdtType: "g_counter",
        replicas: [
          {
            id: "replica-1",
            state: { type: "g_counter", counts: { "replica-1": 3 } },
            resolvedValue: "3",
          },
        ],
        operationCount: 3,
      });

      const handler = registry.handlers.get("crdt_inspect")!;
      await handler({ set_id: "crdt-abc-1", replica_id: "replica-1" });

      expect(mockEngine.inspect).toHaveBeenCalledWith(
        "crdt-abc-1",
        userId,
        "replica-1",
      );
    });
  });

  describe("crdt_check_convergence", () => {
    it("should report converged status", async () => {
      mockEngine.checkConvergence.mockReturnValue({
        converged: true,
        diffs: [],
      });

      const handler = registry.handlers.get("crdt_check_convergence")!;
      const result = await handler({ set_id: "crdt-abc-1" });

      const text = getText(result);
      expect(text).toContain("CONVERGED");
      expect(text).toContain("All replicas agree");
    });

    it("should report differences when not converged", async () => {
      mockEngine.checkConvergence.mockReturnValue({
        converged: false,
        diffs: [
          {
            replicaA: "replica-1",
            replicaB: "replica-2",
            valueA: "5",
            valueB: "3",
          },
        ],
      });

      const handler = registry.handlers.get("crdt_check_convergence")!;
      const result = await handler({ set_id: "crdt-abc-1" });

      const text = getText(result);
      expect(text).toContain("NOT CONVERGED");
      expect(text).toContain("replica-1");
      expect(text).toContain("replica-2");
      expect(text).toContain("5");
      expect(text).toContain("3");
    });
  });

  describe("crdt_compare_with_consensus", () => {
    it("should return comparison text", async () => {
      mockEngine.compareWithConsensus.mockReturnValue(
        "## AP (CRDT) vs CP (Raft/Paxos) Comparison\n\n"
          + "**CRDT Type:** g_counter\n"
          + "**Scenario:** distributed page view counter\n"
          + "**Current State:** All replicas have converged.",
      );

      const handler = registry.handlers.get("crdt_compare_with_consensus")!;
      const result = await handler({
        set_id: "crdt-abc-1",
        scenario_description: "distributed page view counter",
      });

      const text = getText(result);
      expect(text).toContain("AP (CRDT) vs CP (Raft/Paxos)");
      expect(text).toContain("g_counter");
      expect(text).toContain("distributed page view counter");
      expect(mockEngine.compareWithConsensus).toHaveBeenCalledWith(
        "crdt-abc-1",
        userId,
        "distributed page view counter",
      );
    });
  });

  describe("authorization", () => {
    it("should pass userId to engine for access control", async () => {
      mockEngine.inspect.mockImplementation(() => {
        throw new Error("Access denied");
      });

      const handler = registry.handlers.get("crdt_inspect")!;
      const result = await handler({ set_id: "someone-elses" });

      expect(isError(result)).toBe(true);
    });
  });

  describe("formatReplicaState branches", () => {
    it("should format pn_counter state", async () => {
      mockEngine.update.mockReturnValue({
        replica: {
          id: "r1",
          state: {
            type: "pn_counter",
            positive: { r1: 10 },
            negative: { r1: 3 },
          },
          resolvedValue: "7",
        },
        opLog: {
          id: "op-1",
          replicaId: "r1",
          operation: "increment",
          timestamp: 0,
        },
      });
      const result = await registry.handlers.get("crdt_update")!({
        set_id: "s1",
        replica_id: "r1",
        operation: "increment",
      });
      const text = getText(result);
      expect(text).toContain("positive:");
      expect(text).toContain("negative:");
    });

    it("should format lww_register state", async () => {
      mockEngine.update.mockReturnValue({
        replica: {
          id: "r1",
          state: {
            type: "lww_register",
            value: "hello",
            timestamp: 1234567890,
          },
          resolvedValue: "hello",
        },
        opLog: {
          id: "op-2",
          replicaId: "r1",
          operation: "set",
          value: "hello",
          timestamp: 0,
        },
      });
      const result = await registry.handlers.get("crdt_update")!({
        set_id: "s1",
        replica_id: "r1",
        operation: "set",
        value: "hello",
      });
      const text = getText(result);
      expect(text).toContain("value: \"hello\"");
      expect(text).toContain("timestamp: 1234567890");
    });

    it("should format lww_register with null value", async () => {
      mockEngine.inspect.mockReturnValue({
        id: "s2",
        name: "reg",
        crdtType: "lww_register",
        replicas: [{
          id: "r1",
          state: { type: "lww_register", value: null, timestamp: 0 },
          resolvedValue: "null",
        }],
        operationCount: 0,
      });
      const text = getText(
        await registry.handlers.get("crdt_inspect")!({ set_id: "s2" }),
      );
      expect(text).toContain("value: \"null\"");
    });

    it("should format or_set state", async () => {
      mockEngine.update.mockReturnValue({
        replica: {
          id: "r1",
          state: {
            type: "or_set",
            elements: { apple: ["t1", "t2"], banana: ["t3"] },
          },
          resolvedValue: "{apple, banana}",
        },
        opLog: {
          id: "op-3",
          replicaId: "r1",
          operation: "add",
          value: "banana",
          timestamp: 0,
        },
      });
      const result = await registry.handlers.get("crdt_update")!({
        set_id: "s1",
        replica_id: "r1",
        operation: "add",
        value: "banana",
      });
      const text = getText(result);
      expect(text).toContain("elements:");
      expect(text).toContain("\"apple\"");
    });

    it("should fallback to JSON.stringify for unknown type", async () => {
      mockEngine.inspect.mockReturnValue({
        id: "su",
        name: "unk",
        crdtType: "unknown",
        replicas: [{
          id: "r1",
          state: { type: "unknown", foo: "bar" },
          resolvedValue: "?",
        }],
        operationCount: 0,
      });
      const text = getText(
        await registry.handlers.get("crdt_inspect")!({ set_id: "su" }),
      );
      expect(text).toContain("foo");
      expect(text).toContain("bar");
    });

    it("should not show value text when value is not provided in update", async () => {
      mockEngine.update.mockReturnValue({
        replica: {
          id: "r1",
          state: { type: "g_counter", counts: { r1: 1 } },
          resolvedValue: "1",
        },
        opLog: {
          id: "op-4",
          replicaId: "r1",
          operation: "increment",
          timestamp: 0,
        },
      });
      const result = await registry.handlers.get("crdt_update")!({
        set_id: "s1",
        replica_id: "r1",
        operation: "increment",
      });
      expect(getText(result)).not.toContain("(value:");
    });

    it("should show No when sync_all not converged", async () => {
      mockEngine.syncAll.mockReturnValue({
        replicas: [
          {
            id: "r1",
            state: { type: "g_counter", counts: { r1: 3 } },
            resolvedValue: "3",
          },
          {
            id: "r2",
            state: { type: "g_counter", counts: { r2: 2 } },
            resolvedValue: "2",
          },
        ],
        converged: false,
      });
      const text = getText(
        await registry.handlers.get("crdt_sync_all")!({ set_id: "s1" }),
      );
      expect(text).toContain("No");
    });
  });
});
