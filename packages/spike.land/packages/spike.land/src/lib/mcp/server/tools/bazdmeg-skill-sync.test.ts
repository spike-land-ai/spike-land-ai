import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    skill: {
      upsert: vi.fn(),
      findMany: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerBazdmegSkillSyncTools } from "./bazdmeg-skill-sync";

describe("bazdmeg-skill-sync tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBazdmegSkillSyncTools(registry, userId);
  });

  it("should register 2 skill sync tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(2);
  });

  describe("bazdmeg_skill_publish", () => {
    it("should publish skills via upsert", async () => {
      mockPrisma.skill.upsert.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_skill_publish")!;
      const result = await handler({
        skills: [
          {
            name: "brainstorming",
            description: "Brainstorm ideas",
            version: "5.0.0",
          },
          {
            name: "tdd",
            description: "Test-driven development",
            version: "5.0.0",
          },
        ],
      });
      const text = getText(result);
      expect(text).toContain("2");
      expect(text).toContain("brainstorming");
      expect(text).toContain("tdd");
      expect(mockPrisma.skill.upsert).toHaveBeenCalledTimes(2);
    });

    it("should create with correct author and repoUrl", async () => {
      mockPrisma.skill.upsert.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_skill_publish")!;
      await handler({
        skills: [{ name: "debugging", description: "Debug issues" }],
      });
      expect(mockPrisma.skill.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { name: "superpowers:debugging" },
          create: expect.objectContaining({
            author: "superpowers",
            repoUrl: "https://github.com/obra/superpowers",
            status: "PUBLISHED",
          }),
        }),
      );
    });

    it("should generate slug from skill name", async () => {
      mockPrisma.skill.upsert.mockResolvedValue({});

      const handler = registry.handlers.get("bazdmeg_skill_publish")!;
      await handler({
        skills: [{
          name: "verification-before-completion",
          description: "Verify first",
        }],
      });
      expect(mockPrisma.skill.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            slug: "superpowers-verification-before-completion",
          }),
        }),
      );
    });
  });

  describe("bazdmeg_skill_sync_status", () => {
    it("should list published superpowers skills", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([
        {
          name: "superpowers:brainstorming",
          version: "5.0.0",
          status: "PUBLISHED",
          updatedAt: new Date("2024-06-01"),
        },
        {
          name: "superpowers:tdd",
          version: "5.0.0",
          status: "PUBLISHED",
          updatedAt: new Date("2024-06-01"),
        },
      ]);

      const handler = registry.handlers.get("bazdmeg_skill_sync_status")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("2");
      expect(text).toContain("brainstorming");
      expect(text).toContain("tdd");
      expect(text).toContain("5.0.0");
    });

    it("should return empty message when no skills published", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("bazdmeg_skill_sync_status")!;
      const result = await handler({});
      expect(getText(result)).toContain("No superpowers skills published");
    });

    it("should filter by superpowers author", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("bazdmeg_skill_sync_status")!;
      await handler({});
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { author: "superpowers" },
        }),
      );
    });
  });
});
