import { beforeEach, describe, expect, it, vi } from "vitest";
import { renderHook } from "@testing-library/react";

// Use vi.hoisted so mock fn is available inside vi.mock factory
const { mockUseNextAuthSession } = vi.hoisted(() => ({
  mockUseNextAuthSession: vi.fn(),
}));

vi.mock("next-auth/react", () => ({
  useSession: mockUseNextAuthSession,
}));

import { useSession } from "./hooks";
import { UserRole } from "../core/types";

describe("useSession hook", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns unauthenticated state when next-auth returns null data", () => {
    mockUseNextAuthSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: vi.fn(),
    });
    const { result } = renderHook(() => useSession());
    expect(result.current.data).toBeNull();
    expect(result.current.status).toBe("unauthenticated");
  });

  it("returns loading state", () => {
    mockUseNextAuthSession.mockReturnValue({
      data: null,
      status: "loading",
      update: vi.fn(),
    });
    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe("loading");
    expect(result.current.data).toBeNull();
  });

  it("returns session data when authenticated", () => {
    const fakeSession = {
      user: {
        id: "user_abc",
        name: "Alice",
        email: "alice@example.com",
        image: null,
        role: UserRole.USER,
      },
      expires: "2099-01-01T00:00:00.000Z",
    };
    mockUseNextAuthSession.mockReturnValue({
      data: fakeSession,
      status: "authenticated",
      update: vi.fn(),
    });
    const { result } = renderHook(() => useSession());
    expect(result.current.status).toBe("authenticated");
    expect(result.current.data).toEqual(fakeSession);
    expect(result.current.data?.user.email).toBe("alice@example.com");
  });

  it("returns update function from next-auth", () => {
    const mockUpdate = vi.fn().mockResolvedValue(null);
    mockUseNextAuthSession.mockReturnValue({
      data: null,
      status: "unauthenticated",
      update: mockUpdate,
    });
    const { result } = renderHook(() => useSession());
    expect(result.current.update).toBe(mockUpdate);
  });

  it("returns admin role session correctly", () => {
    const adminSession = {
      user: {
        id: "admin_id",
        name: "Admin User",
        email: "admin@example.com",
        image: "https://example.com/avatar.jpg",
        role: UserRole.ADMIN,
      },
      expires: "2099-01-01T00:00:00.000Z",
    };
    mockUseNextAuthSession.mockReturnValue({
      data: adminSession,
      status: "authenticated",
      update: vi.fn(),
    });
    const { result } = renderHook(() => useSession());
    expect(result.current.data?.user.role).toBe(UserRole.ADMIN);
  });
});
