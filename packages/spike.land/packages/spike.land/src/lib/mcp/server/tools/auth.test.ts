import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = {
  user: { findUnique: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAuthTools } from "./auth";

describe("auth tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAuthTools(registry, userId);
  });

  it("should register 3 auth tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.handlers.has("auth_check_session")).toBe(true);
    expect(registry.handlers.has("auth_check_route_access")).toBe(true);
    expect(registry.handlers.has("auth_get_profile")).toBe(true);
  });

  describe("auth_check_session", () => {
    it("should return valid session for existing user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: "Alice",
        email: "alice@test.com",
        role: "USER",
        createdAt: new Date("2025-01-01"),
      });
      const handler = registry.handlers.get("auth_check_session")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Session Valid");
      expect(text).toContain("Alice");
      expect(text).toContain("alice@test.com");
    });

    it("should fall back to 'unnamed' when user name is null", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: null,
        email: "anon@test.com",
        role: "USER",
        createdAt: new Date("2025-01-01"),
      });
      const handler = registry.handlers.get("auth_check_session")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Session Valid");
      expect(text).toContain("User:** unnamed");
    });

    it("should return NOT_FOUND for missing user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("auth_check_session")!;
      const result = await handler({});
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });

  describe("auth_check_route_access", () => {
    it("should grant access to non-admin route", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("auth_check_route_access")!;
      const result = await handler({ path: "/dashboard" });
      expect(getText(result)).toContain("Access:** GRANTED");
    });

    it("should deny admin route for non-admin user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "USER" });
      const handler = registry.handlers.get("auth_check_route_access")!;
      const result = await handler({ path: "/admin/agents" });
      expect(getText(result)).toContain("Access:** DENIED");
    });

    it("should grant admin route for admin user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({ role: "ADMIN" });
      const handler = registry.handlers.get("auth_check_route_access")!;
      const result = await handler({ path: "/admin" });
      expect(getText(result)).toContain("Access:** GRANTED");
    });

    it("should deny access for unauthenticated user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("auth_check_route_access")!;
      const result = await handler({ path: "/dashboard" });
      expect(getText(result)).toContain("Access: DENIED");
    });
  });

  describe("auth_get_profile", () => {
    it("should return user profile", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: "Bob",
        email: "bob@test.com",
        role: "USER",
        image: "https://avatar.url",
        createdAt: new Date("2025-01-01"),
      });
      const handler = registry.handlers.get("auth_get_profile")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("User Profile");
      expect(text).toContain("Bob");
      expect(text).toContain("bob@test.com");
    });

    it("should include workspaces when requested", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: "Bob",
        email: "bob@test.com",
        role: "USER",
        image: null,
        createdAt: new Date("2025-01-01"),
        workspaceMembers: [{
          workspace: { name: "My Workspace", slug: "my-ws" },
          role: "OWNER",
        }],
      });
      const handler = registry.handlers.get("auth_get_profile")!;
      const result = await handler({ include_workspaces: true });
      const text = getText(result);
      expect(text).toContain("Workspaces");
      expect(text).toContain("My Workspace");
    });

    it("should show 'unnamed' and '(none)' for null name and image", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: null,
        email: "anon@test.com",
        role: "USER",
        image: null,
        createdAt: new Date("2025-01-01"),
      });
      const handler = registry.handlers.get("auth_get_profile")!;
      const result = await handler({});
      const text = getText(result);
      expect(text).toContain("Name:** unnamed");
      expect(text).toContain("Avatar:** (none)");
    });

    it("should not show Workspaces section when members array is empty", async () => {
      mockPrisma.user.findUnique.mockResolvedValue({
        id: userId,
        name: "Bob",
        email: "bob@test.com",
        role: "USER",
        image: null,
        createdAt: new Date("2025-01-01"),
        workspaceMembers: [],
      });
      const handler = registry.handlers.get("auth_get_profile")!;
      const result = await handler({ include_workspaces: true });
      const text = getText(result);
      expect(text).toContain("User Profile");
      expect(text).not.toContain("Workspaces:");
    });

    it("should return NOT_FOUND for missing user", async () => {
      mockPrisma.user.findUnique.mockResolvedValue(null);
      const handler = registry.handlers.get("auth_get_profile")!;
      const result = await handler({});
      expect(getText(result)).toContain("NOT_FOUND");
    });
  });
});
