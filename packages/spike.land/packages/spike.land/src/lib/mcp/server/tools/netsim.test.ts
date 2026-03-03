import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mockEngine = vi.hoisted(() => ({
  clearTopologies: vi.fn(),
  createTopology: vi.fn(),
  destroyTopology: vi.fn(),
  listTopologies: vi.fn(),
  setLinkState: vi.fn(),
  partitionNode: vi.fn(),
  healNode: vi.fn(),
  sendMessage: vi.fn(),
  tick: vi.fn(),
  inspect: vi.fn(),
  getDeliveryStats: vi.fn(),
}));

vi.mock("@/lib/netsim/engine", () => mockEngine);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerNetsimTools } from "./netsim";

describe("netsim MCP tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerNetsimTools(registry, userId);
  });

  it("should register 6 netsim tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
    expect(registry.handlers.has("netsim_create_topology")).toBe(true);
    expect(registry.handlers.has("netsim_set_link_state")).toBe(true);
    expect(registry.handlers.has("netsim_partition_node")).toBe(true);
    expect(registry.handlers.has("netsim_heal_node")).toBe(true);
    expect(registry.handlers.has("netsim_send_message")).toBe(true);
    expect(registry.handlers.has("netsim_tick")).toBe(true);
  });

  describe("netsim_create_topology", () => {
    it("should create topology and return details", async () => {
      mockEngine.createTopology.mockReturnValue({
        id: "netsim-abc-1",
        name: "my-network",
        nodeOrder: ["node-1", "node-2", "node-3"],
        links: new Map([
          ["node-1->node-2", {}],
          ["node-1->node-3", {}],
          ["node-2->node-1", {}],
          ["node-2->node-3", {}],
          ["node-3->node-1", {}],
          ["node-3->node-2", {}],
        ]),
      });

      const handler = registry.handlers.get("netsim_create_topology")!;
      const result = await handler({ name: "my-network", node_count: 3 });

      const text = getText(result);
      expect(text).toContain("Network Topology Created");
      expect(text).toContain("netsim-abc-1");
      expect(text).toContain("node-1, node-2, node-3");
      expect(text).toContain("6");
      expect(mockEngine.createTopology).toHaveBeenCalledWith({
        userId,
        name: "my-network",
        nodeCount: 3,
      });
    });
  });

  describe("netsim_set_link_state", () => {
    it("should update link and return new state", async () => {
      mockEngine.setLinkState.mockReturnValue({
        from: "node-1",
        to: "node-2",
        state: "slow",
        latencyMs: 200,
        lossRate: 0,
      });

      const handler = registry.handlers.get("netsim_set_link_state")!;
      const result = await handler({
        topology_id: "netsim-abc-1",
        from: "node-1",
        to: "node-2",
        state: "slow",
        latency_ms: 200,
      });

      const text = getText(result);
      expect(text).toContain("Link Updated");
      expect(text).toContain("node-1 -> node-2");
      expect(text).toContain("slow");
      expect(text).toContain("200ms");
    });

    it("should show loss rate for lossy links", async () => {
      mockEngine.setLinkState.mockReturnValue({
        from: "node-1",
        to: "node-2",
        state: "lossy",
        latencyMs: 0,
        lossRate: 0.3,
      });

      const handler = registry.handlers.get("netsim_set_link_state")!;
      const result = await handler({
        topology_id: "netsim-abc-1",
        from: "node-1",
        to: "node-2",
        state: "lossy",
        loss_rate: 0.3,
      });

      const text = getText(result);
      expect(text).toContain("30%");
    });
  });

  describe("netsim_partition_node", () => {
    it("should partition node and confirm", async () => {
      const handler = registry.handlers.get("netsim_partition_node")!;
      const result = await handler({
        topology_id: "netsim-abc-1",
        node_id: "node-2",
      });

      const text = getText(result);
      expect(text).toContain("Node Partitioned");
      expect(text).toContain("node-2");
      expect(mockEngine.partitionNode).toHaveBeenCalledWith(
        "netsim-abc-1",
        userId,
        "node-2",
      );
    });
  });

  describe("netsim_heal_node", () => {
    it("should heal node and confirm", async () => {
      const handler = registry.handlers.get("netsim_heal_node")!;
      const result = await handler({
        topology_id: "netsim-abc-1",
        node_id: "node-2",
      });

      const text = getText(result);
      expect(text).toContain("Node Healed");
      expect(text).toContain("node-2");
      expect(mockEngine.healNode).toHaveBeenCalledWith(
        "netsim-abc-1",
        userId,
        "node-2",
      );
    });
  });

  describe("netsim_send_message", () => {
    it("should send message and show pending status", async () => {
      mockEngine.sendMessage.mockReturnValue({
        id: "msg-1",
        from: "node-1",
        to: "node-2",
        payload: "hello",
        sentAt: 1,
        deliveredAt: null,
        dropped: false,
        delayed: false,
      });

      const handler = registry.handlers.get("netsim_send_message")!;
      const result = await handler({
        topology_id: "netsim-abc-1",
        from: "node-1",
        to: "node-2",
        payload: "hello",
      });

      const text = getText(result);
      expect(text).toContain("Message Sent");
      expect(text).toContain("msg-1");
      expect(text).toContain("PENDING");
    });

    it("should show DROPPED for dropped messages", async () => {
      mockEngine.sendMessage.mockReturnValue({
        id: "msg-2",
        from: "node-1",
        to: "node-3",
        payload: "data",
        sentAt: 2,
        deliveredAt: null,
        dropped: true,
        delayed: false,
      });

      const handler = registry.handlers.get("netsim_send_message")!;
      const result = await handler({
        topology_id: "netsim-abc-1",
        from: "node-1",
        to: "node-3",
        payload: "data",
      });

      const text = getText(result);
      expect(text).toContain("DROPPED");
    });

    it("should show DELIVERED for delivered messages", async () => {
      mockEngine.sendMessage.mockReturnValue({
        id: "msg-3",
        from: "node-1",
        to: "node-2",
        payload: "data",
        sentAt: 1,
        deliveredAt: 1,
        dropped: false,
        delayed: false,
      });

      const handler = registry.handlers.get("netsim_send_message")!;
      const result = await handler({
        topology_id: "netsim-abc-1",
        from: "node-1",
        to: "node-2",
        payload: "data",
      });

      expect(getText(result)).toContain("DELIVERED");
    });
  });

  describe("netsim_tick", () => {
    it("should advance simulation and show delivery stats", async () => {
      mockEngine.tick.mockReturnValue({
        delivered: [
          { from: "node-1", to: "node-2", payload: "hello" },
        ],
        dropped: [],
        pending: [],
      });

      const handler = registry.handlers.get("netsim_tick")!;
      const result = await handler({ topology_id: "netsim-abc-1" });

      const text = getText(result);
      expect(text).toContain("Simulation Advanced");
      expect(text).toContain("Delivered:** 1");
      expect(text).toContain("Dropped:** 0");
      expect(text).toContain("hello");
    });

    it("should show 'no messages' when none delivered", async () => {
      mockEngine.tick.mockReturnValue({
        delivered: [],
        dropped: [],
        pending: [],
      });

      const handler = registry.handlers.get("netsim_tick")!;
      const result = await handler({ topology_id: "netsim-abc-1", rounds: 5 });

      const text = getText(result);
      expect(text).toContain("No messages delivered");
    });
  });

  describe("authorization", () => {
    it("should pass userId to engine for access control", async () => {
      mockEngine.sendMessage.mockImplementation(() => {
        throw new Error("Access denied");
      });

      const handler = registry.handlers.get("netsim_send_message")!;
      const result = await handler({
        topology_id: "someone-elses",
        from: "node-1",
        to: "node-2",
        payload: "hi",
      });

      expect(isError(result)).toBe(true);
    });
  });
});
