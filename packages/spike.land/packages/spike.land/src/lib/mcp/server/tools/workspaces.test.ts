import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  workspaceMember: { findMany: vi.fn(), create: vi.fn() },
  workspace: {
    findUnique: vi.fn(),
    findFirst: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
  },
  workspaceFavorite: { findUnique: vi.fn(), create: vi.fn(), delete: vi.fn() },
  $transaction: vi.fn(),
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerWorkspacesTools } from "./workspaces";

describe("workspaces tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerWorkspacesTools(registry, userId);
  });

  it("should register 5 workspaces tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
  });

  describe("workspaces_list", () => {
    it("should list workspaces with membership info", async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([
        {
          role: "OWNER",
          workspace: {
            id: "ws1",
            name: "My Workspace",
            slug: "my-workspace",
            subscriptionTier: "FREE",
            createdAt: new Date("2024-01-01"),
          },
        },
      ]);
      const handler = registry.handlers.get("workspaces_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("My Workspace");
      expect(getText(result)).toContain("FREE");
      expect(getText(result)).toContain("OWNER");
      expect(getText(result)).toContain("my-workspace");
      expect(getText(result)).toContain("ws1");
      expect(getText(result)).toContain("Workspaces (1)");
    });

    it("should return empty message when no workspaces", async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("workspaces_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("No workspaces found");
    });

    it("should list multiple workspaces", async () => {
      mockPrisma.workspaceMember.findMany.mockResolvedValue([
        {
          role: "OWNER",
          workspace: {
            id: "ws1",
            name: "Workspace A",
            slug: "workspace-a",
            subscriptionTier: "PRO",
            createdAt: new Date("2024-01-01"),
          },
        },
        {
          role: "MEMBER",
          workspace: {
            id: "ws2",
            name: "Workspace B",
            slug: "workspace-b",
            subscriptionTier: "FREE",
            createdAt: new Date("2024-02-01"),
          },
        },
      ]);
      const handler = registry.handlers.get("workspaces_list")!;
      const result = await handler({});
      expect(getText(result)).toContain("Workspaces (2)");
      expect(getText(result)).toContain("Workspace A");
      expect(getText(result)).toContain("Workspace B");
      expect(getText(result)).toContain("MEMBER");
    });
  });

  describe("workspaces_create", () => {
    it("should create workspace with provided slug", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            workspace: {
              create: vi.fn().mockResolvedValue({
                id: "ws-new",
                name: "New Workspace",
                slug: "new-ws",
              }),
            },
            workspaceMember: { create: vi.fn().mockResolvedValue({}) },
          };
          return fn(tx);
        },
      );
      const handler = registry.handlers.get("workspaces_create")!;
      const result = await handler({ name: "New Workspace", slug: "new-ws" });
      expect(getText(result)).toContain("Workspace Created");
      expect(getText(result)).toContain("New Workspace");
      expect(getText(result)).toContain("new-ws");
    });

    it("should auto-generate slug when not provided", async () => {
      mockPrisma.workspace.findUnique.mockResolvedValue(null);
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            workspace: {
              create: vi.fn().mockResolvedValue({
                id: "ws-auto",
                name: "My Cool Project",
                slug: "my-cool-project",
              }),
            },
            workspaceMember: { create: vi.fn().mockResolvedValue({}) },
          };
          return fn(tx);
        },
      );
      const handler = registry.handlers.get("workspaces_create")!;
      const result = await handler({ name: "My Cool Project" });
      expect(getText(result)).toContain("Workspace Created");
      expect(getText(result)).toContain("My Cool Project");
    });

    it("should handle slug collision by appending suffix", async () => {
      mockPrisma.workspace.findUnique
        .mockResolvedValueOnce({ id: "existing" }) // first check: slug exists
        .mockResolvedValueOnce(null); // second check: slug-1 free
      mockPrisma.$transaction.mockImplementation(
        async (fn: (tx: unknown) => Promise<unknown>) => {
          const tx = {
            workspace: {
              create: vi.fn().mockResolvedValue({
                id: "ws-new",
                name: "Test",
                slug: "test-1",
              }),
            },
            workspaceMember: { create: vi.fn().mockResolvedValue({}) },
          };
          return fn(tx);
        },
      );
      const handler = registry.handlers.get("workspaces_create")!;
      const result = await handler({ name: "Test", slug: "test" });
      expect(getText(result)).toContain("Workspace Created");
      expect(getText(result)).toContain("test-1");
    });
  });

  describe("workspaces_get", () => {
    it("should return workspace details by ID", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws1",
        name: "My Workspace",
        slug: "my-ws",
        description: "A great workspace",
        isPersonal: false,
        subscriptionTier: "PRO",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-06-01"),
      });
      const handler = registry.handlers.get("workspaces_get")!;
      const result = await handler({ workspace_id: "ws1" });
      expect(getText(result)).toContain("My Workspace");
      expect(getText(result)).toContain("my-ws");
      expect(getText(result)).toContain("A great workspace");
      expect(getText(result)).toContain("PRO");
      expect(getText(result)).toContain("false");
    });

    it("should return workspace details by slug", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue({
        id: "ws2",
        name: "Slug Workspace",
        slug: "slug-ws",
        description: null,
        isPersonal: true,
        subscriptionTier: "FREE",
        createdAt: new Date("2024-01-01"),
        updatedAt: new Date("2024-06-01"),
      });
      const handler = registry.handlers.get("workspaces_get")!;
      const result = await handler({ slug: "slug-ws" });
      expect(getText(result)).toContain("Slug Workspace");
      expect(getText(result)).toContain("(none)");
    });

    it("should return NOT_FOUND when workspace does not exist", async () => {
      mockPrisma.workspace.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("workspaces_get")!;
      const result = await handler({ workspace_id: "nonexistent" });
      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should return VALIDATION_ERROR when neither ID nor slug provided", async () => {
      const handler = registry.handlers.get("workspaces_get")!;
      const result = await handler({});
      expect(getText(result)).toContain("VALIDATION_ERROR");
      expect(getText(result)).toContain("workspace_id or slug");
    });
  });

  describe("workspaces_update", () => {
    it("should update workspace name", async () => {
      mockPrisma.workspace.update.mockResolvedValue({
        name: "Updated Name",
        slug: "old-slug",
      });
      const handler = registry.handlers.get("workspaces_update")!;
      const result = await handler({
        workspace_id: "ws1",
        name: "Updated Name",
      });
      expect(getText(result)).toContain("Workspace Updated");
      expect(getText(result)).toContain("Updated Name");
    });

    it("should update workspace slug", async () => {
      mockPrisma.workspace.update.mockResolvedValue({
        name: "Same Name",
        slug: "new-slug",
      });
      const handler = registry.handlers.get("workspaces_update")!;
      const result = await handler({ workspace_id: "ws1", slug: "new-slug" });
      expect(getText(result)).toContain("Workspace Updated");
      expect(getText(result)).toContain("new-slug");
    });

    it("should update both name and slug", async () => {
      mockPrisma.workspace.update.mockResolvedValue({
        name: "New Name",
        slug: "new-slug",
      });
      const handler = registry.handlers.get("workspaces_update")!;
      const result = await handler({
        workspace_id: "ws1",
        name: "New Name",
        slug: "new-slug",
      });
      expect(getText(result)).toContain("Workspace Updated");
      expect(mockPrisma.workspace.update).toHaveBeenCalledWith({
        where: { id: "ws1" },
        data: { name: "New Name", slug: "new-slug" },
      });
    });

    it("should return VALIDATION_ERROR when no fields to update", async () => {
      const handler = registry.handlers.get("workspaces_update")!;
      const result = await handler({ workspace_id: "ws1" });
      expect(getText(result)).toContain("VALIDATION_ERROR");
      expect(getText(result)).toContain("No fields to update");
    });
  });

  describe("workspaces_favorite", () => {
    it("should add favorite when not already favorited", async () => {
      mockPrisma.workspaceFavorite.findUnique.mockResolvedValue(null);
      mockPrisma.workspaceFavorite.create.mockResolvedValue({});
      const handler = registry.handlers.get("workspaces_favorite")!;
      const result = await handler({ workspace_id: "ws1" });
      expect(getText(result)).toContain("Favorite Added");
      expect(getText(result)).toContain("ws1");
      expect(mockPrisma.workspaceFavorite.create).toHaveBeenCalledWith({
        data: { userId, workspaceId: "ws1" },
      });
    });

    it("should remove favorite when already favorited", async () => {
      mockPrisma.workspaceFavorite.findUnique.mockResolvedValue({ id: "fav1" });
      mockPrisma.workspaceFavorite.delete.mockResolvedValue({});
      const handler = registry.handlers.get("workspaces_favorite")!;
      const result = await handler({ workspace_id: "ws1" });
      expect(getText(result)).toContain("Favorite Removed");
      expect(getText(result)).toContain("ws1");
      expect(mockPrisma.workspaceFavorite.delete).toHaveBeenCalledWith({
        where: { id: "fav1" },
      });
    });
  });
});
