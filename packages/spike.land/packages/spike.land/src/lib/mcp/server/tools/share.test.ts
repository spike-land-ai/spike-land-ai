import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  enhancedImage: {
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  toolInvocation: {
    create: vi.fn(),
  },
}));

const mockRandomBytes = vi.hoisted(() => vi.fn());

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("crypto", () => ({
  randomBytes: mockRandomBytes,
}));
vi.mock(
  "@/lib/logger",
  () => ({ default: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }),
);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import { registerShareTools } from "./share";

describe("share tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerShareTools(registry, userId);
    mockPrisma.toolInvocation.create.mockResolvedValue({});
  });

  it("should register 2 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
  });

  describe("share_create_token", () => {
    it("should return existing share token", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue({
        id: "img-1",
        userId,
        shareToken: "existing-token",
      });

      const handler = registry.handlers.get("share_create_token")!;
      const result = await handler({ imageId: "img-1" });

      expect(getText(result)).toContain("existing-token");
      expect(mockPrisma.enhancedImage.update).not.toHaveBeenCalled();
    });

    it("should create new share token when none exists", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue({
        id: "img-1",
        userId,
        shareToken: null,
      });
      mockRandomBytes.mockReturnValue({ toString: () => "abcdef1234567890" });
      mockPrisma.enhancedImage.update.mockResolvedValue({
        id: "img-1",
        shareToken: "abcdef1234567890",
      });

      const handler = registry.handlers.get("share_create_token")!;
      const result = await handler({ imageId: "img-1" });

      expect(getText(result)).toContain("abcdef1234567890");
    });

    it("should error when image not found", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("share_create_token")!;
      const result = await handler({ imageId: "nonexistent" });

      expect(isError(result)).toBe(true);
    });
  });

  describe("share_get_info", () => {
    it("should return shared image info", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue({
        id: "img-1",
        shareToken: "token-123",
        user: { name: "Test User" },
        enhancementJobs: [],
      });

      const handler = registry.handlers.get("share_get_info")!;
      const result = await handler({ token: "token-123" });

      expect(getText(result)).toContain("img-1");
    });

    it("should error when shared item not found", async () => {
      mockPrisma.enhancedImage.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("share_get_info")!;
      const result = await handler({ token: "invalid" });

      expect(isError(result)).toBe(true);
    });
  });
});
