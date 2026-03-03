import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  agentCapabilityToken: { findUnique: vi.fn() },
  permissionRequest: { create: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import {
  createPermissionRequest,
  evaluateCapability,
} from "./capability-evaluator";

describe("capability evaluator", () => {
  beforeEach(() => vi.clearAllMocks());

  const baseToken = {
    status: "ACTIVE",
    expiresAt: new Date(Date.now() + 86400000),
    allowedTools: ["image_generate", "image_enhance"],
    allowedCategories: ["gateway-meta"],
    deniedTools: ["admin_delete_user"],
    usedApiCalls: 0,
    maxApiCalls: 1000,
    usedTokenBudget: 0,
    maxTokenBudget: 100000,
  };

  it("should allow when tool is in allowedTools", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(baseToken);
    const result = await evaluateCapability(
      "token-1",
      "image_generate",
      "image",
    );
    expect(result.allowed).toBe(true);
    expect(result.reason).toBeUndefined();
  });

  it("should allow when category is in allowedCategories", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(baseToken);
    const result = await evaluateCapability(
      "token-1",
      "search_tools",
      "gateway-meta",
    );
    expect(result.allowed).toBe(true);
  });

  it("should deny when tool is in deniedTools", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(baseToken);
    const result = await evaluateCapability(
      "token-1",
      "admin_delete_user",
      "admin",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("explicitly denied");
    expect(result.action).toBe("deny");
  });

  it("should deny even if tool is in both deniedTools and allowedTools", async () => {
    const tokenWithConflict = {
      ...baseToken,
      allowedTools: ["admin_delete_user", "image_generate"],
      deniedTools: ["admin_delete_user"],
    };
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(
      tokenWithConflict,
    );
    const result = await evaluateCapability(
      "token-1",
      "admin_delete_user",
      "admin",
    );
    expect(result.allowed).toBe(false);
    expect(result.action).toBe("deny");
  });

  it("should return request_permission for uncovered tools", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(baseToken);
    const result = await evaluateCapability(
      "token-1",
      "vault_store_secret",
      "vault",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not in allowed scope");
    expect(result.action).toBe("request_permission");
  });

  it("should deny when token status is REVOKED", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
      ...baseToken,
      status: "REVOKED",
    });
    const result = await evaluateCapability(
      "token-1",
      "image_generate",
      "image",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("REVOKED");
    expect(result.action).toBe("deny");
  });

  it("should deny when token is expired", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
      ...baseToken,
      expiresAt: new Date(Date.now() - 1000),
    });
    const result = await evaluateCapability(
      "token-1",
      "image_generate",
      "image",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("expired");
    expect(result.action).toBe("deny");
  });

  it("should deny when API call budget is exceeded", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
      ...baseToken,
      usedApiCalls: 1000,
      maxApiCalls: 1000,
    });
    const result = await evaluateCapability(
      "token-1",
      "image_generate",
      "image",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("API call budget exceeded");
    expect(result.action).toBe("deny");
  });

  it("should deny when token budget is exceeded", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
      ...baseToken,
      usedTokenBudget: 100000,
      maxTokenBudget: 100000,
    });
    const result = await evaluateCapability(
      "token-1",
      "image_generate",
      "image",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("Token budget exceeded");
    expect(result.action).toBe("deny");
  });

  it("should deny when token does not exist", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue(null);
    const result = await evaluateCapability(
      "nonexistent",
      "image_generate",
      "image",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("not found");
    expect(result.action).toBe("deny");
  });

  it("should allow when expiresAt is null (no expiry)", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
      ...baseToken,
      expiresAt: null,
    });
    const result = await evaluateCapability(
      "token-1",
      "image_generate",
      "image",
    );
    expect(result.allowed).toBe(true);
  });

  it("should deny when status is EXPIRED", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
      ...baseToken,
      status: "EXPIRED",
    });
    const result = await evaluateCapability(
      "token-1",
      "image_generate",
      "image",
    );
    expect(result.allowed).toBe(false);
    expect(result.reason).toContain("EXPIRED");
    expect(result.action).toBe("deny");
  });

  it("should handle allowedCategories being null in evaluateCapability", async () => {
    mockPrisma.agentCapabilityToken.findUnique.mockResolvedValue({
      ...baseToken,
      allowedCategories: null,
    });
    const result = await evaluateCapability(
      "token-1",
      "any_tool",
      "any_category",
    );
    expect(result.allowed).toBe(false);
  });
});

describe("createPermissionRequest", () => {
  beforeEach(() => vi.clearAllMocks());

  it("should handle empty or null input in createPermissionRequest", async () => {
    mockPrisma.permissionRequest.create.mockResolvedValue({ id: "req-empty" });
    await createPermissionRequest(
      "agent-1",
      "user-1",
      "tool",
      "cat",
      null as any,
      "QUEUE",
    );
    expect(mockPrisma.permissionRequest.create).toHaveBeenCalled();
  });

  it("should create a permission request and return its id", async () => {
    mockPrisma.permissionRequest.create.mockResolvedValue({ id: "req-123" });

    const id = await createPermissionRequest(
      "agent-1",
      "user-1",
      "vault_store_secret",
      "vault",
      { name: "my-secret", value: "hello" },
      "QUEUE",
    );

    expect(id).toBe("req-123");
    expect(mockPrisma.permissionRequest.create).toHaveBeenCalledTimes(1);

    const callData = mockPrisma.permissionRequest.create.mock.calls[0]![0].data;
    expect(callData.agentId).toBe("agent-1");
    expect(callData.userId).toBe("user-1");
    expect(callData.requestType).toBe("tool_access");
    expect(callData.fallbackBehavior).toBe("QUEUE");
    expect(callData.requestPayload).toEqual({
      toolName: "vault_store_secret",
      toolCategory: "vault",
      input: { name: "my-secret", value: "hello" },
    });
  });

  it("should redact sensitive fields in the input", async () => {
    mockPrisma.permissionRequest.create.mockResolvedValue({ id: "req-456" });

    await createPermissionRequest(
      "agent-1",
      "user-1",
      "some_tool",
      "some_category",
      {
        name: "test",
        password: "super-secret",
        apiKey: "sk-123",
        normalField: "visible",
      },
      "FAIL",
    );

    const callData = mockPrisma.permissionRequest.create.mock.calls[0]![0].data;
    const payload = callData.requestPayload as {
      input: Record<string, unknown>;
    };
    expect(payload.input.password).toBe("[REDACTED]");
    expect(payload.input.apiKey).toBe("[REDACTED]");
    expect(payload.input.normalField).toBe("visible");
    expect(payload.input.name).toBe("test");
  });

  it("should set 24h expiry on the request", async () => {
    mockPrisma.permissionRequest.create.mockResolvedValue({ id: "req-789" });

    const before = Date.now();
    await createPermissionRequest(
      "agent-1",
      "user-1",
      "tool",
      "cat",
      {},
      "SKIP",
    );
    const after = Date.now();

    const callData = mockPrisma.permissionRequest.create.mock.calls[0]![0].data;
    const expiresAt = callData.expiresAt as Date;
    const expectedMin = before + 24 * 60 * 60 * 1000;
    const expectedMax = after + 24 * 60 * 60 * 1000;
    expect(expiresAt.getTime()).toBeGreaterThanOrEqual(expectedMin);
    expect(expiresAt.getTime()).toBeLessThanOrEqual(expectedMax);
  });
});
