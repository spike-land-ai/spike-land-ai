import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  agentCapabilityToken: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    updateMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import {
  createCapabilityToken,
  deductBudget,
  delegateToken,
  revokeCapabilityToken,
  verifyCapabilityToken,
} from "./capability-token-service";

describe("capability-token-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("createCapabilityToken", () => {
    it("should create a token with cap_ prefix and store SHA-256 hash", async () => {
      mockPrisma.agentCapabilityToken.create.mockResolvedValue({
        id: "tok-1",
        tokenHash: "somehash",
      });

      const result = await createCapabilityToken({
        agentId: "agent-1",
        grantedByUserId: "user-1",
        allowedTools: ["image_generate"],
        allowedCategories: ["gateway-meta"],
        deniedTools: [],
      });

      expect(result.rawToken).toMatch(/^cap_/);
      expect(result.tokenId).toBe("tok-1");

      const createCall = mockPrisma.agentCapabilityToken.create.mock.calls[0]![0];
      // Hash should NOT be the raw token
      expect(createCall.data.tokenHash).not.toContain("cap_");
      expect(createCall.data.tokenHash).toHaveLength(64); // SHA-256 hex
    });

    it("should set default budget and delegation values", async () => {
      mockPrisma.agentCapabilityToken.create.mockResolvedValue({ id: "tok-2" });

      await createCapabilityToken({
        agentId: "agent-1",
        grantedByUserId: "user-1",
        allowedTools: [],
        allowedCategories: [],
        deniedTools: [],
      });

      const createCall = mockPrisma.agentCapabilityToken.create.mock.calls[0]![0];
      expect(createCall.data.maxTokenBudget).toBe(100000);
      expect(createCall.data.maxApiCalls).toBe(1000);
      expect(createCall.data.maxDelegationDepth).toBe(2);
      expect(createCall.data.delegationDepth).toBe(0);
    });

    it("should set delegation depth from parent", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        delegationDepth: 1,
        status: "ACTIVE",
      });
      mockPrisma.agentCapabilityToken.create.mockResolvedValue({ id: "tok-3" });

      await createCapabilityToken({
        agentId: "agent-2",
        grantedByUserId: "user-1",
        allowedTools: [],
        allowedCategories: [],
        deniedTools: [],
        parentTokenId: "parent-tok",
      });

      const createCall = mockPrisma.agentCapabilityToken.create.mock.calls[0]![0];
      expect(createCall.data.delegationDepth).toBe(2);
      expect(createCall.data.parentTokenId).toBe("parent-tok");
    });

    it("should throw if parent token not found or not active", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(null);

      await expect(
        createCapabilityToken({
          agentId: "agent-1",
          grantedByUserId: "user-1",
          allowedTools: [],
          allowedCategories: [],
          deniedTools: [],
          parentTokenId: "nonexistent",
        }),
      ).rejects.toThrow("Parent token not found or not active");
    });
  });

  describe("verifyCapabilityToken", () => {
    it("should return null for non-cap_ prefix", async () => {
      const result = await verifyCapabilityToken("mcp_something");
      expect(result).toBeNull();
    });

    it("should return null for non-existent token", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(null);
      const result = await verifyCapabilityToken("cap_nonexistent");
      expect(result).toBeNull();
    });

    it("should return null for revoked token", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        id: "tok-1",
        tokenHash: "abc",
        status: "REVOKED",
        expiresAt: null,
      });
      const result = await verifyCapabilityToken("cap_revoked");
      expect(result).toBeNull();
    });

    it("should return null for expired token", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        id: "tok-1",
        tokenHash: "abc",
        status: "ACTIVE",
        expiresAt: new Date("2020-01-01"),
      });
      const result = await verifyCapabilityToken("cap_expired");
      expect(result).toBeNull();
    });

    it("should return payload for valid active token", async () => {
      // We need the hash to match the token we pass in
      const { createHash } = await import("crypto");
      const rawToken = "cap_" + "a".repeat(43); // base64url of 32 bytes
      const expectedHash = createHash("sha256").update(rawToken).digest("hex");

      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        id: "tok-1",
        tokenHash: expectedHash,
        agentId: "agent-1",
        grantedByUserId: "user-1",
        status: "ACTIVE",
        expiresAt: new Date(Date.now() + 86400000),
        allowedTools: ["image_generate"],
        allowedCategories: ["gateway-meta"],
        deniedTools: ["admin_delete"],
        workspaceIds: ["ws-1"],
        maxTokenBudget: 100000,
        usedTokenBudget: 5000,
        maxApiCalls: 1000,
        usedApiCalls: 42,
        delegationDepth: 0,
        maxDelegationDepth: 2,
      });

      const result = await verifyCapabilityToken(rawToken);
      expect(result).not.toBeNull();
      expect(result!.tokenId).toBe("tok-1");
      expect(result!.agentId).toBe("agent-1");
      expect(result!.userId).toBe("user-1");
      expect(result!.allowedTools).toEqual(["image_generate"]);
      expect(result!.usedApiCalls).toBe(42);
    });
  });

  describe("revokeCapabilityToken", () => {
    it("should set status to REVOKED", async () => {
      mockPrisma.agentCapabilityToken.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.agentCapabilityToken.findMany.mockResolvedValue([]);

      await revokeCapabilityToken("tok-1", false);

      expect(mockPrisma.agentCapabilityToken.updateMany).toHaveBeenCalledWith({
        where: { id: "tok-1", status: "ACTIVE" },
        data: expect.objectContaining({ status: "REVOKED" }),
      });
    });

    it("should cascade revoke to children when cascade=true", async () => {
      mockPrisma.agentCapabilityToken.updateMany.mockResolvedValue({
        count: 1,
      });
      // First level children
      mockPrisma.agentCapabilityToken.findMany
        .mockResolvedValueOnce([{ id: "child-1" }, { id: "child-2" }])
        // Second level children
        .mockResolvedValueOnce([{ id: "grandchild-1" }])
        // No more children
        .mockResolvedValueOnce([]);

      await revokeCapabilityToken("tok-1", true);

      // Parent revoke + children cascade
      expect(mockPrisma.agentCapabilityToken.updateMany).toHaveBeenCalledTimes(2);
      const cascadeCall = mockPrisma.agentCapabilityToken.updateMany.mock.calls[1]![0];
      expect(cascadeCall.where.id.in).toEqual(["child-1", "child-2", "grandchild-1"]);
    });
  });

  describe("delegateToken", () => {
    const activeParent = {
      status: "ACTIVE" as const,
      expiresAt: new Date(Date.now() + 86400000),
      grantedByUserId: "user-1",
      agentId: "parent-agent",
      allowedTools: ["image_generate", "image_enhance"],
      allowedCategories: ["gateway-meta", "image"],
      deniedTools: ["admin_delete"],
      workspaceIds: ["ws-1"],
      maxTokenBudget: 100000,
      usedTokenBudget: 20000,
      maxApiCalls: 1000,
      usedApiCalls: 100,
      delegationDepth: 0,
      maxDelegationDepth: 2,
    };

    it("should create a child token with subset of parent tools", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(activeParent);
      mockPrisma.agentCapabilityToken.create.mockResolvedValue({
        id: "child-tok",
      });

      const result = await delegateToken("parent-tok", {
        agentId: "child-agent",
        allowedTools: ["image_generate"],
        allowedCategories: ["gateway-meta"],
        deniedTools: [],
        maxTokenBudget: 10000,
        maxApiCalls: 50,
      });

      expect(result.tokenId).toBe("child-tok");
      const createCall = mockPrisma.agentCapabilityToken.create.mock.calls[0]![0];
      expect(createCall.data.grantedByAgentId).toBe("parent-agent");
    });

    it("should reject if parent is revoked", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        ...activeParent,
        status: "REVOKED",
      });

      await expect(
        delegateToken("parent-tok", {
          agentId: "child",
          allowedTools: [],
          allowedCategories: [],
          deniedTools: [],
        }),
      ).rejects.toThrow("Parent token is not active");
    });

    it("should reject if parent is expired", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        ...activeParent,
        expiresAt: new Date("2020-01-01"),
      });

      await expect(
        delegateToken("parent-tok", {
          agentId: "child",
          allowedTools: [],
          allowedCategories: [],
          deniedTools: [],
        }),
      ).rejects.toThrow("Parent token is expired");
    });

    it("should reject tools not in parent scope", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(activeParent);

      await expect(
        delegateToken("parent-tok", {
          agentId: "child",
          allowedTools: ["vault_store_secret"],
          allowedCategories: [],
          deniedTools: [],
        }),
      ).rejects.toThrow('Tool "vault_store_secret" not in parent\'s allowed scope');
    });

    it("should reject categories not in parent scope", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(activeParent);

      await expect(
        delegateToken("parent-tok", {
          agentId: "child",
          allowedTools: [],
          allowedCategories: ["admin"],
          deniedTools: [],
        }),
      ).rejects.toThrow('Category "admin" not in parent\'s allowed scope');
    });

    it("should reject budget exceeding parent remaining", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(activeParent);

      await expect(
        delegateToken("parent-tok", {
          agentId: "child",
          allowedTools: [],
          allowedCategories: [],
          deniedTools: [],
          maxTokenBudget: 90000, // parent has 80000 remaining
        }),
      ).rejects.toThrow("exceeds parent remaining budget");
    });

    it("should reject when delegation depth exceeded", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        ...activeParent,
        delegationDepth: 2,
        maxDelegationDepth: 2,
      });

      await expect(
        delegateToken("parent-tok", {
          agentId: "child",
          allowedTools: [],
          allowedCategories: [],
          deniedTools: [],
        }),
      ).rejects.toThrow("Maximum delegation depth");
    });

    it("should merge parent denied tools with child denied tools", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(activeParent);
      mockPrisma.agentCapabilityToken.create.mockResolvedValue({
        id: "child-tok",
      });

      await delegateToken("parent-tok", {
        agentId: "child-agent",
        allowedTools: [],
        allowedCategories: ["gateway-meta"],
        deniedTools: ["image_enhance"],
      });

      const createCall = mockPrisma.agentCapabilityToken.create.mock.calls[0]![0];
      expect(createCall.data.deniedTools).toContain("admin_delete");
      expect(createCall.data.deniedTools).toContain("image_enhance");
    });
  });

  describe("deductBudget", () => {
    it("should return true and increment on success", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        usedApiCalls: 10,
        maxApiCalls: 1000,
        usedTokenBudget: 5000,
        maxTokenBudget: 100000,
        status: "ACTIVE",
      });
      mockPrisma.agentCapabilityToken.update.mockResolvedValue({});

      const result = await deductBudget("tok-1", 1, 100);
      expect(result).toBe(true);
      expect(mockPrisma.agentCapabilityToken.update).toHaveBeenCalledWith({
        where: { id: "tok-1" },
        data: {
          usedApiCalls: { increment: 1 },
          usedTokenBudget: { increment: 100 },
        },
      });
    });

    it("should return false when API calls would exceed max", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        usedApiCalls: 999,
        maxApiCalls: 1000,
        usedTokenBudget: 0,
        maxTokenBudget: 100000,
        status: "ACTIVE",
      });

      const result = await deductBudget("tok-1", 2, 0);
      expect(result).toBe(false);
      expect(mockPrisma.agentCapabilityToken.update).not.toHaveBeenCalled();
    });

    it("should return false when token budget would exceed max", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        usedApiCalls: 0,
        maxApiCalls: 1000,
        usedTokenBudget: 99000,
        maxTokenBudget: 100000,
        status: "ACTIVE",
      });

      const result = await deductBudget("tok-1", 0, 2000);
      expect(result).toBe(false);
    });

    it("should return false for non-active token", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
        usedApiCalls: 0,
        maxApiCalls: 1000,
        usedTokenBudget: 0,
        maxTokenBudget: 100000,
        status: "REVOKED",
      });

      const result = await deductBudget("tok-1", 1, 0);
      expect(result).toBe(false);
    });

    it("should return false for non-existent token", async () => {
      mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(null);

      const result = await deductBudget("nonexistent", 1, 0);
      expect(result).toBe(false);
    });
  });
});
