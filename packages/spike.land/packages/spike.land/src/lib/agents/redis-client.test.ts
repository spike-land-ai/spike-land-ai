import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedis = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  sadd: vi.fn(),
  smembers: vi.fn(),
  srem: vi.fn(),
  lpush: vi.fn(),
  ltrim: vi.fn(),
  lrange: vi.fn(),
  rpop: vi.fn(),
  expire: vi.fn(),
  hincrby: vi.fn(),
  hgetall: vi.fn(),
  publish: vi.fn(),
  ping: vi.fn(),
}));

vi.mock("@/lib/upstash/client", () => ({ redis: mockRedis }));

import {
  disconnectAgent,
  getAgentActivity,
  getAgentData,
  getAgentSSEEvents,
  getAgentStatus,
  getAgentToolStats,
  getPendingTasks,
  getUserAgents,
  isRedisAvailable,
  logAgentActivity,
  popTask,
  processHeartbeat,
  publishAgentEvent,
  registerAgent,
  removeAgent,
  sendTaskToAgent,
} from "./redis-client";
import type { AgentRedisData } from "./redis-client";

const makeAgentData = (
  overrides?: Partial<AgentRedisData>,
): AgentRedisData => ({
  agentId: "agent-1",
  userId: "user-1",
  machineId: "machine-1",
  sessionId: "session-1",
  displayName: "Test Agent",
  projectPath: "/project",
  connectedAt: 1000,
  lastHeartbeat: 1000,
  ...overrides,
});

describe("redis-client", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRedis.publish.mockResolvedValue(0);
    mockRedis.lpush.mockResolvedValue(1);
    mockRedis.ltrim.mockResolvedValue("OK");
    mockRedis.expire.mockResolvedValue(1);
    mockRedis.set.mockResolvedValue("OK");
    mockRedis.del.mockResolvedValue(1);
    mockRedis.sadd.mockResolvedValue(1);
    mockRedis.srem.mockResolvedValue(1);
  });

  describe("registerAgent", () => {
    it("should store data, set status, add to user set, log activity, and publish event", async () => {
      const data = makeAgentData();
      await registerAgent(data);

      expect(mockRedis.set).toHaveBeenCalledWith(
        "agent:agent-1:data",
        JSON.stringify(data),
        { ex: 30 * 24 * 60 * 60 }, // 30-day TTL to prevent orphaned keys
      );
      expect(mockRedis.set).toHaveBeenCalledWith(
        "agent:agent-1:status",
        "online",
        { ex: 90 },
      );
      expect(mockRedis.sadd).toHaveBeenCalledWith(
        "user:user-1:agents",
        "agent-1",
      );
      // Activity logged (lpush called for activity)
      expect(mockRedis.lpush).toHaveBeenCalled();
      // SSE event published
      expect(mockRedis.publish).toHaveBeenCalled();
    });
  });

  describe("processHeartbeat", () => {
    it("should refresh status TTL", async () => {
      await processHeartbeat("agent-1");

      expect(mockRedis.set).toHaveBeenCalledWith(
        "agent:agent-1:status",
        "online",
        { ex: 90 },
      );
    });

    it("should update agent data when projectPath provided", async () => {
      const existingData = makeAgentData();
      mockRedis.get.mockResolvedValue(JSON.stringify(existingData));

      await processHeartbeat("agent-1", "online", {
        projectPath: "/new-project",
      });

      const setCall = mockRedis.set.mock.calls.find(
        (c: unknown[]) => c[0] === "agent:agent-1:data",
      );
      expect(setCall).toBeDefined();
      const savedData = JSON.parse(setCall![1] as string);
      expect(savedData.projectPath).toBe("/new-project");
    });

    it("should update tool stats when toolUsage provided", async () => {
      await processHeartbeat("agent-1", "online", {
        toolUsage: { read: 5, write: 3 },
      });

      expect(mockRedis.hincrby).toHaveBeenCalledWith(
        "agent:agent-1:tools",
        "read",
        5,
      );
      expect(mockRedis.hincrby).toHaveBeenCalledWith(
        "agent:agent-1:tools",
        "write",
        3,
      );
    });

    it("should log activity when activity provided", async () => {
      const activity = {
        type: "tool_use",
        description: "Used read tool",
        timestamp: Date.now(),
      };

      await processHeartbeat("agent-1", "sleeping", { activity });

      expect(mockRedis.set).toHaveBeenCalledWith(
        "agent:agent-1:status",
        "sleeping",
        { ex: 90 },
      );
      expect(mockRedis.lpush).toHaveBeenCalled();
    });
  });

  describe("logAgentActivity", () => {
    it("should lpush, ltrim, and expire", async () => {
      const activity = {
        type: "test",
        description: "Test activity",
        timestamp: 1000,
      };

      await logAgentActivity("agent-1", activity);

      expect(mockRedis.lpush).toHaveBeenCalledWith(
        "agent:agent-1:activity",
        JSON.stringify(activity),
      );
      expect(mockRedis.ltrim).toHaveBeenCalledWith(
        "agent:agent-1:activity",
        0,
        99,
      );
      expect(mockRedis.expire).toHaveBeenCalledWith(
        "agent:agent-1:activity",
        86400,
      );
    });
  });

  describe("getAgentActivity", () => {
    it("should return parsed JSON array", async () => {
      const activities = [
        JSON.stringify({ type: "a", description: "d1", timestamp: 1 }),
        JSON.stringify({ type: "b", description: "d2", timestamp: 2 }),
      ];
      mockRedis.lrange.mockResolvedValue(activities);

      const result = await getAgentActivity("agent-1");

      expect(result).toHaveLength(2);
      expect(result[0]!.type).toBe("a");
      expect(result[1]!.type).toBe("b");
    });

    it("should respect limit parameter", async () => {
      mockRedis.lrange.mockResolvedValue([]);

      await getAgentActivity("agent-1", 10);

      expect(mockRedis.lrange).toHaveBeenCalledWith(
        "agent:agent-1:activity",
        0,
        9,
      );
    });
  });

  describe("getAgentStatus", () => {
    it("should return status when key exists", async () => {
      mockRedis.get.mockResolvedValue("online");

      const result = await getAgentStatus("agent-1");

      expect(result).toBe("online");
    });

    it("should return 'offline' when no key", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getAgentStatus("agent-1");

      expect(result).toBe("offline");
    });
  });

  describe("getAgentData", () => {
    it("should return parsed data when exists", async () => {
      const data = makeAgentData();
      mockRedis.get.mockResolvedValue(JSON.stringify(data));

      const result = await getAgentData("agent-1");

      expect(result).toEqual(data);
    });

    it("should return null when not found", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await getAgentData("agent-1");

      expect(result).toBeNull();
    });
  });

  describe("getUserAgents", () => {
    it("should return agents with status", async () => {
      mockRedis.smembers.mockResolvedValue(["agent-1"]);
      const data = makeAgentData();
      mockRedis.get
        .mockResolvedValueOnce(JSON.stringify(data)) // agent data
        .mockResolvedValueOnce("online"); // agent status

      const result = await getUserAgents("user-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.agentId).toBe("agent-1");
      expect(result[0]!.status).toBe("online");
    });

    it("should filter null entries", async () => {
      mockRedis.smembers.mockResolvedValue(["agent-1", "agent-2"]);
      mockRedis.get
        .mockResolvedValueOnce(null) // agent-1 data missing
        .mockResolvedValueOnce(null) // agent-1 status
        .mockResolvedValueOnce(
          JSON.stringify(makeAgentData({ agentId: "agent-2" })),
        )
        .mockResolvedValueOnce("sleeping");

      const result = await getUserAgents("user-1");

      expect(result).toHaveLength(1);
      expect(result[0]!.agentId).toBe("agent-2");
    });

    it("should return empty array for empty set", async () => {
      mockRedis.smembers.mockResolvedValue([]);

      const result = await getUserAgents("user-1");

      expect(result).toEqual([]);
    });
  });

  describe("getAgentToolStats", () => {
    it("should return parsed number map", async () => {
      mockRedis.hgetall.mockResolvedValue({ read: "5", write: "3" });

      const result = await getAgentToolStats("agent-1");

      expect(result).toEqual({ read: 5, write: 3 });
    });

    it("should return empty object when null", async () => {
      mockRedis.hgetall.mockResolvedValue(null);

      const result = await getAgentToolStats("agent-1");

      expect(result).toEqual({});
    });
  });

  describe("disconnectAgent", () => {
    it("should delete status key, log activity, and publish event", async () => {
      await disconnectAgent("agent-1", "user-1");

      expect(mockRedis.del).toHaveBeenCalledWith("agent:agent-1:status");
      expect(mockRedis.lpush).toHaveBeenCalled();
      expect(mockRedis.publish).toHaveBeenCalled();
    });
  });

  describe("removeAgent", () => {
    it("should delete all keys and remove from user set", async () => {
      await removeAgent("agent-1", "user-1");

      expect(mockRedis.del).toHaveBeenCalledWith("agent:agent-1:data");
      expect(mockRedis.del).toHaveBeenCalledWith("agent:agent-1:status");
      expect(mockRedis.del).toHaveBeenCalledWith("agent:agent-1:activity");
      expect(mockRedis.del).toHaveBeenCalledWith("agent:agent-1:tools");
      expect(mockRedis.del).toHaveBeenCalledWith("agent:agent-1:tasks");
      expect(mockRedis.srem).toHaveBeenCalledWith(
        "user:user-1:agents",
        "agent-1",
      );
    });
  });

  describe("sendTaskToAgent", () => {
    it("should add task with pending status and set TTL", async () => {
      const task = { id: "task-1", prompt: "Do something", createdAt: 1000 };

      await sendTaskToAgent("agent-1", task);

      const pushed = JSON.parse(
        mockRedis.lpush.mock.calls[0]![1] as string,
      );
      expect(pushed.status).toBe("pending");
      expect(pushed.id).toBe("task-1");
      expect(mockRedis.expire).toHaveBeenCalledWith(
        "agent:agent-1:tasks",
        86400,
      );
    });
  });

  describe("getPendingTasks", () => {
    it("should return only pending tasks", async () => {
      mockRedis.lrange.mockResolvedValue([
        JSON.stringify({
          id: "t1",
          status: "pending",
          prompt: "a",
          createdAt: 1,
        }),
        JSON.stringify({
          id: "t2",
          status: "completed",
          prompt: "b",
          createdAt: 2,
        }),
        JSON.stringify({
          id: "t3",
          status: "pending",
          prompt: "c",
          createdAt: 3,
        }),
      ]);

      const result = await getPendingTasks("agent-1");

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe("t1");
      expect(result[1]!.id).toBe("t3");
    });
  });

  describe("popTask", () => {
    it("should return parsed task", async () => {
      mockRedis.rpop.mockResolvedValue(
        JSON.stringify({
          id: "t1",
          status: "pending",
          prompt: "a",
          createdAt: 1,
        }),
      );

      const result = await popTask("agent-1");

      expect(result).not.toBeNull();
      expect(result!.id).toBe("t1");
    });

    it("should return null when queue empty", async () => {
      mockRedis.rpop.mockResolvedValue(null);

      const result = await popTask("agent-1");

      expect(result).toBeNull();
    });
  });

  describe("publishAgentEvent", () => {
    it("should publish to channel and store in list", async () => {
      const event = {
        type: "agent_connected" as const,
        agentId: "agent-1",
        data: null,
        timestamp: 1000,
      };

      await publishAgentEvent("user-1", event);

      expect(mockRedis.publish).toHaveBeenCalledWith(
        "sse:agents:user-1",
        JSON.stringify(event),
      );
      expect(mockRedis.lpush).toHaveBeenCalledWith(
        "sse:agents:user-1:events",
        JSON.stringify(event),
      );
    });

    it("should handle publish errors gracefully", async () => {
      mockRedis.publish.mockRejectedValue(new Error("connection failed"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(
        () => {},
      );

      const event = {
        type: "agent_connected" as const,
        agentId: "agent-1",
        data: null,
        timestamp: 1000,
      };

      // Should not throw
      await publishAgentEvent("user-1", event);

      consoleSpy.mockRestore();
    });
  });

  describe("getAgentSSEEvents", () => {
    it("should filter by timestamp and return oldest-first", async () => {
      mockRedis.lrange.mockResolvedValue([
        JSON.stringify({
          type: "agent_connected",
          agentId: "a1",
          data: null,
          timestamp: 300,
        }),
        JSON.stringify({
          type: "agent_disconnected",
          agentId: "a2",
          data: null,
          timestamp: 200,
        }),
        JSON.stringify({
          type: "agent_activity",
          agentId: "a3",
          data: null,
          timestamp: 100,
        }),
      ]);

      const result = await getAgentSSEEvents("user-1", 150);

      expect(result).toHaveLength(2);
      // oldest first (reversed from lrange order)
      expect(result[0]!.timestamp).toBe(200);
      expect(result[1]!.timestamp).toBe(300);
    });
  });

  describe("isRedisAvailable", () => {
    it("should return true on ping success", async () => {
      mockRedis.ping.mockResolvedValue("PONG");

      const result = await isRedisAvailable();

      expect(result).toBe(true);
    });

    it("should return false on error", async () => {
      mockRedis.ping.mockRejectedValue(new Error("connection refused"));

      const result = await isRedisAvailable();

      expect(result).toBe(false);
    });
  });
});
