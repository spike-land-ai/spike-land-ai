import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  enhancementPipeline: {
    findMany: vi.fn(),
    findUnique: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerPipelinesTools } from "./pipelines";

describe("pipelines tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerPipelinesTools(registry, userId);
  });

  it("should register 6 pipelines tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(6);
  });

  describe("pipelines_list", () => {
    it("should list pipelines with owner tags", async () => {
      mockPrisma.enhancementPipeline.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "My Pipeline",
          description: "Own pipeline",
          userId,
          visibility: "PRIVATE",
          tier: "FREE",
          usageCount: 10,
          createdAt: new Date(),
        },
        {
          id: "p2",
          name: "System Default",
          description: "System pipeline",
          userId: null,
          visibility: "PUBLIC",
          tier: "FREE",
          usageCount: 100,
          createdAt: new Date(),
        },
        {
          id: "p3",
          name: "Community Pipeline",
          description: "Public one",
          userId: "other-user",
          visibility: "PUBLIC",
          tier: "PRO",
          usageCount: 50,
          createdAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("pipelines_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("Pipelines (3)");
      expect(getText(result)).toContain("My Pipeline");
      expect(getText(result)).toContain("[Own]");
      expect(getText(result)).toContain("System Default");
      expect(getText(result)).toContain("[System]");
      expect(getText(result)).toContain("Community Pipeline");
      expect(getText(result)).toContain("[Public]");
      expect(getText(result)).toContain("10 uses");
      expect(getText(result)).toContain("100 uses");
    });

    it("should return empty message when no pipelines", async () => {
      mockPrisma.enhancementPipeline.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("pipelines_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("No pipelines found");
    });

    it("should use default limit of 50", async () => {
      mockPrisma.enhancementPipeline.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("pipelines_list")!;
      await handler({});
      expect(mockPrisma.enhancementPipeline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 50,
        }),
      );
    });

    it("should respect custom limit", async () => {
      mockPrisma.enhancementPipeline.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("pipelines_list")!;
      await handler({ limit: 10 });
      expect(mockPrisma.enhancementPipeline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          take: 10,
        }),
      );
    });

    it("should show (no description) when description is null", async () => {
      mockPrisma.enhancementPipeline.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "No Desc",
          description: null,
          userId,
          visibility: "PRIVATE",
          tier: "FREE",
          usageCount: 0,
          createdAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("pipelines_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("(no description)");
    });

    it("should query with correct OR conditions", async () => {
      mockPrisma.enhancementPipeline.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("pipelines_list")!;
      await handler({});
      expect(mockPrisma.enhancementPipeline.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            OR: [
              { userId },
              { visibility: "PUBLIC" },
              { userId: null },
            ],
          },
        }),
      );
    });
  });

  describe("pipelines_create", () => {
    it("should create a pipeline with name only", async () => {
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-new",
        name: "New Pipeline",
        description: null,
      });
      const handler = registry.handlers.get("pipelines_create")!;
      const result = await handler({ name: "New Pipeline" });
      expect(getText(result)).toContain("Pipeline Created");
      expect(getText(result)).toContain("p-new");
      expect(getText(result)).toContain("New Pipeline");
    });

    it("should create a pipeline with description", async () => {
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-desc",
        name: "Described",
        description: "A great pipeline",
      });
      const handler = registry.handlers.get("pipelines_create")!;
      const result = await handler({
        name: "Described",
        description: "A great pipeline",
      });
      expect(getText(result)).toContain("Pipeline Created");
      expect(getText(result)).toContain("A great pipeline");
    });

    it("should create a pipeline with configs", async () => {
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-cfg",
        name: "Configured",
        description: null,
      });
      const handler = registry.handlers.get("pipelines_create")!;
      const result = await handler({
        name: "Configured",
        configs: {
          analysis: { model: "gpt-4" },
          autoCrop: { enabled: true },
          prompt: { template: "enhance" },
          generation: { quality: "high" },
        },
      });
      expect(getText(result)).toContain("Pipeline Created");
      expect(mockPrisma.enhancementPipeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Configured",
            userId,
            analysisConfig: { model: "gpt-4" },
            autoCropConfig: { enabled: true },
            promptConfig: { template: "enhance" },
            generationConfig: { quality: "high" },
          }),
        }),
      );
    });

    it("should trim name and description", async () => {
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-trim",
        name: "Trimmed",
        description: "Clean",
      });
      const handler = registry.handlers.get("pipelines_create")!;
      await handler({ name: "  Trimmed  ", description: "  Clean  " });
      expect(mockPrisma.enhancementPipeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Trimmed",
            description: "Clean",
          }),
        }),
      );
    });

    it("should set description to null when empty string", async () => {
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-null",
        name: "NoDesc",
        description: null,
      });
      const handler = registry.handlers.get("pipelines_create")!;
      await handler({ name: "NoDesc", description: "" });
      expect(mockPrisma.enhancementPipeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            description: null,
          }),
        }),
      );
    });

    it("should not include description in output when null", async () => {
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-x",
        name: "X",
        description: null,
      });
      const handler = registry.handlers.get("pipelines_create")!;
      const result = await handler({ name: "X" });
      expect(getText(result)).not.toContain("**Description:**");
    });
  });

  describe("pipelines_get", () => {
    it("should return pipeline details for own pipeline", async () => {
      const now = new Date("2024-06-15T12:00:00Z");
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p1",
        name: "My Pipeline",
        description: "Details here",
        userId,
        visibility: "PRIVATE",
        tier: "FREE",
        usageCount: 25,
        analysisConfig: { model: "gpt-4" },
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: { quality: "high" },
        createdAt: now,
        updatedAt: now,
        _count: { albums: 3, jobs: 15 },
      });
      const handler = registry.handlers.get("pipelines_get")!;
      const result = await handler({ pipeline_id: "p1" });
      expect(getText(result)).toContain("My Pipeline");
      expect(getText(result)).toContain("Details here");
      expect(getText(result)).toContain("PRIVATE");
      expect(getText(result)).toContain("25");
      expect(getText(result)).toContain("Albums:** 3");
      expect(getText(result)).toContain("Jobs:** 15");
      expect(getText(result)).toContain("Owner:** You");
      expect(getText(result)).toContain("analysis=set");
      expect(getText(result)).toContain("autoCrop=default");
      expect(getText(result)).toContain("prompt=default");
      expect(getText(result)).toContain("generation=set");
    });

    it("should return pipeline details for system pipeline", async () => {
      const now = new Date("2024-01-01T00:00:00Z");
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p-sys",
        name: "System Pipeline",
        description: null,
        userId: null,
        visibility: "PUBLIC",
        tier: "FREE",
        usageCount: 1000,
        analysisConfig: null,
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: null,
        createdAt: now,
        updatedAt: now,
        _count: { albums: 50, jobs: 200 },
      });
      const handler = registry.handlers.get("pipelines_get")!;
      const result = await handler({ pipeline_id: "p-sys" });
      expect(getText(result)).toContain("Owner:** System");
      expect(getText(result)).toContain("(none)");
    });

    it("should return pipeline details for public pipeline", async () => {
      const now = new Date("2024-03-01T00:00:00Z");
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p-pub",
        name: "Public Pipeline",
        description: "Shared",
        userId: "other-user",
        visibility: "PUBLIC",
        tier: "PRO",
        usageCount: 42,
        analysisConfig: null,
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: null,
        createdAt: now,
        updatedAt: now,
        _count: { albums: 1, jobs: 5 },
      });
      const handler = registry.handlers.get("pipelines_get")!;
      const result = await handler({ pipeline_id: "p-pub" });
      expect(getText(result)).toContain("Owner:** Other");
    });

    it("should return NOT_FOUND when pipeline does not exist", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("pipelines_get")!;
      const result = await handler({ pipeline_id: "nope" });
      expect(getText(result)).toContain("NOT_FOUND");
      expect(getText(result)).toContain("Pipeline not found");
    });

    it("should return PERMISSION_DENIED for private pipeline of another user", async () => {
      const now = new Date();
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p-priv",
        name: "Private",
        description: null,
        userId: "other-user",
        visibility: "PRIVATE",
        tier: "FREE",
        usageCount: 0,
        analysisConfig: null,
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: null,
        createdAt: now,
        updatedAt: now,
        _count: { albums: 0, jobs: 0 },
      });
      const handler = registry.handlers.get("pipelines_get")!;
      const result = await handler({ pipeline_id: "p-priv" });
      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(getText(result)).toContain("Access denied");
    });

    it("should show all configs as set when all are provided", async () => {
      const now = new Date("2024-06-15T12:00:00Z");
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p-all",
        name: "All Configs",
        description: "Full config pipeline",
        userId,
        visibility: "PRIVATE",
        tier: "PRO",
        usageCount: 5,
        analysisConfig: { model: "gpt-4" },
        autoCropConfig: { enabled: true },
        promptConfig: { template: "enhance" },
        generationConfig: { quality: "high" },
        createdAt: now,
        updatedAt: now,
        _count: { albums: 1, jobs: 10 },
      });
      const handler = registry.handlers.get("pipelines_get")!;
      const result = await handler({ pipeline_id: "p-all" });
      const text = getText(result);
      expect(text).toContain("analysis=set");
      expect(text).toContain("autoCrop=set");
      expect(text).toContain("prompt=set");
      expect(text).toContain("generation=set");
    });
  });

  describe("pipelines_update", () => {
    it("should update pipeline name", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({ userId });
      mockPrisma.enhancementPipeline.update.mockResolvedValue({
        id: "p1",
        name: "Updated Name",
      });
      const handler = registry.handlers.get("pipelines_update")!;
      const result = await handler({ pipeline_id: "p1", name: "Updated Name" });
      expect(getText(result)).toContain("Pipeline Updated");
      expect(getText(result)).toContain("Updated Name");
    });

    it("should update pipeline description", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({ userId });
      mockPrisma.enhancementPipeline.update.mockResolvedValue({
        id: "p1",
        name: "Same",
      });
      const handler = registry.handlers.get("pipelines_update")!;
      const result = await handler({
        pipeline_id: "p1",
        description: "New desc",
      });
      expect(getText(result)).toContain("Pipeline Updated");
      expect(mockPrisma.enhancementPipeline.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ description: "New desc" }),
        }),
      );
    });

    it("should update pipeline configs", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({ userId });
      mockPrisma.enhancementPipeline.update.mockResolvedValue({
        id: "p1",
        name: "Cfg",
      });
      const handler = registry.handlers.get("pipelines_update")!;
      await handler({
        pipeline_id: "p1",
        configs: {
          analysis: { model: "claude" },
          autoCrop: { enabled: false },
          prompt: { template: "new" },
          generation: { quality: "low" },
        },
      });
      expect(mockPrisma.enhancementPipeline.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            analysisConfig: { model: "claude" },
            autoCropConfig: { enabled: false },
            promptConfig: { template: "new" },
            generationConfig: { quality: "low" },
          }),
        }),
      );
    });

    it("should return NOT_FOUND when pipeline does not exist", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("pipelines_update")!;
      const result = await handler({ pipeline_id: "nope", name: "X" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED when not the owner", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        userId: "other-user",
      });
      const handler = registry.handlers.get("pipelines_update")!;
      const result = await handler({ pipeline_id: "p1", name: "X" });
      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(getText(result)).toContain("Only the owner");
    });

    it("should trim name and handle empty description", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({ userId });
      mockPrisma.enhancementPipeline.update.mockResolvedValue({
        id: "p1",
        name: "Trimmed",
      });
      const handler = registry.handlers.get("pipelines_update")!;
      await handler({
        pipeline_id: "p1",
        name: "  Trimmed  ",
        description: "",
      });
      expect(mockPrisma.enhancementPipeline.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Trimmed",
            description: null,
          }),
        }),
      );
    });

    it("should handle update with no optional fields", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({ userId });
      mockPrisma.enhancementPipeline.update.mockResolvedValue({
        id: "p1",
        name: "Same",
      });
      const handler = registry.handlers.get("pipelines_update")!;
      const result = await handler({ pipeline_id: "p1" });
      expect(getText(result)).toContain("Pipeline Updated");
      expect(mockPrisma.enhancementPipeline.update).toHaveBeenCalledWith({
        where: { id: "p1" },
        data: {},
        select: { id: true, name: true },
      });
    });
  });

  describe("pipelines_delete", () => {
    it("should delete a pipeline", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        userId,
        _count: { albums: 0 },
      });
      mockPrisma.enhancementPipeline.delete.mockResolvedValue({});
      const handler = registry.handlers.get("pipelines_delete")!;
      const result = await handler({ pipeline_id: "p1" });
      expect(getText(result)).toContain("Pipeline Deleted");
      expect(getText(result)).toContain("p1");
    });

    it("should return NOT_FOUND when pipeline does not exist", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("pipelines_delete")!;
      const result = await handler({ pipeline_id: "nope" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED when not the owner", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        userId: "other-user",
        _count: { albums: 0 },
      });
      const handler = registry.handlers.get("pipelines_delete")!;
      const result = await handler({ pipeline_id: "p1" });
      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(getText(result)).toContain("Only the owner");
    });

    it("should return CONFLICT when pipeline is used by albums", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        userId,
        _count: { albums: 3 },
      });
      const handler = registry.handlers.get("pipelines_delete")!;
      const result = await handler({ pipeline_id: "p1" });
      expect(getText(result)).toContain("CONFLICT");
      expect(getText(result)).toContain("3 album(s)");
      expect(getText(result)).toContain("Remove from albums first");
    });

    it("should call delete with correct pipeline_id", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        userId,
        _count: { albums: 0 },
      });
      mockPrisma.enhancementPipeline.delete.mockResolvedValue({});
      const handler = registry.handlers.get("pipelines_delete")!;
      await handler({ pipeline_id: "p-del" });
      expect(mockPrisma.enhancementPipeline.delete).toHaveBeenCalledWith({
        where: { id: "p-del" },
      });
    });
  });

  describe("pipelines_fork", () => {
    it("should fork own pipeline", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p1",
        name: "Original",
        description: "Desc",
        userId,
        visibility: "PRIVATE",
        tier: "FREE",
        analysisConfig: { model: "x" },
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: null,
      });
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-fork",
        name: "Original (copy)",
      });
      const handler = registry.handlers.get("pipelines_fork")!;
      const result = await handler({ pipeline_id: "p1" });
      expect(getText(result)).toContain("Pipeline Forked");
      expect(getText(result)).toContain("p-fork");
      expect(getText(result)).toContain("Original (copy)");
      expect(getText(result)).toContain("Forked From:** p1");
    });

    it("should fork system pipeline", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p-sys",
        name: "System",
        description: "System desc",
        userId: null,
        visibility: "PUBLIC",
        tier: "FREE",
        analysisConfig: null,
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: null,
      });
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-fork2",
        name: "System (copy)",
      });
      const handler = registry.handlers.get("pipelines_fork")!;
      const result = await handler({ pipeline_id: "p-sys" });
      expect(getText(result)).toContain("Pipeline Forked");
      expect(getText(result)).toContain("System (copy)");
    });

    it("should fork public pipeline from another user", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p-pub",
        name: "Public",
        description: null,
        userId: "other-user",
        visibility: "PUBLIC",
        tier: "PRO",
        analysisConfig: null,
        autoCropConfig: { enabled: true },
        promptConfig: { template: "test" },
        generationConfig: null,
      });
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-fork3",
        name: "Public (copy)",
      });
      const handler = registry.handlers.get("pipelines_fork")!;
      const result = await handler({ pipeline_id: "p-pub" });
      expect(getText(result)).toContain("Pipeline Forked");
      expect(mockPrisma.enhancementPipeline.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            name: "Public (copy)",
            userId,
            tier: "PRO",
            visibility: "PRIVATE",
            autoCropConfig: { enabled: true },
            promptConfig: { template: "test" },
          }),
        }),
      );
    });

    it("should return NOT_FOUND when source pipeline does not exist", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("pipelines_fork")!;
      const result = await handler({ pipeline_id: "nope" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return PERMISSION_DENIED for private pipeline of another user", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p-priv",
        name: "Private",
        description: null,
        userId: "other-user",
        visibility: "PRIVATE",
        tier: "FREE",
        analysisConfig: null,
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: null,
      });
      const handler = registry.handlers.get("pipelines_fork")!;
      const result = await handler({ pipeline_id: "p-priv" });
      expect(getText(result)).toContain("PERMISSION_DENIED");
      expect(getText(result)).toContain("Access denied");
    });

    it("should omit null configs from fork data", async () => {
      mockPrisma.enhancementPipeline.findUnique.mockResolvedValue({
        id: "p-null",
        name: "Null Configs",
        description: null,
        userId,
        visibility: "PRIVATE",
        tier: "FREE",
        analysisConfig: null,
        autoCropConfig: null,
        promptConfig: null,
        generationConfig: null,
      });
      mockPrisma.enhancementPipeline.create.mockResolvedValue({
        id: "p-fork4",
        name: "Null Configs (copy)",
      });
      const handler = registry.handlers.get("pipelines_fork")!;
      await handler({ pipeline_id: "p-null" });
      const createCall = mockPrisma.enhancementPipeline.create.mock.calls[0]![0];
      // When source configs are null, they should not appear in the create data
      expect(createCall.data).not.toHaveProperty("analysisConfig");
      expect(createCall.data).not.toHaveProperty("autoCropConfig");
      expect(createCall.data).not.toHaveProperty("promptConfig");
      expect(createCall.data).not.toHaveProperty("generationConfig");
    });
  });
});
