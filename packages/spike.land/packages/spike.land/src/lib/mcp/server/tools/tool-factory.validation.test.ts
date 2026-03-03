import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  registeredTool: {
    count: vi.fn(),
    findFirst: vi.fn(),
    findMany: vi.fn(),
    upsert: vi.fn(),
    update: vi.fn(),
  },
  subscription: {
    findUnique: vi.fn(),
  },
  vaultSecret: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

// Mock crypto
const mockDecryptSecret = vi.fn();
vi.mock("../crypto/vault", () => ({
  decryptSecret: (...args: unknown[]) => mockDecryptSecret(...args),
}));

// Mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { createMockRegistry } from "../__test-utils__";
import {
  registerToolFactoryTools,
  resolveTemplate,
  validateTemplate,
  validateUrl,
} from "./tool-factory";

describe("tool factory - validation & registration", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerToolFactoryTools(registry, userId);
  });

  it("should register 5 tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("register_tool")).toBe(true);
    expect(registry.handlers.has("test_tool")).toBe(true);
    expect(registry.handlers.has("publish_tool")).toBe(true);
    expect(registry.handlers.has("list_registered_tools")).toBe(true);
    expect(registry.handlers.has("disable_tool")).toBe(true);
  });

  // ============================================================
  // Pure function tests
  // ============================================================

  describe("validateUrl", () => {
    it("should return null for valid HTTPS URLs", () => {
      expect(validateUrl("https://api.example.com/v1/data")).toBeNull();
      expect(validateUrl("https://hooks.slack.com/services/T00/B00/xxx"))
        .toBeNull();
    });

    it("should reject non-HTTPS URLs", () => {
      expect(validateUrl("http://api.example.com")).toBe("URL must use HTTPS");
      expect(validateUrl("ftp://files.example.com")).toBe("URL must use HTTPS");
      expect(validateUrl("ws://stream.example.com")).toBe("URL must use HTTPS");
    });

    it("should reject localhost URLs (SSRF prevention)", () => {
      expect(validateUrl("https://localhost/api")).toBe(
        "URL must not target private/internal addresses",
      );
      expect(validateUrl("https://localhost:8080/api")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 127.x.x.x addresses", () => {
      expect(validateUrl("https://127.0.0.1/api")).toBe(
        "URL must not target private/internal addresses",
      );
      expect(validateUrl("https://127.255.255.255/api")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 0.x.x.x addresses", () => {
      expect(validateUrl("https://0.0.0.0/api")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 10.x.x.x private addresses", () => {
      expect(validateUrl("https://10.0.0.1/api")).toBe(
        "URL must not target private/internal addresses",
      );
      expect(validateUrl("https://10.255.255.255/api")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 172.16-31.x.x private addresses", () => {
      expect(validateUrl("https://172.16.0.1/api")).toBe(
        "URL must not target private/internal addresses",
      );
      expect(validateUrl("https://172.31.255.255/api")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 192.168.x.x private addresses", () => {
      expect(validateUrl("https://192.168.0.1/api")).toBe(
        "URL must not target private/internal addresses",
      );
      expect(validateUrl("https://192.168.1.100/api")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject IPv6 loopback [::1]", () => {
      expect(validateUrl("https://[::1]/api")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject IPv6 link-local [fe80:]", () => {
      expect(validateUrl("https://[fe80::1]/api")).toBe(
        "URL must not target private/internal addresses",
      );
    });

    it("should reject 169.254.x.x link-local addresses", () => {
      expect(validateUrl("https://169.254.1.1/api")).toBe(
        "URL must not target private/internal addresses",
      );
    });
  });

  describe("validateTemplate", () => {
    it("should return null for templates with valid variables", () => {
      expect(validateTemplate("Bearer {{secrets.API_KEY}}")).toBeNull();
      expect(validateTemplate("https://api.example.com/{{input.path}}"))
        .toBeNull();
      expect(
        validateTemplate("{{secrets.TOKEN}} and {{input.query}}"),
      ).toBeNull();
    });

    it("should return null for strings with no template variables", () => {
      expect(validateTemplate("plain text with no variables")).toBeNull();
      expect(validateTemplate("https://api.example.com/v1")).toBeNull();
    });

    it("should reject invalid template variable namespaces", () => {
      const result = validateTemplate("{{env.SECRET}}");
      expect(result).toContain("Invalid template variables");
      expect(result).toContain("{{env.SECRET}}");
    });

    it("should reject template variables with invalid syntax", () => {
      const result = validateTemplate("{{process.env.SECRET}}");
      expect(result).toContain("Invalid template variables");
    });

    it("should reject template injection attempts", () => {
      const result = validateTemplate("{{constructor.prototype}}");
      expect(result).toContain("Invalid template variables");
    });

    it("should reject mixed valid and invalid variables", () => {
      const result = validateTemplate(
        "{{secrets.KEY}} and {{__proto__.polluted}}",
      );
      expect(result).toContain("Invalid template variables");
      expect(result).toContain("{{__proto__.polluted}}");
    });

    it("should reject variables starting with numbers", () => {
      const result = validateTemplate("{{secrets.1KEY}}");
      expect(result).toContain("Invalid template variables");
    });
  });

  describe("resolveTemplate", () => {
    it("should resolve input variables", () => {
      const result = resolveTemplate(
        "Hello {{input.name}}!",
        { name: "World" },
        {},
      );
      expect(result).toBe("Hello World!");
    });

    it("should resolve secret variables", () => {
      const result = resolveTemplate(
        "Bearer {{secrets.TOKEN}}",
        {},
        { TOKEN: "sk-123" },
      );
      expect(result).toBe("Bearer sk-123");
    });

    it("should resolve both input and secret variables", () => {
      const result = resolveTemplate(
        "{{secrets.BASE_URL}}/{{input.endpoint}}",
        { endpoint: "users" },
        { BASE_URL: "https://api.example.com" },
      );
      expect(result).toBe("https://api.example.com/users");
    });

    it("should leave unresolved input variables as-is", () => {
      const result = resolveTemplate(
        "Hello {{input.missing}}!",
        {},
        {},
      );
      expect(result).toBe("Hello {{input.missing}}!");
    });

    it("should leave unresolved secret variables as-is", () => {
      const result = resolveTemplate(
        "Bearer {{secrets.MISSING}}",
        {},
        {},
      );
      expect(result).toBe("Bearer {{secrets.MISSING}}");
    });

    it("should convert non-string input values to strings", () => {
      const result = resolveTemplate(
        "Count: {{input.count}}",
        { count: 42 },
        {},
      );
      expect(result).toBe("Count: 42");
    });

    it("should handle undefined input values by keeping the template", () => {
      const result = resolveTemplate(
        "Val: {{input.undef}}",
        { undef: undefined },
        {},
      );
      expect(result).toBe("Val: {{input.undef}}");
    });

    it("should handle templates with no variables", () => {
      const result = resolveTemplate("no variables here", {}, {});
      expect(result).toBe("no variables here");
    });

    it("should handle multiple occurrences of the same variable", () => {
      const result = resolveTemplate(
        "{{input.x}} + {{input.x}}",
        { x: "a" },
        {},
      );
      expect(result).toBe("a + a");
    });

    it("should leave unrecognized namespace variables as-is", () => {
      const result = resolveTemplate(
        "no variables here {{input.x}}",
        { x: "val" },
        {},
      );
      expect(result).toBe("no variables here val");
    });
  });

  // ============================================================
  // register_tool
  // ============================================================

  describe("register_tool", () => {
    const validInput = {
      name: "my_api_tool",
      description: "Fetches data from an external API",
      input_schema: { query: { type: "string" } },
      handler_spec: {
        url: "https://api.example.com/search?q={{input.query}}",
        method: "GET" as const,
        headers: { Authorization: "Bearer {{secrets.API_KEY}}" },
      },
    };

    it("should register a tool successfully", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.registeredTool.upsert.mockResolvedValue({
        id: "tool-1",
        name: "my_api_tool",
        status: "DRAFT",
      });

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler(validInput);

      expect(mockPrisma.registeredTool.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId_name: { userId, name: "my_api_tool" } },
          create: expect.objectContaining({
            userId,
            name: "my_api_tool",
            description: "Fetches data from an external API",
            status: "DRAFT",
          }),
          update: expect.objectContaining({
            description: "Fetches data from an external API",
            status: "DRAFT",
          }),
        }),
      );
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: "text",
              text: expect.stringContaining("Tool Registered"),
            }),
          ]),
        }),
      );
    });

    it("should include tool ID and name in success response", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);
      mockPrisma.registeredTool.upsert.mockResolvedValue({
        id: "tool-abc",
        name: "my_api_tool",
        status: "DRAFT",
      });

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler(validInput);

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("tool-abc");
      expect(text).toContain("my_api_tool");
      expect(text).toContain("DRAFT");
    });

    it("should enforce quota for free tier", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(5);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler(validInput);

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Tool limit reached"),
            }),
          ]),
        }),
      );
      expect(mockPrisma.registeredTool.upsert).not.toHaveBeenCalled();
    });

    it("should show limit numbers in quota error message", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(5);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler(validInput);

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("5/5");
      expect(text).toContain("500");
    });

    it("should allow more tools for premium users", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(100);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        tier: "PREMIUM",
      });
      mockPrisma.registeredTool.upsert.mockResolvedValue({
        id: "tool-101",
        name: "my_api_tool",
        status: "DRAFT",
      });

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler(validInput);

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Tool Registered"),
            }),
          ]),
        }),
      );
    });

    it("should enforce premium quota limit at 500", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(500);
      mockPrisma.subscription.findUnique.mockResolvedValue({
        tier: "PREMIUM",
      });

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler(validInput);

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Tool limit reached"),
            }),
          ]),
        }),
      );
    });

    it("should reject non-HTTPS URLs (SSRF prevention)", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler({
        ...validInput,
        handler_spec: {
          ...validInput.handler_spec,
          url: "http://api.example.com/search",
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Invalid handler URL"),
            }),
          ]),
        }),
      );
      expect(mockPrisma.registeredTool.upsert).not.toHaveBeenCalled();
    });

    it("should reject private IP URLs (SSRF prevention)", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler({
        ...validInput,
        handler_spec: {
          ...validInput.handler_spec,
          url: "https://192.168.1.1/api",
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Invalid handler URL"),
            }),
          ]),
        }),
      );
    });

    it("should reject invalid template variables in URL (injection prevention)", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler({
        ...validInput,
        handler_spec: {
          ...validInput.handler_spec,
          url: "https://api.example.com/{{env.PATH}}",
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Template error"),
            }),
          ]),
        }),
      );
    });

    it("should reject invalid template variables in headers (injection prevention)", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler({
        ...validInput,
        handler_spec: {
          ...validInput.handler_spec,
          url: "https://api.example.com/data",
          headers: { Authorization: "Bearer {{process.env.TOKEN}}" },
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Template error"),
            }),
          ]),
        }),
      );
    });

    it("should reject invalid template variables in body (injection prevention)", async () => {
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.subscription.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler({
        ...validInput,
        handler_spec: {
          url: "https://api.example.com/data",
          method: "POST" as const,
          headers: {},
          body: "{\"key\": \"{{constructor.prototype}}\"}",
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Template error"),
            }),
          ]),
        }),
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.registeredTool.count.mockRejectedValue(
        new Error("DB connection failed"),
      );

      const handler = registry.handlers.get("register_tool")!;
      const result = await handler(validInput);

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("DB connection failed"),
            }),
          ]),
        }),
      );
    });
  });
});
