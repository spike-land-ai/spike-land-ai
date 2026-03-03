import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  vaultSecret: {
    count: vi.fn(),
    findMany: vi.fn(),
    findFirst: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

// Mock crypto
const mockEncryptSecret = vi.fn();
vi.mock("../crypto/vault", () => ({
  encryptSecret: (...args: unknown[]) => mockEncryptSecret(...args),
}));

import { createMockRegistry } from "../__test-utils__";
import { registerVaultTools } from "./vault";

describe("vault tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerVaultTools(registry, userId);
  });

  it("should register 3 vault tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("vault_store_secret")).toBe(true);
    expect(registry.handlers.has("vault_list_secrets")).toBe(true);
    expect(registry.handlers.has("vault_delete_secret")).toBe(true);
  });

  describe("vault_store_secret", () => {
    it("should store an encrypted secret", async () => {
      mockPrisma.vaultSecret.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockEncryptSecret.mockReturnValue({
        encryptedValue: "enc",
        iv: "iv",
        tag: "tag",
      });
      mockPrisma.vaultSecret.upsert.mockResolvedValue({
        id: "secret-1",
        name: "MY_API_KEY",
        status: "PENDING",
      });

      const handler = registry.handlers.get("vault_store_secret")!;
      const result = await handler({
        name: "MY_API_KEY",
        value: "sk-123",
        allowed_urls: ["https://api.example.com"],
      });

      expect(mockEncryptSecret).toHaveBeenCalledWith(userId, "sk-123");
      expect(mockPrisma.vaultSecret.upsert).toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: "text",
              text: expect.stringContaining("Secret Stored"),
            }),
          ]),
        }),
      );
    });

    it("should enforce quota for free tier", async () => {
      mockPrisma.vaultSecret.count.mockResolvedValue(25);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("vault_store_secret")!;
      const result = await handler({
        name: "NEW_KEY",
        value: "val",
        allowed_urls: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("limit reached"),
            }),
          ]),
        }),
      );
    });

    it("should allow more secrets for premium users", async () => {
      mockPrisma.vaultSecret.count.mockResolvedValue(250);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        tier: "PREMIUM",
      });
      mockEncryptSecret.mockReturnValue({
        encryptedValue: "enc",
        iv: "iv",
        tag: "tag",
      });
      mockPrisma.vaultSecret.upsert.mockResolvedValue({
        id: "secret-51",
        name: "KEY",
        status: "PENDING",
      });

      const handler = registry.handlers.get("vault_store_secret")!;
      const result = await handler({
        name: "KEY",
        value: "val",
        allowed_urls: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Secret Stored"),
            }),
          ]),
        }),
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.vaultSecret.count.mockRejectedValue(
        new Error("DB connection failed"),
      );

      const handler = registry.handlers.get("vault_store_secret")!;
      const result = await handler({
        name: "KEY",
        value: "val",
        allowed_urls: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("DB connection failed"),
            }),
          ]),
        }),
      );
    });
  });

  describe("vault_list_secrets", () => {
    it("should list secrets without values", async () => {
      mockPrisma.vaultSecret.findMany.mockResolvedValue([
        {
          id: "s1",
          name: "API_KEY",
          status: "APPROVED",
          allowedUrls: ["https://api.example.com"],
          createdAt: new Date("2025-01-01"),
        },
        {
          id: "s2",
          name: "TOKEN",
          status: "PENDING",
          allowedUrls: [],
          createdAt: new Date("2025-01-02"),
        },
      ]);
      mockPrisma.vaultSecret.count.mockResolvedValue(2);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("vault_list_secrets")!;
      const result = await handler({});

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("API_KEY"),
            }),
          ]),
        }),
      );
      // Ensure no plaintext values in output
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).not.toContain("sk-");
      expect(text).not.toContain("secret-value");
    });

    it("should show empty vault message", async () => {
      mockPrisma.vaultSecret.findMany.mockResolvedValue([]);
      mockPrisma.vaultSecret.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("vault_list_secrets")!;
      const result = await handler({});

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("No secrets stored"),
            }),
          ]),
        }),
      );
    });

    it("should handle errors", async () => {
      mockPrisma.vaultSecret.findMany.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("vault_list_secrets")!;
      const result = await handler({});

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
        }),
      );
    });
  });

  describe("vault_delete_secret", () => {
    it("should revoke an existing secret", async () => {
      mockPrisma.vaultSecret.findFirst.mockResolvedValue({
        id: "s1",
        name: "API_KEY",
        status: "APPROVED",
        userId,
      });
      mockPrisma.vaultSecret.update.mockResolvedValue({
        id: "s1",
        status: "REVOKED",
      });

      const handler = registry.handlers.get("vault_delete_secret")!;
      const result = await handler({ secret_id: "s1" });

      expect(mockPrisma.vaultSecret.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { status: "REVOKED" },
      });
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Secret Revoked"),
            }),
          ]),
        }),
      );
    });

    it("should return error for non-existent secret", async () => {
      mockPrisma.vaultSecret.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("vault_delete_secret")!;
      const result = await handler({ secret_id: "nonexistent" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("not found"),
            }),
          ]),
        }),
      );
    });

    it("should handle already revoked secret", async () => {
      mockPrisma.vaultSecret.findFirst.mockResolvedValue({
        id: "s1",
        name: "API_KEY",
        status: "REVOKED",
        userId,
      });

      const handler = registry.handlers.get("vault_delete_secret")!;
      const result = await handler({ secret_id: "s1" });

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("already revoked"),
            }),
          ]),
        }),
      );
    });

    it("should handle errors", async () => {
      mockPrisma.vaultSecret.findFirst.mockRejectedValue(
        new Error("DB error"),
      );

      const handler = registry.handlers.get("vault_delete_secret")!;
      const result = await handler({ secret_id: "s1" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
        }),
      );
    });
  });

  describe("vault_store_secret - FREE tier subscription", () => {
    it("should enforce free tier limit when subscription exists with tier FREE", async () => {
      mockPrisma.vaultSecret.count.mockResolvedValue(25);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        tier: "FREE",
      });

      const handler = registry.handlers.get("vault_store_secret")!;
      const result = await handler({
        name: "KEY",
        value: "val",
        allowed_urls: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("25/25"),
            }),
          ]),
        }),
      );
    });

    it("should allow storing when subscription tier is FREE and under limit", async () => {
      mockPrisma.vaultSecret.count.mockResolvedValue(3);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        tier: "FREE",
      });
      mockEncryptSecret.mockReturnValue({
        encryptedValue: "enc",
        iv: "iv",
        tag: "tag",
      });
      mockPrisma.vaultSecret.upsert.mockResolvedValue({
        id: "secret-free",
        name: "KEY",
        status: "PENDING",
      });

      const handler = registry.handlers.get("vault_store_secret")!;
      const result = await handler({
        name: "KEY",
        value: "val",
        allowed_urls: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Secret Stored"),
            }),
          ]),
        }),
      );
    });
  });

  describe("vault_store_secret - premium quota edge", () => {
    it("should enforce premium quota at 500 secrets", async () => {
      mockPrisma.vaultSecret.count.mockResolvedValue(500);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        tier: "PREMIUM",
      });

      const handler = registry.handlers.get("vault_store_secret")!;
      const result = await handler({
        name: "KEY",
        value: "val",
        allowed_urls: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("500/500"),
            }),
          ]),
        }),
      );
    });

    it("should handle non-Error throws in store", async () => {
      mockPrisma.vaultSecret.count.mockRejectedValue("string error");

      const handler = registry.handlers.get("vault_store_secret")!;
      const result = await handler({
        name: "KEY",
        value: "val",
        allowed_urls: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Unknown error"),
            }),
          ]),
        }),
      );
    });
  });

  describe("vault_list_secrets - error handling", () => {
    it("should handle non-Error throws in list", async () => {
      mockPrisma.vaultSecret.findMany.mockRejectedValue(42);

      const handler = registry.handlers.get("vault_list_secrets")!;
      const result = await handler({});

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Unknown error"),
            }),
          ]),
        }),
      );
    });

    it("should show secrets with allowed URLs as 'any' when empty", async () => {
      mockPrisma.vaultSecret.findMany.mockResolvedValue([
        {
          id: "s1",
          name: "API_KEY",
          status: "APPROVED",
          allowedUrls: [],
          createdAt: new Date("2025-01-01"),
        },
      ]);
      mockPrisma.vaultSecret.count.mockResolvedValue(1);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("vault_list_secrets")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("URLs: any");
    });
  });

  describe("vault_delete_secret - error handling", () => {
    it("should handle non-Error throws in delete", async () => {
      mockPrisma.vaultSecret.findFirst.mockRejectedValue(null);

      const handler = registry.handlers.get("vault_delete_secret")!;
      const result = await handler({ secret_id: "s1" });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Unknown error"),
            }),
          ]),
        }),
      );
    });
  });

  describe("vault_approve_secret - must NOT exist (security)", () => {
    it("should NOT register vault_approve_secret tool", () => {
      // vault_approve_secret must NEVER be an MCP tool — it would bypass
      // human-in-the-loop approval. Secrets must be approved via the dashboard only.
      expect(registry.handlers.has("vault_approve_secret")).toBe(false);
    });

    it("should only register exactly 3 vault tools (store, list, delete)", () => {
      const registeredNames = Array.from(registry.handlers.keys());
      const vaultTools = registeredNames.filter(name => name.startsWith("vault_"));
      expect(vaultTools).toEqual(
        expect.arrayContaining([
          "vault_store_secret",
          "vault_list_secrets",
          "vault_delete_secret",
        ]),
      );
      expect(vaultTools).toHaveLength(3);
    });
  });
});
