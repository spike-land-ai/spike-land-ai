import { describe, expect, it } from "vitest";
import { UserRole } from "./types";
import type { AuthSession, AuthUser } from "./types";

describe("UserRole", () => {
  it("has the expected values", () => {
    expect(UserRole.USER).toBe("USER");
    expect(UserRole.ADMIN).toBe("ADMIN");
    expect(UserRole.SUPER_ADMIN).toBe("SUPER_ADMIN");
  });

  it("has exactly 3 roles", () => {
    expect(Object.keys(UserRole)).toHaveLength(3);
  });
});

describe("AuthUser type", () => {
  it("accepts a valid user object", () => {
    const user: AuthUser = {
      id: "user_abc123",
      name: "Test User",
      email: "test@example.com",
      image: "https://example.com/avatar.jpg",
      role: UserRole.USER,
    };
    expect(user.id).toBe("user_abc123");
    expect(user.role).toBe("USER");
  });

  it("accepts nullable name, email, image", () => {
    const user: AuthUser = {
      id: "user_abc123",
      name: null,
      email: null,
      image: null,
      role: UserRole.ADMIN,
    };
    expect(user.name).toBeNull();
  });
});

describe("AuthSession type", () => {
  it("accepts a valid session object", () => {
    const session: AuthSession = {
      user: {
        id: "user_abc123",
        name: "Test",
        email: "test@example.com",
        image: null,
        role: UserRole.USER,
      },
      expires: new Date().toISOString(),
    };
    expect(session.user.id).toBe("user_abc123");
    expect(session.expires).toBeTruthy();
  });
});
