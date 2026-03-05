import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "../../../src/vibe-dev/api.js";

describe("API Client", () => {
  const mockConfig = {
    baseUrl: "https://api.example.com",
    apiKey: "test-key",
  };

  const originalFetch = global.fetch;
  const mockFetch = vi.fn();

  beforeEach(() => {
    global.fetch = mockFetch;
    process.env.AGENT_API_KEY = "test-key";
    process.env.SPIKE_LAND_API_URL = "https://api.example.com";
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.resetAllMocks();
    delete process.env.AGENT_API_KEY;
    delete process.env.SPIKE_LAND_API_URL;
  });

  describe("getApiConfig", () => {
    it("should return config from environment variables", () => {
      const config = api.getApiConfig();
      expect(config).toEqual({
        baseUrl: "https://api.example.com",
        apiKey: "test-key",
      });
    });

    it("should fallback to default URL if all env vars are missing", () => {
      delete process.env.SPIKE_LAND_API_URL;
      const config = api.getApiConfig();
      expect(config.baseUrl).toBe("https://spike.land");
    });

    it("should throw error if API key is missing", () => {
      delete process.env.AGENT_API_KEY;
      expect(() => api.getApiConfig()).toThrow("AGENT_API_KEY not configured");
    });
  });

  describe("getAppContext", () => {
    it("should fetch app context", async () => {
      const mockContext = { app: { id: "app1" } };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockContext,
      });

      const result = await api.getAppContext(mockConfig, "app1");
      expect(result).toEqual(mockContext);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/agent/apps/app1/context?historyLimit=10",
        expect.objectContaining({
          headers: expect.objectContaining({
            Authorization: "Bearer test-key",
          }),
        }),
      );
    });
  });

  describe("getMessageContent", () => {
    it("should fetch message content", async () => {
      const mockMessage = { id: "msg1", content: "hello" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockMessage,
      });

      const result = await api.getMessageContent(mockConfig, "msg1");
      expect(result).toEqual(mockMessage);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/agent/messages/msg1",
        expect.any(Object),
      );
    });
  });

  describe("postAgentResponse", () => {
    it("should post agent response", async () => {
      const mockResponse = { id: "resp1" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const payload = {
        content: "hello",
        codeUpdated: false,
        processedMessageIds: ["msg1"],
      };

      const result = await api.postAgentResponse(mockConfig, "app1", payload);
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/agent/apps/app1/respond",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify(payload),
        }),
      );
    });
  });

  describe("updateApp", () => {
    it("should update app", async () => {
      const mockResponse = { id: "app1" };
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const update = { status: "active" };
      const result = await api.updateApp(mockConfig, "app1", update);
      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/apps/app1/agent",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify(update),
        }),
      );
    });
  });

  describe("setAgentWorkingApi", () => {
    it("should set agent working status", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ success: true }),
      });

      await api.setAgentWorkingApi(mockConfig, "app1", true);
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/apps/app1/agent",
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({ isWorking: true }),
        }),
      );
    });
  });

  describe("markMessageRead", () => {
    it("should mark message as read", async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ id: "msg1" }),
      });

      await api.markMessageRead(mockConfig, "msg1");
      expect(mockFetch).toHaveBeenCalledWith(
        "https://api.example.com/api/agent/messages/msg1",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ isRead: true }),
        }),
      );
    });
  });

  describe("apiRequest failure", () => {
    it("should throw error if response is not ok", async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 500,
        text: async () => "Internal Server Error",
      });

      await expect(api.getAppContext(mockConfig, "app1")).rejects.toThrow(
        "API request failed: 500 - Internal Server Error",
      );
    });
  });
});
