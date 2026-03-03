import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/auth", () => ({
  auth: vi.fn(),
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatch: vi.fn(),
}));

import { auth } from "@/lib/auth";
import { tryCatch } from "@/lib/try-catch";
import { requireAuth } from "./require-auth";

const mockAuth = vi.mocked(auth);
const mockTryCatch = vi.mocked(tryCatch);

describe("api/require-auth", () => {
  it("should return session and userId when authenticated", async () => {
    const session = { user: { id: "user-1", name: "Test", email: "t@t.com" } };
    mockTryCatch.mockResolvedValue({ data: session, error: null });

    const result = await requireAuth();

    expect(result).toEqual({
      session,
      userId: "user-1",
    });
    expect(mockTryCatch).toHaveBeenCalled();
  });

  it("should return 401 when session is null", async () => {
    mockTryCatch.mockResolvedValue({ data: null, error: null });

    const result = await requireAuth();

    // NextResponse check — should be a Response with 401 status
    expect(result).toHaveProperty("status", 401);
  });

  it("should return 401 when auth throws an error", async () => {
    mockTryCatch.mockResolvedValue({
      data: null,
      error: new Error("Auth failed"),
    });

    const result = await requireAuth();

    expect(result).toHaveProperty("status", 401);
  });

  it("should return 401 when session has no user id", async () => {
    mockTryCatch.mockResolvedValue({
      data: { user: { name: "Test" } },
      error: null,
    });

    const result = await requireAuth();

    expect(result).toHaveProperty("status", 401);
  });

  it("should pass auth() result to tryCatch", async () => {
    const authPromise = Promise.resolve({ user: { id: "u1" }, expires: "" }) as ReturnType<
      typeof auth
    >;
    mockAuth.mockReturnValue(authPromise);
    mockTryCatch.mockResolvedValue({
      data: { user: { id: "u1" }, expires: "" },
      error: null,
    });

    await requireAuth();

    expect(mockTryCatch).toHaveBeenCalledWith(authPromise);
  });
});
