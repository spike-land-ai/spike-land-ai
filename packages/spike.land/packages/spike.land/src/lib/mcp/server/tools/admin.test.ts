import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    user: { findUnique: vi.fn() },
    aIProvider: { findMany: vi.fn(), update: vi.fn() },
    emailLog: { findMany: vi.fn(), create: vi.fn() },
    featuredGalleryItem: {
      findMany: vi.fn(),
      update: vi.fn(),
      delete: vi.fn(),
    },
    mcpGenerationJob: { findMany: vi.fn(), update: vi.fn(), delete: vi.fn() },
    enhancedImage: { findMany: vi.fn(), update: vi.fn() },
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAdminTools } from "./admin";

describe("admin tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    // Default: user has ADMIN role (required for all admin tools)
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
    registry = createMockRegistry();
    registerAdminTools(registry, userId);
  });

  it("should register 10 admin tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(10);
    expect(registry.handlers.has("admin_list_agents")).toBe(true);
    expect(registry.handlers.has("admin_manage_agent")).toBe(true);
    expect(registry.handlers.has("admin_list_emails")).toBe(true);
    expect(registry.handlers.has("admin_send_email")).toBe(true);
    expect(registry.handlers.has("admin_list_gallery")).toBe(true);
    expect(registry.handlers.has("admin_manage_gallery")).toBe(true);
    expect(registry.handlers.has("admin_list_jobs")).toBe(true);
    expect(registry.handlers.has("admin_manage_job")).toBe(true);
    expect(registry.handlers.has("admin_list_photos")).toBe(true);
    expect(registry.handlers.has("admin_moderate_photo")).toBe(true);
  });

  describe("admin_list_agents", () => {
    it("should list agents", async () => {
      mockPrisma.aIProvider.findMany.mockResolvedValue([
        { id: "a1", name: "GPT-4", isDefault: true, createdAt: new Date() },
      ]);
      const handler = registry.handlers.get("admin_list_agents")!;
      const result = await handler({});
      expect(getText(result)).toContain("GPT-4");
      expect(getText(result)).toContain("DEFAULT");
    });

    it("should return message when no agents found", async () => {
      mockPrisma.aIProvider.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_agents")!;
      const result = await handler({});
      expect(getText(result)).toContain("No agents found");
    });

    it("should filter by ACTIVE status (isDefault: true)", async () => {
      mockPrisma.aIProvider.findMany.mockResolvedValue([
        { id: "a1", name: "Claude", isDefault: true, createdAt: new Date() },
      ]);
      const handler = registry.handlers.get("admin_list_agents")!;
      await handler({ status: "ACTIVE" });
      expect(mockPrisma.aIProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isDefault: true } }),
      );
    });

    it("should filter by INACTIVE status (isDefault: false)", async () => {
      mockPrisma.aIProvider.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_agents")!;
      await handler({ status: "INACTIVE" });
      expect(mockPrisma.aIProvider.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isDefault: false } }),
      );
    });

    it("should show STANDBY for agent with isDefault: false", async () => {
      mockPrisma.aIProvider.findMany.mockResolvedValue([
        { id: "a2", name: "Backup", isDefault: false, createdAt: new Date() },
      ]);
      const handler = registry.handlers.get("admin_list_agents")!;
      const result = await handler({});
      expect(getText(result)).toContain("STANDBY");
    });
  });

  describe("admin_manage_agent", () => {
    it("should activate an agent", async () => {
      mockPrisma.aIProvider.update.mockResolvedValue({});
      const handler = registry.handlers.get("admin_manage_agent")!;
      const result = await handler({ agent_id: "a1", action: "activate" });
      expect(getText(result)).toContain("activate completed");
      expect(mockPrisma.aIProvider.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isDefault: true } }),
      );
    });

    it("should deactivate an agent", async () => {
      mockPrisma.aIProvider.update.mockResolvedValue({});
      const handler = registry.handlers.get("admin_manage_agent")!;
      await handler({ agent_id: "a1", action: "deactivate" });
      expect(mockPrisma.aIProvider.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isDefault: false } }),
      );
    });

    it("should restart an agent (isDefault: true)", async () => {
      mockPrisma.aIProvider.update.mockResolvedValue({});
      const handler = registry.handlers.get("admin_manage_agent")!;
      const result = await handler({ agent_id: "a1", action: "restart" });
      expect(getText(result)).toContain("restart completed");
      expect(mockPrisma.aIProvider.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isDefault: true } }),
      );
    });
  });

  describe("admin_list_emails", () => {
    it("should list emails", async () => {
      mockPrisma.emailLog.findMany.mockResolvedValue([
        {
          id: "e1",
          to: "test@test.com",
          subject: "Welcome",
          status: "SENT",
          sentAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("admin_list_emails")!;
      const result = await handler({});
      expect(getText(result)).toContain("Welcome");
      expect(getText(result)).toContain("SENT");
    });

    it("should filter by SENT status", async () => {
      mockPrisma.emailLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_emails")!;
      await handler({ status: "SENT" });
      expect(mockPrisma.emailLog.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: "SENT" } }),
      );
    });

    it("should return empty message when no emails found", async () => {
      mockPrisma.emailLog.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_emails")!;
      const result = await handler({});
      expect(getText(result)).toContain("No emails found");
    });

    it("should show 'pending' for email with sentAt: null", async () => {
      mockPrisma.emailLog.findMany.mockResolvedValue([
        {
          id: "e2",
          to: "test@test.com",
          subject: "Queued",
          status: "PENDING",
          sentAt: null,
        },
      ]);
      const handler = registry.handlers.get("admin_list_emails")!;
      const result = await handler({});
      expect(getText(result)).toContain("pending");
    });
  });

  describe("admin_send_email", () => {
    it("should queue an email", async () => {
      mockPrisma.emailLog.create.mockResolvedValue({ id: "e2" });
      const handler = registry.handlers.get("admin_send_email")!;
      const result = await handler({
        to: "test@test.com",
        subject: "Hi",
        template: "welcome",
      });
      expect(getText(result)).toContain("Email queued");
    });
  });

  describe("admin_list_gallery", () => {
    it("should list gallery items", async () => {
      mockPrisma.featuredGalleryItem.findMany.mockResolvedValue([
        {
          id: "g1",
          title: "Sunset",
          enhancedUrl: "https://example.com/sunset.jpg",
          isActive: true,
          createdAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("admin_list_gallery")!;
      const result = await handler({});
      expect(getText(result)).toContain("Sunset");
      expect(getText(result)).toContain("ACTIVE");
    });

    it("should filter by featured: true (isActive: true)", async () => {
      mockPrisma.featuredGalleryItem.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_gallery")!;
      await handler({ featured: true });
      expect(mockPrisma.featuredGalleryItem.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isActive: true } }),
      );
    });

    it("should return empty message when no gallery items found", async () => {
      mockPrisma.featuredGalleryItem.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_gallery")!;
      const result = await handler({});
      expect(getText(result)).toContain("No gallery items found");
    });

    it("should show INACTIVE for gallery item with isActive: false", async () => {
      mockPrisma.featuredGalleryItem.findMany.mockResolvedValue([
        {
          id: "g2",
          title: "Hidden",
          enhancedUrl: "https://example.com/hidden.jpg",
          isActive: false,
          createdAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("admin_list_gallery")!;
      const result = await handler({});
      expect(getText(result)).toContain("INACTIVE");
    });
  });

  describe("admin_manage_gallery", () => {
    it("should remove a gallery item", async () => {
      mockPrisma.featuredGalleryItem.delete.mockResolvedValue({});
      const handler = registry.handlers.get("admin_manage_gallery")!;
      const result = await handler({ item_id: "g1", action: "remove" });
      expect(getText(result)).toContain("removed");
    });

    it("should feature a gallery item", async () => {
      mockPrisma.featuredGalleryItem.update.mockResolvedValue({});
      const handler = registry.handlers.get("admin_manage_gallery")!;
      const result = await handler({ item_id: "g1", action: "feature" });
      expect(getText(result)).toContain("feature completed");
    });

    it("should unfeature a gallery item (isActive: false)", async () => {
      mockPrisma.featuredGalleryItem.update.mockResolvedValue({});
      const handler = registry.handlers.get("admin_manage_gallery")!;
      const result = await handler({ item_id: "g1", action: "unfeature" });
      expect(getText(result)).toContain("unfeature completed");
      expect(mockPrisma.featuredGalleryItem.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { isActive: false } }),
      );
    });
  });

  describe("admin_list_jobs", () => {
    it("should list jobs", async () => {
      mockPrisma.mcpGenerationJob.findMany.mockResolvedValue([
        {
          id: "j1",
          type: "GENERATE",
          status: "COMPLETED",
          prompt: "A cat",
          createdAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("admin_list_jobs")!;
      const result = await handler({});
      expect(getText(result)).toContain("GENERATE");
      expect(getText(result)).toContain("COMPLETED");
    });

    it("should filter by PENDING status", async () => {
      mockPrisma.mcpGenerationJob.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_jobs")!;
      await handler({ status: "PENDING" });
      expect(mockPrisma.mcpGenerationJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { status: "PENDING" } }),
      );
    });

    it("should return empty message when no jobs found", async () => {
      mockPrisma.mcpGenerationJob.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_jobs")!;
      const result = await handler({});
      expect(getText(result)).toContain("No jobs found");
    });
  });

  describe("admin_manage_job", () => {
    it("should cancel a job", async () => {
      mockPrisma.mcpGenerationJob.update.mockResolvedValue({});
      const handler = registry.handlers.get("admin_manage_job")!;
      const result = await handler({ job_id: "j1", action: "cancel" });
      expect(getText(result)).toContain("cancel completed");
      expect(getText(result)).toContain("FAILED");
    });

    it("should retry a job (newStatus: PENDING)", async () => {
      mockPrisma.mcpGenerationJob.update.mockResolvedValue({});
      const handler = registry.handlers.get("admin_manage_job")!;
      const result = await handler({ job_id: "j1", action: "retry" });
      expect(getText(result)).toContain("retry completed");
      expect(getText(result)).toContain("PENDING");
      expect(mockPrisma.mcpGenerationJob.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: { status: "PENDING" } }),
      );
    });

    it("should delete a job", async () => {
      mockPrisma.mcpGenerationJob.delete.mockResolvedValue({});
      const handler = registry.handlers.get("admin_manage_job")!;
      const result = await handler({ job_id: "j1", action: "delete" });
      expect(getText(result)).toContain("deleted");
    });
  });

  describe("admin_list_photos", () => {
    it("should list photos", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([
        {
          id: "p1",
          name: "Beach",
          originalUrl: "https://example.com/beach.jpg",
          isPublic: true,
          createdAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("admin_list_photos")!;
      const result = await handler({});
      expect(getText(result)).toContain("Beach");
      expect(getText(result)).toContain("PUBLIC");
    });

    it("should filter by PUBLIC status (isPublic: true)", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_photos")!;
      await handler({ status: "PUBLIC" });
      expect(mockPrisma.enhancedImage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublic: true } }),
      );
    });

    it("should filter by PRIVATE status (isPublic: false)", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_photos")!;
      await handler({ status: "PRIVATE" });
      expect(mockPrisma.enhancedImage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { isPublic: false } }),
      );
    });

    it("should return empty message when no photos found", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_photos")!;
      const result = await handler({});
      expect(getText(result)).toContain("No photos found");
    });

    it("should show 'Untitled' for photo with name: null", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([
        {
          id: "p2",
          name: null,
          originalUrl: "https://example.com/unnamed.jpg",
          isPublic: true,
          createdAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("admin_list_photos")!;
      const result = await handler({});
      expect(getText(result)).toContain("Untitled");
    });

    it("should show PRIVATE for non-public photo", async () => {
      mockPrisma.enhancedImage.findMany.mockResolvedValue([
        {
          id: "p3",
          name: "Secret",
          originalUrl: "https://example.com/secret.jpg",
          isPublic: false,
          createdAt: new Date(),
        },
      ]);
      const handler = registry.handlers.get("admin_list_photos")!;
      const result = await handler({});
      expect(getText(result)).toContain("PRIVATE");
    });
  });

  describe("admin_moderate_photo", () => {
    it("should approve a photo", async () => {
      mockPrisma.enhancedImage.update.mockResolvedValue({});
      const handler = registry.handlers.get("admin_moderate_photo")!;
      const result = await handler({ photo_id: "p1", action: "approve" });
      expect(getText(result)).toContain("approved");
    });

    it("should reject a photo", async () => {
      mockPrisma.enhancedImage.update.mockResolvedValue({});
      const handler = registry.handlers.get("admin_moderate_photo")!;
      const result = await handler({ photo_id: "p1", action: "reject" });
      expect(getText(result)).toContain("rejected");
    });
  });

  describe("requireAdminRole (SEC-AUTHZ-01)", () => {
    it("should deny access when user has USER role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("admin_list_agents")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should deny access when user is not found", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("admin_list_agents")!;
      const result = await handler({});
      expect(getText(result)).toContain("PERMISSION_DENIED");
    });

    it("should allow access for ADMIN role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
      mockPrisma.aIProvider.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_agents")!;
      const result = await handler({});
      expect(getText(result)).toContain("No agents found");
    });

    it("should allow access for SUPER_ADMIN role", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "SUPER_ADMIN" });
      mockPrisma.aIProvider.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get("admin_list_agents")!;
      const result = await handler({});
      expect(getText(result)).toContain("No agents found");
    });

    it("should check admin role on every admin tool handler", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const toolNames = [
        "admin_list_agents",
        "admin_manage_agent",
        "admin_list_emails",
        "admin_send_email",
        "admin_list_gallery",
        "admin_manage_gallery",
        "admin_list_jobs",
        "admin_manage_job",
        "admin_list_photos",
        "admin_moderate_photo",
      ];
      for (const toolName of toolNames) {
        const handler = registry.handlers.get(toolName)!;
        const result = await handler({});
        expect(getText(result)).toContain("PERMISSION_DENIED");
      }
    });
  });
});
