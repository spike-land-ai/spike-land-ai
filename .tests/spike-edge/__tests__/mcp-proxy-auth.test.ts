import { describe, expect, it, vi } from "vitest";
import { buildMcpProxyHeaders } from "../../../src/edge-api/main/api/middleware/mcp-proxy-auth.js";
import type { Env } from "../../../src/edge-api/main/core-logic/env.js";

function makeEnv(): Env {
  return {
    MCP_INTERNAL_SECRET: "mcp-secret",
  } as Env;
}

describe("buildMcpProxyHeaders", () => {
  it("promotes a valid browser session into trusted MCP headers", async () => {
    const fetchAuth = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ session: {}, user: { id: "user-123" } }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );

    const headers = await buildMcpProxyHeaders(
      makeEnv(),
      new Request("https://spike.land/mcp", {
        method: "POST",
        headers: { cookie: "auth_session=abc" },
      }),
      {
        requestId: "req-1",
        fetchAuth,
      },
    );

    expect(fetchAuth).toHaveBeenCalledTimes(1);
    expect(headers.get("X-Internal-Secret")).toBe("mcp-secret");
    expect(headers.get("X-User-Id")).toBe("user-123");
    expect(headers.get("cookie")).toBeNull();
  });

  it("keeps bearer auth untouched and skips session lookup", async () => {
    const fetchAuth = vi.fn();

    const headers = await buildMcpProxyHeaders(
      makeEnv(),
      new Request("https://spike.land/mcp", {
        method: "POST",
        headers: {
          Authorization: "Bearer sk_test_123",
          cookie: "auth_session=abc",
        },
      }),
      {
        requestId: "req-2",
        fetchAuth,
      },
    );

    expect(fetchAuth).not.toHaveBeenCalled();
    expect(headers.get("authorization")).toBe("Bearer sk_test_123");
    expect(headers.get("X-Internal-Secret")).toBeNull();
    expect(headers.get("X-User-Id")).toBeNull();
    expect(headers.get("cookie")).toBeNull();
  });
});
