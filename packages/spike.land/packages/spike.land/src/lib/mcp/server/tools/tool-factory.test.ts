import { beforeEach, describe, expect, it, vi } from "vitest";

// ---- Prisma mock ----
const mockPrisma = {
  registeredTool: {
    count: vi.fn(),
    upsert: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
  },
  subscription: { findUnique: vi.fn() },
  vaultSecret: { findMany: vi.fn() },
};

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

// ---- Vault mock ----
const mockDecryptSecret = vi.fn();
vi.mock("../crypto/vault", () => ({ decryptSecret: mockDecryptSecret }));

// ---- Fetch mock ----
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { createMockRegistry, getText, isError } from "../__test-utils__";
import {
  registerToolFactoryTools,
  resolveTemplate,
  validateTemplate,
  validateUrl,
} from "./tool-factory";

describe("tool-factory", () => {
  const userId = "user-factory-1";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerToolFactoryTools(registry, userId);
  });

  // ── Registration ──────────────────────────────────────────

  it("should register 5 tool-factory tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("register_tool")).toBe(true);
    expect(registry.handlers.has("test_tool")).toBe(true);
    expect(registry.handlers.has("publish_tool")).toBe(true);
    expect(registry.handlers.has("list_registered_tools")).toBe(true);
    expect(registry.handlers.has("disable_tool")).toBe(true);
  });

  // ── Pure helpers ──────────────────────────────────────────

  describe("validateUrl", () => {
    it("should accept valid HTTPS URLs", () => {
      expect(validateUrl("https://api.example.com/v1")).toBeNull();
    });

    it("should reject HTTP URLs", () => {
      expect(validateUrl("http://api.example.com")).toBe("URL must use HTTPS");
    });

    it("should reject localhost", () => {
      expect(validateUrl("https://localhost:8080")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 127.x addresses", () => {
      expect(validateUrl("https://127.0.0.1/path")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 10.x private addresses", () => {
      expect(validateUrl("https://10.0.0.1")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 172.16-31.x private addresses", () => {
      expect(validateUrl("https://172.16.0.1")).toBe(
        "URL must not target private/internal addresses",
      );
      expect(validateUrl("https://172.31.255.1")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 192.168.x addresses", () => {
      expect(validateUrl("https://192.168.1.1")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject IPv6 loopback", () => {
      expect(validateUrl("https://[::1]/path")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject link-local addresses", () => {
      expect(validateUrl("https://169.254.169.254/latest/meta-data")).toBe(
        "URL must not target private/internal addresses",
      );
    });
  });

  describe("validateTemplate", () => {
    it("should accept strings without template variables", () => {
      expect(validateTemplate("just plain text")).toBeNull();
    });

    it("should accept valid secrets template vars", () => {
      expect(validateTemplate("Bearer {{secrets.API_KEY}}")).toBeNull();
    });

    it("should accept valid input template vars", () => {
      expect(validateTemplate("https://api.com/{{input.query}}")).toBeNull();
    });

    it("should reject invalid template vars", () => {
      const err = validateTemplate("{{env.PATH}}");
      expect(err).toContain("Invalid template variables");
      expect(err).toContain("{{env.PATH}}");
    });

    it("should reject mixed valid and invalid template vars", () => {
      const err = validateTemplate("{{secrets.KEY}} {{process.env}}");
      expect(err).toContain("Invalid template variables");
      expect(err).toContain("{{process.env}}");
    });
  });

  describe("resolveTemplate", () => {
    it("should replace input variables", () => {
      const result = resolveTemplate(
        "https://api.com/{{input.id}}/info",
        { id: "42" },
        {},
      );
      expect(result).toBe("https://api.com/42/info");
    });

    it("should replace secrets variables", () => {
      const result = resolveTemplate(
        "Bearer {{secrets.TOKEN}}",
        {},
        { TOKEN: "abc123" },
      );
      expect(result).toBe("Bearer abc123");
    });

    it("should leave unmatched variables intact", () => {
      const result = resolveTemplate(
        "{{input.missing}}",
        {},
        {},
      );
      expect(result).toBe("{{input.missing}}");
    });

    it("should handle multiple variables in one string", () => {
      const result = resolveTemplate(
        "https://{{input.host}}/{{input.path}}?key={{secrets.KEY}}",
        { host: "example.com", path: "v1" },
        { KEY: "secret" },
      );
      expect(result).toBe("https://example.com/v1?key=secret");
    });

    it("should convert non-string input values to string", () => {
      const result = resolveTemplate(
        "count={{input.n}}",
        { n: 99 },
        {},
      );
      expect(result).toBe("count=99");
    });
  });

  // ── register_tool handler ─────────────────────────────────

  describe("register_tool", () => {
    const validInput = {
      name: "my_tool",
      description: "A test tool",
      input_schema: {},
      handler_spec: {
        url: "https://api.example.com/v1",
        method: "POST",
        headers: {},
      },
    };

    it("should register a tool successfully", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.registeredTool.upsert.mockResolvedValue({
        id: "tool-1",
        name: "my_tool",
        status: "DRAFT",
      });

      const result = await registry.call("register_tool", validInput);
      const text = getText(result);
      expect(text).toContain("Tool Registered");
      expect(text).toContain("tool-1");
      expect(text).toContain("DRAFT");
      expect(isError(result)).toBe(false);
    });

    it("should reject when tool limit is reached (free tier)", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(5);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await registry.call("register_tool", validInput);
      const text = getText(result);
      expect(text).toContain("Tool limit reached");
      expect(text).toContain("5/5");
      expect(isError(result)).toBe(true);
    });

    it("should allow more tools for premium users", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(5);
      mockPrisma.subscription.findUnique.mockResolvedValue({ tier: "PRO" });
      mockPrisma.registeredTool.upsert.mockResolvedValue({
        id: "tool-6",
        name: "my_tool",
        status: "DRAFT",
      });

      const result = await registry.call("register_tool", validInput);
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Tool Registered");
    });

    it("should reject non-HTTPS URLs", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await registry.call("register_tool", {
        ...validInput,
        handler_spec: { ...validInput.handler_spec, url: "http://api.example.com" },
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Invalid handler URL");
    });

    it("should reject invalid template variables in handler spec", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await registry.call("register_tool", {
        ...validInput,
        handler_spec: {
          url: "https://api.example.com",
          method: "POST",
          headers: { Authorization: "{{env.SECRET}}" },
        },
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Template error");
    });

    it("should return error message on prisma failure", async () => {
      mockPrisma.registeredTool.count.mockRejectedValue(new Error("DB down"));

      const result = await registry.call("register_tool", validInput);
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Error registering tool");
      expect(getText(result)).toContain("DB down");
    });
  });

  // ── test_tool handler ─────────────────────────────────────

  describe("test_tool", () => {
    it("should return error when tool is not found", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue(null);

      const result = await registry.call("test_tool", {
        tool_id: "missing",
        test_input: {},
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Tool not found");
    });

    it("should execute HTTP request for a tool without secrets", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "test_api",
        handlerSpec: {
          url: "https://api.example.com/data",
          method: "GET",
          headers: {},
        },
      });
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve('{"result":"ok"}'),
      });

      const result = await registry.call("test_tool", {
        tool_id: "tool-1",
        test_input: {},
      });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Tool Test: test_api");
      expect(text).toContain("200 OK");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/data",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should resolve input templates in URL", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-2",
        name: "user_api",
        handlerSpec: {
          url: "https://api.example.com/users/{{input.user_id}}",
          method: "GET",
          headers: {},
        },
      });
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("user data"),
      });

      await registry.call("test_tool", {
        tool_id: "tool-2",
        test_input: { user_id: "abc" },
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/users/abc",
        expect.objectContaining({ method: "GET" }),
      );
    });

    it("should resolve secrets in headers", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-3",
        name: "auth_api",
        handlerSpec: {
          url: "https://api.example.com",
          method: "GET",
          headers: { Authorization: "Bearer {{secrets.API_KEY}}" },
        },
      });
      mockPrisma.vaultSecret.findMany.mockResolvedValue([
        { name: "API_KEY", encryptedValue: "enc", iv: "iv1", tag: "tag1" },
      ]);
      mockDecryptSecret.mockReturnValue("real-key-123");
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("ok"),
      });

      await registry.call("test_tool", {
        tool_id: "tool-3",
        test_input: {},
      });
      expect(mockDecryptSecret).toHaveBeenCalledWith(userId, "enc", "iv1", "tag1");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com",
        expect.objectContaining({
          headers: { Authorization: "Bearer real-key-123" },
        }),
      );
    });

    it("should return error for missing/unapproved secrets", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-4",
        name: "secret_api",
        handlerSpec: {
          url: "https://api.example.com",
          method: "GET",
          headers: { Authorization: "{{secrets.MISSING}}" },
        },
      });
      mockPrisma.vaultSecret.findMany.mockResolvedValue([]);

      const result = await registry.call("test_tool", {
        tool_id: "tool-4",
        test_input: {},
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Missing or unapproved secret: MISSING");
    });

    it("should reject resolved URL targeting private IPs (SSRF)", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-5",
        name: "ssrf_tool",
        handlerSpec: {
          url: "https://{{input.host}}/data",
          method: "GET",
          headers: {},
        },
      });

      const result = await registry.call("test_tool", {
        tool_id: "tool-5",
        test_input: { host: "127.0.0.1" },
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Resolved URL is invalid");
    });

    it("should apply json_path response transform", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-6",
        name: "json_api",
        handlerSpec: {
          url: "https://api.example.com/data",
          method: "GET",
          headers: {},
          responseTransform: { type: "json_path", path: "result.value" },
        },
      });
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () =>
          Promise.resolve(JSON.stringify({ result: { value: "hello" } })),
      });

      const result = await registry.call("test_tool", {
        tool_id: "tool-6",
        test_input: {},
      });
      const text = getText(result);
      expect(text).toContain("Transformed Result");
      expect(text).toContain('"hello"');
    });

    it("should handle fetch errors gracefully", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-7",
        name: "fail_api",
        handlerSpec: {
          url: "https://api.example.com",
          method: "GET",
          headers: {},
        },
      });
      mockFetch.mockRejectedValue(new Error("Network error"));

      const result = await registry.call("test_tool", {
        tool_id: "tool-7",
        test_input: {},
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Error testing tool");
      expect(getText(result)).toContain("Network error");
    });

    it("should resolve body templates", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-8",
        name: "body_api",
        handlerSpec: {
          url: "https://api.example.com",
          method: "POST",
          headers: {},
          body: '{"query":"{{input.q}}"}',
        },
      });
      mockFetch.mockResolvedValue({
        status: 200,
        statusText: "OK",
        text: () => Promise.resolve("ok"),
      });

      await registry.call("test_tool", {
        tool_id: "tool-8",
        test_input: { q: "test" },
      });
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com",
        expect.objectContaining({ body: '{"query":"test"}' }),
      );
    });
  });

  // ── publish_tool handler ──────────────────────────────────

  describe("publish_tool", () => {
    it("should publish a DRAFT tool", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_tool",
        status: "DRAFT",
      });
      mockPrisma.registeredTool.update.mockResolvedValue({});

      const result = await registry.call("publish_tool", { tool_id: "tool-1" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Tool Published");
      expect(getText(result)).toContain("my_tool");
      expect(mockPrisma.registeredTool.update).toHaveBeenCalledWith({
        where: { id: "tool-1" },
        data: { status: "PUBLISHED" },
      });
    });

    it("should reject if tool not found", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue(null);

      const result = await registry.call("publish_tool", { tool_id: "nope" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Tool not found");
    });

    it("should reject if tool is not in DRAFT status", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_tool",
        status: "PUBLISHED",
      });

      const result = await registry.call("publish_tool", { tool_id: "tool-1" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("PUBLISHED");
      expect(getText(result)).toContain("not DRAFT");
    });

    it("should handle errors gracefully", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue(
        new Error("DB error"),
      );

      const result = await registry.call("publish_tool", { tool_id: "x" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Error publishing tool");
    });
  });

  // ── list_registered_tools handler ─────────────────────────

  describe("list_registered_tools", () => {
    it("should return empty list message when no tools", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([]);
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await registry.call("list_registered_tools", {});
      const text = getText(result);
      expect(text).toContain("No tools registered");
      expect(text).toContain("0/5");
    });

    it("should list tools with details", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([
        {
          id: "t1",
          name: "my_tool",
          description: "Does stuff",
          status: "PUBLISHED",
          installCount: 10,
          createdAt: new Date("2025-06-01"),
        },
      ]);
      mockPrisma.registeredTool.count.mockResolvedValue(1);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const result = await registry.call("list_registered_tools", {});
      const text = getText(result);
      expect(text).toContain("my_tool");
      expect(text).toContain("PUBLISHED");
      expect(text).toContain("1/5");
      expect(text).toContain("Does stuff");
    });

    it("should show premium limit for premium users", async () => {
      mockPrisma.registeredTool.findMany.mockResolvedValue([]);
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue({ tier: "PRO" });

      const result = await registry.call("list_registered_tools", {});
      expect(getText(result)).toContain("0/500");
    });

    it("should handle errors gracefully", async () => {
      mockPrisma.registeredTool.findMany.mockRejectedValue(
        new Error("DB error"),
      );

      const result = await registry.call("list_registered_tools", {});
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Error listing tools");
    });
  });

  // ── disable_tool handler ──────────────────────────────────

  describe("disable_tool", () => {
    it("should disable an active tool", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_tool",
        status: "PUBLISHED",
      });
      mockPrisma.registeredTool.update.mockResolvedValue({});

      const result = await registry.call("disable_tool", { tool_id: "tool-1" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Tool Disabled");
      expect(getText(result)).toContain("my_tool");
    });

    it("should return message if tool is already disabled", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue({
        id: "tool-1",
        name: "my_tool",
        status: "DISABLED",
      });

      const result = await registry.call("disable_tool", { tool_id: "tool-1" });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("already disabled");
    });

    it("should return error if tool not found", async () => {
      mockPrisma.registeredTool.findFirst.mockResolvedValue(null);

      const result = await registry.call("disable_tool", { tool_id: "nope" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Tool not found");
    });

    it("should handle errors gracefully", async () => {
      mockPrisma.registeredTool.findFirst.mockRejectedValue(
        new Error("DB error"),
      );

      const result = await registry.call("disable_tool", { tool_id: "x" });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Error disabling tool");
    });
  });
});
