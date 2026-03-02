import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock validateApiKey from api-key-manager
const { mockValidateApiKey } = vi.hoisted(() => ({
  mockValidateApiKey: vi.fn(),
}));

vi.mock("./api-key-manager", () => ({
  validateApiKey: mockValidateApiKey,
}));

// Mock auth from @/auth
const { mockAuth } = vi.hoisted(() => ({
  mockAuth: vi.fn(),
}));

vi.mock("@/lib/auth", () => ({
  auth: mockAuth,
}));

// Mock OAuth token service
const { mockVerifyAccessToken } = vi.hoisted(() => ({
  mockVerifyAccessToken: vi.fn(),
}));

vi.mock("@/lib/mcp/oauth/token-service", () => ({
  verifyAccessToken: mockVerifyAccessToken,
}));

// Mock Capability token service
const { mockVerifyCapabilityToken } = vi.hoisted(() => ({
  mockVerifyCapabilityToken: vi.fn(),
}));

vi.mock("@/lib/agents/capability-token-service", () => ({
  verifyCapabilityToken: mockVerifyCapabilityToken,
}));

import type { NextRequest } from "next/server";
import {
  authenticateMcpOrSession,
  authenticateMcpRequest,
  authenticateSseRequest,
  extractApiKey,
  maskApiKey,
} from "./auth";

// Helper to create mock NextRequest
function createMockRequest(
  headers: Record<string, string> = {},
  url = "http://localhost",
): NextRequest {
  return {
    headers: {
      get: (name: string) => headers[name] || null,
    },
    url,
  } as unknown as NextRequest;
}

describe("auth", () => {
  const testUserId = "test-user-123";
  const testApiKeyId = "api-key-456";

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe("authenticateMcpRequest", () => {
    it("should return error when Authorization header is missing", async () => {
      const request = createMockRequest({});

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing Authorization header");
    });

    it("should return error when Authorization header doesn't start with Bearer", async () => {
      const request = createMockRequest({
        Authorization: "Basic abc123",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid Authorization header format. Expected: Bearer <api_key>");
    });

    it("should return error when API key is empty", async () => {
      const request = createMockRequest({
        Authorization: "Bearer ",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing API key or token");
    });

    it("should return error when API key is just whitespace", async () => {
      const request = createMockRequest({
        Authorization: "Bearer    ",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing API key or token");
    });

    it("should return success when API key is valid", async () => {
      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        userId: testUserId,
        apiKeyId: testApiKeyId,
      });

      const request = createMockRequest({
        Authorization: "Bearer sk_test_validkey",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(testUserId);
      expect(result.apiKeyId).toBe(testApiKeyId);
      expect(mockValidateApiKey).toHaveBeenCalledWith("sk_test_validkey");
    });

    it("should authenticate capability tokens (cap_ prefix)", async () => {
      mockVerifyCapabilityToken.mockResolvedValue({
        userId: testUserId,
        agentId: "test-agent-id",
        tokenId: "token-123",
      });

      const request = createMockRequest({
        Authorization: "Bearer cap_test_token",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(testUserId);
      expect(result.agentId).toBe("test-agent-id");
      expect(result.capabilityTokenId).toBe("token-123");
    });

    it("should return error for invalid capability tokens", async () => {
      mockVerifyCapabilityToken.mockResolvedValue(null);

      const request = createMockRequest({
        Authorization: "Bearer cap_invalid_token",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or expired capability token");
    });

    it("should return error when capability token verification throws", async () => {
      mockVerifyCapabilityToken.mockRejectedValue(new Error("Cap service down"));

      const request = createMockRequest({
        Authorization: "Bearer cap_broken_token",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Capability token verification failed");
    });

    it("should return error when API key validation fails", async () => {
      mockValidateApiKey.mockResolvedValue({
        isValid: false,
        error: "Invalid API key format",
      });

      const request = createMockRequest({
        Authorization: "Bearer invalid_key",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key format");
    });

    it("should trim whitespace from API key", async () => {
      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        userId: testUserId,
        apiKeyId: testApiKeyId,
      });

      const request = createMockRequest({
        Authorization: "Bearer   sk_test_validkey   ",
      });

      await authenticateMcpRequest(request);

      expect(mockValidateApiKey).toHaveBeenCalledWith("sk_test_validkey");
    });

    it("should authenticate OAuth tokens (mcp_ prefix)", async () => {
      mockVerifyAccessToken.mockResolvedValue({
        userId: testUserId,
        clientId: "test-client-id",
        scope: "mcp",
      });

      const request = createMockRequest({
        Authorization: "Bearer mcp_test_oauth_token_abc123",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(testUserId);
      expect(result.oauthClientId).toBe("test-client-id");
      expect(mockValidateApiKey).not.toHaveBeenCalled();
    });

    it("should return error for invalid OAuth tokens", async () => {
      mockVerifyAccessToken.mockResolvedValue(null);

      const request = createMockRequest({
        Authorization: "Bearer mcp_invalid_token",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or expired OAuth token");
    });

    it("should return error when OAuth token verification throws", async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error("OAuth service unavailable"));

      const request = createMockRequest({
        Authorization: "Bearer mcp_crashing_token",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("OAuth token verification failed");
    });

    it("should return default error when API key validation returns isValid false without error string", async () => {
      mockValidateApiKey.mockResolvedValue({
        isValid: false,
        // No error property
      });

      const request = createMockRequest({
        Authorization: "Bearer sk_test_noerror",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid API key");
    });

    it("should return error when validateApiKey throws an exception", async () => {
      mockValidateApiKey.mockRejectedValue(new Error("Database connection failed"));

      const request = createMockRequest({
        Authorization: "Bearer sk_test_validkey",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Database connection failed");
    });

    it("should return fallback error when validateApiKey throws without message", async () => {
      mockValidateApiKey.mockRejectedValue(new Error());

      const request = createMockRequest({
        Authorization: "Bearer sk_test_validkey",
      });

      const result = await authenticateMcpRequest(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("API key validation failed");
    });
  });

  describe("authenticateSseRequest", () => {
    it("should return error when token is missing", async () => {
      const request = createMockRequest({}, "http://localhost");
      const result = await authenticateSseRequest(request);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Missing token query parameter");
    });

    it("should authenticate OAuth token in SSE request", async () => {
      mockVerifyAccessToken.mockResolvedValue({
        userId: testUserId,
        clientId: "test-client",
      });
      const request = createMockRequest({}, "http://localhost?token=mcp_valid");
      const result = await authenticateSseRequest(request);
      expect(result.success).toBe(true);
      expect(result.userId).toBe(testUserId);
    });

    it("should return error for invalid OAuth token in SSE", async () => {
      mockVerifyAccessToken.mockResolvedValue(null);
      const request = createMockRequest({}, "http://localhost?token=mcp_invalid");
      const result = await authenticateSseRequest(request);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Invalid or expired OAuth token");
    });

    it("should return error when OAuth verification throws in SSE", async () => {
      mockVerifyAccessToken.mockRejectedValue(new Error("Down"));
      const request = createMockRequest({}, "http://localhost?token=mcp_broken");
      const result = await authenticateSseRequest(request);
      expect(result.success).toBe(false);
      expect(result.error).toBe("OAuth token verification failed");
    });

    it("should authenticate API key in SSE request", async () => {
      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        userId: testUserId,
        apiKeyId: testApiKeyId,
      });
      const request = createMockRequest({}, "http://localhost?token=sk_valid");
      const result = await authenticateSseRequest(request);
      expect(result.success).toBe(true);
      expect(result.userId).toBe(testUserId);
    });

    it("should return error for invalid API key in SSE", async () => {
      mockValidateApiKey.mockResolvedValue({
        isValid: false,
        error: "Bad key",
      });
      const request = createMockRequest({}, "http://localhost?token=sk_invalid");
      const result = await authenticateSseRequest(request);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Bad key");
    });

    it("should handle error when API key validation throws in SSE", async () => {
      mockValidateApiKey.mockRejectedValue(new Error("Boom"));
      const request = createMockRequest({}, "http://localhost?token=sk_broken");
      const result = await authenticateSseRequest(request);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Boom");
    });

    it("should use default error for invalid API key in SSE without message", async () => {
      mockValidateApiKey.mockResolvedValue({ isValid: false });
      const request = createMockRequest({}, "http://localhost?token=sk_invalid");
      const result = await authenticateSseRequest(request);
      expect(result.error).toBe("Invalid API key");
    });

    it("should use fallback error when SSE validateApiKey throws without message", async () => {
      mockValidateApiKey.mockRejectedValue(new Error());
      const request = createMockRequest({}, "http://localhost?token=sk_broken_nomsg");
      const result = await authenticateSseRequest(request);
      expect(result.success).toBe(false);
      expect(result.error).toBe("API key validation failed");
    });
  });

  describe("extractApiKey", () => {
    it("should return null when Authorization header is missing", () => {
      const request = createMockRequest({});

      const result = extractApiKey(request);

      expect(result).toBeNull();
    });

    it("should return null when header doesn't start with Bearer", () => {
      const request = createMockRequest({
        Authorization: "Basic abc123",
      });

      const result = extractApiKey(request);

      expect(result).toBeNull();
    });

    it("should return null when API key is empty", () => {
      const request = createMockRequest({
        Authorization: "Bearer ",
      });

      const result = extractApiKey(request);

      expect(result).toBeNull();
    });

    it("should extract API key correctly", () => {
      const request = createMockRequest({
        Authorization: "Bearer sk_test_abc123",
      });

      const result = extractApiKey(request);

      expect(result).toBe("sk_test_abc123");
    });

    it("should trim whitespace from API key", () => {
      const request = createMockRequest({
        Authorization: "Bearer   sk_test_abc123   ",
      });

      const result = extractApiKey(request);

      expect(result).toBe("sk_test_abc123");
    });
  });

  describe("maskApiKey", () => {
    it("should mask API key showing first 7 chars (matches api-key-manager)", () => {
      const result = maskApiKey("sk_test_abcdefghijklmnop");

      expect(result).toBe("sk_test...****");
    });

    it("should return *** for short API keys (less than 7 chars)", () => {
      const result = maskApiKey("short");

      expect(result).toBe("***");
    });

    it("should return *** for empty string", () => {
      const result = maskApiKey("");

      expect(result).toBe("***");
    });

    it("should handle exactly 7 character key", () => {
      const result = maskApiKey("1234567");

      expect(result).toBe("1234567...****");
    });

    it("should handle keys just under 7 chars", () => {
      const result = maskApiKey("123456");

      expect(result).toBe("***");
    });

    it("should mask production keys correctly", () => {
      const result = maskApiKey("sk_live_abc123xyz789fullkey");

      expect(result).toBe("sk_live...****");
    });
  });

  describe("authenticateMcpOrSession", () => {
    it("should use API key auth when Bearer token is provided", async () => {
      mockValidateApiKey.mockResolvedValue({
        isValid: true,
        userId: testUserId,
        apiKeyId: testApiKeyId,
      });

      const request = createMockRequest({
        Authorization: "Bearer sk_test_validkey",
      });

      const result = await authenticateMcpOrSession(request);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(testUserId);
      expect(result.apiKeyId).toBe(testApiKeyId);
      expect(mockAuth).not.toHaveBeenCalled();
    });

    it("should fall back to session auth when no Bearer token", async () => {
      mockAuth.mockResolvedValue({
        user: { id: testUserId },
      });

      const request = createMockRequest({});

      const result = await authenticateMcpOrSession(request);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(testUserId);
      expect(result.apiKeyId).toBeUndefined();
      expect(mockAuth).toHaveBeenCalled();
    });

    it("should fall back to session auth with non-Bearer Authorization", async () => {
      mockAuth.mockResolvedValue({
        user: { id: testUserId },
      });

      const request = createMockRequest({
        Authorization: "Basic abc123",
      });

      const result = await authenticateMcpOrSession(request);

      expect(result.success).toBe(true);
      expect(result.userId).toBe(testUserId);
      expect(mockAuth).toHaveBeenCalled();
      expect(mockValidateApiKey).not.toHaveBeenCalled();
    });

    it("should return error when neither API key nor session is valid", async () => {
      mockAuth.mockResolvedValue(null);

      const request = createMockRequest({});

      const result = await authenticateMcpOrSession(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required. Provide an API key or sign in.");
    });

    it("should return error when session exists but has no user", async () => {
      mockAuth.mockResolvedValue({});

      const request = createMockRequest({});

      const result = await authenticateMcpOrSession(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required. Provide an API key or sign in.");
    });

    it("should return error when session user has no id", async () => {
      mockAuth.mockResolvedValue({
        user: { email: "test@example.com" },
      });

      const request = createMockRequest({});

      const result = await authenticateMcpOrSession(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Authentication required. Provide an API key or sign in.");
    });

    it("should return error when session auth throws an exception", async () => {
      mockAuth.mockRejectedValue(new Error("Session service unavailable"));

      const request = createMockRequest({});

      const result = await authenticateMcpOrSession(request);

      expect(result.success).toBe(false);
      expect(result.error).toBe("Session authentication failed");
    });
  });
});
