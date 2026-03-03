import { beforeEach, describe, expect, it, vi } from "vitest";

const mockSkill = vi.hoisted(() => ({
  id: "skill-123",
  slug: "test-skill",
  name: "Test Skill",
  description: "A test skill",
  version: "1.0.0",
  category: "development",
  tags: ["test"],
  installCount: 42,
  isActive: true,
  status: "PUBLISHED",
}));

const mockPrisma = vi.hoisted(() => ({
  skill: {
    findMany: vi.fn().mockResolvedValue([]),
    findFirst: vi.fn().mockResolvedValue(null),
    update: vi.fn().mockResolvedValue({}),
  },
  skillInstallation: {
    findMany: vi.fn().mockResolvedValue([]),
    findUnique: vi.fn().mockResolvedValue(null),
    create: vi.fn().mockResolvedValue({}),
  },
  $transaction: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerStoreSkillsTools } from "./store-skills";

describe("store-skills tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerStoreSkillsTools(registry, userId);
  });

  it("should register 4 store-skills tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("store_skills_list")).toBe(true);
    expect(registry.handlers.has("store_skills_get")).toBe(true);
    expect(registry.handlers.has("store_skills_install")).toBe(true);
    expect(registry.handlers.has("store_skills_my_installs")).toBe(true);
  });

  describe("store_skills_list", () => {
    it("should return skills list when skills exist", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([mockSkill]);

      const handler = registry.handlers.get("store_skills_list")!;
      const result = await handler({ limit: 20 });

      const text = getText(result);
      expect(text).toContain("Skill Store");
      expect(text).toContain("Test Skill");
      expect(text).toContain("test-skill");
      expect(text).toContain("42");
    });

    it("should show empty message when no skills", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("store_skills_list")!;
      const result = await handler({ limit: 20 });

      const text = getText(result);
      expect(text).toContain("No skills available");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.skill.findMany.mockRejectedValue(
        new Error("relation \"Skill\" does not exist"),
      );

      const handler = registry.handlers.get("store_skills_list")!;
      const result = await handler({ limit: 20 });

      const text = getText(result);
      expect(text).toContain(
        "Skills list unavailable (DB table pending migration)",
      );
    });
  });

  describe("store_skills_get", () => {
    it("should return skill card when found", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue(mockSkill);

      const handler = registry.handlers.get("store_skills_get")!;
      const result = await handler({ id: "test-skill" });

      const text = getText(result);
      expect(text).toContain("Test Skill");
      expect(text).toContain("test-skill");
      expect(text).toContain("1.0.0");
      expect(text).toContain("development");
      expect(text).toContain("test");
      expect(text).toContain("42");
    });

    it("should return not-found for unknown id", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("store_skills_get")!;
      const result = await handler({ id: "nonexistent" });

      const text = getText(result);
      expect(text).toContain("Skill not found");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.skill.findFirst.mockRejectedValue(
        new Error("relation \"Skill\" does not exist"),
      );

      const handler = registry.handlers.get("store_skills_get")!;
      const result = await handler({ id: "test-skill" });

      const text = getText(result);
      expect(text).toContain("Skill not found (DB table pending migration)");
    });
  });

  describe("store_skills_install", () => {
    it("should require authentication", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreSkillsTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_skills_install")!;
      const result = await handler({ id: "test-skill" });

      const text = getText(result);
      expect(text).toContain("Authentication required");
    });

    it("should install a skill successfully", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue(mockSkill);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.skillInstallation.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("store_skills_install")!;
      const result = await handler({ id: "test-skill" });

      const text = getText(result);
      expect(text).toContain("Installed");
      expect(text).toContain("Test Skill");
      expect(text).toContain("claude skill add spike-land/test-skill");
    });

    it("should guard against duplicate installs", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue(mockSkill);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: typeof mockPrisma) => Promise<unknown>) => fn(mockPrisma),
      );
      mockPrisma.skillInstallation.findUnique.mockResolvedValue({
        id: "existing",
        skillId: mockSkill.id,
        userId: "test-user-123",
      });

      const handler = registry.handlers.get("store_skills_install")!;
      const result = await handler({ id: "test-skill" });

      const text = getText(result);
      expect(text).toContain("already installed");
    });

    it("should return not-found when skill does not exist", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("store_skills_install")!;
      const result = await handler({ id: "nonexistent" });

      const text = getText(result);
      expect(text).toContain("Skill not found");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.skill.findFirst.mockRejectedValue(
        new Error("relation \"Skill\" does not exist"),
      );

      const handler = registry.handlers.get("store_skills_install")!;
      const result = await handler({ id: "test-skill" });

      const text = getText(result);
      expect(text).toContain(
        "Skill install failed (DB table pending migration)",
      );
    });
  });

  describe("store_skills_my_installs", () => {
    it("should require authentication", async () => {
      const noAuthRegistry = createMockRegistry();
      registerStoreSkillsTools(noAuthRegistry, "");

      const handler = noAuthRegistry.handlers.get("store_skills_my_installs")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Authentication required");
    });

    it("should return installed skills list", async () => {
      mockPrisma.skillInstallation.findMany.mockResolvedValue([
        { skill: { name: "Test Skill", slug: "test-skill" } },
      ]);

      const handler = registry.handlers.get("store_skills_my_installs")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Your Installed Skills");
      expect(text).toContain("Test Skill");
      expect(text).toContain("test-skill");
    });

    it("should show empty message when no installs", async () => {
      mockPrisma.skillInstallation.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("store_skills_my_installs")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("No skills installed yet");
    });

    it("should handle DB errors gracefully", async () => {
      mockPrisma.skillInstallation.findMany.mockRejectedValue(
        new Error("relation \"Skill\" does not exist"),
      );

      const handler = registry.handlers.get("store_skills_my_installs")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain(
        "Install list unavailable (DB table pending migration)",
      );
    });
  });
});
