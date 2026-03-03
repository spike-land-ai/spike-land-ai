import { afterEach, describe, expect, it } from "vitest";
import {
  checkConsensus,
  checkSafety,
  clearClusters,
  createCluster,
  destroyCluster,
  inspect,
  listClusters,
  propose,
  runCommitPhase,
  runFullRound,
  runPreparePhase,
  setBehavior,
} from "./engine";

describe("BFT engine", () => {
  const userId = "test-user";

  afterEach(() => {
    clearClusters();
  });

  describe("createCluster", () => {
    it("should create a cluster with correct node count", () => {
      const cluster = createCluster({
        userId,
        name: "test-cluster",
        nodeCount: 4,
      });
      expect(cluster.nodeOrder).toHaveLength(4);
      expect(cluster.userId).toBe(userId);
      expect(cluster.name).toBe("test-cluster");
      expect(cluster.nodeOrder).toEqual([
        "node-1",
        "node-2",
        "node-3",
        "node-4",
      ]);
    });

    it("should create all nodes as honest initially", () => {
      const cluster = createCluster({
        userId,
        name: "all-honest",
        nodeCount: 4,
      });
      for (const nodeId of cluster.nodeOrder) {
        const node = cluster.nodes.get(nodeId)!;
        expect(node.behavior).toBe("honest");
        expect(node.phase).toBe("idle");
        expect(node.decidedValue).toBeNull();
      }
    });

    it("should reject node count less than 4", () => {
      expect(() =>
        createCluster({
          userId,
          name: "too-small",
          nodeCount: 3,
        })
      ).toThrow("Node count must be at least 4");
    });

    it("should create a larger cluster with 7 nodes", () => {
      const cluster = createCluster({
        userId,
        name: "large",
        nodeCount: 7,
      });
      expect(cluster.nodeOrder).toHaveLength(7);
    });
  });

  describe("setBehavior", () => {
    it("should change a node's behavior", () => {
      const cluster = createCluster({
        userId,
        name: "behavior-test",
        nodeCount: 4,
      });

      const result = setBehavior(cluster.id, userId, "node-2", "silent");
      expect(result.node.behavior).toBe("silent");
      expect(result.warning).toBeNull();
    });

    it("should warn when too few honest nodes remain", () => {
      const cluster = createCluster({
        userId,
        name: "warn-test",
        nodeCount: 4,
      });

      // f = floor((4-1)/3) = 1, so quorum = 2*1+1 = 3 honest needed
      // Making 2 nodes faulty leaves only 2 honest
      setBehavior(cluster.id, userId, "node-2", "silent");
      const result = setBehavior(
        cluster.id,
        userId,
        "node-3",
        "equivocating",
      );

      expect(result.warning).not.toBeNull();
      expect(result.warning).toContain("only 2 honest nodes remain");
    });

    it("should throw for unknown node", () => {
      const cluster = createCluster({
        userId,
        name: "unknown-node",
        nodeCount: 4,
      });
      expect(() => setBehavior(cluster.id, userId, "node-99", "silent"))
        .toThrow("not found");
    });
  });

  describe("propose", () => {
    it("should start a new round with pre_prepare phase", () => {
      const cluster = createCluster({
        userId,
        name: "propose-test",
        nodeCount: 4,
      });

      const round = propose(cluster.id, userId, "value-A");

      expect(round.sequenceNumber).toBe(1);
      expect(round.proposedValue).toBe("value-A");
      expect(round.phase).toBe("pre_prepare");
      expect(round.decided).toBe(false);
      expect(round.messages).toHaveLength(1);
      expect(round.messages[0]!.type).toBe("pre_prepare");
      expect(round.messages[0]!.nodeId).toBe("node-1");
    });

    it("should increment sequence number for multiple proposals", () => {
      const cluster = createCluster({
        userId,
        name: "multi-propose",
        nodeCount: 4,
      });

      const round1 = propose(cluster.id, userId, "val-1");
      // Complete the round before proposing again
      runPreparePhase(cluster.id, userId, round1.sequenceNumber);
      runCommitPhase(cluster.id, userId, round1.sequenceNumber);
      checkConsensus(cluster.id, userId, round1.sequenceNumber);

      const round2 = propose(cluster.id, userId, "val-2");
      expect(round2.sequenceNumber).toBe(2);
    });
  });

  describe("PBFT protocol with all honest nodes", () => {
    it("should generate prepare messages from all nodes", () => {
      const cluster = createCluster({
        userId,
        name: "prepare-test",
        nodeCount: 4,
      });

      propose(cluster.id, userId, "value-A");
      const round = runPreparePhase(cluster.id, userId, 1);

      expect(round.phase).toBe("prepare");

      // All 4 honest nodes should send prepare messages
      const prepareMessages = round.messages.filter(
        m => m.type === "prepare",
      );
      expect(prepareMessages).toHaveLength(4);
      for (const msg of prepareMessages) {
        expect(msg.value).toBe("value-A");
      }
    });

    it("should generate commit messages with quorum", () => {
      const cluster = createCluster({
        userId,
        name: "commit-test",
        nodeCount: 4,
      });

      propose(cluster.id, userId, "value-A");
      runPreparePhase(cluster.id, userId, 1);
      const round = runCommitPhase(cluster.id, userId, 1);

      expect(round.phase).toBe("commit");

      const commitMessages = round.messages.filter(
        m => m.type === "commit",
      );
      // All 4 honest nodes should send commit (they all received 4 matching prepares >= quorum of 3)
      expect(commitMessages).toHaveLength(4);
    });

    it("should reach consensus with all honest nodes", () => {
      const cluster = createCluster({
        userId,
        name: "consensus-test",
        nodeCount: 4,
      });

      propose(cluster.id, userId, "value-A");
      runPreparePhase(cluster.id, userId, 1);
      runCommitPhase(cluster.id, userId, 1);
      const result = checkConsensus(cluster.id, userId, 1);

      expect(result.decided).toBe(true);
      expect(result.value).toBe("value-A");
      expect(result.phase).toBe("decided");
      expect(result.commitCount).toBe(4);
      // f = 1, quorum = 3
      expect(result.requiredQuorum).toBe(3);
    });
  });

  describe("PBFT with silent node (within tolerance)", () => {
    it("should still reach consensus with one silent node (f=1)", () => {
      const cluster = createCluster({
        userId,
        name: "silent-one",
        nodeCount: 4,
      });

      // One silent node (within f=1 tolerance)
      setBehavior(cluster.id, userId, "node-4", "silent");

      const result = runFullRound(cluster.id, userId, "value-B");

      // 3 honest nodes send prepare (matching value), 1 silent sends nothing
      // Quorum is 3, so 3 matching prepares >= 3 -> all honest nodes send commit
      // 3 commits >= 3 -> decided
      expect(result.decided).toBe(true);
      expect(result.value).toBe("value-B");
    });

    it("should verify safety after consensus with silent node", () => {
      const cluster = createCluster({
        userId,
        name: "silent-safety",
        nodeCount: 4,
      });

      setBehavior(cluster.id, userId, "node-4", "silent");
      runFullRound(cluster.id, userId, "value-C");

      const safety = checkSafety(cluster.id, userId);
      expect(safety.safe).toBe(true);
      expect(safety.issues).toHaveLength(0);
    });
  });

  describe("PBFT with equivocating node", () => {
    it("should send different values from equivocating node", () => {
      const cluster = createCluster({
        userId,
        name: "equivoc-test",
        nodeCount: 4,
      });

      setBehavior(cluster.id, userId, "node-3", "equivocating");

      propose(cluster.id, userId, "value-D");
      const round = runPreparePhase(cluster.id, userId, 1);

      const prepareMessages = round.messages.filter(
        m => m.type === "prepare",
      );
      // 3 honest + 1 equivocating = 4 prepare messages
      expect(prepareMessages).toHaveLength(4);

      // Equivocating node should have sent a different value
      const equivocMsg = prepareMessages.find(m => m.nodeId === "node-3");
      expect(equivocMsg).toBeDefined();
      expect(equivocMsg!.value).not.toBe("value-D");
      expect(equivocMsg!.value).toContain("EQUIVOC");
    });

    it("should still reach consensus with one equivocating node (f=1)", () => {
      const cluster = createCluster({
        userId,
        name: "equivoc-consensus",
        nodeCount: 4,
      });

      setBehavior(cluster.id, userId, "node-4", "equivocating");

      const result = runFullRound(cluster.id, userId, "value-E");

      // 3 honest nodes send matching prepare messages
      // Quorum is 3, so 3 matching prepares >= 3 -> honest nodes send commit
      // 3 matching commits >= 3 -> decided
      expect(result.decided).toBe(true);
      expect(result.value).toBe("value-E");
    });
  });

  describe("PBFT with too many faults", () => {
    it("should not reach consensus when too many nodes are silent", () => {
      const cluster = createCluster({
        userId,
        name: "too-many-silent",
        nodeCount: 4,
      });

      // f=1, making 2 nodes silent exceeds tolerance
      setBehavior(cluster.id, userId, "node-3", "silent");
      setBehavior(cluster.id, userId, "node-4", "silent");

      const result = runFullRound(cluster.id, userId, "value-F");

      // Only 2 honest nodes send prepare, quorum is 3 -> not enough
      // No commits sent -> not decided
      expect(result.decided).toBe(false);
      expect(result.value).toBeNull();
    });

    it("should not reach consensus when too many nodes are equivocating", () => {
      const cluster = createCluster({
        userId,
        name: "too-many-equivoc",
        nodeCount: 4,
      });

      // f=1, making 2 nodes equivocating exceeds tolerance
      setBehavior(cluster.id, userId, "node-3", "equivocating");
      setBehavior(cluster.id, userId, "node-4", "equivocating");

      const result = runFullRound(cluster.id, userId, "value-G");

      // 2 honest send matching prepare, 2 equivocating send different values
      // Matching prepares = 2, quorum = 3 -> honest nodes don't send commit
      // No matching commits -> not decided
      expect(result.decided).toBe(false);
      expect(result.value).toBeNull();
    });

    it("should detect safety issues with too many faults", () => {
      const cluster = createCluster({
        userId,
        name: "safety-violation",
        nodeCount: 4,
      });

      setBehavior(cluster.id, userId, "node-3", "silent");
      setBehavior(cluster.id, userId, "node-4", "equivocating");

      const safety = checkSafety(cluster.id, userId);
      expect(safety.safe).toBe(false);
      expect(safety.issues.length).toBeGreaterThan(0);
      expect(safety.issues[0]).toContain("Too many faulty nodes");
    });
  });

  describe("runFullRound", () => {
    it("should run the complete protocol in one call", () => {
      const cluster = createCluster({
        userId,
        name: "full-round",
        nodeCount: 4,
      });

      const result = runFullRound(cluster.id, userId, "quick-value");

      expect(result.decided).toBe(true);
      expect(result.value).toBe("quick-value");
      expect(result.phase).toBe("decided");
      expect(result.prepareCount).toBe(4);
      expect(result.commitCount).toBe(4);
      expect(result.requiredQuorum).toBe(3);
    });

    it("should handle multiple full rounds", () => {
      const cluster = createCluster({
        userId,
        name: "multi-full",
        nodeCount: 4,
      });

      const result1 = runFullRound(cluster.id, userId, "val-1");
      expect(result1.decided).toBe(true);
      expect(result1.value).toBe("val-1");

      const result2 = runFullRound(cluster.id, userId, "val-2");
      expect(result2.decided).toBe(true);
      expect(result2.value).toBe("val-2");
    });
  });

  describe("checkSafety", () => {
    it("should report safe when all nodes are honest", () => {
      const cluster = createCluster({
        userId,
        name: "safe-cluster",
        nodeCount: 4,
      });

      runFullRound(cluster.id, userId, "safe-value");

      const safety = checkSafety(cluster.id, userId);
      expect(safety.safe).toBe(true);
      expect(safety.issues).toHaveLength(0);
    });

    it("should report safe with no decisions and no faults", () => {
      const cluster = createCluster({
        userId,
        name: "no-decisions",
        nodeCount: 4,
      });

      const safety = checkSafety(cluster.id, userId);
      expect(safety.safe).toBe(true);
    });

    it("should detect too many faulty nodes", () => {
      const cluster = createCluster({
        userId,
        name: "too-faulty",
        nodeCount: 4,
      });

      setBehavior(cluster.id, userId, "node-2", "silent");
      setBehavior(cluster.id, userId, "node-3", "equivocating");

      const safety = checkSafety(cluster.id, userId);
      expect(safety.safe).toBe(false);
      expect(safety.issues).toHaveLength(1);
      expect(safety.issues[0]).toContain("Too many faulty nodes: 2");
    });
  });

  describe("inspect", () => {
    it("should return cluster state view", () => {
      const cluster = createCluster({
        userId,
        name: "inspect-test",
        nodeCount: 4,
      });

      const view = inspect(cluster.id, userId);

      expect(view.id).toBe(cluster.id);
      expect(view.name).toBe("inspect-test");
      expect(view.nodes).toHaveLength(4);
      expect(view.roundCount).toBe(0);
      expect(view.currentRound).toBeNull();
      expect(view.faultTolerance).toBe(
        "f=1 (tolerates 1 Byzantine node out of 4)",
      );
    });

    it("should show current round after proposal", () => {
      const cluster = createCluster({
        userId,
        name: "inspect-round",
        nodeCount: 4,
      });

      propose(cluster.id, userId, "inspect-val");

      const view = inspect(cluster.id, userId);
      expect(view.currentRound).not.toBeNull();
      expect(view.currentRound!.proposedValue).toBe("inspect-val");
      expect(view.roundCount).toBe(1);
    });

    it("should show node behaviors", () => {
      const cluster = createCluster({
        userId,
        name: "inspect-behaviors",
        nodeCount: 4,
      });

      setBehavior(cluster.id, userId, "node-2", "silent");
      setBehavior(cluster.id, userId, "node-3", "equivocating");

      const view = inspect(cluster.id, userId);
      const node2 = view.nodes.find(n => n.id === "node-2");
      const node3 = view.nodes.find(n => n.id === "node-3");

      expect(node2!.behavior).toBe("silent");
      expect(node3!.behavior).toBe("equivocating");
    });

    it("should show decided values after consensus", () => {
      const cluster = createCluster({
        userId,
        name: "inspect-decided",
        nodeCount: 4,
      });

      runFullRound(cluster.id, userId, "decided-val");

      const view = inspect(cluster.id, userId);
      const honestNodes = view.nodes.filter(n => n.behavior === "honest");
      for (const node of honestNodes) {
        expect(node.decidedValue).toBe("decided-val");
        expect(node.phase).toBe("decided");
      }
    });

    it("should show fault tolerance for larger clusters", () => {
      const cluster = createCluster({
        userId,
        name: "inspect-large",
        nodeCount: 7,
      });

      const view = inspect(cluster.id, userId);
      // f = floor((7-1)/3) = 2
      expect(view.faultTolerance).toBe(
        "f=2 (tolerates 2 Byzantine nodes out of 7)",
      );
    });
  });

  describe("access control", () => {
    it("should deny access from different userId", () => {
      const cluster = createCluster({
        userId,
        name: "acl-test",
        nodeCount: 4,
      });

      expect(() => inspect(cluster.id, "other-user")).toThrow("Access denied");
    });

    it("should deny propose from different userId", () => {
      const cluster = createCluster({
        userId,
        name: "acl-propose",
        nodeCount: 4,
      });

      expect(() => propose(cluster.id, "other-user", "val")).toThrow(
        "Access denied",
      );
    });

    it("should deny setBehavior from different userId", () => {
      const cluster = createCluster({
        userId,
        name: "acl-behavior",
        nodeCount: 4,
      });

      expect(() => setBehavior(cluster.id, "other-user", "node-1", "silent"))
        .toThrow("Access denied");
    });

    it("should deny destroy from different userId", () => {
      const cluster = createCluster({
        userId,
        name: "acl-destroy",
        nodeCount: 4,
      });

      expect(() => destroyCluster(cluster.id, "other-user")).toThrow(
        "Access denied",
      );
    });

    it("should deny checkSafety from different userId", () => {
      const cluster = createCluster({
        userId,
        name: "acl-safety",
        nodeCount: 4,
      });

      expect(() => checkSafety(cluster.id, "other-user")).toThrow(
        "Access denied",
      );
    });
  });

  describe("listClusters and destroyCluster", () => {
    it("should list only clusters for the given user", () => {
      createCluster({
        userId,
        name: "mine-1",
        nodeCount: 4,
      });
      createCluster({
        userId,
        name: "mine-2",
        nodeCount: 5,
      });
      createCluster({
        userId: "other-user",
        name: "theirs",
        nodeCount: 4,
      });

      const list = listClusters(userId);
      expect(list).toHaveLength(2);
      expect(list.map(c => c.name).sort()).toEqual(["mine-1", "mine-2"]);
    });

    it("should return correct cluster summary", () => {
      const cluster = createCluster({
        userId,
        name: "summary-test",
        nodeCount: 4,
      });

      setBehavior(cluster.id, userId, "node-3", "silent");
      runFullRound(cluster.id, userId, "test-val");

      const list = listClusters(userId);
      expect(list).toHaveLength(1);

      const summary = list[0]!;
      expect(summary.nodeCount).toBe(4);
      expect(summary.honestCount).toBe(3);
      expect(summary.faultyCount).toBe(1);
      expect(summary.roundCount).toBe(1);
    });

    it("should remove cluster on destroy", () => {
      const cluster = createCluster({
        userId,
        name: "to-destroy",
        nodeCount: 4,
      });

      destroyCluster(cluster.id, userId);

      const list = listClusters(userId);
      expect(list).toHaveLength(0);
    });

    it("should throw on destroy of non-existent cluster", () => {
      expect(() => destroyCluster("non-existent", userId)).toThrow("not found");
    });
  });

  describe("phase validation", () => {
    it("should reject prepare phase when not in pre_prepare", () => {
      const cluster = createCluster({
        userId,
        name: "phase-check",
        nodeCount: 4,
      });

      propose(cluster.id, userId, "val");
      runPreparePhase(cluster.id, userId, 1);

      // Already in prepare phase, can't run prepare again
      expect(() => runPreparePhase(cluster.id, userId, 1)).toThrow(
        "expected \"pre_prepare\"",
      );
    });

    it("should reject commit phase when not in prepare", () => {
      const cluster = createCluster({
        userId,
        name: "commit-phase-check",
        nodeCount: 4,
      });

      propose(cluster.id, userId, "val");

      // Still in pre_prepare, can't run commit
      expect(() => runCommitPhase(cluster.id, userId, 1)).toThrow(
        "expected \"prepare\"",
      );
    });

    it("should reject consensus check when not in commit", () => {
      const cluster = createCluster({
        userId,
        name: "consensus-phase-check",
        nodeCount: 4,
      });

      propose(cluster.id, userId, "val");
      runPreparePhase(cluster.id, userId, 1);

      // Still in prepare, can't check consensus
      expect(() => checkConsensus(cluster.id, userId, 1)).toThrow(
        "expected \"commit\"",
      );
    });
  });

  describe("larger cluster (7 nodes, f=2)", () => {
    it("should reach consensus with 2 silent nodes", () => {
      const cluster = createCluster({
        userId,
        name: "large-silent",
        nodeCount: 7,
      });

      // f=2 for n=7, quorum = 2*2+1 = 5
      setBehavior(cluster.id, userId, "node-6", "silent");
      setBehavior(cluster.id, userId, "node-7", "silent");

      const result = runFullRound(cluster.id, userId, "large-val");

      // 5 honest nodes send prepare, quorum = 5 -> enough
      expect(result.decided).toBe(true);
      expect(result.value).toBe("large-val");
    });

    it("should not reach consensus with 3 silent nodes", () => {
      const cluster = createCluster({
        userId,
        name: "large-too-many",
        nodeCount: 7,
      });

      // f=2 for n=7, but 3 silent nodes exceed tolerance
      setBehavior(cluster.id, userId, "node-5", "silent");
      setBehavior(cluster.id, userId, "node-6", "silent");
      setBehavior(cluster.id, userId, "node-7", "silent");

      const result = runFullRound(cluster.id, userId, "large-fail");

      // 4 honest send prepare, quorum = 5 -> not enough
      expect(result.decided).toBe(false);
    });
  });
});
