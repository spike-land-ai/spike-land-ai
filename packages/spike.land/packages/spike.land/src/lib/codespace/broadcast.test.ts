import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/lib/upstash", () => ({
  redis: {
    publish: vi.fn().mockResolvedValue(0),
    lpush: vi.fn().mockResolvedValue(1),
    expire: vi.fn().mockResolvedValue(1),
    ltrim: vi.fn().mockResolvedValue("OK"),
    lrange: vi.fn().mockResolvedValue([]),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    error: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
  },
}));

import {
  addConnection,
  broadcastToCodespace,
  getCodespaceInstanceId,
  getCodespaceSSEEvents,
  getConnections,
  removeConnection,
} from "./broadcast";

describe("broadcast", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("getCodespaceInstanceId", () => {
    it("should return a non-empty string", () => {
      const id = getCodespaceInstanceId();
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
    });

    it("should return the same ID on subsequent calls", () => {
      expect(getCodespaceInstanceId()).toBe(getCodespaceInstanceId());
    });
  });

  describe("connection management", () => {
    it("should return undefined for unknown codespace", () => {
      expect(getConnections("nonexistent-space")).toBeUndefined();
    });

    it("should add and retrieve a connection", () => {
      const controller = {
        enqueue: vi.fn(),
      } as unknown as ReadableStreamDefaultController<Uint8Array>;

      addConnection("test-space-add", controller);
      const connections = getConnections("test-space-add");
      expect(connections).toBeDefined();
      expect(connections!.size).toBe(1);
      expect(connections!.has(controller)).toBe(true);

      // Clean up
      removeConnection("test-space-add", controller);
    });

    it("should add multiple connections to same codespace", () => {
      const c1 = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController<Uint8Array>;
      const c2 = { enqueue: vi.fn() } as unknown as ReadableStreamDefaultController<Uint8Array>;

      addConnection("test-space-multi", c1);
      addConnection("test-space-multi", c2);

      const connections = getConnections("test-space-multi");
      expect(connections!.size).toBe(2);

      removeConnection("test-space-multi", c1);
      removeConnection("test-space-multi", c2);
    });

    it("should remove a connection", () => {
      const controller = {
        enqueue: vi.fn(),
      } as unknown as ReadableStreamDefaultController<Uint8Array>;

      addConnection("test-space-remove", controller);
      removeConnection("test-space-remove", controller);
      // After removing last connection, the map entry is cleaned up
      expect(getConnections("test-space-remove")).toBeUndefined();
    });

    it("should handle removing from non-existent codespace", () => {
      const controller = {
        enqueue: vi.fn(),
      } as unknown as ReadableStreamDefaultController<Uint8Array>;
      // Should not throw
      removeConnection("nonexistent", controller);
    });
  });

  describe("getCodespaceSSEEvents", () => {
    it("should return empty array when no events in Redis", async () => {
      const events = await getCodespaceSSEEvents("test-space", 0);
      expect(events).toEqual([]);
    });

    it("should filter events from this instance", async () => {
      const { redis } = await import("@/lib/upstash");
      const instanceId = getCodespaceInstanceId();

      vi.mocked(redis.lrange).mockResolvedValue([
        JSON.stringify({
          type: "session_update",
          data: {},
          timestamp: 1000,
          sourceInstanceId: instanceId,
        }),
      ]);

      const events = await getCodespaceSSEEvents("test-space", 0);
      expect(events).toEqual([]);
    });

    it("should include events from other instances after timestamp", async () => {
      const { redis } = await import("@/lib/upstash");

      vi.mocked(redis.lrange).mockResolvedValue([
        JSON.stringify({
          type: "session_update",
          data: { code: "new" },
          timestamp: 2000,
          sourceInstanceId: "other-instance",
        }),
      ]);

      const events = await getCodespaceSSEEvents("test-space", 1000);
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("session_update");
      expect(events[0]!.sourceInstanceId).toBe("other-instance");
    });

    it("should filter events older than afterTimestamp", async () => {
      const { redis } = await import("@/lib/upstash");

      vi.mocked(redis.lrange).mockResolvedValue([
        JSON.stringify({
          type: "heartbeat",
          data: {},
          timestamp: 500,
          sourceInstanceId: "other-instance",
        }),
      ]);

      const events = await getCodespaceSSEEvents("test-space", 1000);
      expect(events).toHaveLength(0);
    });

    it("should handle pre-parsed objects from Redis", async () => {
      const { redis } = await import("@/lib/upstash");

      vi.mocked(redis.lrange).mockResolvedValue([
        {
          type: "version_created",
          data: { version: 1 },
          timestamp: 5000,
          sourceInstanceId: "other-instance",
        } as unknown as string,
      ]);

      const events = await getCodespaceSSEEvents("test-space", 1000);
      expect(events).toHaveLength(1);
      expect(events[0]!.type).toBe("version_created");
    });
  });

  describe("broadcastToCodespace", () => {
    it("should publish to Redis and store in list", async () => {
      const { redis } = await import("@/lib/upstash");

      await broadcastToCodespace("broadcast-test", {
        type: "session_update",
        data: { code: "new code" },
      });

      expect(redis.publish).toHaveBeenCalledWith(
        "codespace:broadcast-test:updates",
        expect.any(String),
      );
      expect(redis.lpush).toHaveBeenCalledWith(
        "codespace:broadcast-test:events",
        expect.any(String),
      );
      expect(redis.expire).toHaveBeenCalledWith(
        "codespace:broadcast-test:events",
        60,
      );
      expect(redis.ltrim).toHaveBeenCalledWith(
        "codespace:broadcast-test:events",
        0,
        99,
      );
    });

    it("should broadcast to local connections", async () => {
      const controller = {
        enqueue: vi.fn(),
      } as unknown as ReadableStreamDefaultController<Uint8Array>;

      addConnection("broadcast-local", controller);

      await broadcastToCodespace("broadcast-local", {
        type: "heartbeat",
        data: {},
      });

      expect(controller.enqueue).toHaveBeenCalled();
      const encoded = vi.mocked(controller.enqueue).mock.calls[0]![0] as Uint8Array;
      const text = new TextDecoder().decode(encoded);
      expect(text).toContain("data: ");
      expect(text).toContain("heartbeat");

      removeConnection("broadcast-local", controller);
    });

    it("should include sourceInstanceId and timestamp in payload", async () => {
      const { redis } = await import("@/lib/upstash");

      await broadcastToCodespace("broadcast-meta", {
        type: "version_created",
        data: { version: 5 },
      });

      const publishCall = vi.mocked(redis.publish).mock.calls[0]!;
      const payload = JSON.parse(publishCall[1] as string);
      expect(payload.sourceInstanceId).toBe(getCodespaceInstanceId());
      expect(payload.timestamp).toBeGreaterThan(0);
      expect(payload.type).toBe("version_created");
      expect(payload.data).toEqual({ version: 5 });
    });

    it("should handle Redis publish errors gracefully", async () => {
      const { redis } = await import("@/lib/upstash");
      vi.mocked(redis.publish).mockRejectedValueOnce(
        new Error("Redis connection lost"),
      );

      // Should not throw
      await broadcastToCodespace("broadcast-err", {
        type: "heartbeat",
        data: {},
      });
    });

    it("should handle Redis list errors gracefully", async () => {
      const { redis } = await import("@/lib/upstash");
      vi.mocked(redis.lpush).mockRejectedValueOnce(
        new Error("Redis write error"),
      );

      // Should not throw
      await broadcastToCodespace("broadcast-list-err", {
        type: "heartbeat",
        data: {},
      });
    });

    it("should silently handle closed controller enqueue error", async () => {
      const controller = {
        enqueue: vi.fn().mockImplementation(() => {
          throw new Error("Controller is closed");
        }),
      } as unknown as ReadableStreamDefaultController<Uint8Array>;

      addConnection("broadcast-closed", controller);

      // Should not throw
      await broadcastToCodespace("broadcast-closed", {
        type: "session_update",
        data: {},
      });

      removeConnection("broadcast-closed", controller);
    });

    it("should broadcast to multiple local connections", async () => {
      const c1 = {
        enqueue: vi.fn(),
      } as unknown as ReadableStreamDefaultController<Uint8Array>;
      const c2 = {
        enqueue: vi.fn(),
      } as unknown as ReadableStreamDefaultController<Uint8Array>;

      addConnection("broadcast-multi", c1);
      addConnection("broadcast-multi", c2);

      await broadcastToCodespace("broadcast-multi", {
        type: "session_update",
        data: { code: "updated" },
      });

      expect(c1.enqueue).toHaveBeenCalled();
      expect(c2.enqueue).toHaveBeenCalled();

      removeConnection("broadcast-multi", c1);
      removeConnection("broadcast-multi", c2);
    });

    it("should skip local broadcast when no connections exist", async () => {
      // No connections for this codespace - should not throw
      await broadcastToCodespace("broadcast-no-conn", {
        type: "heartbeat",
        data: {},
      });
    });
  });
});
