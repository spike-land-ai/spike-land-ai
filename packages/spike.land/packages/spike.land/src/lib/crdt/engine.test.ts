import { afterEach, describe, expect, it } from "vitest";
import {
  checkConvergence,
  clearSets,
  compareWithConsensus,
  createSet,
  destroySet,
  inspect,
  listSets,
  syncAll,
  syncPair,
  update,
} from "./engine";

describe("CRDT engine", () => {
  const userId = "test-user";

  afterEach(() => {
    clearSets();
  });

  describe("createSet", () => {
    it("should create a G-Counter set with correct replica count", () => {
      const set = createSet({
        userId,
        name: "test-gc",
        replicaCount: 3,
        crdtType: "g_counter",
      });
      expect(set.replicaOrder).toHaveLength(3);
      expect(set.crdtType).toBe("g_counter");
      expect(set.userId).toBe(userId);
      expect(set.replicaOrder).toEqual([
        "replica-1",
        "replica-2",
        "replica-3",
      ]);
    });

    it("should create a PN-Counter set", () => {
      const set = createSet({
        userId,
        name: "test-pn",
        replicaCount: 2,
        crdtType: "pn_counter",
      });
      expect(set.replicaOrder).toHaveLength(2);
      expect(set.crdtType).toBe("pn_counter");
    });

    it("should create an LWW-Register set", () => {
      const set = createSet({
        userId,
        name: "test-lww",
        replicaCount: 4,
        crdtType: "lww_register",
      });
      expect(set.replicaOrder).toHaveLength(4);
      expect(set.crdtType).toBe("lww_register");
    });

    it("should create an OR-Set set", () => {
      const set = createSet({
        userId,
        name: "test-or",
        replicaCount: 5,
        crdtType: "or_set",
      });
      expect(set.replicaOrder).toHaveLength(5);
      expect(set.crdtType).toBe("or_set");
    });

    it("should reject replica count < 2 or > 7", () => {
      expect(() =>
        createSet({
          userId,
          name: "bad",
          replicaCount: 1,
          crdtType: "g_counter",
        })
      ).toThrow("Replica count must be between 2 and 7");
      expect(() =>
        createSet({
          userId,
          name: "bad",
          replicaCount: 8,
          crdtType: "g_counter",
        })
      ).toThrow("Replica count must be between 2 and 7");
    });
  });

  describe("G-Counter", () => {
    it("should increment and compute value as sum", () => {
      const set = createSet({
        userId,
        name: "gc",
        replicaCount: 3,
        crdtType: "g_counter",
      });

      const r1 = update(set.id, userId, "replica-1", "increment");
      expect(r1.replica.resolvedValue).toBe("1");

      update(set.id, userId, "replica-1", "increment");
      const r1b = update(set.id, userId, "replica-1", "increment");
      expect(r1b.replica.resolvedValue).toBe("3");

      const r2 = update(set.id, userId, "replica-2", "increment", "5");
      expect(r2.replica.resolvedValue).toBe("5");
    });

    it("should merge using max per key", () => {
      const set = createSet({
        userId,
        name: "gc-merge",
        replicaCount: 2,
        crdtType: "g_counter",
      });

      // replica-1 increments 3 times
      update(set.id, userId, "replica-1", "increment");
      update(set.id, userId, "replica-1", "increment");
      update(set.id, userId, "replica-1", "increment");

      // replica-2 increments 2 times
      update(set.id, userId, "replica-2", "increment");
      update(set.id, userId, "replica-2", "increment");

      // Sync replica-1 -> replica-2
      const result = syncPair(set.id, userId, "replica-1", "replica-2");

      // replica-2 should now have sum = 3 (from r1) + 2 (from r2) = 5
      expect(result.to.resolvedValue).toBe("5");
    });

    it("should reject invalid operations", () => {
      const set = createSet({
        userId,
        name: "gc-invalid",
        replicaCount: 2,
        crdtType: "g_counter",
      });
      expect(() => update(set.id, userId, "replica-1", "decrement")).toThrow(
        "Invalid operation \"decrement\" for G-Counter",
      );
    });
  });

  describe("PN-Counter", () => {
    it("should increment and decrement correctly", () => {
      const set = createSet({
        userId,
        name: "pn",
        replicaCount: 2,
        crdtType: "pn_counter",
      });

      update(set.id, userId, "replica-1", "increment", "5");
      const r = update(set.id, userId, "replica-1", "decrement", "2");
      expect(r.replica.resolvedValue).toBe("3");
    });

    it("should merge preserving both positive and negative counters", () => {
      const set = createSet({
        userId,
        name: "pn-merge",
        replicaCount: 2,
        crdtType: "pn_counter",
      });

      // replica-1: +5, -1
      update(set.id, userId, "replica-1", "increment", "5");
      update(set.id, userId, "replica-1", "decrement");

      // replica-2: +3, -2
      update(set.id, userId, "replica-2", "increment", "3");
      update(set.id, userId, "replica-2", "decrement", "2");

      // Sync both ways
      syncPair(set.id, userId, "replica-1", "replica-2");
      syncPair(set.id, userId, "replica-2", "replica-1");

      const state = inspect(set.id, userId);
      // Both should resolve to (5+3) - (1+2) = 5
      expect(state.replicas[0]!.resolvedValue).toBe("5");
      expect(state.replicas[1]!.resolvedValue).toBe("5");
    });
  });

  describe("LWW-Register", () => {
    it("should set value with deterministic timestamp", () => {
      const set = createSet({
        userId,
        name: "lww",
        replicaCount: 2,
        crdtType: "lww_register",
      });

      const r = update(set.id, userId, "replica-1", "set", "hello");
      expect(r.replica.resolvedValue).toBe("hello");
    });

    it("should use latest timestamp on merge", () => {
      const set = createSet({
        userId,
        name: "lww-merge",
        replicaCount: 2,
        crdtType: "lww_register",
      });

      // replica-1 sets "first" (timestamp 1)
      update(set.id, userId, "replica-1", "set", "first");
      // replica-2 sets "second" (timestamp 2 - higher)
      update(set.id, userId, "replica-2", "set", "second");

      // Sync replica-2 -> replica-1: "second" should win (higher timestamp)
      const result = syncPair(set.id, userId, "replica-2", "replica-1");
      expect(result.to.resolvedValue).toBe("second");
    });

    it("should keep existing value if source has lower timestamp", () => {
      const set = createSet({
        userId,
        name: "lww-keep",
        replicaCount: 2,
        crdtType: "lww_register",
      });

      // replica-1 sets "first" (timestamp 1)
      update(set.id, userId, "replica-1", "set", "first");
      // replica-2 sets "second" (timestamp 2 - higher)
      update(set.id, userId, "replica-2", "set", "second");

      // Sync replica-1 -> replica-2: "second" should stay (higher timestamp)
      const result = syncPair(set.id, userId, "replica-1", "replica-2");
      expect(result.to.resolvedValue).toBe("second");
    });

    it("should require value for set operation", () => {
      const set = createSet({
        userId,
        name: "lww-novalue",
        replicaCount: 2,
        crdtType: "lww_register",
      });
      expect(() => update(set.id, userId, "replica-1", "set")).toThrow(
        "requires a value",
      );
    });
  });

  describe("OR-Set", () => {
    it("should add elements and generate unique tags", () => {
      const set = createSet({
        userId,
        name: "or",
        replicaCount: 2,
        crdtType: "or_set",
      });

      update(set.id, userId, "replica-1", "add", "apple");
      const r = update(set.id, userId, "replica-1", "add", "banana");
      expect(r.replica.resolvedValue).toBe("{apple, banana}");
    });

    it("should remove elements", () => {
      const set = createSet({
        userId,
        name: "or-remove",
        replicaCount: 2,
        crdtType: "or_set",
      });

      update(set.id, userId, "replica-1", "add", "apple");
      update(set.id, userId, "replica-1", "add", "banana");
      const r = update(set.id, userId, "replica-1", "remove", "apple");
      expect(r.replica.resolvedValue).toBe("{banana}");
    });

    it("should preserve concurrent adds on merge (add wins)", () => {
      const set = createSet({
        userId,
        name: "or-concurrent",
        replicaCount: 2,
        crdtType: "or_set",
      });

      // replica-1 adds "apple"
      update(set.id, userId, "replica-1", "add", "apple");
      // replica-2 also adds "apple" concurrently (different tag)
      update(set.id, userId, "replica-2", "add", "apple");

      // replica-1 removes "apple" (only removes its own tag)
      update(set.id, userId, "replica-1", "remove", "apple");

      // After merge, replica-2's add tag should survive
      const result = syncPair(set.id, userId, "replica-2", "replica-1");
      expect(result.to.resolvedValue).toBe("{apple}");
    });

    it("should require value for add/remove", () => {
      const set = createSet({
        userId,
        name: "or-novalue",
        replicaCount: 2,
        crdtType: "or_set",
      });
      expect(() => update(set.id, userId, "replica-1", "add")).toThrow(
        "requires a value",
      );
    });
  });

  describe("syncPair", () => {
    it("should merge state from source to target", () => {
      const set = createSet({
        userId,
        name: "sync-pair",
        replicaCount: 3,
        crdtType: "g_counter",
      });

      update(set.id, userId, "replica-1", "increment", "10");
      update(set.id, userId, "replica-2", "increment", "20");

      const result = syncPair(set.id, userId, "replica-1", "replica-2");
      // replica-2 should now see both: 10 (from r1) + 20 (from r2) = 30
      expect(result.to.resolvedValue).toBe("30");
      // replica-1 should remain unchanged (only 10)
      expect(result.from.resolvedValue).toBe("10");
    });
  });

  describe("syncAll", () => {
    it("should achieve convergence across all replicas", () => {
      const set = createSet({
        userId,
        name: "sync-all",
        replicaCount: 4,
        crdtType: "g_counter",
      });

      update(set.id, userId, "replica-1", "increment", "1");
      update(set.id, userId, "replica-2", "increment", "2");
      update(set.id, userId, "replica-3", "increment", "3");
      update(set.id, userId, "replica-4", "increment", "4");

      const result = syncAll(set.id, userId);
      expect(result.converged).toBe(true);

      // All replicas should agree on value = 1+2+3+4 = 10
      for (const replica of result.replicas) {
        expect(replica.resolvedValue).toBe("10");
      }
    });
  });

  describe("checkConvergence", () => {
    it("should detect convergence when all replicas agree", () => {
      const set = createSet({
        userId,
        name: "converge",
        replicaCount: 2,
        crdtType: "g_counter",
      });

      update(set.id, userId, "replica-1", "increment");
      syncAll(set.id, userId);

      const result = checkConvergence(set.id, userId);
      expect(result.converged).toBe(true);
      expect(result.diffs).toHaveLength(0);
    });

    it("should detect differences when replicas disagree", () => {
      const set = createSet({
        userId,
        name: "diverge",
        replicaCount: 3,
        crdtType: "g_counter",
      });

      // Different replicas have different local state
      update(set.id, userId, "replica-1", "increment", "5");
      update(set.id, userId, "replica-2", "increment", "3");
      // replica-3 has no updates

      const result = checkConvergence(set.id, userId);
      expect(result.converged).toBe(false);
      expect(result.diffs.length).toBeGreaterThan(0);
    });
  });

  describe("concurrent updates on different replicas", () => {
    it("should not lose data from concurrent G-Counter increments", () => {
      const set = createSet({
        userId,
        name: "concurrent-gc",
        replicaCount: 3,
        crdtType: "g_counter",
      });

      // Concurrent increments on different replicas
      update(set.id, userId, "replica-1", "increment", "10");
      update(set.id, userId, "replica-2", "increment", "20");
      update(set.id, userId, "replica-3", "increment", "30");

      // Sync all - no data should be lost
      syncAll(set.id, userId);
      const convergence = checkConvergence(set.id, userId);
      expect(convergence.converged).toBe(true);

      const state = inspect(set.id, userId);
      // Total should be 10 + 20 + 30 = 60
      expect(state.replicas[0]!.resolvedValue).toBe("60");
    });

    it("should not lose data from concurrent PN-Counter operations", () => {
      const set = createSet({
        userId,
        name: "concurrent-pn",
        replicaCount: 2,
        crdtType: "pn_counter",
      });

      // replica-1 increments, replica-2 decrements concurrently
      update(set.id, userId, "replica-1", "increment", "10");
      update(set.id, userId, "replica-2", "decrement", "3");

      syncAll(set.id, userId);
      const state = inspect(set.id, userId);
      // Value should be 10 - 3 = 7
      expect(state.replicas[0]!.resolvedValue).toBe("7");
    });

    it("should not lose concurrent OR-Set adds", () => {
      const set = createSet({
        userId,
        name: "concurrent-or",
        replicaCount: 2,
        crdtType: "or_set",
      });

      // Both replicas add different items concurrently
      update(set.id, userId, "replica-1", "add", "A");
      update(set.id, userId, "replica-2", "add", "B");

      syncAll(set.id, userId);
      const state = inspect(set.id, userId);
      // Both A and B should be present
      expect(state.replicas[0]!.resolvedValue).toBe("{A, B}");
    });
  });

  describe("access control", () => {
    it("should deny access from different userId", () => {
      const set = createSet({
        userId,
        name: "acl",
        replicaCount: 2,
        crdtType: "g_counter",
      });
      expect(() => inspect(set.id, "other-user")).toThrow("Access denied");
    });

    it("should deny destroy from different userId", () => {
      const set = createSet({
        userId,
        name: "acl-destroy",
        replicaCount: 2,
        crdtType: "g_counter",
      });
      expect(() => destroySet(set.id, "other-user")).toThrow("Access denied");
    });

    it("should deny update from different userId", () => {
      const set = createSet({
        userId,
        name: "acl-update",
        replicaCount: 2,
        crdtType: "g_counter",
      });
      expect(() => update(set.id, "other-user", "replica-1", "increment"))
        .toThrow("Access denied");
    });
  });

  describe("listSets", () => {
    it("should list only sets for the given user", () => {
      createSet({
        userId,
        name: "mine1",
        replicaCount: 2,
        crdtType: "g_counter",
      });
      createSet({
        userId,
        name: "mine2",
        replicaCount: 3,
        crdtType: "pn_counter",
      });
      createSet({
        userId: "other",
        name: "theirs",
        replicaCount: 2,
        crdtType: "g_counter",
      });

      const list = listSets(userId);
      expect(list).toHaveLength(2);
      expect(list.map(s => s.name).sort()).toEqual(["mine1", "mine2"]);
    });
  });

  describe("compareWithConsensus", () => {
    it("should return comparison text for each CRDT type", () => {
      const set = createSet({
        userId,
        name: "compare",
        replicaCount: 2,
        crdtType: "g_counter",
      });

      const text = compareWithConsensus(
        set.id,
        userId,
        "distributed page view counter",
      );
      expect(text).toContain("AP (CRDT) vs CP (Raft/Paxos)");
      expect(text).toContain("g_counter");
      expect(text).toContain("distributed page view counter");
      expect(text).toContain("high availability");
    });
  });

  describe("inspect", () => {
    it("should return state for a single replica when specified", () => {
      const set = createSet({
        userId,
        name: "inspect-one",
        replicaCount: 3,
        crdtType: "g_counter",
      });

      update(set.id, userId, "replica-1", "increment", "5");

      const state = inspect(set.id, userId, "replica-1");
      expect(state.replicas).toHaveLength(1);
      expect(state.replicas[0]!.id).toBe("replica-1");
      expect(state.replicas[0]!.resolvedValue).toBe("5");
    });

    it("should return state for all replicas when none specified", () => {
      const set = createSet({
        userId,
        name: "inspect-all",
        replicaCount: 3,
        crdtType: "g_counter",
      });

      const state = inspect(set.id, userId);
      expect(state.replicas).toHaveLength(3);
    });

    it("should throw for unknown replica", () => {
      const set = createSet({
        userId,
        name: "inspect-bad",
        replicaCount: 2,
        crdtType: "g_counter",
      });
      expect(() => inspect(set.id, userId, "replica-99")).toThrow("not found");
    });
  });
});
