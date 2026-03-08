import { describe, it, expect, vi } from "vitest";
import { authMiddleware } from "../api/middleware";
import { Context } from "hono";

describe("authMiddleware", () => {
  it("returns 401 if no auth header or cookie", async () => {
    const c = {
      req: {
        header: vi.fn().mockReturnValue(null),
      },
      json: vi.fn().mockReturnValue(new Response()),
      set: vi.fn(),
    } as unknown as Context;
    const next = vi.fn();

    await authMiddleware(c as any, next);
    expect(c.json).toHaveBeenCalledWith({ error: "Authentication required" }, 401);
  });

  it("handles guest access", async () => {
    const c = {
      req: {
        header: (name: string) => name === "x-guest-access" ? "true" : null,
      },
      json: vi.fn(),
      set: vi.fn(),
    } as unknown as Context;
    const next = vi.fn();

    await authMiddleware(c as any, next);
    expect(c.set).toHaveBeenCalledWith("isGuest", true);
    expect(c.set).toHaveBeenCalledWith("userId", expect.stringMatching(/^visitor-/));
    expect(next).toHaveBeenCalled();
  });

  it("validates session via AUTH_MCP", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ session: {}, user: { id: "user-1" } }),
    });
    const c = {
      req: {
        header: (name: string) => name === "cookie" ? "session=123" : null,
      },
      env: {
        AUTH_MCP: { fetch: mockFetch },
      },
      set: vi.fn(),
    } as unknown as Context;
    const next = vi.fn();

    await authMiddleware(c as any, next);
    expect(mockFetch).toHaveBeenCalled();
    expect(c.set).toHaveBeenCalledWith("userId", "user-1");
    expect(c.set).toHaveBeenCalledWith("isGuest", false);
    expect(next).toHaveBeenCalled();
  });

  it("validates session via AUTH_MCP with authHeader", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ session: {}, user: { id: "user-1" } }),
    });
    const c = {
      req: {
        header: (name: string) => name === "authorization" ? "Bearer 123" : null,
      },
      env: {
        AUTH_MCP: { fetch: mockFetch },
      },
      set: vi.fn(),
    } as unknown as Context;
    const next = vi.fn();

    await authMiddleware(c as any, next);
    expect(mockFetch).toHaveBeenCalled();
    expect(c.set).toHaveBeenCalledWith("userId", "user-1");
  });

  it("returns 401 if AUTH_MCP returns !ok", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: false,
    });
    const c = {
      req: {
        header: (name: string) => name === "cookie" ? "session=123" : null,
      },
      env: {
        AUTH_MCP: { fetch: mockFetch },
      },
      json: vi.fn().mockReturnValue(new Response()),
      set: vi.fn(),
    } as unknown as Context;
    const next = vi.fn();

    await authMiddleware(c as any, next);
    expect(c.json).toHaveBeenCalledWith({ error: "Invalid or expired session" }, 401);
  });

  it("returns 401 if AUTH_MCP session format is invalid", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ }),
    });
    const c = {
      req: {
        header: (name: string) => name === "cookie" ? "session=123" : null,
      },
      env: {
        AUTH_MCP: { fetch: mockFetch },
      },
      json: vi.fn().mockReturnValue(new Response()),
      set: vi.fn(),
    } as unknown as Context;
    const next = vi.fn();

    await authMiddleware(c as any, next);
    expect(c.json).toHaveBeenCalledWith({ error: "Invalid or expired session" }, 401);
  });

  it("falls back to fetch if AUTH_MCP fetch throws", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ session: {}, user: { id: "user-2" } }),
    }) as any;

    const mockFetch = vi.fn().mockRejectedValue(new Error("Binding missing"));
    const c = {
      req: {
        header: (name: string) => name === "cookie" ? "session=123" : null,
      },
      env: {
        AUTH_MCP: { fetch: mockFetch },
      },
      set: vi.fn(),
    } as unknown as Context;
    const next = vi.fn();

    await authMiddleware(c as any, next);
    expect(global.fetch).toHaveBeenCalled();
    expect(c.set).toHaveBeenCalledWith("userId", "user-2");
    expect(next).toHaveBeenCalled();
  });

  it("falls back to fetch if AUTH_MCP fetch returns 503", async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ session: {}, user: { id: "user-2" } }),
    }) as any;

    const mockFetch = vi.fn().mockResolvedValue({
        status: 503
    });
    const c = {
      req: {
        header: (name: string) => name === "cookie" ? "session=123" : null,
      },
      env: {
        AUTH_MCP: { fetch: mockFetch },
      },
      set: vi.fn(),
    } as unknown as Context;
    const next = vi.fn();

    await authMiddleware(c as any, next);
    expect(global.fetch).toHaveBeenCalled();
    expect(c.set).toHaveBeenCalledWith("userId", "user-2");
    expect(next).toHaveBeenCalled();
  });
});
