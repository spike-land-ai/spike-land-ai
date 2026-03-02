import { describe, it, expect, vi, beforeEach } from "vitest";
import type { Env } from "./auth";

// --- Module-level mocks ---

// Capture registered tools for assertions
const registeredTools: Array<{
  name: string;
  description: string;
  schema: Record<string, unknown>;
  handler: (args: Record<string, unknown>) => Promise<unknown>;
}> = [];

const mockMcpConnect = vi.fn();
const mockHandleRequest = vi.fn(
  async (_req: Request) =>
    new Response(JSON.stringify({ result: "ok" }), {
      status: 200,
      headers: { "content-type": "application/json" },
    }),
);

vi.mock("@modelcontextprotocol/sdk/server/mcp.js", () => ({
  McpServer: vi.fn().mockImplementation(function () {
    return {
      tool: vi.fn(
        (
          name: string,
          description: string,
          schema: unknown,
          handler: (args: Record<string, unknown>) => Promise<unknown>,
        ) => {
          registeredTools.push({
            name,
            description,
            schema: schema as Record<string, unknown>,
            handler,
          });
        },
      ),
      connect: mockMcpConnect,
    };
  }),
}));

vi.mock("@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js", () => ({
  WebStandardStreamableHTTPServerTransport: vi.fn().mockImplementation(function () {
    return {
      handleRequest: mockHandleRequest,
    };
  }),
}));

// Mock drizzle — expose a setter so tests can override findFirst behavior
let mockFindFirst = vi.fn(async (..._args: any[]) => null as any);
vi.mock("drizzle-orm/d1", () => ({
  drizzle: vi.fn(() => ({
    query: {
      user: {
        findFirst: (...args: any[]) => mockFindFirst(...args),
      },
    },
  })),
}));

// Mock auth module
let mockGetSession = vi.fn(async (..._args: any[]) => null as any);
vi.mock("./auth", () => ({
  createAuth: vi.fn(() => ({
    handler: vi.fn(async (_req: Request) => new Response("auth response", { status: 200 })),
    api: {
      getSession: (...args: any[]) => mockGetSession(...args),
    },
  })),
}));

// Import worker after mocks are set up
import worker from "./index";

const makeEnv = (): Env => ({
  AUTH_DB: {} as D1Database,
  BETTER_AUTH_SECRET: "test-secret",
  APP_URL: "https://example.com",
});

const makeRequest = (method: string, path: string, headers?: Record<string, string>): Request =>
  new Request(`https://example.com${path}`, { method, headers });

describe("worker fetch handler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst = vi.fn(async (..._args: any[]) => null as any);
    mockGetSession = vi.fn(async (..._args: any[]) => null as any);
    registeredTools.length = 0;
  });

  describe("OPTIONS preflight", () => {
    it("returns 204 with CORS headers", async () => {
      const req = makeRequest("OPTIONS", "/mcp");
      const res = await worker.fetch(req, makeEnv());
      expect(res.status).toBe(204);
    });

    it("sets Access-Control-Allow-Origin: *", async () => {
      const req = makeRequest("OPTIONS", "/anything");
      const res = await worker.fetch(req, makeEnv());
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("sets Access-Control-Allow-Methods with GET, POST, DELETE, OPTIONS", async () => {
      const req = makeRequest("OPTIONS", "/mcp");
      const res = await worker.fetch(req, makeEnv());
      const methods = res.headers.get("Access-Control-Allow-Methods") ?? "";
      expect(methods).toContain("GET");
      expect(methods).toContain("POST");
      expect(methods).toContain("DELETE");
      expect(methods).toContain("OPTIONS");
    });

    it("sets Access-Control-Allow-Headers", async () => {
      const req = makeRequest("OPTIONS", "/mcp");
      const res = await worker.fetch(req, makeEnv());
      const allowHeaders = res.headers.get("Access-Control-Allow-Headers") ?? "";
      expect(allowHeaders).toContain("Content-Type");
      expect(allowHeaders).toContain("Authorization");
    });

    it("has null body", async () => {
      const req = makeRequest("OPTIONS", "/mcp");
      const res = await worker.fetch(req, makeEnv());
      expect(res.body).toBeNull();
    });
  });

  describe("/api/auth/* routes", () => {
    it("delegates to better-auth handler", async () => {
      const { createAuth } = await import("./auth");
      const req = makeRequest("GET", "/api/auth/session");
      const res = await worker.fetch(req, makeEnv());
      expect(createAuth).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("delegates /api/auth/sign-in/email to better-auth handler", async () => {
      const { createAuth } = await import("./auth");
      const req = makeRequest("POST", "/api/auth/sign-in/email");
      const res = await worker.fetch(req, makeEnv());
      expect(createAuth).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("does not route /api/auth-extra to better-auth (path mismatch)", async () => {
      const req = makeRequest("GET", "/api/auth-extra/test");
      const res = await worker.fetch(req, makeEnv());
      // not an auth route, not /mcp, so 404
      expect(res.status).toBe(404);
    });
  });

  describe("unknown routes", () => {
    it("returns 404 for unknown path", async () => {
      const req = makeRequest("GET", "/unknown");
      const res = await worker.fetch(req, makeEnv());
      expect(res.status).toBe(404);
    });

    it("returns 404 with CORS headers", async () => {
      const req = makeRequest("GET", "/unknown");
      const res = await worker.fetch(req, makeEnv());
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("returns 'Not found' body for unknown path", async () => {
      const req = makeRequest("GET", "/unknown");
      const res = await worker.fetch(req, makeEnv());
      expect(await res.text()).toBe("Not found");
    });
  });

  describe("/mcp endpoint", () => {
    it("calls transport.handleRequest and returns response", async () => {
      const req = makeRequest("POST", "/mcp");
      const res = await worker.fetch(req, makeEnv());
      expect(mockHandleRequest).toHaveBeenCalled();
      expect(res.status).toBe(200);
    });

    it("adds CORS headers to the MCP response", async () => {
      const req = makeRequest("POST", "/mcp");
      const res = await worker.fetch(req, makeEnv());
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
    });

    it("connects McpServer to transport before handling request", async () => {
      const req = makeRequest("POST", "/mcp");
      await worker.fetch(req, makeEnv());
      expect(mockMcpConnect).toHaveBeenCalled();
    });

    it("registers verify-session and get-user-by-email tools", async () => {
      const req = makeRequest("POST", "/mcp");
      await worker.fetch(req, makeEnv());
      const toolNames = registeredTools.map((t) => t.name);
      expect(toolNames).toContain("verify-session");
      expect(toolNames).toContain("get-user-by-email");
    });
  });

  describe("CORS header propagation (withCors)", () => {
    it("propagates original response headers alongside CORS headers", async () => {
      mockHandleRequest.mockResolvedValueOnce(
        new Response("body", {
          status: 201,
          headers: { "x-custom-header": "custom-value" },
        }),
      );
      const req = makeRequest("POST", "/mcp");
      const res = await worker.fetch(req, makeEnv());
      expect(res.headers.get("Access-Control-Allow-Origin")).toBe("*");
      expect(res.headers.get("x-custom-header")).toBe("custom-value");
      expect(res.status).toBe(201);
    });

    it("preserves response body after applying CORS", async () => {
      mockHandleRequest.mockResolvedValueOnce(new Response("hello world", { status: 200 }));
      const req = makeRequest("POST", "/mcp");
      const res = await worker.fetch(req, makeEnv());
      expect(await res.text()).toBe("hello world");
    });
  });
});

describe("MCP tool: verify-session", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools.length = 0;
    mockGetSession = vi.fn(async (..._args: any[]) => null as any);
  });

  async function getVerifySessionTool() {
    const req = makeRequest("POST", "/mcp");
    await worker.fetch(req, makeEnv());
    return registeredTools.find((t) => t.name === "verify-session");
  }

  it("returns valid:false when session is null", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const tool = await getVerifySessionTool();
    expect(tool).toBeDefined();
    const result = (await tool!.handler({ sessionToken: "invalid-token" })) as {
      content: Array<{ text: string }>;
    };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.valid).toBe(false);
  });

  it("returns valid:false when sessionResult has no session property", async () => {
    mockGetSession.mockResolvedValueOnce({ user: { id: "u1" } });
    const tool = await getVerifySessionTool();
    const result = (await tool!.handler({ sessionToken: "token" })) as {
      content: Array<{ text: string }>;
    };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.valid).toBe(false);
  });

  it("returns valid:true with user and session when session exists", async () => {
    mockGetSession.mockResolvedValueOnce({
      session: { id: "sess-1", token: "tok" },
      user: { id: "user-1", email: "test@example.com", name: "Test User" },
    });
    const tool = await getVerifySessionTool();
    const result = (await tool!.handler({ sessionToken: "valid-token" })) as {
      content: Array<{ text: string }>;
    };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.valid).toBe(true);
    expect(data.user.id).toBe("user-1");
    expect(data.user.email).toBe("test@example.com");
    expect(data.session.id).toBe("sess-1");
  });

  it("sets cookie header with the session token", async () => {
    mockGetSession.mockImplementationOnce(async ({ headers }: { headers: Headers }) => {
      const cookie = headers.get("cookie") ?? "";
      expect(cookie).toContain("better-auth.session_token=my-token");
      return { session: { id: "s1" }, user: { id: "u1" } };
    });
    const tool = await getVerifySessionTool();
    await tool!.handler({ sessionToken: "my-token" });
  });

  it("returns text content type in response", async () => {
    mockGetSession.mockResolvedValueOnce(null);
    const tool = await getVerifySessionTool();
    const result = (await tool!.handler({ sessionToken: "tok" })) as {
      content: Array<{ type: string }>;
    };
    expect(result.content[0]!.type).toBe("text");
  });
});

describe("MCP tool: get-user-by-email", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools.length = 0;
    mockFindFirst = vi.fn(async (..._args: any[]) => null as any);
  });

  async function getEmailTool() {
    const req = makeRequest("POST", "/mcp");
    await worker.fetch(req, makeEnv());
    return registeredTools.find((t) => t.name === "get-user-by-email");
  }

  it("returns found:false when user does not exist", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const tool = await getEmailTool();
    expect(tool).toBeDefined();
    const result = (await tool!.handler({ email: "notfound@example.com" })) as {
      content: Array<{ text: string }>;
    };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.found).toBe(false);
  });

  it("returns found:true with user fields when user exists", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "user-42",
      email: "alice@example.com",
      name: "Alice",
      role: "admin",
      image: "https://example.com/avatar.png",
    });
    const tool = await getEmailTool();
    const result = (await tool!.handler({ email: "alice@example.com" })) as {
      content: Array<{ text: string }>;
    };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.found).toBe(true);
    expect(data.user.id).toBe("user-42");
    expect(data.user.email).toBe("alice@example.com");
    expect(data.user.name).toBe("Alice");
    expect(data.user.role).toBe("admin");
  });

  it("only returns id, email, name, role — not image", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "u1",
      email: "bob@example.com",
      name: "Bob",
      role: "user",
      image: "https://secret-image.example.com/photo.jpg",
    });
    const tool = await getEmailTool();
    const result = (await tool!.handler({ email: "bob@example.com" })) as {
      content: Array<{ text: string }>;
    };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.user).not.toHaveProperty("image");
  });

  it("returns null role when user has no role set", async () => {
    mockFindFirst.mockResolvedValueOnce({
      id: "u2",
      email: "charlie@example.com",
      name: "Charlie",
      role: null,
    });
    const tool = await getEmailTool();
    const result = (await tool!.handler({ email: "charlie@example.com" })) as {
      content: Array<{ text: string }>;
    };
    const data = JSON.parse(result.content[0]!.text);
    expect(data.found).toBe(true);
    expect(data.user.role).toBeNull();
  });

  it("returns text content type", async () => {
    mockFindFirst.mockResolvedValueOnce(null);
    const tool = await getEmailTool();
    const result = (await tool!.handler({ email: "x@example.com" })) as {
      content: Array<{ type: string }>;
    };
    expect(result.content[0]!.type).toBe("text");
  });
});
