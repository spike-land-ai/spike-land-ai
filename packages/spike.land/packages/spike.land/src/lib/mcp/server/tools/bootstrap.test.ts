import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  workspaceConfig: {
    upsert: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
  },
  vaultSecret: {
    upsert: vi.fn(),
    count: vi.fn(),
  },
  registeredTool: {
    count: vi.fn(),
  },
  app: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  prisma: mockPrisma,
  default: mockPrisma,
}));

// Mock crypto
const mockEncryptSecret = vi.fn();
vi.mock("../crypto/vault", () => ({
  encryptSecret: (...args: unknown[]) => mockEncryptSecret(...args),
}));

// Mock SessionService for bootstrap_create_app
const mockGetOrCreateSession = vi.fn();
const mockUpsertSession = vi.fn();
const mockTranspileCode = vi.fn();

vi.mock("@/lib/codespace/session-service", () => ({
  getOrCreateSession: (...args: unknown[]) => mockGetOrCreateSession(...args),
  upsertSession: (...args: unknown[]) => mockUpsertSession(...args),
}));

vi.mock("@/lib/codespace/transpile", () => ({
  transpileCode: (...args: unknown[]) => mockTranspileCode(...args),
}));

import { createMockRegistry } from "../__test-utils__";
import { registerBootstrapTools } from "./bootstrap";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("bootstrap tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerBootstrapTools(registry, userId);
  });

  it("should register 4 bootstrap tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(4);
    expect(registry.handlers.has("bootstrap_workspace")).toBe(true);
    expect(registry.handlers.has("bootstrap_connect_integration")).toBe(true);
    expect(registry.handlers.has("bootstrap_create_app")).toBe(true);
    expect(registry.handlers.has("bootstrap_status")).toBe(true);
  });

  describe("bootstrap_workspace", () => {
    it("should create a new workspace", async () => {
      mockPrisma.workspaceConfig.upsert.mockResolvedValue({
        id: "ws-1",
        name: "My Workspace",
        userId,
        settings: {},
      });

      const handler = registry.handlers.get("bootstrap_workspace")!;
      const result = await handler({ name: "My Workspace", settings: {} });

      expect(mockPrisma.workspaceConfig.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: { name: "My Workspace", settings: {} },
        create: { userId, name: "My Workspace", settings: {} },
      });
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: "text",
              text: expect.stringContaining("Workspace Ready!"),
            }),
          ]),
        }),
      );
    });

    it("should include workspace ID and name in the response", async () => {
      mockPrisma.workspaceConfig.upsert.mockResolvedValue({
        id: "ws-42",
        name: "Dev Space",
        userId,
        settings: { theme: "dark" },
      });

      const handler = registry.handlers.get("bootstrap_workspace")!;
      const result = await handler({
        name: "Dev Space",
        settings: { theme: "dark" },
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("ws-42");
      expect(text).toContain("Dev Space");
      expect(text).toContain("bootstrap_connect_integration");
      expect(text).toContain("bootstrap_create_app");
    });

    it("should update an existing workspace", async () => {
      mockPrisma.workspaceConfig.upsert.mockResolvedValue({
        id: "ws-1",
        name: "Updated Workspace",
        userId,
        settings: { region: "eu" },
      });

      const handler = registry.handlers.get("bootstrap_workspace")!;
      const result = await handler({
        name: "Updated Workspace",
        settings: { region: "eu" },
      });

      expect(mockPrisma.workspaceConfig.upsert).toHaveBeenCalledWith({
        where: { userId },
        update: {
          name: "Updated Workspace",
          settings: { region: "eu" },
        },
        create: {
          userId,
          name: "Updated Workspace",
          settings: { region: "eu" },
        },
      });
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Workspace Ready!"),
            }),
          ]),
        }),
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.workspaceConfig.upsert.mockRejectedValue(
        new Error("DB connection failed"),
      );

      const handler = registry.handlers.get("bootstrap_workspace")!;
      const result = await handler({ name: "Test", settings: {} });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Error creating workspace"),
            }),
          ]),
        }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("DB connection failed");
    });

    it("should handle non-Error thrown values", async () => {
      mockPrisma.workspaceConfig.upsert.mockRejectedValue("string error");

      const handler = registry.handlers.get("bootstrap_workspace")!;
      const result = await handler({ name: "Test", settings: {} });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Unknown error"),
            }),
          ]),
        }),
      );
    });
  });

  describe("bootstrap_connect_integration", () => {
    it("should store credentials as vault secrets and update workspace", async () => {
      mockEncryptSecret.mockReturnValue({
        encryptedValue: "enc-val",
        iv: "iv-val",
        tag: "tag-val",
      });
      mockPrisma.vaultSecret.upsert
        .mockResolvedValueOnce({
          id: "secret-1",
          name: "github_api_key",
          status: "PENDING",
        })
        .mockResolvedValueOnce({
          id: "secret-2",
          name: "github_api_secret",
          status: "PENDING",
        });
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue({
        id: "ws-1",
        userId,
        integrations: {},
      });
      mockPrisma.workspaceConfig.update.mockResolvedValue({});

      const handler = registry.handlers.get(
        "bootstrap_connect_integration",
      )!;
      const result = await handler({
        integration_name: "github",
        credentials: { api_key: "gh-key-123", api_secret: "gh-secret-456" },
        allowed_urls: ["https://api.github.com"],
      });

      expect(mockEncryptSecret).toHaveBeenCalledTimes(2);
      expect(mockEncryptSecret).toHaveBeenCalledWith(userId, "gh-key-123");
      expect(mockEncryptSecret).toHaveBeenCalledWith(userId, "gh-secret-456");

      expect(mockPrisma.vaultSecret.upsert).toHaveBeenCalledTimes(2);

      expect(mockPrisma.workspaceConfig.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          integrations: expect.objectContaining({
            github: expect.objectContaining({
              secretNames: ["github_api_key", "github_api_secret"],
              allowedUrls: ["https://api.github.com"],
            }),
          }),
        },
      });

      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: "text",
              text: expect.stringContaining(
                "Integration Connected: github",
              ),
            }),
          ]),
        }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("github_api_key");
      expect(text).toContain("secret-1");
    });

    it("should handle single credential", async () => {
      mockEncryptSecret.mockReturnValue({
        encryptedValue: "enc",
        iv: "iv",
        tag: "tag",
      });
      mockPrisma.vaultSecret.upsert.mockResolvedValue({
        id: "secret-10",
        name: "slack_token",
        status: "PENDING",
      });
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue({
        id: "ws-1",
        userId,
        integrations: { existing: { connectedAt: "2025-01-01" } },
      });
      mockPrisma.workspaceConfig.update.mockResolvedValue({});

      const handler = registry.handlers.get(
        "bootstrap_connect_integration",
      )!;
      const result = await handler({
        integration_name: "slack",
        credentials: { token: "xoxb-123" },
        allowed_urls: [],
      });

      expect(mockEncryptSecret).toHaveBeenCalledTimes(1);
      expect(mockPrisma.vaultSecret.upsert).toHaveBeenCalledTimes(1);

      expect(mockPrisma.workspaceConfig.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          integrations: expect.objectContaining({
            existing: { connectedAt: "2025-01-01" },
            slack: expect.objectContaining({
              secretNames: ["slack_token"],
              allowedUrls: [],
            }),
          }),
        },
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Integration Connected: slack");
    });

    it("should skip workspace update when no workspace exists", async () => {
      mockEncryptSecret.mockReturnValue({
        encryptedValue: "enc",
        iv: "iv",
        tag: "tag",
      });
      mockPrisma.vaultSecret.upsert.mockResolvedValue({
        id: "secret-5",
        name: "api_key",
        status: "PENDING",
      });
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue(null);

      const handler = registry.handlers.get(
        "bootstrap_connect_integration",
      )!;
      const result = await handler({
        integration_name: "api",
        credentials: { key: "val" },
        allowed_urls: [],
      });

      expect(mockPrisma.workspaceConfig.update).not.toHaveBeenCalled();
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Integration Connected: api"),
            }),
          ]),
        }),
      );
    });

    it("should handle workspace with null integrations", async () => {
      mockEncryptSecret.mockReturnValue({
        encryptedValue: "enc",
        iv: "iv",
        tag: "tag",
      });
      mockPrisma.vaultSecret.upsert.mockResolvedValue({
        id: "secret-7",
        name: "svc_token",
        status: "PENDING",
      });
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue({
        id: "ws-1",
        userId,
        integrations: null,
      });
      mockPrisma.workspaceConfig.update.mockResolvedValue({});

      const handler = registry.handlers.get(
        "bootstrap_connect_integration",
      )!;
      await handler({
        integration_name: "svc",
        credentials: { token: "t" },
        allowed_urls: [],
      });

      expect(mockPrisma.workspaceConfig.update).toHaveBeenCalledWith({
        where: { userId },
        data: {
          integrations: expect.objectContaining({
            svc: expect.objectContaining({
              secretNames: ["svc_token"],
            }),
          }),
        },
      });
    });

    it("should handle database errors", async () => {
      mockEncryptSecret.mockReturnValue({
        encryptedValue: "enc",
        iv: "iv",
        tag: "tag",
      });
      mockPrisma.vaultSecret.upsert.mockRejectedValue(
        new Error("Vault DB error"),
      );

      const handler = registry.handlers.get(
        "bootstrap_connect_integration",
      )!;
      const result = await handler({
        integration_name: "test",
        credentials: { key: "val" },
        allowed_urls: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Error connecting integration"),
            }),
          ]),
        }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Vault DB error");
    });

    it("should handle non-Error thrown values", async () => {
      mockEncryptSecret.mockImplementation(() => {
        throw "unexpected";
      });

      const handler = registry.handlers.get(
        "bootstrap_connect_integration",
      )!;
      const result = await handler({
        integration_name: "test",
        credentials: { key: "val" },
        allowed_urls: [],
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Unknown error"),
            }),
          ]),
        }),
      );
    });
  });

  describe("bootstrap_create_app", () => {
    it("should create app with code via SessionService", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        codeSpace: "my-app",
        code: "",
        transpiled: "",
        html: "",
        css: "",
        messages: [],
        hash: "h",
      });
      mockTranspileCode.mockResolvedValue("transpiled-code");
      mockUpsertSession.mockResolvedValue({
        codeSpace: "my-app",
        hash: "abc",
        code: "code",
        transpiled: "transpiled-code",
        html: "",
        css: "",
        messages: [],
      });

      // Mock app POST to spike.land
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "app-1", name: "My App" }),
        text: () => Promise.resolve(""),
      });

      const handler = registry.handlers.get("bootstrap_create_app")!;
      const result = await handler({
        app_name: "My App",
        description: "A test application for the platform",
        code: "export default function App() { return <div>Hello</div>; }",
      });

      // Verify SessionService was used instead of HTTP
      expect(mockGetOrCreateSession).toHaveBeenCalledWith("my-app");
      expect(mockTranspileCode).toHaveBeenCalled();
      expect(mockUpsertSession).toHaveBeenCalled();

      // Only one fetch call (to spike.land for app creation)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [appUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(appUrl).toContain("spike.land/api/apps");

      // Verify response
      expect(result).toEqual(
        expect.objectContaining({
          content: expect.arrayContaining([
            expect.objectContaining({
              type: "text",
              text: expect.stringContaining("App Created!"),
            }),
          ]),
        }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("My App");
      expect(text).toContain("app-1");
      expect(text).toContain("my-app");
    });

    it("should create app without code (only hits spike.land)", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "app-2", name: "No Code App" }),
        text: () => Promise.resolve(""),
      });

      const handler = registry.handlers.get("bootstrap_create_app")!;
      const result = await handler({
        app_name: "No Code App",
        codespace_id: "custom-space",
      });

      // No SessionService calls when no code provided
      expect(mockGetOrCreateSession).not.toHaveBeenCalled();

      // Only one fetch call (to spike.land)
      expect(mockFetch).toHaveBeenCalledTimes(1);
      const [appUrl] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(appUrl).toContain("spike.land/api/apps");
      expect(appUrl).not.toContain("testing.spike.land");

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("App Created!");
      expect(text).toContain("custom-space");
    });

    it("should derive codespace_id from app_name when not provided", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "app-3", name: "Cool Widget" }),
        text: () => Promise.resolve(""),
      });

      const handler = registry.handlers.get("bootstrap_create_app")!;
      await handler({ app_name: "Cool Widget!!!" });

      const [, appOptions] = mockFetch.mock.calls[0] as [
        string,
        RequestInit,
      ];
      const appBody = JSON.parse(appOptions.body as string);
      expect(appBody.codespaceId).toBe("cool-widget");
    });

    it("should handle codespace creation errors", async () => {
      mockGetOrCreateSession.mockRejectedValue(
        new Error("DB connection failed"),
      );

      const handler = registry.handlers.get("bootstrap_create_app")!;
      const result = await handler({
        app_name: "Broken App",
        code: "some code",
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Error creating app"),
            }),
          ]),
        }),
      );
    });

    it("should handle app API errors", async () => {
      // No code, so goes straight to app API
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.resolve("App name already taken"),
      });

      const handler = registry.handlers.get("bootstrap_create_app")!;
      const result = await handler({
        app_name: "Dup App",
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Error creating app"),
            }),
          ]),
        }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("App name already taken");
    });

    it("should handle app API error when text() fails", async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        text: () => Promise.reject(new Error("read error")),
      });

      const handler = registry.handlers.get("bootstrap_create_app")!;
      const result = await handler({
        app_name: "Some App",
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Error creating app");
      expect(text).toContain("Unknown error");
    });

    it("should handle network/fetch errors", async () => {
      mockFetch.mockRejectedValue(new Error("Network timeout"));

      const handler = registry.handlers.get("bootstrap_create_app")!;
      const result = await handler({
        app_name: "Net Fail",
      });

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Error creating app"),
            }),
          ]),
        }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Network timeout");
    });

    it("should handle non-Error thrown values in catch", async () => {
      mockFetch.mockRejectedValue(42);

      const handler = registry.handlers.get("bootstrap_create_app")!;
      const result = await handler({
        app_name: "Weird Fail",
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Unknown error");
    });

    it("should fall back to SPIKE_LAND_API_KEY when SERVICE_TOKEN is not set", async () => {
      const originalSvc = process.env.SPIKE_LAND_SERVICE_TOKEN;
      const originalApi = process.env.SPIKE_LAND_API_KEY;
      delete process.env.SPIKE_LAND_SERVICE_TOKEN;
      process.env.SPIKE_LAND_API_KEY = "api-key-fallback";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "app-fb", name: "Fallback App" }),
        text: () => Promise.resolve(""),
      });

      const handler = registry.handlers.get("bootstrap_create_app")!;
      await handler({ app_name: "Fallback App" });

      const [, appOptions] = mockFetch.mock.calls[0] as [string, RequestInit];
      expect(
        (appOptions.headers as Record<string, string>).Authorization,
      ).toBe("Bearer api-key-fallback");

      if (originalSvc === undefined) {
        delete process.env.SPIKE_LAND_SERVICE_TOKEN;
      } else process.env.SPIKE_LAND_SERVICE_TOKEN = originalSvc;
      if (originalApi === undefined) delete process.env.SPIKE_LAND_API_KEY;
      else process.env.SPIKE_LAND_API_KEY = originalApi;
    });

    it("should handle session with null messages when creating app with code", async () => {
      mockGetOrCreateSession.mockResolvedValue({
        codeSpace: "null-msgs",
        code: "",
        transpiled: "",
        html: "",
        css: "",
        messages: null,
        hash: "h",
      });
      mockTranspileCode.mockResolvedValue("transpiled");
      mockUpsertSession.mockResolvedValue({});

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "app-nm", name: "Null Msgs" }),
        text: () => Promise.resolve(""),
      });

      const handler = registry.handlers.get("bootstrap_create_app")!;
      const result = await handler({
        app_name: "Null Msgs",
        code: "export default function() { return <div/>; }",
      });

      // The ?? [] fallback should provide an empty array
      expect(mockUpsertSession).toHaveBeenCalledWith(
        expect.objectContaining({ messages: [] }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!.text;
      expect(text).toContain("App Created!");
    });

    it("should include Authorization header when service token is set", async () => {
      const originalEnv = process.env.SPIKE_LAND_SERVICE_TOKEN;
      process.env.SPIKE_LAND_SERVICE_TOKEN = "svc-token-xyz";

      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ id: "app-9", name: "Auth App" }),
        text: () => Promise.resolve(""),
      });

      const handler = registry.handlers.get("bootstrap_create_app")!;
      await handler({
        app_name: "Auth App",
      });

      const [, appOptions] = mockFetch.mock.calls[0] as [
        string,
        RequestInit,
      ];
      expect(
        (appOptions.headers as Record<string, string>).Authorization,
      ).toBe("Bearer svc-token-xyz");

      if (originalEnv === undefined) {
        delete process.env.SPIKE_LAND_SERVICE_TOKEN;
      } else {
        process.env.SPIKE_LAND_SERVICE_TOKEN = originalEnv;
      }
    });
  });

  describe("bootstrap_status", () => {
    it("should return status with configured workspace and apps", async () => {
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue({
        id: "ws-1",
        name: "Production",
        userId,
        integrations: {
          github: { connectedAt: "2025-06-01" },
          slack: { connectedAt: "2025-06-02" },
        },
      });
      mockPrisma.vaultSecret.count.mockResolvedValue(5);
      mockPrisma.registeredTool.count.mockResolvedValue(3);
      mockPrisma.app.findMany.mockResolvedValue([
        {
          id: "app-1",
          name: "Dashboard",
          status: "ACTIVE",
          codespaceId: "dashboard-v2",
        },
        {
          id: "app-2",
          name: "Widget",
          status: "DRAFT",
          codespaceId: null,
        },
      ]);

      const handler = registry.handlers.get("bootstrap_status")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Workspace Status");
      expect(text).toContain("Production");
      expect(text).toContain("Integrations:** 2");
      expect(text).toContain("Vault Secrets:** 5");
      expect(text).toContain("Registered Tools:** 3");
      expect(text).toContain("Apps:** 2");
      expect(text).toContain("Dashboard (ACTIVE)");
      expect(text).toContain("dashboard-v2");
      expect(text).toContain("Widget (DRAFT)");
    });

    it("should return status without workspace", async () => {
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue(null);
      mockPrisma.vaultSecret.count.mockResolvedValue(0);
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.app.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("bootstrap_status")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Not configured");
      expect(text).toContain("Vault Secrets:** 0");
      expect(text).toContain("Registered Tools:** 0");
      expect(text).toContain("Apps:** 0");
      expect(text).toContain("bootstrap_workspace");
    });

    it("should handle workspace with empty integrations", async () => {
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue({
        id: "ws-1",
        name: "Empty WS",
        userId,
        integrations: {},
      });
      mockPrisma.vaultSecret.count.mockResolvedValue(0);
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.app.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("bootstrap_status")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Empty WS");
      expect(text).toContain("Integrations:** 0");
    });

    it("should handle workspace with null integrations", async () => {
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue({
        id: "ws-1",
        name: "Null Int WS",
        userId,
        integrations: null,
      });
      mockPrisma.vaultSecret.count.mockResolvedValue(1);
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.app.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("bootstrap_status")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Null Int WS");
      expect(text).toContain("Integrations:** 0");
    });

    it("should not show apps section when there are no apps", async () => {
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue({
        id: "ws-1",
        name: "No Apps WS",
        userId,
        integrations: {},
      });
      mockPrisma.vaultSecret.count.mockResolvedValue(0);
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.app.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("bootstrap_status")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Apps:** 0");
      expect(text).not.toMatch(/\*\*Apps:\*\*\n-/);
    });

    it("should not suggest bootstrap_workspace when workspace exists", async () => {
      mockPrisma.workspaceConfig.findUnique.mockResolvedValue({
        id: "ws-1",
        name: "Existing",
        userId,
        integrations: {},
      });
      mockPrisma.vaultSecret.count.mockResolvedValue(0);
      mockPrisma.registeredTool.count.mockResolvedValue(0);
      mockPrisma.app.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("bootstrap_status")!;
      const result = await handler({});

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).not.toContain("bootstrap_workspace");
    });

    it("should handle database errors", async () => {
      mockPrisma.workspaceConfig.findUnique.mockRejectedValue(
        new Error("Connection refused"),
      );

      const handler = registry.handlers.get("bootstrap_status")!;
      const result = await handler({});

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Error getting status"),
            }),
          ]),
        }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Connection refused");
    });

    it("should handle non-Error thrown values", async () => {
      mockPrisma.workspaceConfig.findUnique.mockRejectedValue(null);

      const handler = registry.handlers.get("bootstrap_status")!;
      const result = await handler({});

      expect(result).toEqual(
        expect.objectContaining({
          isError: true,
          content: expect.arrayContaining([
            expect.objectContaining({
              text: expect.stringContaining("Unknown error"),
            }),
          ]),
        }),
      );
    });
  });
});
