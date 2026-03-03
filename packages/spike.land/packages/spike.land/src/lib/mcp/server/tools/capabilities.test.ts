import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  agentCapabilityToken: { findFirst: vi.fn() },
  agentTrustScore: { findFirst: vi.fn() },
  permissionRequest: { create: vi.fn(), findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerCapabilitiesTools } from "./capabilities";

describe("capabilities tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerCapabilitiesTools(registry, userId);
  });

  it("should register 3 capabilities tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("capabilities_request_permissions")).toBe(
      true,
    );
    expect(registry.handlers.has("capabilities_check_permissions")).toBe(true);
    expect(registry.handlers.has("capabilities_list_queued_actions")).toBe(
      true,
    );
  });

  describe("capabilities_request_permissions", () => {
    it("should create permission request with tools and reason", async () => {
      mockPrisma.agentCapabilityToken.findFirst.mockResolvedValue({
        id: "tok-1",
        agentId: "agent-1",
      });
      mockPrisma.permissionRequest.create.mockResolvedValue({
        id: "req-1",
      });
      const handler = registry.handlers.get(
        "capabilities_request_permissions",
      )!;
      const result = await handler({
        tools: ["admin_delete_user"],
        reason: "Need to clean up test data",
      });
      const text = getText(result);
      expect(text).toContain("Permission Request Created");
      expect(text).toContain("req-1");
    });

    it("should handle no active capability token", async () => {
      mockPrisma.agentCapabilityToken.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get(
        "capabilities_request_permissions",
      )!;
      const result = await handler({ reason: "test" });
      expect(getText(result)).toContain("No Capability Token");
    });

    it("should create permission request with categories and no tools", async () => {
      mockPrisma.agentCapabilityToken.findFirst.mockResolvedValue({
        id: "tok-1",
        agentId: "agent-1",
      });
      mockPrisma.permissionRequest.create.mockResolvedValue({
        id: "req-2",
      });
      const handler = registry.handlers.get(
        "capabilities_request_permissions",
      )!;
      const result = await handler({
        categories: ["image", "audio"],
        reason: "Need media tools",
      });
      const text = getText(result);
      expect(text).toContain("Permission Request Created");
      expect(text).toContain("Tools:** (none)");
      expect(text).toContain("image, audio");
    });
  });

  describe("capabilities_check_permissions", () => {
    it("should return token scope and budget for active token", async () => {
      mockPrisma.agentCapabilityToken.findFirst.mockResolvedValue({
        id: "tok-1",
        allowedTools: ["image_generate"],
        allowedCategories: ["gateway-meta", "image"],
        deniedTools: [],
        maxTokenBudget: 100000,
        usedTokenBudget: 5000,
        maxApiCalls: 1000,
        usedApiCalls: 42,
        delegationDepth: 0,
        maxDelegationDepth: 2,
        expiresAt: new Date("2026-12-31"),
        agent: { displayName: "Test Agent" },
      });
      mockPrisma.agentTrustScore.findFirst.mockResolvedValue({
        trustLevel: "BASIC",
        totalSuccessful: 50,
        totalFailed: 2,
      });
      const handler = registry.handlers.get("capabilities_check_permissions")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Current Capabilities");
      expect(text).toContain("Test Agent");
      expect(text).toContain("42/1000");
      expect(text).toContain("BASIC");
    });

    it("should handle no capability token", async () => {
      mockPrisma.agentCapabilityToken.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("capabilities_check_permissions")!;
      const result = await handler({});
      expect(getText(result)).toContain("No Capability Token");
    });

    it("should show denied tools when present", async () => {
      mockPrisma.agentCapabilityToken.findFirst.mockResolvedValue({
        id: "tok-1",
        allowedTools: [],
        allowedCategories: ["gateway-meta"],
        deniedTools: ["admin_delete_user", "admin_reset_db"],
        maxTokenBudget: 10000,
        usedTokenBudget: 0,
        maxApiCalls: 100,
        usedApiCalls: 0,
        delegationDepth: 0,
        maxDelegationDepth: 1,
        expiresAt: null,
        agent: { displayName: "Restricted Agent" },
      });
      mockPrisma.agentTrustScore.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("capabilities_check_permissions")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("admin_delete_user, admin_reset_db");
      expect(text).not.toContain("Denied Tools:** (none)");
    });

    it("should show (by category) when allowedTools is empty", async () => {
      mockPrisma.agentCapabilityToken.findFirst.mockResolvedValue({
        id: "tok-1",
        allowedTools: [],
        allowedCategories: ["gateway-meta"],
        deniedTools: [],
        maxTokenBudget: 10000,
        usedTokenBudget: 0,
        maxApiCalls: 100,
        usedApiCalls: 0,
        delegationDepth: 0,
        maxDelegationDepth: 1,
        expiresAt: null,
        agent: { displayName: "Cat Agent" },
      });
      mockPrisma.agentTrustScore.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("capabilities_check_permissions")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Allowed Tools:** (by category)");
    });

    it("should show SANDBOX for new agent without trust score", async () => {
      mockPrisma.agentCapabilityToken.findFirst.mockResolvedValue({
        id: "tok-1",
        allowedTools: [],
        allowedCategories: ["gateway-meta"],
        deniedTools: [],
        maxTokenBudget: 10000,
        usedTokenBudget: 0,
        maxApiCalls: 100,
        usedApiCalls: 0,
        delegationDepth: 0,
        maxDelegationDepth: 1,
        expiresAt: null,
        agent: { displayName: "New Agent" },
      });
      mockPrisma.agentTrustScore.findFirst.mockResolvedValue(null);
      const handler = registry.handlers.get("capabilities_check_permissions")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("SANDBOX");
      expect(text).toContain("New Agent");
      expect(text).toContain("Expires:** never");
    });
  });

  describe("capabilities_list_queued_actions", () => {
    it("should return pending requests", async () => {
      mockPrisma.permissionRequest.findMany.mockResolvedValue([{
        id: "req-1",
        requestType: "scope_expansion",
        requestPayload: {},
        status: "PENDING",
        fallbackBehavior: "QUEUE",
        denialReason: null,
        createdAt: new Date("2026-01-01"),
        agent: { displayName: "Agent A" },
      }]);
      const handler = registry.handlers.get(
        "capabilities_list_queued_actions",
      )!;
      const result = await handler({ status: "PENDING" });
      const text = getText(result);
      expect(text).toContain("Permission Requests");
      expect(text).toContain("req-1");
      expect(text).toContain("Agent A");
    });

    it("should handle empty list", async () => {
      mockPrisma.permissionRequest.findMany.mockResolvedValue([]);
      const handler = registry.handlers.get(
        "capabilities_list_queued_actions",
      )!;
      const result = await handler({ status: "PENDING" });
      expect(getText(result)).toContain("No PENDING Requests");
    });

    it("should include denial reason when present", async () => {
      mockPrisma.permissionRequest.findMany.mockResolvedValue([{
        id: "req-2",
        requestType: "scope_expansion",
        requestPayload: {},
        status: "DENIED",
        fallbackBehavior: "QUEUE",
        denialReason: "Too risky",
        createdAt: new Date("2026-01-02"),
        agent: { displayName: "Agent B" },
      }]);
      const handler = registry.handlers.get(
        "capabilities_list_queued_actions",
      )!;
      const result = await handler({ status: "DENIED" });
      const text = getText(result);
      expect(text).toContain("Too risky");
      expect(text).toContain("DENIED");
    });
  });
});
