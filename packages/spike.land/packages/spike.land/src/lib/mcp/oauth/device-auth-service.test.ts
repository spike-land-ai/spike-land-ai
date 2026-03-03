import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    deviceAuthorizationCode: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
    oAuthAccessToken: {
      create: vi.fn(),
    },
    oAuthClient: {
      upsert: vi.fn().mockResolvedValue({ clientId: "test-client" }),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

import {
  approveDeviceCode,
  cleanupExpiredDeviceCodes,
  denyDeviceCode,
  generateDeviceCode,
  pollDeviceCode,
  verifyUserCode,
} from "./device-auth-service";

describe("device-auth-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("generateDeviceCode", () => {
    it("should generate device code and user code", async () => {
      mockPrisma.deviceAuthorizationCode.create.mockResolvedValue({
        id: "device-id",
      });

      const result = await generateDeviceCode(
        "client-1",
        "https://spike.land",
      );

      expect(result.deviceCode).toBeTruthy();
      expect(result.userCode).toMatch(/^[A-Z0-9]{4}-[A-Z0-9]{4}$/);
      expect(result.verificationUri).toBe(
        "https://spike.land/mcp/auth/device",
      );
      expect(result.verificationUriComplete).toContain(result.userCode);
      expect(result.expiresIn).toBe(900); // 15 minutes
      expect(result.interval).toBe(5);
    });

    it("should store device code hash (not plaintext)", async () => {
      mockPrisma.deviceAuthorizationCode.create.mockResolvedValue({
        id: "device-id",
      });

      const result = await generateDeviceCode(
        "client-1",
        "https://spike.land",
      );
      const expectedHash = createHash("sha256")
        .update(result.deviceCode)
        .digest("hex");

      expect(
        mockPrisma.deviceAuthorizationCode.create,
      ).toHaveBeenCalledWith({
        data: expect.objectContaining({
          deviceCodeHash: expectedHash,
          clientId: "client-1",
        }),
      });
    });

    it("should exclude ambiguous characters from user code", async () => {
      mockPrisma.deviceAuthorizationCode.create.mockResolvedValue({
        id: "device-id",
      });

      // Generate multiple codes and check for ambiguous chars
      for (let i = 0; i < 20; i++) {
        const result = await generateDeviceCode(
          "client-1",
          "https://spike.land",
        );
        const rawCode = result.userCode.replace("-", "");
        expect(rawCode).not.toMatch(/[0OIL1]/);
      }
    });
  });

  describe("verifyUserCode", () => {
    it("should verify valid pending user code", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        status: "PENDING",
        expiresAt: new Date(Date.now() + 600000),
        client: { clientName: "Test Client" },
      });

      const result = await verifyUserCode("ABCD-EFGH");

      expect(result.valid).toBe(true);
      expect(result.clientName).toBe("Test Client");
    });

    it("should reject nonexistent user code", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue(null);

      const result = await verifyUserCode("XXXX-YYYY");
      expect(result.valid).toBe(false);
    });

    it("should reject already approved code", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        status: "APPROVED",
        expiresAt: new Date(Date.now() + 600000),
        client: { clientName: "Test Client" },
      });

      const result = await verifyUserCode("ABCD-EFGH");
      expect(result.valid).toBe(false);
    });

    it("should reject expired code", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000),
        client: { clientName: "Test Client" },
      });

      const result = await verifyUserCode("ABCD-EFGH");
      expect(result.valid).toBe(false);
    });
  });

  describe("approveDeviceCode", () => {
    it("should approve pending device code", async () => {
      mockPrisma.deviceAuthorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await approveDeviceCode("ABCD-EFGH", "user-1");
      expect(result).toBe(true);
      expect(
        mockPrisma.deviceAuthorizationCode.updateMany,
      ).toHaveBeenCalledWith({
        where: {
          userCode: "ABCD-EFGH",
          status: "PENDING",
          expiresAt: { gt: expect.any(Date) },
        },
        data: {
          status: "APPROVED",
          userId: "user-1",
        },
      });
    });

    it("should return false for already-used code", async () => {
      mockPrisma.deviceAuthorizationCode.updateMany.mockResolvedValue({
        count: 0,
      });

      const result = await approveDeviceCode("USED-CODE", "user-1");
      expect(result).toBe(false);
    });
  });

  describe("denyDeviceCode", () => {
    it("should deny pending device code", async () => {
      mockPrisma.deviceAuthorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });

      const result = await denyDeviceCode("ABCD-EFGH");
      expect(result).toBe(true);
    });

    it("should return false for non-pending code", async () => {
      mockPrisma.deviceAuthorizationCode.updateMany.mockResolvedValue({
        count: 0,
      });

      const result = await denyDeviceCode("APPROVED-CODE");
      expect(result).toBe(false);
    });
  });

  describe("pollDeviceCode", () => {
    it("should return authorization_pending for pending code", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        id: "device-id",
        clientId: "client-1",
        userId: null,
        scope: "mcp",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 600000),
        interval: 5,
        lastPolledAt: null,
      });
      mockPrisma.deviceAuthorizationCode.update.mockResolvedValue({});

      const result = await pollDeviceCode("device-code-123", "client-1");
      expect(result).toEqual({ status: "authorization_pending" });
    });

    it("should return slow_down when polling too fast", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        id: "device-id",
        clientId: "client-1",
        userId: null,
        scope: "mcp",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 600000),
        interval: 5,
        lastPolledAt: new Date(Date.now() - 1000), // 1 second ago (too fast)
      });
      mockPrisma.deviceAuthorizationCode.update.mockResolvedValue({});

      const result = await pollDeviceCode("device-code-123", "client-1");
      expect(result).toEqual({ status: "slow_down", interval: 6 });
    });

    it("should proceed normally when lastPolledAt exists but interval is respected", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        id: "device-id",
        clientId: "client-1",
        userId: null,
        scope: "mcp",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 600000),
        interval: 5,
        lastPolledAt: new Date(Date.now() - 10000), // 10 seconds ago (within interval)
      });
      mockPrisma.deviceAuthorizationCode.update.mockResolvedValue({});

      const result = await pollDeviceCode("device-code-123", "client-1");
      expect(result).toEqual({ status: "authorization_pending" });
      // Should have called update to set lastPolledAt (not slow_down update)
      expect(
        mockPrisma.deviceAuthorizationCode.update,
      ).toHaveBeenCalledWith({
        where: { id: "device-id" },
        data: { lastPolledAt: expect.any(Date) },
      });
    });

    it("should return expired_token for EXPIRED status record", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        id: "device-id",
        clientId: "client-1",
        userId: null,
        scope: "mcp",
        status: "EXPIRED",
        expiresAt: new Date(Date.now() + 600000), // Not time-expired, but status is EXPIRED
        interval: 5,
        lastPolledAt: null,
      });
      mockPrisma.deviceAuthorizationCode.update.mockResolvedValue({});

      const result = await pollDeviceCode("device-code-123", "client-1");
      expect(result).toEqual({ status: "expired_token" });
    });

    it("should return access_denied for denied code", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        id: "device-id",
        clientId: "client-1",
        userId: null,
        scope: "mcp",
        status: "DENIED",
        expiresAt: new Date(Date.now() + 600000),
        interval: 5,
        lastPolledAt: null,
      });
      mockPrisma.deviceAuthorizationCode.update.mockResolvedValue({});

      const result = await pollDeviceCode("device-code-123", "client-1");
      expect(result).toEqual({ status: "access_denied" });
    });

    it("should return expired_token for expired code", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        id: "device-id",
        clientId: "client-1",
        userId: null,
        scope: "mcp",
        status: "PENDING",
        expiresAt: new Date(Date.now() - 1000),
        interval: 5,
        lastPolledAt: null,
      });

      const result = await pollDeviceCode("device-code-123", "client-1");
      expect(result).toEqual({ status: "expired_token" });
    });

    it("should return expired_token for wrong client_id", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        id: "device-id",
        clientId: "client-1",
        userId: null,
        scope: "mcp",
        status: "PENDING",
        expiresAt: new Date(Date.now() + 600000),
        interval: 5,
        lastPolledAt: null,
      });

      const result = await pollDeviceCode("device-code-123", "wrong-client");
      expect(result).toEqual({ status: "expired_token" });
    });

    it("should return expired_token for nonexistent code", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue(null);

      const result = await pollDeviceCode("nonexistent", "client-1");
      expect(result).toEqual({ status: "expired_token" });
    });

    it("should return tokens when approved", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        id: "device-id",
        clientId: "client-1",
        userId: "user-1",
        scope: "mcp",
        status: "APPROVED",
        expiresAt: new Date(Date.now() + 600000),
        interval: 5,
        lastPolledAt: null,
      });
      mockPrisma.deviceAuthorizationCode.update.mockResolvedValue({});
      mockPrisma.deviceAuthorizationCode.delete.mockResolvedValue({});
      // generateTokenPair calls create twice (refresh + access)
      mockPrisma.oAuthAccessToken.create
        .mockResolvedValueOnce({ id: "refresh-id" })
        .mockResolvedValueOnce({ id: "access-id" });

      const result = await pollDeviceCode("device-code-123", "client-1");

      expect(result.status).toBe("approved");
      if (result.status === "approved") {
        expect(result.accessToken).toMatch(/^mcp_/);
        expect(result.refreshToken).toMatch(/^mcp_/);
        expect(result.tokenType).toBe("Bearer");
        expect(result.scope).toBe("mcp");
      }
      // Should delete the device code after use
      expect(mockPrisma.deviceAuthorizationCode.delete).toHaveBeenCalledWith({
        where: { id: "device-id" },
      });
    });

    it("should return expired_token when approved but no userId", async () => {
      mockPrisma.deviceAuthorizationCode.findUnique.mockResolvedValue({
        id: "device-id",
        clientId: "client-1",
        userId: null, // No user set despite APPROVED
        scope: "mcp",
        status: "APPROVED",
        expiresAt: new Date(Date.now() + 600000),
        interval: 5,
        lastPolledAt: null,
      });
      mockPrisma.deviceAuthorizationCode.update.mockResolvedValue({});

      const result = await pollDeviceCode("device-code-123", "client-1");
      expect(result).toEqual({ status: "expired_token" });
    });
  });

  describe("cleanupExpiredDeviceCodes", () => {
    it("should delete expired device codes", async () => {
      mockPrisma.deviceAuthorizationCode.deleteMany.mockResolvedValue({
        count: 5,
      });

      const count = await cleanupExpiredDeviceCodes();
      expect(count).toBe(5);
      expect(
        mockPrisma.deviceAuthorizationCode.deleteMany,
      ).toHaveBeenCalledWith({
        where: { expiresAt: { lt: expect.any(Date) } },
      });
    });
  });
});
