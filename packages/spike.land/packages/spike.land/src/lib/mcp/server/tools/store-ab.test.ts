import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  storeAppDeployment: {
    create: vi.fn(),
    findFirst: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  storeAppVariant: {
    create: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    deleteMany: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerStoreAbTools } from "./store-ab";

describe("store-ab tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerStoreAbTools(registry, userId);
  });

  it("should register 8 store-ab tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(8);
    expect(registry.handlers.has("store_app_deploy")).toBe(true);
    expect(registry.handlers.has("store_app_add_variant")).toBe(true);
    expect(registry.handlers.has("store_app_assign_visitor")).toBe(true);
    expect(registry.handlers.has("store_app_record_impression")).toBe(true);
    expect(registry.handlers.has("store_app_record_error")).toBe(true);
    expect(registry.handlers.has("store_app_get_results")).toBe(true);
    expect(registry.handlers.has("store_app_declare_winner")).toBe(true);
    expect(registry.handlers.has("store_app_cleanup")).toBe(true);
  });

  describe("store_app_deploy", () => {
    it("should create a deployment with DRAFT status", async () => {
      mockPrisma.storeAppDeployment.create.mockResolvedValue({ id: "dep-1" });

      const handler = registry.handlers.get("store_app_deploy")!;
      const result = await handler({
        app_slug: "codespace",
        base_codespace_id: "cs-base-1",
      });

      const text = getText(result);
      expect(text).toContain("Deployment Created");
      expect(text).toContain("dep-1");
      expect(text).toContain("codespace");
      expect(text).toContain("cs-base-1");
      expect(text).toContain("DRAFT");
      expect(mockPrisma.storeAppDeployment.create).toHaveBeenCalledWith({
        data: {
          appSlug: "codespace",
          baseCodespaceId: "cs-base-1",
          status: "DRAFT",
        },
      });
    });

    it("should reject invalid app slugs", async () => {
      const handler = registry.handlers.get("store_app_deploy")!;
      const result = await handler({
        app_slug: "nonexistent-app-xyz",
        base_codespace_id: "cs-base-1",
      });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("nonexistent-app-xyz");
      expect(text).toContain("not found in store");
      expect(mockPrisma.storeAppDeployment.create).not.toHaveBeenCalled();
    });
  });

  describe("store_app_add_variant", () => {
    it("should add a variant to a deployment", async () => {
      mockPrisma.storeAppVariant.create.mockResolvedValue({ id: "var-1" });

      const handler = registry.handlers.get("store_app_add_variant")!;
      const result = await handler({
        deployment_id: "dep-1",
        variant_label: "Dark Theme",
        codespace_id: "cs-dark",
        dimension: "theme",
      });

      const text = getText(result);
      expect(text).toContain("Variant Added");
      expect(text).toContain("var-1");
      expect(text).toContain("dep-1");
      expect(text).toContain("Dark Theme");
      expect(text).toContain("theme");
      expect(text).toContain("cs-dark");
      expect(mockPrisma.storeAppVariant.create).toHaveBeenCalledWith({
        data: {
          deploymentId: "dep-1",
          variantLabel: "Dark Theme",
          codespaceId: "cs-dark",
          dimension: "theme",
        },
      });
    });
  });

  describe("store_app_assign_visitor", () => {
    it("should assign a visitor to a variant using hash", async () => {
      mockPrisma.storeAppVariant.findMany.mockResolvedValue([
        {
          id: "var-1",
          codespaceId: "cs-1",
          variantLabel: "Control",
          createdAt: new Date("2025-01-01"),
        },
        {
          id: "var-2",
          codespaceId: "cs-2",
          variantLabel: "Theme B",
          createdAt: new Date("2025-01-02"),
        },
      ]);

      const handler = registry.handlers.get("store_app_assign_visitor")!;
      const result = await handler({
        deployment_id: "dep-1",
        visitor_id: "visitor-abc",
      });

      const text = getText(result);
      expect(text).toContain("Visitor Assigned");
      expect(text).toContain("dep-1");
      expect(text).toContain("visitor-abc");
      // Should assign to one of the variants
      expect(text).toMatch(/var-1|var-2/);
    });

    it("should return VALIDATION_ERROR for deployment with no variants", async () => {
      mockPrisma.storeAppVariant.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("store_app_assign_visitor")!;
      const result = await handler({
        deployment_id: "dep-1",
        visitor_id: "visitor-1",
      });

      expect(getText(result)).toContain("VALIDATION_ERROR");
      expect(getText(result)).toContain("No variants configured");
    });

    it("should produce consistent assignments for the same visitor", async () => {
      const variants = [
        {
          id: "var-1",
          codespaceId: "cs-1",
          variantLabel: "Control",
          createdAt: new Date("2025-01-01"),
        },
        {
          id: "var-2",
          codespaceId: "cs-2",
          variantLabel: "Theme B",
          createdAt: new Date("2025-01-02"),
        },
      ];
      mockPrisma.storeAppVariant.findMany.mockResolvedValue(variants);

      const handler = registry.handlers.get("store_app_assign_visitor")!;
      const result1 = await handler({
        deployment_id: "dep-1",
        visitor_id: "same-visitor",
      });
      const result2 = await handler({
        deployment_id: "dep-1",
        visitor_id: "same-visitor",
      });

      expect(getText(result1)).toEqual(getText(result2));
    });

    it("should return codespace_id in the response", async () => {
      mockPrisma.storeAppVariant.findMany.mockResolvedValue([
        {
          id: "var-1",
          codespaceId: "cs-special",
          variantLabel: "Only Variant",
          createdAt: new Date("2025-01-01"),
        },
      ]);

      const handler = registry.handlers.get("store_app_assign_visitor")!;
      const result = await handler({
        deployment_id: "dep-1",
        visitor_id: "any-visitor",
      });

      expect(getText(result)).toContain("cs-special");
    });
  });

  describe("store_app_record_impression", () => {
    it("should atomically increment impressions", async () => {
      mockPrisma.storeAppVariant.update.mockResolvedValue({
        id: "var-1",
        impressions: 42,
      });

      const handler = registry.handlers.get("store_app_record_impression")!;
      const result = await handler({ variant_id: "var-1" });

      const text = getText(result);
      expect(text).toContain("Impression Recorded");
      expect(text).toContain("var-1");
      expect(text).toContain("42");
      expect(mockPrisma.storeAppVariant.update).toHaveBeenCalledWith({
        where: { id: "var-1" },
        data: { impressions: { increment: 1 } },
      });
    });
  });

  describe("store_app_record_error", () => {
    it("should atomically increment error count", async () => {
      mockPrisma.storeAppVariant.update.mockResolvedValue({
        id: "var-1",
        errorCount: 5,
      });

      const handler = registry.handlers.get("store_app_record_error")!;
      const result = await handler({ variant_id: "var-1" });

      const text = getText(result);
      expect(text).toContain("Error Recorded");
      expect(text).toContain("var-1");
      expect(text).toContain("5");
      expect(mockPrisma.storeAppVariant.update).toHaveBeenCalledWith({
        where: { id: "var-1" },
        data: { errorCount: { increment: 1 } },
      });
    });
  });

  describe("store_app_get_results", () => {
    it("should return results with metrics table", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue({
        id: "dep-1",
        appSlug: "my-app",
        status: "LIVE",
        variants: [
          {
            id: "var-1",
            variantLabel: "Control",
            dimension: "layout",
            impressions: 1000,
            engagements: 50,
            errorCount: 2,
            isWinner: true,
          },
          {
            id: "var-2",
            variantLabel: "Compact",
            dimension: "layout",
            impressions: 800,
            engagements: 30,
            errorCount: 5,
            isWinner: false,
          },
        ],
      });

      const handler = registry.handlers.get("store_app_get_results")!;
      const result = await handler({ deployment_id: "dep-1" });

      const text = getText(result);
      expect(text).toContain("Deployment Results");
      expect(text).toContain("dep-1");
      expect(text).toContain("my-app");
      expect(text).toContain("LIVE");
      expect(text).toContain("var-1");
      expect(text).toContain("var-2");
      expect(text).toContain("Control");
      expect(text).toContain("Compact");
      expect(text).toContain("1000");
      expect(text).toContain("800");
      expect(text).toContain("Yes");
      expect(text).toContain("No");
    });

    it("should return NOT_FOUND for missing deployment", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("store_app_get_results")!;
      const result = await handler({ deployment_id: "nonexistent" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should handle deployment with no variants", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue({
        id: "dep-1",
        appSlug: "my-app",
        status: "DRAFT",
        variants: [],
      });

      const handler = registry.handlers.get("store_app_get_results")!;
      const result = await handler({ deployment_id: "dep-1" });

      const text = getText(result);
      expect(text).toContain("Deployment Results");
      expect(text).toContain("DRAFT");
    });
  });

  describe("store_app_declare_winner", () => {
    it("should mark variant as winner and set deployment to LIVE", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue({
        id: "dep-1",
        status: "DRAFT",
      });
      mockPrisma.storeAppVariant.update.mockResolvedValue({
        id: "var-1",
        isWinner: true,
      });
      mockPrisma.storeAppDeployment.update.mockResolvedValue({
        id: "dep-1",
        status: "LIVE",
      });

      const handler = registry.handlers.get("store_app_declare_winner")!;
      const result = await handler({
        deployment_id: "dep-1",
        variant_id: "var-1",
      });

      const text = getText(result);
      expect(text).toContain("Winner Declared");
      expect(text).toContain("dep-1");
      expect(text).toContain("var-1");
      expect(text).toContain("LIVE");
      expect(mockPrisma.storeAppVariant.update).toHaveBeenCalledWith({
        where: { id: "var-1" },
        data: { isWinner: true },
      });
      expect(mockPrisma.storeAppDeployment.update).toHaveBeenCalledWith({
        where: { id: "dep-1" },
        data: { status: "LIVE" },
      });
    });

    it("should return NOT_FOUND for missing deployment", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("store_app_declare_winner")!;
      const result = await handler({
        deployment_id: "nonexistent",
        variant_id: "var-1",
      });

      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("store_app_cleanup", () => {
    it("should delete deployment and variants with FAILED status", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue({
        id: "dep-1",
        status: "FAILED",
      });
      mockPrisma.storeAppVariant.deleteMany.mockResolvedValue({ count: 2 });
      mockPrisma.storeAppDeployment.delete.mockResolvedValue({ id: "dep-1" });

      const handler = registry.handlers.get("store_app_cleanup")!;
      const result = await handler({ deployment_id: "dep-1" });

      const text = getText(result);
      expect(text).toContain("Deployment Cleaned Up");
      expect(text).toContain("dep-1");
      expect(text).toContain("FAILED");
      expect(mockPrisma.storeAppVariant.deleteMany).toHaveBeenCalledWith({
        where: { deploymentId: "dep-1" },
      });
      expect(mockPrisma.storeAppDeployment.delete).toHaveBeenCalledWith({
        where: { id: "dep-1" },
      });
    });

    it("should delete deployment with ARCHIVED status", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue({
        id: "dep-2",
        status: "ARCHIVED",
      });
      mockPrisma.storeAppVariant.deleteMany.mockResolvedValue({ count: 0 });
      mockPrisma.storeAppDeployment.delete.mockResolvedValue({ id: "dep-2" });

      const handler = registry.handlers.get("store_app_cleanup")!;
      const result = await handler({ deployment_id: "dep-2" });

      const text = getText(result);
      expect(text).toContain("Deployment Cleaned Up");
      expect(text).toContain("ARCHIVED");
    });

    it("should return NOT_FOUND for missing deployment", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue(null);

      const handler = registry.handlers.get("store_app_cleanup")!;
      const result = await handler({ deployment_id: "nonexistent" });

      expect(getText(result)).toContain("NOT_FOUND");
    });

    it("should reject cleanup of DRAFT deployment", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue({
        id: "dep-1",
        status: "DRAFT",
      });

      const handler = registry.handlers.get("store_app_cleanup")!;
      const result = await handler({ deployment_id: "dep-1" });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("FAILED or ARCHIVED");
      expect(text).toContain("DRAFT");
      expect(mockPrisma.storeAppVariant.deleteMany).not.toHaveBeenCalled();
      expect(mockPrisma.storeAppDeployment.delete).not.toHaveBeenCalled();
    });

    it("should reject cleanup of LIVE deployment", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue({
        id: "dep-1",
        status: "LIVE",
      });

      const handler = registry.handlers.get("store_app_cleanup")!;
      const result = await handler({ deployment_id: "dep-1" });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("LIVE");
    });

    it("should reject cleanup of DEPLOYING deployment", async () => {
      mockPrisma.storeAppDeployment.findFirst.mockResolvedValue({
        id: "dep-1",
        status: "DEPLOYING",
      });

      const handler = registry.handlers.get("store_app_cleanup")!;
      const result = await handler({ deployment_id: "dep-1" });

      const text = getText(result);
      expect(text).toContain("VALIDATION_ERROR");
      expect(text).toContain("DEPLOYING");
    });
  });
});
