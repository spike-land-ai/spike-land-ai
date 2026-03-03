import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock prisma
const mockPrisma = {
  app: {
    findMany: vi.fn(),
  },
  appMessage: {
    findMany: vi.fn(),
  },
  appCodeVersion: {
    findMany: vi.fn(),
  },
};

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

// Mock app-lookup
const mockFindAppByIdentifierSimple = vi.fn();
vi.mock("@/lib/app-lookup", () => ({
  findAppByIdentifierSimple: (...args: unknown[]) => mockFindAppByIdentifierSimple(...args),
}));

import { createMockRegistry, getText } from "../__test-utils__";
import { registerAppsTools } from "./apps";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("apps tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerAppsTools(registry, userId);
  });

  it("should register 14 apps tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(14);
    expect(registry.handlers.has("apps_create")).toBe(true);
    expect(registry.handlers.has("apps_list")).toBe(true);
    expect(registry.handlers.has("apps_get")).toBe(true);
    expect(registry.handlers.has("apps_chat")).toBe(true);
    expect(registry.handlers.has("apps_get_messages")).toBe(true);
    expect(registry.handlers.has("apps_set_status")).toBe(true);
    expect(registry.handlers.has("apps_bin")).toBe(true);
    expect(registry.handlers.has("apps_restore")).toBe(true);
    expect(registry.handlers.has("apps_delete_permanent")).toBe(true);
    expect(registry.handlers.has("apps_list_versions")).toBe(true);
    expect(registry.handlers.has("apps_batch_status")).toBe(true);
    expect(registry.handlers.has("apps_clear_messages")).toBe(true);
    expect(registry.handlers.has("apps_upload_images")).toBe(true);
    expect(registry.handlers.has("apps_generate_codespace_id")).toBe(true);
  });

  describe("apps_create", () => {
    it("should create an app via API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "app-1",
            name: "My App",
            slug: "my-app",
            status: "WAITING",
            codespaceId: "my-app",
            codespaceUrl: "/api/codespace/my-app/embed",
          }),
      });

      const handler = registry.handlers.get("apps_create")!;
      const result = await handler({
        prompt: "Build a todo app",
      });

      expect(mockFetch).toHaveBeenCalledTimes(1);
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("App Created!");
      expect(text).toContain("My App");
      expect(text).toContain("app-1");
    });

    it("should pass optional params to API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "app-2",
            name: "Custom App",
            slug: "custom-slug",
            status: "WAITING",
            codespaceId: "custom-slug",
            codespaceUrl: "/api/codespace/custom-slug/embed",
          }),
      });

      const handler = registry.handlers.get("apps_create")!;
      await handler({
        prompt: "Build a dashboard",
        codespace_id: "custom-slug",
        image_ids: ["img-1"],
        template_id: "react-basic",
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.codespaceId).toBe("custom-slug");
      expect(body.imageIds).toEqual(["img-1"]);
      expect(body.templateId).toBe("react-basic");
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 409,
        text: () => Promise.resolve(JSON.stringify({ error: "Name taken" })),
      });

      const handler = registry.handlers.get("apps_create")!;
      const result = await handler({ prompt: "test" });

      expect(result).toEqual(
        expect.objectContaining({ isError: true }),
      );
      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("CONFLICT");
    });
  });

  describe("apps_list", () => {
    it("should list user apps from prisma", async () => {
      mockPrisma.app.findMany.mockResolvedValue([
        {
          id: "app-1",
          name: "Todo App",
          slug: "todo-app",
          status: "LIVE",
          codespaceId: "todo-app",
          lastAgentActivity: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-02"),
          _count: { messages: 5, images: 2, codeVersions: 3 },
        },
      ]);

      const handler = registry.handlers.get("apps_list")!;
      const result = await handler({ limit: 20 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("My Apps (1)");
      expect(text).toContain("Todo App");
      expect(text).toContain("LIVE");
      expect(text).toContain("todo-app");
    });

    it("should show empty message when no apps", async () => {
      mockPrisma.app.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("apps_list")!;
      const result = await handler({ limit: 20 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("My Apps (0)");
      expect(text).toContain("apps_create");
    });

    it("should filter by status when provided", async () => {
      mockPrisma.app.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("apps_list")!;
      await handler({ status: "LIVE", limit: 10 });

      expect(mockPrisma.app.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: "LIVE",
            userId,
            deletedAt: null,
          }),
        }),
      );
    });

    it("should handle database errors", async () => {
      mockPrisma.app.findMany.mockRejectedValue(new Error("DB error"));

      const handler = registry.handlers.get("apps_list")!;
      const result = await handler({ limit: 20 });

      expect(result).toEqual(
        expect.objectContaining({ isError: true }),
      );
    });

    it("should fall back to slug when codespaceId is null", async () => {
      mockPrisma.app.findMany.mockResolvedValue([
        {
          id: "app-1",
          name: "Slug App",
          slug: "slug-only",
          status: "LIVE",
          codespaceId: null,
          lastAgentActivity: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-02"),
          _count: { messages: 1, images: 0, codeVersions: 1 },
        },
      ]);

      const handler = registry.handlers.get("apps_list")!;
      const result = await handler({ limit: 20 });

      const text = getText(result);
      expect(text).toContain("ID: `slug-only`");
    });

    it("should fall back to id when both codespaceId and slug are falsy", async () => {
      mockPrisma.app.findMany.mockResolvedValue([
        {
          id: "app-fallback-id",
          name: "ID App",
          slug: "",
          status: "LIVE",
          codespaceId: null,
          lastAgentActivity: null,
          createdAt: new Date("2025-01-01"),
          updatedAt: new Date("2025-01-02"),
          _count: { messages: 0, images: 0, codeVersions: 0 },
        },
      ]);

      const handler = registry.handlers.get("apps_list")!;
      const result = await handler({ limit: 20 });

      const text = getText(result);
      expect(text).toContain("ID: `app-fallback-id`");
    });
  });

  describe("apps_get", () => {
    it("should fetch app details via API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "app-1",
            name: "My App",
            slug: "my-app",
            description: "A test app",
            status: "LIVE",
            codespaceId: "my-app",
            codespaceUrl: "/api/codespace/my-app/embed",
            agentWorking: false,
            lastAgentActivity: null,
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-02T00:00:00Z",
          }),
      });

      const handler = registry.handlers.get("apps_get")!;
      const result = await handler({ app_id: "my-app" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("App: My App");
      expect(text).toContain("LIVE");
      expect(text).toContain("Agent Working:** No");
    });

    it("should handle 404 errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ error: "App not found" })),
      });

      const handler = registry.handlers.get("apps_get")!;
      const result = await handler({ app_id: "nonexistent" });

      expect(result).toEqual(
        expect.objectContaining({ isError: true }),
      );
    });

    it("should show dash when slug is falsy", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "app-no-slug",
            name: "No Slug App",
            slug: "",
            description: null,
            status: "BUILDING",
            codespaceId: null,
            codespaceUrl: null,
            agentWorking: false,
            lastAgentActivity: null,
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-02T00:00:00Z",
          }),
      });

      const handler = registry.handlers.get("apps_get")!;
      const result = await handler({ app_id: "app-no-slug" });

      const text = getText(result);
      expect(text).toContain("Slug:** \u2014");
      expect(text).not.toContain("Description:");
      expect(text).not.toContain("Codespace:");
      expect(text).not.toContain("Preview:");
    });

    it("should display all optional fields including _count, statusHistory, description, codespaceUrl", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "app-full",
            name: "Full App",
            slug: "full-app",
            description: "A fully-featured app",
            status: "LIVE",
            codespaceId: "full-app",
            codespaceUrl: "/api/codespace/full-app/embed",
            agentWorking: true,
            lastAgentActivity: "2025-01-02T00:00:00Z",
            createdAt: "2025-01-01T00:00:00Z",
            updatedAt: "2025-01-02T00:00:00Z",
            _count: { messages: 10, images: 3 },
            statusHistory: [
              {
                status: "LIVE",
                message: "Deployed successfully",
                createdAt: "2025-01-02T00:00:00Z",
              },
              {
                status: "BUILDING",
                message: null,
                createdAt: "2025-01-01T12:00:00Z",
              },
            ],
          }),
      });

      const handler = registry.handlers.get("apps_get")!;
      const result = await handler({ app_id: "full-app" });

      const text = getText(result);
      expect(text).toContain("Description:** A fully-featured app");
      expect(text).toContain("Codespace:** full-app");
      expect(text).toContain(
        "Preview:** https://testing.spike.land/live/full-app",
      );
      expect(text).toContain("Messages:** 10");
      expect(text).toContain("Images:** 3");
      expect(text).toContain("Agent Working:** Yes");
      expect(text).toContain("Recent Status History");
      expect(text).toContain("Deployed successfully");
      expect(text).toContain("BUILDING");
    });
  });

  describe("apps_chat", () => {
    it("should send message via API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "msg-1",
            content: "Build a todo app",
            role: "USER",
            createdAt: "2025-01-01T00:00:00Z",
          }),
      });

      const handler = registry.handlers.get("apps_chat")!;
      const result = await handler({
        app_id: "my-app",
        message: "Add dark mode",
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Message Sent!");
      expect(text).toContain("msg-1");
    });

    it("should pass image_ids to API when provided", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () =>
          Promise.resolve({
            id: "msg-2",
            content: "With image",
            role: "USER",
            createdAt: "2025-01-01T00:00:00Z",
          }),
      });

      const handler = registry.handlers.get("apps_chat")!;
      await handler({
        app_id: "my-app",
        message: "Use this design",
        image_ids: ["img-1"],
      });

      const [, options] = mockFetch.mock.calls[0] as [string, RequestInit];
      const body = JSON.parse(options.body as string);
      expect(body.imageIds).toEqual(["img-1"]);
    });
  });

  describe("apps_get_messages", () => {
    it("should list messages from prisma", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue({
        id: "app-1",
        slug: "my-app",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-1",
          role: "USER",
          content: "Build a todo app",
          createdAt: new Date("2025-01-01"),
          codeVersion: null,
        },
        {
          id: "msg-2",
          role: "AGENT",
          content: "Here is your todo app",
          createdAt: new Date("2025-01-02"),
          codeVersion: { id: "v-1", hash: "abc123def" },
        },
      ]);

      const handler = registry.handlers.get("apps_get_messages")!;
      const result = await handler({ app_id: "my-app", limit: 20 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Messages for my-app");
      expect(text).toContain("Build a todo app");
      expect(text).toContain("Agent");
      expect(text).toContain("abc123de");
    });

    it("should return error when app not found", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue(null);

      const handler = registry.handlers.get("apps_get_messages")!;
      const result = await handler({ app_id: "nonexistent", limit: 20 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("APP_NOT_FOUND");
    });

    it("should show empty message when no messages", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue({
        id: "app-1",
        slug: "my-app",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("apps_get_messages")!;
      const result = await handler({ app_id: "my-app", limit: 20 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("No messages yet");
    });

    it("should use cursor for pagination", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue({
        id: "app-1",
        slug: "my-app",
      });
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-old",
          role: "USER",
          content: "Old message",
          createdAt: new Date("2024-12-31"),
          codeVersion: null,
        },
      ]);

      const handler = registry.handlers.get("apps_get_messages")!;
      await handler({
        app_id: "my-app",
        cursor: "2025-01-01T00:00:00Z",
        limit: 20,
      });

      expect(mockPrisma.appMessage.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            createdAt: { lt: new Date("2025-01-01T00:00:00Z") },
          }),
        }),
      );
    });

    it("should show 'More messages available' when messages.length === limit", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue({
        id: "app-1",
        slug: "my-app",
      });
      const messages = [
        {
          id: "msg-1",
          role: "USER",
          content: "Hello",
          createdAt: new Date("2025-01-02"),
          codeVersion: null,
        },
        {
          id: "msg-2",
          role: "AGENT",
          content: "Hi there",
          createdAt: new Date("2025-01-01"),
          codeVersion: null,
        },
      ];
      mockPrisma.appMessage.findMany.mockResolvedValue(messages);

      const handler = registry.handlers.get("apps_get_messages")!;
      const result = await handler({ app_id: "my-app", limit: 2 });

      expect(getText(result)).toContain("More messages available");
    });

    it("should truncate messages with content > 300 chars", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue({
        id: "app-1",
        slug: "my-app",
      });
      const longContent = "A".repeat(400);
      mockPrisma.appMessage.findMany.mockResolvedValue([
        {
          id: "msg-long",
          role: "USER",
          content: longContent,
          createdAt: new Date("2025-01-01"),
          codeVersion: null,
        },
      ]);

      const handler = registry.handlers.get("apps_get_messages")!;
      const result = await handler({ app_id: "my-app", limit: 20 });

      const text = getText(result);
      expect(text).toContain("...");
      expect(text).not.toContain("A".repeat(400));
    });
  });

  describe("apps_set_status", () => {
    it("should update status via API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = registry.handlers.get("apps_set_status")!;
      const result = await handler({
        app_id: "my-app",
        status: "ARCHIVED",
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Status Updated!");
      expect(text).toContain("ARCHIVED");
      expect(text).toContain("apps_bin");
    });

    it("should set status to PROMPTING without archive message", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = registry.handlers.get("apps_set_status")!;
      const result = await handler({
        app_id: "my-app",
        status: "PROMPTING",
      });

      const text = getText(result);
      expect(text).toContain("Status Updated!");
      expect(text).toContain("PROMPTING");
      expect(text).not.toContain("removed from your active list");
    });
  });

  describe("apps_bin", () => {
    it("should soft-delete via API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = registry.handlers.get("apps_bin")!;
      const result = await handler({ app_id: "my-app" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Moved to Bin!");
      expect(text).toContain("apps_restore");
    });
  });

  describe("apps_restore", () => {
    it("should restore from bin via API", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = registry.handlers.get("apps_restore")!;
      const result = await handler({ app_id: "my-app" });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Restored!");
    });
  });

  describe("apps_delete_permanent", () => {
    it("should require confirm=true", async () => {
      const handler = registry.handlers.get("apps_delete_permanent")!;
      const result = await handler({ app_id: "my-app", confirm: false });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Safety Check Failed");
    });

    it("should permanently delete when confirmed", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = registry.handlers.get("apps_delete_permanent")!;
      const result = await handler({ app_id: "my-app", confirm: true });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Permanently Deleted!");
    });
  });

  describe("apps_list_versions", () => {
    it("should list code versions from prisma", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue({
        id: "app-1",
        slug: "my-app",
      });
      mockPrisma.appCodeVersion.findMany.mockResolvedValue([
        {
          id: "v-1",
          hash: "abc123def456",
          description: "Initial version",
          createdAt: new Date("2025-01-01"),
        },
      ]);

      const handler = registry.handlers.get("apps_list_versions")!;
      const result = await handler({ app_id: "my-app", limit: 10 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Versions for my-app");
      expect(text).toContain("abc123de");
      expect(text).toContain("Initial version");
    });

    it("should return error when app not found", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue(null);

      const handler = registry.handlers.get("apps_list_versions")!;
      const result = await handler({ app_id: "nope", limit: 10 });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("APP_NOT_FOUND");
    });

    it("should list version without description", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue({
        id: "app-1",
        slug: "my-app",
      });
      mockPrisma.appCodeVersion.findMany.mockResolvedValue([
        {
          id: "v-no-desc",
          hash: "xyz789abcdef",
          description: null,
          createdAt: new Date("2025-01-01"),
        },
      ]);

      const handler = registry.handlers.get("apps_list_versions")!;
      const result = await handler({ app_id: "my-app", limit: 10 });

      const text = getText(result);
      expect(text).toContain("xyz789ab");
      expect(text).not.toContain("\u2014");
    });

    it("should show empty message when app has no versions", async () => {
      mockFindAppByIdentifierSimple.mockResolvedValue({
        id: "app-1",
        slug: "my-app",
      });
      mockPrisma.appCodeVersion.findMany.mockResolvedValue([]);

      const handler = registry.handlers.get("apps_list_versions")!;
      const result = await handler({ app_id: "my-app", limit: 10 });

      const text = getText(result);
      expect(text).toContain("No code versions yet");
    });
  });

  describe("apps_batch_status", () => {
    it("should update multiple apps", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        });

      const handler = registry.handlers.get("apps_batch_status")!;
      const result = await handler({
        app_ids: ["app-1", "app-2"],
        status: "ARCHIVED",
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Batch Status Update");
      expect(text).toContain("Succeeded:** 2/2");
    });

    it("should report failures in batch", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockResolvedValueOnce({
          ok: false,
          status: 404,
          text: () => Promise.resolve(JSON.stringify({ error: "App not found" })),
        });

      const handler = registry.handlers.get("apps_batch_status")!;
      const result = await handler({
        app_ids: ["app-1", "app-2"],
        status: "ARCHIVED",
      });

      const text = (result as { content: Array<{ text: string; }>; }).content[0]!
        .text;
      expect(text).toContain("Succeeded:** 1/2");
      expect(text).toContain("Failed:");
      expect(text).toContain("app-2");
    });

    it("should handle non-Error thrown in batch", async () => {
      mockFetch
        .mockResolvedValueOnce({
          ok: true,
          json: () => Promise.resolve({ success: true }),
        })
        .mockRejectedValueOnce("string error");

      const handler = registry.handlers.get("apps_batch_status")!;
      const result = await handler({
        app_ids: ["app-1", "app-2"],
        status: "ARCHIVED",
      });

      const text = getText(result);
      expect(text).toContain("Succeeded:** 1/2");
      expect(text).toContain("Unknown error");
    });
  });

  describe("apps_clear_messages", () => {
    it("should call DELETE on messages endpoint", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      });

      const handler = registry.handlers.get("apps_clear_messages")!;
      const result = await handler({ app_id: "my-app" });

      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("/api/apps/my-app/messages"),
        expect.objectContaining({ method: "DELETE" }),
      );
      const text = getText(result);
      expect(text).toContain("Chat Cleared!");
      expect(text).toContain("my-app");
    });

    it("should handle API errors", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 404,
        text: () => Promise.resolve(JSON.stringify({ error: "App not found" })),
      });

      const handler = registry.handlers.get("apps_clear_messages")!;
      const result = await handler({ app_id: "nonexistent" });

      expect(result).toEqual(expect.objectContaining({ isError: true }));
    });
  });

  describe("apps_upload_images", () => {
    it("should return upload instructions with correct app_id and count", async () => {
      const handler = registry.handlers.get("apps_upload_images")!;
      const result = await handler({ app_id: "my-app", image_count: 3 });

      const text = getText(result);
      expect(text).toContain("Image Upload Instructions");
      expect(text).toContain("`my-app`");
      expect(text).toContain("3");
      expect(text).toContain("/api/apps/my-app/images");
      expect(text).toContain("apps_chat");
    });

    it("should include upload requirements", async () => {
      const handler = registry.handlers.get("apps_upload_images")!;
      const result = await handler({ app_id: "test-app", image_count: 1 });

      const text = getText(result);
      expect(text).toContain("Max per request: 5");
      expect(text).toContain("image/*");
      expect(text).toContain("multipart form");
    });
  });

  describe("apps_generate_codespace_id", () => {
    it("should return a generated codespace ID in expected format", async () => {
      const handler = registry.handlers.get("apps_generate_codespace_id")!;
      const result = await handler({});

      const text = getText(result);
      expect(text).toContain("Generated Codespace ID");
      expect(text).toContain("apps_create");
      // The ID should have 4 dot-separated parts
      const match = text.match(/`([a-z]+\.[a-z]+\.[a-z]+\.[a-z0-9]+)`/);
      expect(match).not.toBeNull();
      const parts = match![1]!.split(".");
      expect(parts).toHaveLength(4);
    });
  });
});
