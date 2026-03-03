import { describe, expect, it } from "vitest";
import { createMockSession } from "./mock-session";
import { UserRole } from "../core/types";

describe("createMockSession", () => {
  it("returns default session when no options given", () => {
    const session = createMockSession();
    expect(session.user.id).toBe("test-user-id");
    expect(session.user.email).toBe("test@example.com");
    expect(session.user.name).toBe("Test User");
    expect(session.user.role).toBe(UserRole.USER);
    expect(session.user.image).toBeNull();
    expect(session.expires).toBeTruthy();
  });

  it("maps admin@example.com to admin user", () => {
    const session = createMockSession({ email: "admin@example.com" });
    expect(session.user.id).toBe("admin-user-id");
    expect(session.user.role).toBe(UserRole.ADMIN);
  });

  it("maps newuser@example.com to new user ID", () => {
    const session = createMockSession({ email: "newuser@example.com" });
    expect(session.user.id).toBe("new-user-id");
  });

  it("maps no-orders@example.com to new user ID", () => {
    const session = createMockSession({ email: "no-orders@example.com" });
    expect(session.user.id).toBe("new-user-id");
  });

  it("respects custom name", () => {
    const session = createMockSession({ name: "Custom Name" });
    expect(session.user.name).toBe("Custom Name");
  });

  it("validates role against UserRole enum", () => {
    const session = createMockSession({ role: "SUPER_ADMIN" });
    expect(session.user.role).toBe(UserRole.SUPER_ADMIN);
  });

  it("defaults to USER for invalid role", () => {
    const session = createMockSession({ role: "INVALID_ROLE" });
    expect(session.user.role).toBe(UserRole.USER);
  });

  it("sets expires to ~24h from now", () => {
    const session = createMockSession();
    const expires = new Date(session.expires).getTime();
    const now = Date.now();
    // Should be roughly 24 hours from now (within 5 seconds tolerance)
    expect(expires - now).toBeGreaterThan(23 * 60 * 60 * 1000);
    expect(expires - now).toBeLessThan(25 * 60 * 60 * 1000);
  });
});
