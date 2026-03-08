import { describe, it, expect, vi } from "vitest";
import { checkWorkspaceMembership, checkChannelAccess } from "../core-logic/permissions";
import type { Env } from "../core-logic/env";

describe("permissions", () => {
  it("checkWorkspaceMembership returns true for visitors", async () => {
    const result = await checkWorkspaceMembership({} as Env, "visitor-123", "ws-1");
    expect(result).toBe(true);
  });

  it("checkWorkspaceMembership returns false if MCP_SERVICE returns 404", async () => {
    const env = {
      MCP_SERVICE: {
        fetch: vi.fn().mockResolvedValue({ status: 404 }),
      },
    } as unknown as Env;

    const result = await checkWorkspaceMembership(env, "user-1", "ws-1");
    expect(result).toBe(false);
  });

  it("checkWorkspaceMembership returns res.ok otherwise", async () => {
    const env = {
      MCP_SERVICE: {
        fetch: vi.fn().mockResolvedValue({ status: 200, ok: true }),
      },
    } as unknown as Env;

    const result = await checkWorkspaceMembership(env, "user-1", "ws-1");
    expect(result).toBe(true);
  });

  it("checkWorkspaceMembership returns false on error", async () => {
    const env = {
      MCP_SERVICE: {
        fetch: vi.fn().mockRejectedValue(new Error("Network Error")),
      },
    } as unknown as Env;

    const result = await checkWorkspaceMembership(env, "user-1", "ws-1");
    expect(result).toBe(false);
  });

  it("checkChannelAccess returns true for now", async () => {
    const result = await checkChannelAccess({} as Env, "user-1", "chan-1");
    expect(result).toBe(true);
  });
});
