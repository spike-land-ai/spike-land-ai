import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Redis } from "@upstash/redis";

// Track all mock methods for assertions
const mockRedisMethods = {
  lpush: vi.fn(),
  expire: vi.fn(),
  sadd: vi.fn(),
  rpop: vi.fn(),
  llen: vi.fn(),
  srem: vi.fn(),
  lrange: vi.fn(),
  smembers: vi.fn(),
  sismember: vi.fn(),
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  eval: vi.fn(),
};

vi.mock("@upstash/redis", () => {
  return {
    Redis: vi.fn(),
  };
});

function setupRedisMock(): void {
  const RedisCtor = Redis as unknown as ReturnType<typeof vi.fn>;
  RedisCtor.mockImplementation(function mockedRedis() {
    return { ...mockRedisMethods };
  });
}

describe("upstash/client", () => {
  const originalEnv = process.env;
  let clientModule: typeof import("./client");

  beforeEach(async () => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: "https://mock.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "mock",
    };
    // Clear REDIS_URL to avoid native adapter path
    delete process.env.REDIS_URL;

    vi.clearAllMocks();
    setupRedisMock();

    clientModule = await import("./client");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe("getInstanceId", () => {
    it("should return a non-empty UUID string", () => {
      const id = clientModule.getInstanceId();
      expect(id).toBeTruthy();
      expect(typeof id).toBe("string");
      // UUID v4 pattern
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i);
    });
  });

  describe("enqueueMessage", () => {
    it("should push message to queue, set TTL, and track in pending set", async () => {
      mockRedisMethods.lpush.mockResolvedValue(1);
      mockRedisMethods.expire.mockResolvedValue(1);
      mockRedisMethods.sadd.mockResolvedValue(1);

      await clientModule.enqueueMessage("app-1", "msg-123");

      expect(mockRedisMethods.lpush).toHaveBeenCalledWith("app:app-1:pending_messages", "msg-123");
      expect(mockRedisMethods.expire).toHaveBeenCalledWith(
        "app:app-1:pending_messages",
        86400, // 24 hours
      );
      expect(mockRedisMethods.sadd).toHaveBeenCalledWith("apps:with_pending", "app-1");
    });
  });

  describe("dequeueMessage", () => {
    it("should pop oldest message and remove app from set when queue is empty", async () => {
      mockRedisMethods.rpop.mockResolvedValue("msg-123");
      mockRedisMethods.llen.mockResolvedValue(0);
      mockRedisMethods.srem.mockResolvedValue(1);

      const result = await clientModule.dequeueMessage("app-1");

      expect(result).toBe("msg-123");
      expect(mockRedisMethods.rpop).toHaveBeenCalledWith("app:app-1:pending_messages");
      expect(mockRedisMethods.srem).toHaveBeenCalledWith("apps:with_pending", "app-1");
    });

    it("should not remove app from set when queue still has messages", async () => {
      mockRedisMethods.rpop.mockResolvedValue("msg-123");
      mockRedisMethods.llen.mockResolvedValue(3);

      const result = await clientModule.dequeueMessage("app-1");

      expect(result).toBe("msg-123");
      expect(mockRedisMethods.srem).not.toHaveBeenCalled();
    });

    it("should return null when queue is empty", async () => {
      mockRedisMethods.rpop.mockResolvedValue(null);
      mockRedisMethods.llen.mockResolvedValue(0);
      mockRedisMethods.srem.mockResolvedValue(0);

      const result = await clientModule.dequeueMessage("app-1");

      expect(result).toBeNull();
    });
  });

  describe("getPendingMessages", () => {
    it("should return all message IDs in the queue", async () => {
      mockRedisMethods.lrange.mockResolvedValue(["msg-1", "msg-2", "msg-3"]);

      const result = await clientModule.getPendingMessages("app-1");

      expect(result).toEqual(["msg-1", "msg-2", "msg-3"]);
      expect(mockRedisMethods.lrange).toHaveBeenCalledWith("app:app-1:pending_messages", 0, -1);
    });

    it("should return empty array when no messages pending", async () => {
      mockRedisMethods.lrange.mockResolvedValue([]);

      const result = await clientModule.getPendingMessages("app-1");

      expect(result).toEqual([]);
    });
  });

  describe("getAppsWithPending", () => {
    it("should return all app IDs with pending messages", async () => {
      mockRedisMethods.smembers.mockResolvedValue(["app-1", "app-2"]);

      const result = await clientModule.getAppsWithPending();

      expect(result).toEqual(["app-1", "app-2"]);
      expect(mockRedisMethods.smembers).toHaveBeenCalledWith("apps:with_pending");
    });
  });

  describe("hasPendingMessages", () => {
    it("should return true when app has pending messages", async () => {
      mockRedisMethods.sismember.mockResolvedValue(1);

      const result = await clientModule.hasPendingMessages("app-1");

      expect(result).toBe(true);
      expect(mockRedisMethods.sismember).toHaveBeenCalledWith("apps:with_pending", "app-1");
    });

    it("should return false when app has no pending messages", async () => {
      mockRedisMethods.sismember.mockResolvedValue(0);

      const result = await clientModule.hasPendingMessages("app-1");

      expect(result).toBe(false);
    });
  });

  describe("getPendingCount", () => {
    it("should return the number of pending messages", async () => {
      mockRedisMethods.llen.mockResolvedValue(5);

      const result = await clientModule.getPendingCount("app-1");

      expect(result).toBe(5);
      expect(mockRedisMethods.llen).toHaveBeenCalledWith("app:app-1:pending_messages");
    });
  });

  describe("setAgentWorking", () => {
    it("should set working flag with 5-minute TTL when true", async () => {
      mockRedisMethods.set.mockResolvedValue("OK");

      await clientModule.setAgentWorking("app-1", true);

      expect(mockRedisMethods.set).toHaveBeenCalledWith("app:app-1:agent_working", "1", {
        ex: 300,
      });
    });

    it("should delete working flag when false", async () => {
      mockRedisMethods.del.mockResolvedValue(1);

      await clientModule.setAgentWorking("app-1", false);

      expect(mockRedisMethods.del).toHaveBeenCalledWith("app:app-1:agent_working");
    });
  });

  describe("isAgentWorking", () => {
    it("should return true when agent is working", async () => {
      mockRedisMethods.get.mockResolvedValue("1");

      const result = await clientModule.isAgentWorking("app-1");

      expect(result).toBe(true);
    });

    it("should return false when agent is not working", async () => {
      mockRedisMethods.get.mockResolvedValue(null);

      const result = await clientModule.isAgentWorking("app-1");

      expect(result).toBe(false);
    });
  });

  describe("clearPendingMessages", () => {
    it("should delete queue, remove from pending set, and clear agent working", async () => {
      mockRedisMethods.del.mockResolvedValue(1);
      mockRedisMethods.srem.mockResolvedValue(1);

      await clientModule.clearPendingMessages("app-1");

      expect(mockRedisMethods.del).toHaveBeenCalledWith("app:app-1:pending_messages");
      expect(mockRedisMethods.srem).toHaveBeenCalledWith("apps:with_pending", "app-1");
      expect(mockRedisMethods.del).toHaveBeenCalledWith("app:app-1:agent_working");
    });
  });

  describe("getQueueStats", () => {
    it("should return zero counts when no apps have pending messages", async () => {
      mockRedisMethods.smembers.mockResolvedValue([]);

      const result = await clientModule.getQueueStats();

      expect(result).toEqual({
        appsWithPending: 0,
        totalPendingMessages: 0,
      });
    });

    it("should aggregate pending message counts across apps", async () => {
      mockRedisMethods.smembers.mockResolvedValue(["app-1", "app-2", "app-3"]);
      // getPendingCount calls llen for each app
      mockRedisMethods.llen
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(7)
        .mockResolvedValueOnce(2);

      const result = await clientModule.getQueueStats();

      expect(result).toEqual({
        appsWithPending: 3,
        totalPendingMessages: 12,
      });
    });
  });

  describe("setMcpAgentActive", () => {
    it("should set MCP agent active flag with 5-minute TTL", async () => {
      mockRedisMethods.set.mockResolvedValue("OK");

      await clientModule.setMcpAgentActive("app-1");

      expect(mockRedisMethods.set).toHaveBeenCalledWith("mcp_agent_active:app-1", "1", { ex: 300 });
    });
  });

  describe("isMcpAgentActive", () => {
    it("should return true when MCP agent is active", async () => {
      mockRedisMethods.get.mockResolvedValue("1");

      const result = await clientModule.isMcpAgentActive("app-1");

      expect(result).toBe(true);
    });

    it("should return false when MCP agent is not active", async () => {
      mockRedisMethods.get.mockResolvedValue(null);

      const result = await clientModule.isMcpAgentActive("app-1");

      expect(result).toBe(false);
    });
  });

  describe("publishSSEEvent", () => {
    it("should publish event via Lua script", async () => {
      mockRedisMethods.eval.mockResolvedValue(undefined);

      await clientModule.publishSSEEvent("app-1", {
        type: "update",
        data: { code: "console.log(1)" },
        timestamp: 1000,
      });

      expect(mockRedisMethods.eval).toHaveBeenCalledWith(
        expect.stringContaining("PUBLISH"),
        ["sse:app-1:events"],
        ["sse:app-1", expect.stringContaining('"type":"update"'), "60", "0", "99"],
      );
    });

    it("should include sourceInstanceId in the event payload", async () => {
      mockRedisMethods.eval.mockResolvedValue(undefined);

      await clientModule.publishSSEEvent("app-1", {
        type: "test",
        data: null,
        timestamp: 500,
      });

      const evalCall = mockRedisMethods.eval.mock.calls[0]!;
      const payload = JSON.parse(evalCall[2][1] as string) as Record<string, unknown>;
      expect(payload.sourceInstanceId).toBe(clientModule.getInstanceId());
    });

    it("should not throw when eval fails", async () => {
      mockRedisMethods.eval.mockRejectedValue(new Error("Redis down"));
      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Should not throw
      await clientModule.publishSSEEvent("app-1", {
        type: "test",
        data: null,
        timestamp: 500,
      });

      consoleSpy.mockRestore();
    });
  });

  describe("getSSEEvents", () => {
    it("should filter events correctly using Redis Lua script", async () => {
      const instanceId = clientModule.getInstanceId();
      const otherInstanceId = "other-instance-id";

      const events = [
        {
          type: "msg",
          data: "new",
          timestamp: 200,
          sourceInstanceId: otherInstanceId,
        },
        {
          type: "msg",
          data: "mine",
          timestamp: 190,
          sourceInstanceId: instanceId,
        },
        {
          type: "msg",
          data: "old",
          timestamp: 100,
          sourceInstanceId: otherInstanceId,
        },
      ];

      const expectedFiltered = [JSON.stringify(events[0])];
      mockRedisMethods.eval.mockResolvedValue(expectedFiltered);

      const result = await clientModule.getSSEEvents("app-1", 150);

      expect(mockRedisMethods.eval).toHaveBeenCalledWith(
        expect.stringContaining("local matches = {}"),
        ["sse:app-1:events"],
        [150, instanceId],
      );

      expect(result).toHaveLength(1);
      expect(result[0]?.data).toBe("new");
      expect(result[0]?.timestamp).toBe(200);
    });

    it("should fall back to client-side filtering if Lua script fails", async () => {
      const instanceId = clientModule.getInstanceId();
      const otherInstanceId = "other-instance-id";

      const events = [
        {
          type: "msg",
          data: "new",
          timestamp: 200,
          sourceInstanceId: otherInstanceId,
        },
        {
          type: "msg",
          data: "mine",
          timestamp: 190,
          sourceInstanceId: instanceId,
        },
        {
          type: "msg",
          data: "old",
          timestamp: 100,
          sourceInstanceId: otherInstanceId,
        },
      ];

      mockRedisMethods.eval.mockRejectedValue(new Error("Script error"));
      mockRedisMethods.lrange.mockResolvedValue(events.map((e) => JSON.stringify(e)));

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await clientModule.getSSEEvents("app-1", 150);

      expect(mockRedisMethods.eval).toHaveBeenCalled();
      expect(mockRedisMethods.lrange).toHaveBeenCalled();
      expect(result).toHaveLength(1);
      expect(result[0]?.data).toBe("new");

      consoleSpy.mockRestore();
    });

    it("should handle fallback with pre-parsed objects from lrange", async () => {
      const otherInstanceId = "other-instance-id";

      mockRedisMethods.eval.mockRejectedValue(new Error("Script error"));
      // Upstash REST auto-parses JSON, so lrange may return objects
      mockRedisMethods.lrange.mockResolvedValue([
        {
          type: "msg",
          data: "event-obj",
          timestamp: 200,
          sourceInstanceId: otherInstanceId,
        },
      ]);

      const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      const result = await clientModule.getSSEEvents("app-1", 100);

      expect(result).toHaveLength(1);
      expect(result[0]?.data).toBe("event-obj");

      consoleSpy.mockRestore();
    });
  });

  describe("getCodeHash", () => {
    it("should return stored code hash for an app", async () => {
      mockRedisMethods.get.mockResolvedValue("abc123hash");

      const result = await clientModule.getCodeHash("app-1");

      expect(result).toBe("abc123hash");
      expect(mockRedisMethods.get).toHaveBeenCalledWith("app:app-1:code_hash");
    });

    it("should return null when no hash is stored", async () => {
      mockRedisMethods.get.mockResolvedValue(null);

      const result = await clientModule.getCodeHash("app-1");

      expect(result).toBeNull();
    });
  });

  describe("setCodeHash", () => {
    it("should store code hash with 1-hour TTL", async () => {
      mockRedisMethods.set.mockResolvedValue("OK");

      await clientModule.setCodeHash("app-1", "abc123hash");

      expect(mockRedisMethods.set).toHaveBeenCalledWith("app:app-1:code_hash", "abc123hash", {
        ex: 3600,
      });
    });
  });

  describe("redis client creation", () => {
    it("should use KV_REST_API_URL as fallback when UPSTASH vars are missing", async () => {
      vi.resetModules();
      vi.clearAllMocks();
      delete process.env.REDIS_URL;
      delete process.env.UPSTASH_REDIS_REST_URL;
      delete process.env.UPSTASH_REDIS_REST_TOKEN;
      process.env.KV_REST_API_URL = "https://kv.vercel.io";
      process.env.KV_REST_API_TOKEN = "kv-token";

      setupRedisMock();

      const mod = await import("./client");
      // Trigger Redis client creation by calling any method
      mockRedisMethods.sismember.mockResolvedValue(0);
      await mod.hasPendingMessages("app-1");

      expect(Redis).toHaveBeenCalledWith({
        url: "https://kv.vercel.io",
        token: "kv-token",
      });
    });
  });
});

describe("getQueueStats", () => {
  const originalEnv = process.env;
  let clientModule: typeof import("./client");

  beforeEach(async () => {
    vi.resetModules();
    process.env = {
      ...originalEnv,
      UPSTASH_REDIS_REST_URL: "https://mock.upstash.io",
      UPSTASH_REDIS_REST_TOKEN: "mock",
    };
    vi.clearAllMocks();

    // Re-import the module to ensure a fresh _redisPromise and Redis instance
    clientModule = await import("./client");
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it("should calculate queue stats correctly using Redis Lua script", async () => {
    const expectedStats = [2, 8]; // 2 apps, 8 pending messages

    const evalMock = vi.fn().mockResolvedValue(expectedStats);

    (Redis as unknown as { mockImplementation: (fn: () => unknown) => void }).mockImplementation(
      function () {
        return {
          eval: evalMock,
        };
      },
    );

    const result = await clientModule.getQueueStats();

    expect(evalMock).toHaveBeenCalledWith(
      expect.stringContaining('local apps = redis.call("SMEMBERS", KEYS[1])'),
      ["apps:with_pending"],
      [],
    );

    expect(result).toEqual({
      appsWithPending: 2,
      totalPendingMessages: 8,
    });
  });

  it("should fall back to client-side aggregation if Lua script fails", async () => {
    const appIds = ["app-1", "app-2"];

    // First call (Lua script) fails
    const evalMock = vi.fn().mockRejectedValue(new Error("Script error"));

    // Fallback calls
    const smembersMock = vi.fn().mockResolvedValue(appIds);
    const llenMock = vi
      .fn()
      .mockResolvedValueOnce(5) // app-1 has 5 messages
      .mockResolvedValueOnce(3); // app-2 has 3 messages

    (Redis as unknown as { mockImplementation: (fn: () => unknown) => void }).mockImplementation(
      function () {
        return {
          eval: evalMock,
          smembers: smembersMock,
          llen: llenMock,
        };
      },
    );

    // Silence console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await clientModule.getQueueStats();

    // Check Lua script attempt
    expect(evalMock).toHaveBeenCalled();

    // Check fallback execution
    expect(smembersMock).toHaveBeenCalledWith("apps:with_pending");
    expect(llenMock).toHaveBeenCalledTimes(2);
    expect(llenMock).toHaveBeenCalledWith("app:app-1:pending_messages");
    expect(llenMock).toHaveBeenCalledWith("app:app-2:pending_messages");

    expect(result).toEqual({
      appsWithPending: 2,
      totalPendingMessages: 8,
    });

    consoleSpy.mockRestore();
  });

  it("should handle empty queue stats correctly in fallback mode", async () => {
    const evalMock = vi.fn().mockRejectedValue(new Error("Script error"));
    const smembersMock = vi.fn().mockResolvedValue([]);
    const llenMock = vi.fn();

    (Redis as unknown as { mockImplementation: (fn: () => unknown) => void }).mockImplementation(
      function () {
        return {
          eval: evalMock,
          smembers: smembersMock,
          llen: llenMock,
        };
      },
    );

    // Silence console.error for this test
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await clientModule.getQueueStats();

    expect(smembersMock).toHaveBeenCalledWith("apps:with_pending");
    expect(llenMock).not.toHaveBeenCalled();

    expect(result).toEqual({
      appsWithPending: 0,
      totalPendingMessages: 0,
    });

    consoleSpy.mockRestore();
  });
});
