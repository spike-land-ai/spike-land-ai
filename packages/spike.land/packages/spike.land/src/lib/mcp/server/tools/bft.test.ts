import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Hoisted mocks ---
const mockEngine = vi.hoisted(() => ({
  clearClusters: vi.fn(),
  createCluster: vi.fn(),
  destroyCluster: vi.fn(),
  listClusters: vi.fn(),
  setBehavior: vi.fn(),
  propose: vi.fn(),
  runPreparePhase: vi.fn(),
  runCommitPhase: vi.fn(),
  checkConsensus: vi.fn(),
  runFullRound: vi.fn(),
  inspect: vi.fn(),
  checkSafety: vi.fn(),
}));

vi.mock("@/lib/bft/engine", () => mockEngine);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerBftTools } from "./bft";

describe("bft MCP tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBftTools(registry, userId);
  });

  it("should register 8 bft tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(8);
    expect(registry.handlers.has("bft_create_cluster")).toBe(true);
    expect(registry.handlers.has("bft_set_behavior")).toBe(true);
    expect(registry.handlers.has("bft_propose")).toBe(true);
    expect(registry.handlers.has("bft_run_prepare")).toBe(true);
    expect(registry.handlers.has("bft_run_commit")).toBe(true);
    expect(registry.handlers.has("bft_check_consensus")).toBe(true);
    expect(registry.handlers.has("bft_run_full_round")).toBe(true);
    expect(registry.handlers.has("bft_inspect")).toBe(true);
  });

  describe("bft_create_cluster", () => {
    it("should create cluster and return details", async () => {
      mockEngine.createCluster.mockReturnValue({
        id: "bft-abc-1",
        name: "my-cluster",
        nodeOrder: ["node-1", "node-2", "node-3", "node-4"],
      });

      const handler = registry.handlers.get("bft_create_cluster")!;
      const result = await handler({ name: "my-cluster", node_count: 4 });

      const text = getText(result);
      expect(text).toContain("BFT Cluster Created");
      expect(text).toContain("bft-abc-1");
      expect(text).toContain("node-1, node-2, node-3, node-4");
      expect(text).toContain("f=1");
      expect(mockEngine.createCluster).toHaveBeenCalledWith({
        userId,
        name: "my-cluster",
        nodeCount: 4,
      });
    });
  });

  describe("bft_set_behavior", () => {
    it("should update behavior to silent with warning", async () => {
      const handler = registry.handlers.get("bft_set_behavior")!;
      const result = await handler({
        cluster_id: "bft-abc-1",
        node_id: "node-2",
        behavior: "silent",
      });

      const text = getText(result);
      expect(text).toContain("Node Behavior Updated");
      expect(text).toContain("node-2");
      expect(text).toContain("silent");
      expect(text).toContain("Byzantine fault");
      expect(mockEngine.setBehavior).toHaveBeenCalledWith(
        "bft-abc-1",
        userId,
        "node-2",
        "silent",
      );
    });

    it("should update behavior to honest without warning", async () => {
      const handler = registry.handlers.get("bft_set_behavior")!;
      const result = await handler({
        cluster_id: "bft-abc-1",
        node_id: "node-2",
        behavior: "honest",
      });

      const text = getText(result);
      expect(text).toContain("honest");
      expect(text).toContain("follow the PBFT protocol");
    });
  });

  describe("bft_propose", () => {
    it("should start a new consensus round", async () => {
      mockEngine.propose.mockReturnValue({
        sequenceNumber: 1,
        proposedValue: "tx-42",
        phase: "pre_prepare",
        messages: [{ type: "pre_prepare" }],
      });

      const handler = registry.handlers.get("bft_propose")!;
      const result = await handler({
        cluster_id: "bft-abc-1",
        value: "tx-42",
      });

      const text = getText(result);
      expect(text).toContain("Consensus Round Started");
      expect(text).toContain("tx-42");
      expect(text).toContain("pre_prepare");
    });
  });

  describe("bft_run_prepare", () => {
    it("should run prepare phase and show message count", async () => {
      mockEngine.runPreparePhase.mockReturnValue({
        sequenceNumber: 1,
        phase: "prepare",
        messages: [
          { type: "pre_prepare" },
          { type: "prepare" },
          { type: "prepare" },
          { type: "prepare" },
        ],
      });

      const handler = registry.handlers.get("bft_run_prepare")!;
      const result = await handler({
        cluster_id: "bft-abc-1",
        sequence_number: 1,
      });

      const text = getText(result);
      expect(text).toContain("Prepare Phase Complete");
      expect(text).toContain("3");
    });
  });

  describe("bft_run_commit", () => {
    it("should run commit phase and show message count", async () => {
      mockEngine.runCommitPhase.mockReturnValue({
        sequenceNumber: 1,
        phase: "commit",
        messages: [
          { type: "pre_prepare" },
          { type: "prepare" },
          { type: "prepare" },
          { type: "commit" },
          { type: "commit" },
          { type: "commit" },
        ],
      });

      const handler = registry.handlers.get("bft_run_commit")!;
      const result = await handler({
        cluster_id: "bft-abc-1",
        sequence_number: 1,
      });

      const text = getText(result);
      expect(text).toContain("Commit Phase Complete");
      expect(text).toContain("3");
    });
  });

  describe("bft_check_consensus", () => {
    it("should report consensus reached", async () => {
      mockEngine.checkConsensus.mockReturnValue({
        decided: true,
        value: "tx-42",
        phase: "decided",
        prepareCount: 3,
        commitCount: 3,
        requiredQuorum: 3,
      });

      const handler = registry.handlers.get("bft_check_consensus")!;
      const result = await handler({
        cluster_id: "bft-abc-1",
        sequence_number: 1,
      });

      const text = getText(result);
      expect(text).toContain("YES");
      expect(text).toContain("tx-42");
      expect(text).toContain("decided");
    });

    it("should report consensus not reached", async () => {
      mockEngine.checkConsensus.mockReturnValue({
        decided: false,
        value: null,
        phase: "commit",
        prepareCount: 2,
        commitCount: 1,
        requiredQuorum: 3,
      });

      const handler = registry.handlers.get("bft_check_consensus")!;
      const result = await handler({
        cluster_id: "bft-abc-1",
        sequence_number: 1,
      });

      const text = getText(result);
      expect(text).toContain("NO");
      expect(text).toContain("(none)");
    });
  });

  describe("bft_run_full_round", () => {
    it("should run full round with consensus", async () => {
      mockEngine.runFullRound.mockReturnValue({
        decided: true,
        value: "tx-99",
        phase: "decided",
        prepareCount: 4,
        commitCount: 4,
        requiredQuorum: 3,
      });

      const handler = registry.handlers.get("bft_run_full_round")!;
      const result = await handler({
        cluster_id: "bft-abc-1",
        value: "tx-99",
      });

      const text = getText(result);
      expect(text).toContain("Full Consensus Round");
      expect(text).toContain("YES");
      expect(text).toContain("tx-99");
      expect(text).toContain("Consensus reached");
    });

    it("should show failure message when consensus not reached", async () => {
      mockEngine.runFullRound.mockReturnValue({
        decided: false,
        value: null,
        phase: "commit",
        prepareCount: 1,
        commitCount: 0,
        requiredQuorum: 3,
      });

      const handler = registry.handlers.get("bft_run_full_round")!;
      const result = await handler({
        cluster_id: "bft-abc-1",
        value: "tx-fail",
      });

      const text = getText(result);
      expect(text).toContain("NOT reached");
    });
  });

  describe("bft_inspect", () => {
    it("should show cluster state with node details", async () => {
      mockEngine.inspect.mockReturnValue({
        id: "bft-abc-1",
        name: "my-cluster",
        nodes: [
          {
            id: "node-1",
            behavior: "honest",
            phase: "decided",
            decidedValue: "tx-42",
          },
          {
            id: "node-2",
            behavior: "honest",
            phase: "decided",
            decidedValue: "tx-42",
          },
          {
            id: "node-3",
            behavior: "silent",
            phase: "idle",
            decidedValue: null,
          },
          {
            id: "node-4",
            behavior: "honest",
            phase: "decided",
            decidedValue: "tx-42",
          },
        ],
        currentRound: null,
        roundCount: 1,
        faultTolerance: "f=1 (tolerates 1 Byzantine node out of 4)",
      });

      const handler = registry.handlers.get("bft_inspect")!;
      const result = await handler({ cluster_id: "bft-abc-1" });

      const text = getText(result);
      expect(text).toContain("my-cluster");
      expect(text).toContain("f=1");
      expect(text).toContain("node-1");
      expect(text).toContain("honest");
      expect(text).toContain("silent");
      expect(text).toContain("tx-42");
    });

    it("should show dash for nodes with no decided value", async () => {
      mockEngine.inspect.mockReturnValue({
        id: "bft-abc-1",
        name: "cluster",
        nodes: [
          {
            id: "node-1",
            behavior: "honest",
            phase: "idle",
            decidedValue: null,
          },
        ],
        currentRound: null,
        roundCount: 0,
        faultTolerance: "f=1",
      });

      const text = getText(
        await registry.handlers.get("bft_inspect")!({
          cluster_id: "bft-abc-1",
        }),
      );
      expect(text).toContain("| - |");
    });
  });

  describe("authorization", () => {
    it("should pass userId to engine for access control", async () => {
      mockEngine.propose.mockImplementation(() => {
        throw new Error("Access denied");
      });

      const handler = registry.handlers.get("bft_propose")!;
      const result = await handler({
        cluster_id: "someone-elses",
        value: "hack",
      });

      expect(isError(result)).toBe(true);
    });
  });
});
