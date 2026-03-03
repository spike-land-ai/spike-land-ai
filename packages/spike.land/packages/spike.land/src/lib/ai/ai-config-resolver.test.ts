import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the dependencies
vi.mock("@/lib/crypto/token-encryption", () => ({
  safeDecryptToken: vi.fn().mockImplementation((token: string) => {
    if (!token) return "";
    return token.startsWith("enc_") ? token.replace("enc_", "dec_") : token;
  }),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    aIProvider: {
      findUnique: vi.fn(),
      findFirst: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  getDefaultAIProvider,
  resolveAIProviderConfig,
} from "./ai-config-resolver";

describe("ai-config-resolver", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Clear simple cache manually between tests
    // A bit hacky but works since it's a simple module level object
    // For robust testing of the cache, we would need to mock Date.now()
    // or expose a clearCache() function in the original module.
  });

  describe("getDefaultAIProvider", () => {
    it("should return null if no default provider exists", async () => {
      vi.mocked(prisma.aIProvider.findFirst).mockResolvedValue(null);
      const result = await getDefaultAIProvider();
      expect(result).toBeNull();
      expect(prisma.aIProvider.findFirst).toHaveBeenCalledWith({
        where: { isDefault: true },
      });
    });

    it("should fetch and parse the default provider", async () => {
      const mockProvider = {
        name: "test-provider",
        tokenEncrypted: "enc_secret123",
        isDefault: true,
        config: { model: "default-model" },
      };

      vi.mocked(prisma.aIProvider.findFirst).mockResolvedValue(
        mockProvider as any,
      );

      const result = await getDefaultAIProvider();

      expect(result).toEqual({
        name: "test-provider",
        token: "dec_secret123",
        isDefault: true,
        config: { model: "default-model" },
      });
    });

    it("should handle error gracefully without throwing", async () => {
      vi.mocked(prisma.aIProvider.findFirst).mockRejectedValue(
        new Error("DB Error"),
      );

      const result = await getDefaultAIProvider();
      expect(result).toBeNull();
    });
  });

  describe("resolveAIProviderConfig", () => {
    it("should fetch a provider by name from DB", async () => {
      const mockProvider = {
        name: "specific-provider",
        token: "plain_secret",
        tokenEncrypted: null,
        isDefault: false,
        config: null,
      };

      vi.mocked(prisma.aIProvider.findUnique).mockResolvedValue(
        mockProvider as any,
      );

      const result = await resolveAIProviderConfig("specific-provider");

      expect(result).toEqual({
        name: "specific-provider",
        token: "plain_secret",
        isDefault: false,
        config: null,
      });

      expect(prisma.aIProvider.findUnique).toHaveBeenCalledWith({
        where: { name: "specific-provider" },
      });
    });

    it("should return null if provider is not found", async () => {
      vi.mocked(prisma.aIProvider.findUnique).mockResolvedValue(null);

      const result = await resolveAIProviderConfig("missing-provider");
      expect(result).toBeNull();
    });

    it("should cache results to avoid repeated DB calls", async () => {
      const mockProvider = {
        name: "cached-provider",
        token: "secret",
        isDefault: false,
        config: null,
      };

      vi.mocked(prisma.aIProvider.findUnique).mockResolvedValueOnce(
        mockProvider as any,
      );

      // First call hits DB
      const result1 = await resolveAIProviderConfig("cached-provider");
      expect(prisma.aIProvider.findUnique).toHaveBeenCalledTimes(1);

      // Second call should hit cache (if Date.now() didn't advance 30s)
      const result2 = await resolveAIProviderConfig("cached-provider");
      expect(prisma.aIProvider.findUnique).toHaveBeenCalledTimes(1);

      expect(result1).toEqual(result2);
    });
  });
});
