import { beforeEach, describe, expect, it, vi } from "vitest";

const mockRedis = vi.hoisted(() => ({
  set: vi.fn(),
  get: vi.fn(),
  del: vi.fn(),
  ttl: vi.fn(),
}));

vi.mock("@/lib/upstash/client", () => ({
  redis: mockRedis,
}));

import {
  approveQRAuth,
  completeQRAuth,
  initiateQRAuth,
  pollQRAuth,
} from "./qr-auth-service";

describe("qr-auth-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("initiateQRAuth", () => {
    it("generates a token and hash and stores session in Redis", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const result = await initiateQRAuth();

      expect(result.token).toBeDefined();
      expect(typeof result.token).toBe("string");
      expect(result.token.length).toBeGreaterThan(0);

      expect(result.hash).toBeDefined();
      expect(typeof result.hash).toBe("string");
      expect(result.hash).toMatch(/^[a-f0-9]{64}$/);

      expect(mockRedis.set).toHaveBeenCalledOnce();
      const [key, value, options] = mockRedis.set.mock.calls[0]!;
      expect(key).toBe(`qr_auth:${result.hash}`);
      expect(JSON.parse(value as string)).toEqual({ status: "PENDING" });
      expect(options).toEqual({ ex: 300 });
    });

    it("generates unique tokens on each call", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const result1 = await initiateQRAuth();
      const result2 = await initiateQRAuth();

      expect(result1.token).not.toBe(result2.token);
      expect(result1.hash).not.toBe(result2.hash);
    });

    it("stores session with PENDING status", async () => {
      mockRedis.set.mockResolvedValue("OK");

      await initiateQRAuth();

      const storedValue = JSON.parse(mockRedis.set.mock.calls[0]![1] as string) as {
        status: string;
      };
      expect(storedValue.status).toBe("PENDING");
    });

    it("sets TTL of 5 minutes (300 seconds)", async () => {
      mockRedis.set.mockResolvedValue("OK");

      await initiateQRAuth();

      const options = mockRedis.set.mock.calls[0]![2] as { ex: number; };
      expect(options.ex).toBe(300);
    });

    it("hash is SHA-256 of token", async () => {
      mockRedis.set.mockResolvedValue("OK");

      const { createHash } = await import("crypto");
      const result = await initiateQRAuth();
      const expectedHash = createHash("sha256").update(result.token).digest("hex");

      expect(result.hash).toBe(expectedHash);
    });
  });

  describe("pollQRAuth", () => {
    it("returns session data when session exists", async () => {
      const session = { status: "PENDING" };
      mockRedis.get.mockResolvedValue(JSON.stringify(session));

      const result = await pollQRAuth("testhash");

      expect(result).toEqual(session);
      expect(mockRedis.get).toHaveBeenCalledWith("qr_auth:testhash");
    });

    it("returns null when session does not exist (expired or not found)", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await pollQRAuth("nonexistenthash");

      expect(result).toBeNull();
    });

    it("returns APPROVED session data", async () => {
      const session = { status: "APPROVED" };
      mockRedis.get.mockResolvedValue(JSON.stringify(session));

      const result = await pollQRAuth("approvedhash");

      expect(result).toEqual(session);
    });

    it("handles object returned from Redis (non-string)", async () => {
      const session = { status: "PENDING" };
      mockRedis.get.mockResolvedValue(session);

      const result = await pollQRAuth("testhash");

      expect(result).toEqual(session);
    });
  });

  describe("approveQRAuth", () => {
    it("returns hash and oneTimeCode when session is PENDING", async () => {
      const { createHash } = await import("crypto");
      const token = "test-token-value";
      const hash = createHash("sha256").update(token).digest("hex");

      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "PENDING" }));
      mockRedis.ttl.mockResolvedValue(240);
      mockRedis.set.mockResolvedValue("OK");

      const result = await approveQRAuth(token, "user-123");

      expect(result).not.toBeNull();
      expect(result!.hash).toBe(hash);
      expect(result!.oneTimeCode).toBeDefined();
      expect(typeof result!.oneTimeCode).toBe("string");
      expect(result!.oneTimeCode.length).toBeGreaterThan(0);
    });

    it("updates session to APPROVED status with userId and oneTimeCode", async () => {
      const token = "test-token-value";
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "PENDING" }));
      mockRedis.ttl.mockResolvedValue(240);
      mockRedis.set.mockResolvedValue("OK");

      const result = await approveQRAuth(token, "user-456");

      expect(mockRedis.set).toHaveBeenCalledOnce();
      const [, storedValue, options] = mockRedis.set.mock.calls[0]!;
      const stored = JSON.parse(storedValue as string) as {
        status: string;
        userId: string;
        oneTimeCode: string;
      };
      expect(stored.status).toBe("APPROVED");
      expect(stored.userId).toBe("user-456");
      expect(stored.oneTimeCode).toBe(result!.oneTimeCode);
      expect(options).toEqual({ ex: 240 });
    });

    it("returns null when session does not exist", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await approveQRAuth("nonexistent-token", "user-123");

      expect(result).toBeNull();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("returns null when session is already APPROVED (not PENDING)", async () => {
      const token = "test-token-value";
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ status: "APPROVED", userId: "user-123", oneTimeCode: "code" }),
      );

      const result = await approveQRAuth(token, "user-456");

      expect(result).toBeNull();
      expect(mockRedis.set).not.toHaveBeenCalled();
    });

    it("uses fallback TTL when Redis TTL is <= 0", async () => {
      const token = "test-token-value";
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "PENDING" }));
      mockRedis.ttl.mockResolvedValue(-1);
      mockRedis.set.mockResolvedValue("OK");

      await approveQRAuth(token, "user-123");

      const [, , options] = mockRedis.set.mock.calls[0]!;
      expect((options as { ex: number; }).ex).toBe(300);
    });

    it("uses remaining TTL when valid", async () => {
      const token = "test-token-value";
      mockRedis.get.mockResolvedValue(JSON.stringify({ status: "PENDING" }));
      mockRedis.ttl.mockResolvedValue(120);
      mockRedis.set.mockResolvedValue("OK");

      await approveQRAuth(token, "user-123");

      const [, , options] = mockRedis.set.mock.calls[0]!;
      expect((options as { ex: number; }).ex).toBe(120);
    });
  });

  describe("completeQRAuth", () => {
    it("returns userId on valid one-time code", async () => {
      const oneTimeCode = "valid-one-time-code";
      const session = {
        status: "APPROVED",
        oneTimeCode,
        userId: "user-789",
      };
      mockRedis.get.mockResolvedValue(JSON.stringify(session));
      mockRedis.del.mockResolvedValue(1);

      const result = await completeQRAuth("testhash", oneTimeCode);

      expect(result).toBe("user-789");
      expect(mockRedis.del).toHaveBeenCalledWith("qr_auth:testhash");
    });

    it("deletes session after successful verification to prevent reuse", async () => {
      const oneTimeCode = "valid-code";
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ status: "APPROVED", oneTimeCode, userId: "user-123" }),
      );
      mockRedis.del.mockResolvedValue(1);

      await completeQRAuth("testhash", oneTimeCode);

      expect(mockRedis.del).toHaveBeenCalledOnce();
      expect(mockRedis.del).toHaveBeenCalledWith("qr_auth:testhash");
    });

    it("returns null when session does not exist (expired)", async () => {
      mockRedis.get.mockResolvedValue(null);

      const result = await completeQRAuth("expiredhash", "any-code");

      expect(result).toBeNull();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("returns null when session is not APPROVED (still PENDING)", async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ status: "PENDING" }),
      );

      const result = await completeQRAuth("testhash", "any-code");

      expect(result).toBeNull();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("returns null when oneTimeCode does not match", async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ status: "APPROVED", oneTimeCode: "correct-code", userId: "user-123" }),
      );

      const result = await completeQRAuth("testhash", "wrong-code");

      expect(result).toBeNull();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("returns null when oneTimeCode differs by length (timing-safe check)", async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ status: "APPROVED", oneTimeCode: "correct-code", userId: "user-123" }),
      );

      const result = await completeQRAuth("testhash", "short");

      expect(result).toBeNull();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("returns null when session missing oneTimeCode", async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ status: "APPROVED", userId: "user-123" }),
      );

      const result = await completeQRAuth("testhash", "any-code");

      expect(result).toBeNull();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("returns null when session missing userId", async () => {
      mockRedis.get.mockResolvedValue(
        JSON.stringify({ status: "APPROVED", oneTimeCode: "some-code" }),
      );

      const result = await completeQRAuth("testhash", "some-code");

      expect(result).toBeNull();
      expect(mockRedis.del).not.toHaveBeenCalled();
    });

    it("prevents code reuse — second call returns null after session deleted", async () => {
      const oneTimeCode = "one-time-use";
      mockRedis.get
        .mockResolvedValueOnce(
          JSON.stringify({ status: "APPROVED", oneTimeCode, userId: "user-123" }),
        )
        .mockResolvedValueOnce(null);
      mockRedis.del.mockResolvedValue(1);

      const first = await completeQRAuth("testhash", oneTimeCode);
      const second = await completeQRAuth("testhash", oneTimeCode);

      expect(first).toBe("user-123");
      expect(second).toBeNull();
    });
  });
});
