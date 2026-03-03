import { afterEach, describe, expect, it } from "vitest";
import {
  clearTopologies,
  createTopology,
  destroyTopology,
  getDeliveryStats,
  healNode,
  inspect,
  listTopologies,
  partitionNode,
  sendMessage,
  setLinkState,
  tick,
} from "./engine";

describe("netsim engine", () => {
  const userId = "test-user";

  afterEach(() => {
    clearTopologies();
  });

  describe("createTopology", () => {
    it("should create nodes and full-mesh links", () => {
      const topo = createTopology({
        userId,
        name: "test-net",
        nodeCount: 3,
      });

      expect(topo.nodeOrder).toHaveLength(3);
      expect(topo.nodeOrder).toEqual(["node-1", "node-2", "node-3"]);
      expect(topo.userId).toBe(userId);
      expect(topo.name).toBe("test-net");
      expect(topo.clock).toBe(0);

      // Full mesh: 3 nodes = 3 * 2 = 6 directional links
      expect(topo.links.size).toBe(6);

      // All links should be "up" with 0 latency and 0 loss
      for (const link of topo.links.values()) {
        expect(link.state).toBe("up");
        expect(link.latencyMs).toBe(0);
        expect(link.lossRate).toBe(0);
      }
    });

    it("should create a 2-node topology", () => {
      const topo = createTopology({
        userId,
        name: "two-nodes",
        nodeCount: 2,
      });

      expect(topo.nodeOrder).toHaveLength(2);
      // 2 nodes = 2 directional links
      expect(topo.links.size).toBe(2);
    });

    it("should reject node count < 2", () => {
      expect(() => createTopology({ userId, name: "bad", nodeCount: 1 }))
        .toThrow("Node count must be between 2 and 20");
    });

    it("should reject node count > 20", () => {
      expect(() => createTopology({ userId, name: "bad", nodeCount: 21 }))
        .toThrow("Node count must be between 2 and 20");
    });

    it("should set all nodes as not partitioned", () => {
      const topo = createTopology({
        userId,
        name: "initial",
        nodeCount: 4,
      });

      for (const node of topo.nodes.values()) {
        expect(node.partitioned).toBe(false);
      }
    });
  });

  describe("setLinkState", () => {
    it("should modify link state", () => {
      const topo = createTopology({
        userId,
        name: "link-test",
        nodeCount: 3,
      });

      const link = setLinkState(
        topo.id,
        userId,
        "node-1",
        "node-2",
        "slow",
        200,
      );
      expect(link.state).toBe("slow");
      expect(link.latencyMs).toBe(200);
    });

    it("should update loss rate", () => {
      const topo = createTopology({
        userId,
        name: "lossy-test",
        nodeCount: 2,
      });

      const link = setLinkState(
        topo.id,
        userId,
        "node-1",
        "node-2",
        "lossy",
        undefined,
        0.5,
      );
      expect(link.state).toBe("lossy");
      expect(link.lossRate).toBe(0.5);
    });

    it("should reject invalid loss rate", () => {
      const topo = createTopology({
        userId,
        name: "bad-loss",
        nodeCount: 2,
      });

      expect(() => setLinkState(topo.id, userId, "node-1", "node-2", "lossy", 0, 1.5)).toThrow(
        "Loss rate must be between 0 and 1",
      );
    });

    it("should throw for non-existent link", () => {
      const topo = createTopology({
        userId,
        name: "no-link",
        nodeCount: 2,
      });

      expect(() => setLinkState(topo.id, userId, "node-1", "node-99", "up"))
        .toThrow("not found");
    });
  });

  describe("partitionNode", () => {
    it("should partition a node and set all its links to partitioned", () => {
      const topo = createTopology({
        userId,
        name: "partition-test",
        nodeCount: 3,
      });

      partitionNode(topo.id, userId, "node-1");

      const node = topo.nodes.get("node-1");
      expect(node!.partitioned).toBe(true);

      // All links from/to node-1 should be partitioned
      for (const link of topo.links.values()) {
        if (link.from === "node-1" || link.to === "node-1") {
          expect(link.state).toBe("partitioned");
        }
      }

      // Links between node-2 and node-3 should still be up
      const link23 = topo.links.get("node-2->node-3");
      expect(link23!.state).toBe("up");
    });

    it("should throw for non-existent node", () => {
      const topo = createTopology({
        userId,
        name: "bad-partition",
        nodeCount: 2,
      });

      expect(() => partitionNode(topo.id, userId, "node-99")).toThrow(
        "not found",
      );
    });
  });

  describe("healNode", () => {
    it("should heal a partitioned node and restore links", () => {
      const topo = createTopology({
        userId,
        name: "heal-test",
        nodeCount: 3,
      });

      partitionNode(topo.id, userId, "node-1");
      healNode(topo.id, userId, "node-1");

      const node = topo.nodes.get("node-1");
      expect(node!.partitioned).toBe(false);

      // All links involving node-1 should be back to "up"
      for (const link of topo.links.values()) {
        if (link.from === "node-1" || link.to === "node-1") {
          expect(link.state).toBe("up");
        }
      }
    });

    it("should not heal links to other partitioned nodes", () => {
      const topo = createTopology({
        userId,
        name: "partial-heal",
        nodeCount: 3,
      });

      // Partition both node-1 and node-2
      partitionNode(topo.id, userId, "node-1");
      partitionNode(topo.id, userId, "node-2");

      // Heal node-1
      healNode(topo.id, userId, "node-1");

      // Link from node-1 to node-2 should remain partitioned
      // because node-2 is still partitioned
      const link12 = topo.links.get("node-1->node-2");
      expect(link12!.state).toBe("partitioned");

      // Link from node-1 to node-3 should be up
      const link13 = topo.links.get("node-1->node-3");
      expect(link13!.state).toBe("up");
    });

    it("should throw for non-existent node", () => {
      const topo = createTopology({
        userId,
        name: "bad-heal",
        nodeCount: 2,
      });

      expect(() => healNode(topo.id, userId, "node-99")).toThrow("not found");
    });
  });

  describe("sendMessage", () => {
    it("should create a pending message", () => {
      const topo = createTopology({
        userId,
        name: "msg-test",
        nodeCount: 2,
      });

      const msg = sendMessage(
        topo.id,
        userId,
        "node-1",
        "node-2",
        "hello",
      );

      expect(msg.from).toBe("node-1");
      expect(msg.to).toBe("node-2");
      expect(msg.payload).toBe("hello");
      expect(msg.sentAt).toBe(0);
      expect(msg.deliveredAt).toBeNull();
      expect(msg.dropped).toBe(false);
      expect(msg.delayed).toBe(false);
    });

    it("should add message to the log", () => {
      const topo = createTopology({
        userId,
        name: "msg-log",
        nodeCount: 2,
      });

      sendMessage(topo.id, userId, "node-1", "node-2", "msg1");
      sendMessage(topo.id, userId, "node-2", "node-1", "msg2");

      expect(topo.messageLog).toHaveLength(2);
    });

    it("should throw for non-existent sender", () => {
      const topo = createTopology({
        userId,
        name: "bad-sender",
        nodeCount: 2,
      });

      expect(() => sendMessage(topo.id, userId, "node-99", "node-1", "hello"))
        .toThrow("not found");
    });

    it("should throw for non-existent receiver", () => {
      const topo = createTopology({
        userId,
        name: "bad-receiver",
        nodeCount: 2,
      });

      expect(() => sendMessage(topo.id, userId, "node-1", "node-99", "hello"))
        .toThrow("not found");
    });
  });

  describe("tick", () => {
    it("should deliver messages on up links immediately", () => {
      const topo = createTopology({
        userId,
        name: "tick-up",
        nodeCount: 2,
      });

      sendMessage(topo.id, userId, "node-1", "node-2", "hello");

      const result = tick(topo.id, userId);
      expect(result.delivered).toHaveLength(1);
      expect(result.dropped).toHaveLength(0);
      expect(result.pending).toHaveLength(0);
      expect(result.delivered[0]!.deliveredAt).toBe(1);
    });

    it("should drop messages on partitioned links", () => {
      const topo = createTopology({
        userId,
        name: "tick-partition",
        nodeCount: 2,
      });

      partitionNode(topo.id, userId, "node-1");
      sendMessage(topo.id, userId, "node-1", "node-2", "hello");

      const result = tick(topo.id, userId);
      expect(result.delivered).toHaveLength(0);
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0]!.dropped).toBe(true);
    });

    it("should delay messages on slow links", () => {
      const topo = createTopology({
        userId,
        name: "tick-slow",
        nodeCount: 2,
      });

      setLinkState(topo.id, userId, "node-1", "node-2", "slow", 300);
      sendMessage(topo.id, userId, "node-1", "node-2", "hello");

      // First tick: message should still be pending (needs ceil(300/100) = 3 ticks)
      const r1 = tick(topo.id, userId);
      expect(r1.delivered).toHaveLength(0);
      expect(r1.pending).toHaveLength(1);

      // Second tick: still pending
      const r2 = tick(topo.id, userId);
      expect(r2.delivered).toHaveLength(0);
      expect(r2.pending).toHaveLength(1);

      // Third tick: should be delivered now (3 ticks elapsed)
      const r3 = tick(topo.id, userId);
      expect(r3.delivered).toHaveLength(1);
      expect(r3.delivered[0]!.delayed).toBe(true);
      expect(r3.pending).toHaveLength(0);
    });

    it("should handle multiple rounds in a single tick call", () => {
      const topo = createTopology({
        userId,
        name: "tick-rounds",
        nodeCount: 2,
      });

      setLinkState(topo.id, userId, "node-1", "node-2", "slow", 200);
      sendMessage(topo.id, userId, "node-1", "node-2", "hello");

      // 2 rounds in one call: ceil(200/100) = 2 ticks needed
      const result = tick(topo.id, userId, 2);
      expect(result.delivered).toHaveLength(1);
      expect(result.delivered[0]!.delayed).toBe(true);
    });

    it("should advance the clock", () => {
      const topo = createTopology({
        userId,
        name: "tick-clock",
        nodeCount: 2,
      });

      expect(topo.clock).toBe(0);
      tick(topo.id, userId);
      expect(topo.clock).toBe(1);
      tick(topo.id, userId, 5);
      expect(topo.clock).toBe(6);
    });

    it("should handle lossy links deterministically", () => {
      const topo = createTopology({
        userId,
        name: "tick-lossy",
        nodeCount: 2,
      });

      setLinkState(topo.id, userId, "node-1", "node-2", "lossy", 0, 0.5);

      // Send multiple messages
      for (let i = 0; i < 10; i++) {
        sendMessage(topo.id, userId, "node-1", "node-2", `msg-${i}`);
      }

      const result = tick(topo.id, userId);

      // Some should be delivered, some dropped (deterministic based on msg id)
      const totalResolved = result.delivered.length + result.dropped.length;
      expect(totalResolved).toBe(10);

      // Run the same scenario again - results should be consistent
      // (already resolved, so no new deliveries)
      const result2 = tick(topo.id, userId);
      expect(result2.delivered).toHaveLength(0);
      expect(result2.dropped).toHaveLength(0);
    });

    it("should not re-process already delivered messages", () => {
      const topo = createTopology({
        userId,
        name: "tick-idempotent",
        nodeCount: 2,
      });

      sendMessage(topo.id, userId, "node-1", "node-2", "hello");

      const r1 = tick(topo.id, userId);
      expect(r1.delivered).toHaveLength(1);

      // Second tick should not re-deliver
      const r2 = tick(topo.id, userId);
      expect(r2.delivered).toHaveLength(0);
      expect(r2.pending).toHaveLength(0);
    });

    it("should not re-process already dropped messages", () => {
      const topo = createTopology({
        userId,
        name: "tick-drop-once",
        nodeCount: 2,
      });

      partitionNode(topo.id, userId, "node-1");
      sendMessage(topo.id, userId, "node-1", "node-2", "hello");

      const r1 = tick(topo.id, userId);
      expect(r1.dropped).toHaveLength(1);

      // Even if we heal, the dropped message stays dropped
      healNode(topo.id, userId, "node-1");
      const r2 = tick(topo.id, userId);
      expect(r2.delivered).toHaveLength(0);
      expect(r2.dropped).toHaveLength(0);
    });
  });

  describe("inspect", () => {
    it("should return topology state view", () => {
      const topo = createTopology({
        userId,
        name: "inspect-test",
        nodeCount: 3,
      });

      sendMessage(topo.id, userId, "node-1", "node-2", "hello");
      tick(topo.id, userId);

      const view = inspect(topo.id, userId);

      expect(view.id).toBe(topo.id);
      expect(view.name).toBe("inspect-test");
      expect(view.nodes).toHaveLength(3);
      expect(view.links).toHaveLength(6);
      expect(view.recentMessages).toHaveLength(1);
    });

    it("should include node partition status", () => {
      const topo = createTopology({
        userId,
        name: "inspect-partition",
        nodeCount: 2,
      });

      partitionNode(topo.id, userId, "node-1");
      const view = inspect(topo.id, userId);

      expect(view.nodes[0]!.partitioned).toBe(true);
      expect(view.nodes[1]!.partitioned).toBe(false);
    });

    it("should include link states", () => {
      const topo = createTopology({
        userId,
        name: "inspect-links",
        nodeCount: 2,
      });

      setLinkState(topo.id, userId, "node-1", "node-2", "slow", 150);
      const view = inspect(topo.id, userId);

      const slowLink = view.links.find(
        l => l.from === "node-1" && l.to === "node-2",
      );
      expect(slowLink!.state).toBe("slow");
      expect(slowLink!.latencyMs).toBe(150);
    });
  });

  describe("getDeliveryStats", () => {
    it("should categorize messages correctly", () => {
      const topo = createTopology({
        userId,
        name: "stats-test",
        nodeCount: 3,
      });

      // Message on up link
      sendMessage(topo.id, userId, "node-1", "node-2", "delivered-msg");

      // Partition node-3, then send a message to it
      partitionNode(topo.id, userId, "node-3");
      sendMessage(topo.id, userId, "node-1", "node-3", "dropped-msg");

      // Message on slow link (will be pending after 1 tick)
      setLinkState(topo.id, userId, "node-2", "node-1", "slow", 500);
      sendMessage(topo.id, userId, "node-2", "node-1", "pending-msg");

      tick(topo.id, userId);

      const stats = getDeliveryStats(topo.id, userId);
      expect(stats.delivered).toHaveLength(1);
      expect(stats.dropped).toHaveLength(1);
      expect(stats.pending).toHaveLength(1);
    });

    it("should return empty stats for new topology", () => {
      const topo = createTopology({
        userId,
        name: "empty-stats",
        nodeCount: 2,
      });

      const stats = getDeliveryStats(topo.id, userId);
      expect(stats.delivered).toHaveLength(0);
      expect(stats.dropped).toHaveLength(0);
      expect(stats.pending).toHaveLength(0);
    });
  });

  describe("access control", () => {
    it("should deny access from different userId on inspect", () => {
      const topo = createTopology({
        userId,
        name: "acl",
        nodeCount: 2,
      });
      expect(() => inspect(topo.id, "other-user")).toThrow("Access denied");
    });

    it("should deny destroy from different userId", () => {
      const topo = createTopology({
        userId,
        name: "acl-destroy",
        nodeCount: 2,
      });
      expect(() => destroyTopology(topo.id, "other-user")).toThrow(
        "Access denied",
      );
    });

    it("should deny setLinkState from different userId", () => {
      const topo = createTopology({
        userId,
        name: "acl-link",
        nodeCount: 2,
      });
      expect(() => setLinkState(topo.id, "other-user", "node-1", "node-2", "slow")).toThrow(
        "Access denied",
      );
    });

    it("should deny partitionNode from different userId", () => {
      const topo = createTopology({
        userId,
        name: "acl-partition",
        nodeCount: 2,
      });
      expect(() => partitionNode(topo.id, "other-user", "node-1")).toThrow(
        "Access denied",
      );
    });

    it("should deny healNode from different userId", () => {
      const topo = createTopology({
        userId,
        name: "acl-heal",
        nodeCount: 2,
      });
      expect(() => healNode(topo.id, "other-user", "node-1")).toThrow(
        "Access denied",
      );
    });

    it("should deny sendMessage from different userId", () => {
      const topo = createTopology({
        userId,
        name: "acl-send",
        nodeCount: 2,
      });
      expect(() => sendMessage(topo.id, "other-user", "node-1", "node-2", "hello")).toThrow(
        "Access denied",
      );
    });

    it("should deny tick from different userId", () => {
      const topo = createTopology({
        userId,
        name: "acl-tick",
        nodeCount: 2,
      });
      expect(() => tick(topo.id, "other-user")).toThrow("Access denied");
    });

    it("should deny getDeliveryStats from different userId", () => {
      const topo = createTopology({
        userId,
        name: "acl-stats",
        nodeCount: 2,
      });
      expect(() => getDeliveryStats(topo.id, "other-user")).toThrow(
        "Access denied",
      );
    });
  });

  describe("listTopologies", () => {
    it("should list only topologies for the given user", () => {
      createTopology({ userId, name: "mine1", nodeCount: 2 });
      createTopology({ userId, name: "mine2", nodeCount: 3 });
      createTopology({ userId: "other", name: "theirs", nodeCount: 2 });

      const list = listTopologies(userId);
      expect(list).toHaveLength(2);
      expect(list.map(t => t.name).sort()).toEqual(["mine1", "mine2"]);
    });

    it("should include correct summary data", () => {
      const topo = createTopology({ userId, name: "summary", nodeCount: 3 });
      sendMessage(topo.id, userId, "node-1", "node-2", "hello");

      const list = listTopologies(userId);
      expect(list).toHaveLength(1);
      expect(list[0]!.nodeCount).toBe(3);
      expect(list[0]!.linkCount).toBe(6);
      expect(list[0]!.messageCount).toBe(1);
    });

    it("should return empty array for user with no topologies", () => {
      const list = listTopologies("nobody");
      expect(list).toHaveLength(0);
    });
  });

  describe("destroyTopology", () => {
    it("should remove the topology", () => {
      const topo = createTopology({ userId, name: "destroy", nodeCount: 2 });
      destroyTopology(topo.id, userId);

      expect(() => inspect(topo.id, userId)).toThrow("not found");
    });

    it("should throw for non-existent topology", () => {
      expect(() => destroyTopology("nonexistent", userId)).toThrow(
        "not found",
      );
    });
  });

  describe("messageFilter", () => {
    it("should drop messages rejected by the filter", () => {
      const topo = createTopology({
        userId,
        name: "filter-test",
        nodeCount: 3,
      });

      // Set a filter that only allows messages from node-1
      topo.messageFilter = msg => msg.from === "node-1";

      sendMessage(topo.id, userId, "node-1", "node-2", "allowed");
      sendMessage(topo.id, userId, "node-2", "node-1", "blocked");

      const result = tick(topo.id, userId);

      expect(result.delivered).toHaveLength(1);
      expect(result.delivered[0]!.payload).toBe("allowed");
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0]!.payload).toBe("blocked");
    });

    it("should work with no filter set (allow all)", () => {
      const topo = createTopology({
        userId,
        name: "no-filter",
        nodeCount: 2,
      });

      sendMessage(topo.id, userId, "node-1", "node-2", "hello");
      sendMessage(topo.id, userId, "node-2", "node-1", "world");

      const result = tick(topo.id, userId);
      expect(result.delivered).toHaveLength(2);
    });

    it("should apply filter based on payload content", () => {
      const topo = createTopology({
        userId,
        name: "payload-filter",
        nodeCount: 2,
      });

      // Filter that blocks messages containing "secret"
      topo.messageFilter = msg => !msg.payload.includes("secret");

      sendMessage(topo.id, userId, "node-1", "node-2", "hello");
      sendMessage(topo.id, userId, "node-1", "node-2", "secret-data");
      sendMessage(topo.id, userId, "node-1", "node-2", "goodbye");

      const result = tick(topo.id, userId);
      expect(result.delivered).toHaveLength(2);
      expect(result.dropped).toHaveLength(1);
      expect(result.dropped[0]!.payload).toBe("secret-data");
    });
  });

  describe("complex scenarios", () => {
    it("should simulate a network partition and recovery", () => {
      const topo = createTopology({
        userId,
        name: "partition-recovery",
        nodeCount: 3,
      });

      // Send a message before partition
      sendMessage(topo.id, userId, "node-1", "node-2", "before-partition");
      tick(topo.id, userId);

      // Partition node-3
      partitionNode(topo.id, userId, "node-3");

      // Messages to node-3 should be dropped
      sendMessage(topo.id, userId, "node-1", "node-3", "during-partition");
      const partitionResult = tick(topo.id, userId);
      expect(partitionResult.dropped).toHaveLength(1);

      // Messages between non-partitioned nodes still work
      sendMessage(topo.id, userId, "node-1", "node-2", "still-works");
      const normalResult = tick(topo.id, userId);
      expect(normalResult.delivered).toHaveLength(1);

      // Heal node-3
      healNode(topo.id, userId, "node-3");

      // Messages to node-3 should now be delivered
      sendMessage(topo.id, userId, "node-1", "node-3", "after-heal");
      const healResult = tick(topo.id, userId);
      expect(healResult.delivered).toHaveLength(1);
      expect(healResult.delivered[0]!.payload).toBe("after-heal");
    });

    it("should handle mixed link states across the network", () => {
      const topo = createTopology({
        userId,
        name: "mixed-states",
        nodeCount: 3,
      });

      // node-1 -> node-2: slow (200ms)
      setLinkState(topo.id, userId, "node-1", "node-2", "slow", 200);
      // node-1 -> node-3: partitioned
      setLinkState(topo.id, userId, "node-1", "node-3", "partitioned");
      // node-2 -> node-3: up

      sendMessage(topo.id, userId, "node-1", "node-2", "slow-msg");
      sendMessage(topo.id, userId, "node-1", "node-3", "blocked-msg");
      sendMessage(topo.id, userId, "node-2", "node-3", "fast-msg");

      const r1 = tick(topo.id, userId);
      // Fast message delivered, blocked message dropped, slow message pending
      expect(r1.delivered).toHaveLength(1);
      expect(r1.delivered[0]!.payload).toBe("fast-msg");
      expect(r1.dropped).toHaveLength(1);
      expect(r1.dropped[0]!.payload).toBe("blocked-msg");
      expect(r1.pending).toHaveLength(1);

      // After enough ticks, slow message should be delivered
      const r2 = tick(topo.id, userId);
      expect(r2.delivered).toHaveLength(1);
      expect(r2.delivered[0]!.payload).toBe("slow-msg");
      expect(r2.delivered[0]!.delayed).toBe(true);
    });
  });
});
