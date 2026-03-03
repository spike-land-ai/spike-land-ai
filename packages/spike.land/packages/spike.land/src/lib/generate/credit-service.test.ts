import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: {
    findUnique: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));
vi.mock("@/lib/logger", () => ({
  default: { warn: vi.fn(), info: vi.fn(), error: vi.fn() },
}));

import { checkCredits, deductCredits } from "./credit-service";

describe("credit-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("checkCredits", () => {
    it("returns hasCredits=true for existing users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      const result = await checkCredits("user-1");
      expect(result.hasCredits).toBe(true);
    });

    it("returns hasCredits=false for missing users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await checkCredits("missing");
      expect(result.hasCredits).toBe(false);
    });
  });

  describe("deductCredits", () => {
    it("returns true for valid users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ id: "user-1" });
      const result = await deductCredits("user-1");
      expect(result).toBe(true);
    });

    it("returns false for missing users", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const result = await deductCredits("missing");
      expect(result).toBe(false);
    });
  });
});
