import { beforeEach, describe, expect, it, vi } from "vitest";
import { NextResponse } from "next/server";

// Mock getSession
vi.mock("./get-session", () => ({
  getSession: vi.fn(),
}));

import { requireAuth } from "./require-auth";
import { getSession } from "./get-session";

const mockGetSession = vi.mocked(getSession);

describe("requireAuth", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 401 NextResponse when session is null", async () => {
    mockGetSession.mockResolvedValue(null);
    const result = await requireAuth();
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("returns 401 when session has no user", async () => {
    mockGetSession.mockResolvedValue({
      expires: "2099-01-01",
      user: undefined as unknown as import("../core/types").AuthUser,
    });
    const result = await requireAuth();
    expect(result).toBeInstanceOf(NextResponse);
  });

  it("returns 401 when user has no id", async () => {
    mockGetSession.mockResolvedValue({
      expires: "2099-01-01",
      user: { id: "", name: "Alice", email: "alice@example.com", image: null, role: "USER" },
    });
    const result = await requireAuth();
    expect(result).toBeInstanceOf(NextResponse);
    const response = result as NextResponse;
    expect(response.status).toBe(401);
  });

  it("returns session and userId when authenticated", async () => {
    const fakeSession = {
      user: {
        id: "user_abc",
        name: "Alice",
        email: "alice@example.com",
        image: null,
        role: "USER" as const,
      },
      expires: "2099-01-01T00:00:00.000Z",
    };
    mockGetSession.mockResolvedValue(fakeSession);
    const result = await requireAuth();
    expect(result).not.toBeInstanceOf(NextResponse);
    const { session, userId } = result as { session: typeof fakeSession; userId: string; };
    expect(session).toEqual(fakeSession);
    expect(userId).toBe("user_abc");
  });

  it("returns userId equal to session.user.id", async () => {
    const fakeSession = {
      user: {
        id: "user_xyz789",
        name: "Bob",
        email: "bob@example.com",
        image: null,
        role: "ADMIN" as const,
      },
      expires: "2099-01-01T00:00:00.000Z",
    };
    mockGetSession.mockResolvedValue(fakeSession);
    const result = await requireAuth();
    const { userId } = result as { session: typeof fakeSession; userId: string; };
    expect(userId).toBe("user_xyz789");
  });
});
