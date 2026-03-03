import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  user: { findUnique: vi.fn() },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { permissionGatedHandler } from "./permission-gated";

function getText(result: unknown): string {
  return (result as { content: Array<{ text: string; }>; }).content[0]!.text;
}

describe("permissionGatedHandler", () => {
  const userId = "user-123";
  const toolName = "admin_delete_user";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should call inner handler when user has required ADMIN role", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    const innerHandler = vi.fn(async (_input: { targetId: string; }) => ({
      content: [{ type: "text" as const, text: "Deleted user successfully" }],
    }));

    const handler = permissionGatedHandler(
      toolName,
      userId,
      "ADMIN",
      innerHandler,
    );

    const result = await handler({ targetId: "target-456" });

    expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: userId },
      select: { role: true },
    });
    expect(innerHandler).toHaveBeenCalledWith({ targetId: "target-456" });
    expect(getText(result)).toBe("Deleted user successfully");
  });

  it("should allow ADMIN to access USER-required tools", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "Success" }],
    }));

    const handler = permissionGatedHandler(
      "user_tool",
      userId,
      "USER",
      innerHandler,
    );

    const result = await handler({});

    expect(innerHandler).toHaveBeenCalled();
    expect(getText(result)).toBe("Success");
  });

  it("should deny access when USER tries to use ADMIN tool", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "Should not reach" }],
    }));

    const handler = permissionGatedHandler(
      toolName,
      userId,
      "ADMIN",
      innerHandler,
    );

    const result = await handler({});

    expect(innerHandler).not.toHaveBeenCalled();
    expect(getText(result)).toContain("PERMISSION_DENIED");
    expect(getText(result)).toContain("ADMIN");
    expect(getText(result)).toContain("USER");
    expect(getText(result)).toContain("Retryable:** false");
  });

  it("should return NOT_FOUND error when user does not exist", async () => {
    mockPrisma.user.findUnique.mockResolvedValue(null);

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "Should not reach" }],
    }));

    const handler = permissionGatedHandler(
      toolName,
      userId,
      "ADMIN",
      innerHandler,
    );

    const result = await handler({});

    expect(innerHandler).not.toHaveBeenCalled();
    expect(getText(result)).toContain("NOT_FOUND");
    expect(getText(result)).toContain("User not found");
    expect(getText(result)).toContain("Retryable:** false");
  });

  it("should allow USER to access USER-required tools", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "User access granted" }],
    }));

    const handler = permissionGatedHandler(
      "user_view_profile",
      userId,
      "USER",
      innerHandler,
    );

    const result = await handler({});

    expect(innerHandler).toHaveBeenCalled();
    expect(getText(result)).toBe("User access granted");
  });

  it("should treat unknown role as level 0 (same as USER)", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "UNKNOWN_ROLE" });

    const innerHandler = vi.fn(async () => ({
      content: [{ type: "text" as const, text: "ok" }],
    }));

    const handler = permissionGatedHandler(
      toolName,
      userId,
      "ADMIN",
      innerHandler,
    );

    const result = await handler({});

    expect(innerHandler).not.toHaveBeenCalled();
    expect(getText(result)).toContain("PERMISSION_DENIED");
  });

  it("should pass through the input to the inner handler", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    const innerHandler = vi.fn(async (
      input: { id: string; action: string; },
    ) => ({
      content: [{
        type: "text" as const,
        text: `${input.action}: ${input.id}`,
      }],
    }));

    const handler = permissionGatedHandler(
      toolName,
      userId,
      "ADMIN",
      innerHandler,
    );

    await handler({ id: "abc", action: "delete" });

    expect(innerHandler).toHaveBeenCalledWith({ id: "abc", action: "delete" });
  });

  it("should return a function that can be called multiple times", async () => {
    mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });

    let callCount = 0;
    const innerHandler = vi.fn(async () => {
      callCount++;
      return {
        content: [{ type: "text" as const, text: `call ${callCount}` }],
      };
    });

    const handler = permissionGatedHandler(
      toolName,
      userId,
      "ADMIN",
      innerHandler,
    );

    const result1 = await handler({});
    const result2 = await handler({});

    expect(getText(result1)).toBe("call 1");
    expect(getText(result2)).toBe("call 2");
    expect(innerHandler).toHaveBeenCalledTimes(2);
  });
});
