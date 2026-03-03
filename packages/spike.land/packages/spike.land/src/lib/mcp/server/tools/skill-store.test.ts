import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  skill: {
    findMany: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  skillInstallation: {
    findFirst: vi.fn(),
    create: vi.fn(),
  },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerSkillStoreTools } from "./skill-store";

describe("skill-store tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerSkillStoreTools(registry, userId);
  });

  it("should register 7 skill-store tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(7);
  });

  describe("skill_store_list", () => {
    it("should list published skills", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([
        {
          id: "s1",
          name: "code-review",
          displayName: "Code Review",
          description: "AI code review",
          category: "QUALITY",
          version: "1.0.0",
          author: "Test",
          installCount: 42,
        },
      ]);
      const handler = registry.handlers.get("skill_store_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("Code Review");
      expect(getText(result)).toContain("QUALITY");
      expect(getText(result)).toContain("42");
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PUBLISHED", isActive: true },
          take: 20,
          skip: 0,
        }),
      );
    });

    it("should filter by category", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([
        {
          id: "s2",
          name: "test-runner",
          displayName: "Test Runner",
          description: "Run tests",
          category: "TESTING",
          version: "2.0.0",
          author: "Dev",
          installCount: 10,
        },
      ]);
      const handler = registry.handlers.get("skill_store_list")!;
      const result = await handler({ category: "TESTING" });
      expect(getText(result)).toContain("Test Runner");
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "PUBLISHED", isActive: true, category: "TESTING" },
        }),
      );
    });

    it("should filter by search term", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([
        {
          id: "s3",
          name: "linter",
          displayName: "Linter Pro",
          description: "Advanced linting",
          category: "QUALITY",
          version: "1.0.0",
          author: "Lint",
          installCount: 5,
        },
      ]);
      const handler = registry.handlers.get("skill_store_list")!;
      const result = await handler({ search: "lint" });
      expect(getText(result)).toContain("Linter Pro");
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: "lint", mode: "insensitive" } },
              { displayName: { contains: "lint", mode: "insensitive" } },
              { description: { contains: "lint", mode: "insensitive" } },
            ],
          }),
        }),
      );
    });

    it("should filter by both category and search", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("skill_store_list")!;
      const result = await handler({ category: "SECURITY", search: "scan" });
      expect(getText(result)).toContain("No published skills found");
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "PUBLISHED",
            isActive: true,
            category: "SECURITY",
            OR: expect.arrayContaining([
              { name: { contains: "scan", mode: "insensitive" } },
            ]),
          }),
        }),
      );
    });

    it("should return empty message when no skills found", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("skill_store_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("No published skills found");
    });

    it("should respect limit and offset", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("skill_store_list")!;
      await handler({ limit: 5, offset: 10 });
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 5,
          skip: 10,
        }),
      );
    });
  });

  describe("skill_store_get", () => {
    it("should return skill details by slug", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue({
        id: "s1",
        name: "code-review",
        slug: "code-review",
        displayName: "Code Review",
        description: "AI code review",
        longDescription: "Extended description here",
        category: "QUALITY",
        version: "1.0.0",
        author: "Test",
        authorUrl: "https://example.com",
        repoUrl: "https://github.com/test",
        iconUrl: "https://example.com/icon.png",
        color: "#FF5500",
        tags: ["ai", "review"],
        installCount: 42,
        isFeatured: true,
        createdAt: new Date("2024-01-01"),
      });
      const handler = registry.handlers.get("skill_store_get")!;
      const result = await handler({ identifier: "code-review" });
      expect(getText(result)).toContain("Code Review");
      expect(getText(result)).toContain("Extended description here");
      expect(getText(result)).toContain("ai, review");
      expect(getText(result)).toContain("https://github.com/test");
      expect(getText(result)).toContain("#FF5500");
      expect(getText(result)).toContain("https://example.com/icon.png");
      expect(getText(result)).toContain("https://example.com");
    });

    it("should return skill without optional fields", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue({
        id: "s2",
        name: "basic",
        slug: "basic",
        displayName: "Basic Skill",
        description: "Simple",
        longDescription: null,
        category: "OTHER",
        version: "1.0.0",
        author: "Author",
        authorUrl: null,
        repoUrl: null,
        iconUrl: null,
        color: null,
        tags: [],
        installCount: 0,
        isFeatured: false,
        createdAt: new Date("2024-01-01"),
      });
      const handler = registry.handlers.get("skill_store_get")!;
      const result = await handler({ identifier: "s2" });
      expect(getText(result)).toContain("Basic Skill");
      expect(getText(result)).not.toContain("Details:");
      expect(getText(result)).not.toContain("Tags:");
      expect(getText(result)).not.toContain("Repo:");
      expect(getText(result)).not.toContain("Icon:");
      expect(getText(result)).not.toContain("Color:");
    });

    it("should return NOT_FOUND for missing skill", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("skill_store_get")!;
      const result = await handler({ identifier: "nonexistent" });
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("skill_store_install", () => {
    it("should install a skill", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue({
        id: "s1",
        name: "code-review",
        displayName: "Code Review",
      });
      mockPrisma.skillInstallation.findFirst.mockResolvedValue(null);
      mockPrisma.$transaction.mockResolvedValue([{}, {}]);
      const handler = registry.handlers.get("skill_store_install")!;
      const result = await handler({ skill_id: "s1" });
      expect(getText(result)).toContain("Skill Installed");
      expect(getText(result)).toContain("Code Review");
      expect(mockPrisma.$transaction).toHaveBeenCalled();
    });

    it("should return NOT_FOUND for unpublished skill", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("skill_store_install")!;
      const result = await handler({ skill_id: "nope" });
      expect(getText(result)).toContain("NOT_FOUND");
      expect(mockPrisma.skillInstallation.findFirst).not.toHaveBeenCalled();
    });

    it("should return already installed message", async () => {
      mockPrisma.skill.findFirst.mockResolvedValue({
        id: "s1",
        name: "code-review",
        displayName: "Code Review",
      });
      mockPrisma.skillInstallation.findFirst.mockResolvedValue({
        id: "inst1",
        skillId: "s1",
        userId,
      });
      const handler = registry.handlers.get("skill_store_install")!;
      const result = await handler({ skill_id: "s1" });
      expect(getText(result)).toContain("Already Installed");
      expect(mockPrisma.$transaction).not.toHaveBeenCalled();
    });
  });

  describe("skill_store_admin_list", () => {
    it("should list all skills including drafts", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([
        {
          id: "s1",
          name: "draft-skill",
          displayName: "Draft",
          description: "Drafted",
          category: "OTHER",
          status: "DRAFT",
          version: "0.1.0",
          author: "Dev",
          installCount: 0,
          isActive: false,
          isFeatured: false,
        },
        {
          id: "s2",
          name: "published-skill",
          displayName: "Published",
          description: "Ready",
          category: "TESTING",
          status: "PUBLISHED",
          version: "1.0.0",
          author: "Dev",
          installCount: 50,
          isActive: true,
          isFeatured: true,
        },
      ]);
      const handler = registry.handlers.get("skill_store_admin_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("Draft");
      expect(getText(result)).toContain("Published");
      expect(getText(result)).toContain("DRAFT");
      expect(getText(result)).toContain("Active: false");
      expect(getText(result)).toContain("Featured: true");
    });

    it("should filter by status", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("skill_store_admin_list")!;
      const result = await handler({ status: "ARCHIVED" });
      expect(getText(result)).toContain("No skills found");
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: "ARCHIVED" },
        }),
      );
    });

    it("should return empty message", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("skill_store_admin_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("No skills found");
    });

    it("should respect limit and offset", async () => {
      mockPrisma.skill.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("skill_store_admin_list")!;
      await handler({ limit: 50, offset: 25 });
      expect(mockPrisma.skill.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
          skip: 25,
        }),
      );
    });
  });

  describe("skill_store_admin_create", () => {
    it("should create a skill", async () => {
      mockPrisma.skill.create.mockResolvedValue({
        id: "s-new",
        name: "new-skill",
        displayName: "New Skill",
      });
      const handler = registry.handlers.get("skill_store_admin_create")!;
      const result = await handler({
        name: "new-skill",
        slug: "new-skill",
        displayName: "New Skill",
        description: "A brand new skill",
        author: "Admin",
        category: "WORKFLOW",
      });
      expect(getText(result)).toContain("Skill Created");
      expect(getText(result)).toContain("new-skill");
      expect(getText(result)).toContain("New Skill");
      expect(mockPrisma.skill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "new-skill",
            slug: "new-skill",
            displayName: "New Skill",
            description: "A brand new skill",
            category: "WORKFLOW",
            createdBy: userId,
          }),
        }),
      );
    });

    it("should create with all optional fields", async () => {
      mockPrisma.skill.create.mockResolvedValue({
        id: "s-full",
        name: "full-skill",
        displayName: "Full Skill",
      });
      const handler = registry.handlers.get("skill_store_admin_create")!;
      const result = await handler({
        name: "full-skill",
        slug: "full-skill",
        displayName: "Full Skill",
        description: "Full description",
        longDescription: "Very long description",
        category: "SECURITY",
        status: "PUBLISHED",
        version: "2.0.0",
        author: "Admin",
        authorUrl: "https://author.com",
        repoUrl: "https://github.com/repo",
        iconUrl: "https://icon.com/icon.png",
        color: "#00FF00",
        tags: ["security", "audit"],
        sortOrder: 5,
        isActive: true,
        isFeatured: true,
      });
      expect(getText(result)).toContain("Skill Created");
      expect(mockPrisma.skill.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            longDescription: "Very long description",
            status: "PUBLISHED",
            version: "2.0.0",
            authorUrl: "https://author.com",
            repoUrl: "https://github.com/repo",
            iconUrl: "https://icon.com/icon.png",
            color: "#00FF00",
            tags: ["security", "audit"],
            sortOrder: 5,
            isActive: true,
            isFeatured: true,
          }),
        }),
      );
    });
  });

  describe("skill_store_admin_update", () => {
    it("should update skill fields", async () => {
      mockPrisma.skill.update.mockResolvedValue({
        displayName: "Updated Skill",
        status: "PUBLISHED",
      });
      const handler = registry.handlers.get("skill_store_admin_update")!;
      const result = await handler({
        skill_id: "s1",
        displayName: "Updated Skill",
        status: "PUBLISHED",
      });
      expect(getText(result)).toContain("Skill Updated");
      expect(getText(result)).toContain("Updated Skill");
      expect(mockPrisma.skill.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { displayName: "Updated Skill", status: "PUBLISHED" },
      });
    });

    it("should update all optional fields", async () => {
      mockPrisma.skill.update.mockResolvedValue({
        displayName: "Full Update",
        status: "DRAFT",
      });
      const handler = registry.handlers.get("skill_store_admin_update")!;
      await handler({
        skill_id: "s1",
        name: "new-name",
        slug: "new-slug",
        displayName: "Full Update",
        description: "New desc",
        longDescription: "New long desc",
        category: "PERFORMANCE",
        status: "DRAFT",
        version: "3.0.0",
        author: "NewAuthor",
        authorUrl: "https://new.com",
        repoUrl: "https://github.com/new",
        iconUrl: "https://new.com/icon.png",
        color: "#0000FF",
        tags: ["new"],
        sortOrder: 10,
        isActive: false,
        isFeatured: false,
      });
      expect(mockPrisma.skill.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: {
          name: "new-name",
          slug: "new-slug",
          displayName: "Full Update",
          description: "New desc",
          longDescription: "New long desc",
          category: "PERFORMANCE",
          status: "DRAFT",
          version: "3.0.0",
          author: "NewAuthor",
          authorUrl: "https://new.com",
          repoUrl: "https://github.com/new",
          iconUrl: "https://new.com/icon.png",
          color: "#0000FF",
          tags: ["new"],
          sortOrder: 10,
          isActive: false,
          isFeatured: false,
        },
      });
    });

    it("should handle update with no optional fields", async () => {
      mockPrisma.skill.update.mockResolvedValue({
        displayName: "Same",
        status: "PUBLISHED",
      });
      const handler = registry.handlers.get("skill_store_admin_update")!;
      const result = await handler({ skill_id: "s1" });
      expect(getText(result)).toContain("Skill Updated");
      expect(mockPrisma.skill.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: {},
      });
    });
  });

  describe("skill_store_admin_delete", () => {
    it("should archive a skill (soft delete)", async () => {
      mockPrisma.skill.update.mockResolvedValue({
        displayName: "Archived Skill",
        id: "s1",
      });
      const handler = registry.handlers.get("skill_store_admin_delete")!;
      const result = await handler({ skill_id: "s1" });
      expect(getText(result)).toContain("Skill Archived");
      expect(getText(result)).toContain("Archived Skill");
      expect(mockPrisma.skill.update).toHaveBeenCalledWith({
        where: { id: "s1" },
        data: { status: "ARCHIVED", isActive: false },
      });
    });
  });
});
