import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Mock Prisma - must use vi.hoisted to avoid hoisting issues
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    oAuthAccessToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      updateMany: vi.fn(),
    },
    oAuthAuthorizationCode: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
    },
    oAuthClient: {
      upsert: vi.fn().mockResolvedValue({ clientId: "test-client" }),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

import {
  exchangeAuthorizationCode,
  generateAuthorizationCode,
  generateTokenPair,
  refreshAccessToken,
  revokeToken,
  verifyAccessToken,
  verifyPkce,
} from "./token-service";

describe("token-service", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("verifyPkce", () => {
    it("should verify valid PKCE S256 challenge", () => {
      const codeVerifier = "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk";
      const codeChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      expect(verifyPkce(codeVerifier, codeChallenge)).toBe(true);
    });

    it("should reject invalid PKCE challenge", () => {
      expect(verifyPkce("valid-verifier", "invalid-challenge")).toBe(false);
    });

    it("should reject empty verifier", () => {
      const challenge = createHash("sha256").update("test").digest("base64url");
      expect(verifyPkce("", challenge)).toBe(false);
    });
  });

  describe("generateTokenPair", () => {
    it("should generate access and refresh tokens", async () => {
      mockPrisma.oAuthAccessToken.create
        .mockResolvedValueOnce({ id: "refresh-id" }) // Refresh token
        .mockResolvedValueOnce({ id: "access-id" }); // Access token

      const result = await generateTokenPair("user-1", "client-1", "mcp");

      expect(result.accessToken).toMatch(/^mcp_/);
      expect(result.refreshToken).toMatch(/^mcp_/);
      expect(result.accessToken).not.toBe(result.refreshToken);
      expect(result.tokenType).toBe("Bearer");
      expect(result.scope).toBe("mcp");
      expect(result.expiresIn).toBe(3600);
      expect(mockPrisma.oAuthAccessToken.create).toHaveBeenCalledTimes(2);
    });

    it("should store tokens as SHA-256 hashes", async () => {
      mockPrisma.oAuthAccessToken.create.mockResolvedValue({ id: "test-id" });

      await generateTokenPair("user-1", "client-1", "mcp");

      // Check that the stored token hashes are SHA-256 hex strings (64 chars)
      const firstCall = mockPrisma.oAuthAccessToken.create.mock.calls[0]?.[0];
      const secondCall = mockPrisma.oAuthAccessToken.create.mock.calls[1]?.[0];
      expect(firstCall?.data?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
      expect(secondCall?.data?.tokenHash).toMatch(/^[a-f0-9]{64}$/);
    });

    it("should set correct token types", async () => {
      mockPrisma.oAuthAccessToken.create.mockResolvedValue({ id: "test-id" });

      await generateTokenPair("user-1", "client-1", "mcp");

      const refreshCall = mockPrisma.oAuthAccessToken.create.mock.calls[0]?.[0];
      const accessCall = mockPrisma.oAuthAccessToken.create.mock.calls[1]?.[0];
      expect(refreshCall?.data?.tokenType).toBe("REFRESH");
      expect(accessCall?.data?.tokenType).toBe("ACCESS");
    });

    it("should ensure OAuthClient exists before creating tokens", async () => {
      mockPrisma.oAuthAccessToken.create.mockResolvedValue({ id: "test-id" });

      await generateTokenPair("user-1", "my-frontend", "mcp");

      // ensureOAuthClient should upsert with the clientId
      expect(mockPrisma.oAuthClient.upsert).toHaveBeenCalledWith({
        where: { clientId: "my-frontend" },
        update: {},
        create: expect.objectContaining({
          clientId: "my-frontend",
          clientName: "my-frontend",
        }),
      });
      // upsert must be called before token creation
      const upsertOrder = mockPrisma.oAuthClient.upsert.mock.invocationCallOrder[0];
      const createOrder = mockPrisma.oAuthAccessToken.create.mock.invocationCallOrder[0];
      expect(upsertOrder).toBeLessThan(createOrder!);
    });
  });

  describe("verifyAccessToken", () => {
    it("should reject tokens without mcp_ prefix", async () => {
      const result = await verifyAccessToken("sk_live_not_oauth");
      expect(result).toBeNull();
      expect(mockPrisma.oAuthAccessToken.findUnique).not.toHaveBeenCalled();
    });

    it("should verify valid access token", async () => {
      const token = "mcp_test_token_abc123";
      const tokenHash = createHash("sha256").update(token).digest("hex");

      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        tokenType: "ACCESS",
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
      });

      const result = await verifyAccessToken(token);

      expect(result).toEqual({
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
      });
      expect(mockPrisma.oAuthAccessToken.findUnique).toHaveBeenCalledWith({
        where: { tokenHash },
        select: expect.any(Object),
      });
    });

    it("should reject expired access token", async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        tokenType: "ACCESS",
        expiresAt: new Date(Date.now() - 1000), // expired
        revokedAt: null,
      });

      const result = await verifyAccessToken("mcp_expired_token");
      expect(result).toBeNull();
    });

    it("should reject revoked access token", async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        tokenType: "ACCESS",
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: new Date(), // revoked
      });

      const result = await verifyAccessToken("mcp_revoked_token");
      expect(result).toBeNull();
    });

    it("should reject refresh tokens used as access tokens", async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        tokenType: "REFRESH", // Not ACCESS
        expiresAt: new Date(Date.now() + 3600000),
        revokedAt: null,
      });

      const result = await verifyAccessToken("mcp_refresh_as_access");
      expect(result).toBeNull();
    });

    it("should return null for nonexistent token", async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue(null);

      const result = await verifyAccessToken("mcp_nonexistent");
      expect(result).toBeNull();
    });
  });

  describe("refreshAccessToken", () => {
    it("should generate new access token from valid refresh token", async () => {
      const refreshToken = "mcp_refresh_valid";

      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: "refresh-id",
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        resource: null,
        tokenType: "REFRESH",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });

      mockPrisma.oAuthAccessToken.create.mockResolvedValue({
        id: "new-access",
      });

      const result = await refreshAccessToken(refreshToken, "client-1");

      expect(result).not.toBeNull();
      expect(result!.accessToken).toMatch(/^mcp_/);
      expect(result!.refreshToken).toBe(refreshToken); // Same refresh token
      expect(result!.tokenType).toBe("Bearer");
    });

    it("should reject refresh for wrong client", async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: "refresh-id",
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        resource: null,
        tokenType: "REFRESH",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });

      const result = await refreshAccessToken("mcp_refresh", "wrong-client");
      expect(result).toBeNull();
    });

    it("should reject non-mcp_ prefix tokens", async () => {
      const result = await refreshAccessToken("sk_live_not_mcp", "client-1");
      expect(result).toBeNull();
    });
  });

  describe("revokeToken", () => {
    it("should revoke a valid token", async () => {
      mockPrisma.oAuthAccessToken.updateMany.mockResolvedValue({ count: 1 });

      const result = await revokeToken("mcp_token_to_revoke");
      expect(result).toBe(true);
    });

    it("should return false for already revoked token", async () => {
      mockPrisma.oAuthAccessToken.updateMany.mockResolvedValue({ count: 0 });

      const result = await revokeToken("mcp_already_revoked");
      expect(result).toBe(false);
    });

    it("should reject non-mcp_ prefix tokens", async () => {
      const result = await revokeToken("sk_live_not_mcp");
      expect(result).toBe(false);
      expect(mockPrisma.oAuthAccessToken.updateMany).not.toHaveBeenCalled();
    });
  });

  describe("generateAuthorizationCode", () => {
    it("should create an authorization code", async () => {
      mockPrisma.oAuthAuthorizationCode.create.mockResolvedValue({
        id: "code-id",
        code: "test-code",
      });

      const code = await generateAuthorizationCode({
        clientId: "client-1",
        userId: "user-1",
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge123",
      });

      expect(typeof code).toBe("string");
      expect(code.length).toBeGreaterThan(0);
      expect(mockPrisma.oAuthAuthorizationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          clientId: "client-1",
          userId: "user-1",
          redirectUri: "https://example.com/callback",
          codeChallenge: "challenge123",
          codeChallengeMethod: "S256",
          scope: "mcp",
        }),
      });
    });
  });

  describe("exchangeAuthorizationCode", () => {
    it("should exchange valid code for tokens", async () => {
      const codeVerifier = "test-verifier-string-long-enough";
      const codeChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      // Atomic mark-as-used succeeds
      mockPrisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });
      // Then fetch details
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
        clientId: "client-1",
        userId: "user-1",
        redirectUri: "https://example.com/callback",
        codeChallenge,
        codeChallengeMethod: "S256",
        scope: "mcp",
        resource: null,
        expiresAt: new Date(Date.now() + 600000),
      });

      mockPrisma.oAuthAccessToken.create.mockResolvedValue({ id: "token-id" });

      const result = await exchangeAuthorizationCode(
        "test-code",
        "client-1",
        codeVerifier,
        "https://example.com/callback",
      );

      expect(result).not.toBeNull();
      expect(result!.accessToken).toMatch(/^mcp_/);
      expect(result!.refreshToken).toMatch(/^mcp_/);
      // Verify atomic update was called with usedAt: null condition
      expect(mockPrisma.oAuthAuthorizationCode.updateMany).toHaveBeenCalledWith(
        {
          where: { code: "test-code", usedAt: null },
          data: { usedAt: expect.any(Date) },
        },
      );
    });

    it("should reject already-used codes (atomic update returns count 0)", async () => {
      // Atomic update finds no unused code — already used
      mockPrisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({
        count: 0,
      });

      const result = await exchangeAuthorizationCode(
        "used-code",
        "client-1",
        "verifier",
        "https://example.com/callback",
      );

      expect(result).toBeNull();
      // findUnique should NOT be called since updateMany returned 0
      expect(mockPrisma.oAuthAuthorizationCode.findUnique).not
        .toHaveBeenCalled();
    });

    it("should reject expired codes", async () => {
      mockPrisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
        clientId: "client-1",
        userId: "user-1",
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        scope: "mcp",
        resource: null,
        expiresAt: new Date(Date.now() - 1000), // Expired
      });

      const result = await exchangeAuthorizationCode(
        "expired-code",
        "client-1",
        "verifier",
        "https://example.com/callback",
      );

      expect(result).toBeNull();
    });

    it("should reject wrong client", async () => {
      mockPrisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
        clientId: "client-1",
        userId: "user-1",
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        scope: "mcp",
        resource: null,
        expiresAt: new Date(Date.now() + 600000),
      });

      const result = await exchangeAuthorizationCode(
        "code",
        "wrong-client", // Wrong client
        "verifier",
        "https://example.com/callback",
      );

      expect(result).toBeNull();
    });

    it("should reject wrong redirect URI", async () => {
      mockPrisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
        clientId: "client-1",
        userId: "user-1",
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge",
        codeChallengeMethod: "S256",
        scope: "mcp",
        resource: null,
        expiresAt: new Date(Date.now() + 600000),
      });

      const result = await exchangeAuthorizationCode(
        "code",
        "client-1",
        "verifier",
        "https://evil.com/callback", // Wrong redirect
      );

      expect(result).toBeNull();
    });

    it("should reject nonexistent code (atomic update returns count 0)", async () => {
      // updateMany finds no matching code
      mockPrisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({
        count: 0,
      });

      const result = await exchangeAuthorizationCode(
        "nonexistent",
        "client-1",
        "verifier",
        "https://example.com/callback",
      );

      expect(result).toBeNull();
    });

    it("should reject when PKCE verification fails (mismatched codeVerifier)", async () => {
      const codeVerifier = "correct-verifier-string";
      const codeChallenge = createHash("sha256")
        .update(codeVerifier)
        .digest("base64url");

      // Atomic mark-as-used succeeds
      mockPrisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });
      // Then fetch details with the correct challenge
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue({
        clientId: "client-1",
        userId: "user-1",
        redirectUri: "https://example.com/callback",
        codeChallenge,
        codeChallengeMethod: "S256",
        scope: "mcp",
        resource: null,
        expiresAt: new Date(Date.now() + 600000),
      });

      // Use wrong verifier that won't match the challenge
      const result = await exchangeAuthorizationCode(
        "test-code",
        "client-1",
        "wrong-verifier-that-does-not-match",
        "https://example.com/callback",
      );

      // Should fail because PKCE verifier doesn't match challenge
      expect(result).toBeNull();
    });

    it("should return null when authCode is not found after atomic update", async () => {
      // Atomic mark-as-used succeeds (race condition scenario)
      mockPrisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({
        count: 1,
      });
      // But subsequent findUnique returns null
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(null);

      const result = await exchangeAuthorizationCode(
        "disappearing-code",
        "client-1",
        "verifier",
        "https://example.com/callback",
      );

      expect(result).toBeNull();
    });
  });

  describe("generateAuthorizationCode - custom params", () => {
    it("should pass custom scope, state, resource, and codeChallengeMethod", async () => {
      mockPrisma.oAuthAuthorizationCode.create.mockResolvedValue({
        id: "code-id",
        code: "test-code",
      });

      await generateAuthorizationCode({
        clientId: "client-1",
        userId: "user-1",
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge123",
        codeChallengeMethod: "plain",
        scope: "mcp:write",
        state: "random-state",
        resource: "https://api.example.com",
      });

      expect(mockPrisma.oAuthAuthorizationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          codeChallengeMethod: "plain",
          scope: "mcp:write",
          state: "random-state",
          resource: "https://api.example.com",
        }),
      });
    });

    it("should handle undefined state and resource as undefined", async () => {
      mockPrisma.oAuthAuthorizationCode.create.mockResolvedValue({
        id: "code-id",
        code: "test-code",
      });

      await generateAuthorizationCode({
        clientId: "client-1",
        userId: "user-1",
        redirectUri: "https://example.com/callback",
        codeChallenge: "challenge123",
        state: undefined,
        resource: undefined,
      });

      expect(mockPrisma.oAuthAuthorizationCode.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          codeChallengeMethod: "S256",
          scope: "mcp",
        }),
      });
    });
  });

  describe("refreshAccessToken - edge cases", () => {
    it("should reject expired refresh token", async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: "refresh-id",
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        resource: null,
        tokenType: "REFRESH",
        expiresAt: new Date(Date.now() - 1000), // expired
        revokedAt: null,
      });

      const result = await refreshAccessToken(
        "mcp_refresh_expired",
        "client-1",
      );
      expect(result).toBeNull();
    });

    it("should reject revoked refresh token", async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: "refresh-id",
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        resource: null,
        tokenType: "REFRESH",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: new Date(), // revoked
      });

      const result = await refreshAccessToken(
        "mcp_refresh_revoked",
        "client-1",
      );
      expect(result).toBeNull();
    });

    it("should reject non-existent refresh token", async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue(null);

      const result = await refreshAccessToken(
        "mcp_refresh_nonexistent",
        "client-1",
      );
      expect(result).toBeNull();
    });

    it("should reject access token used as refresh token", async () => {
      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: "access-id",
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        resource: null,
        tokenType: "ACCESS", // Not REFRESH
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });

      const result = await refreshAccessToken(
        "mcp_access_as_refresh",
        "client-1",
      );
      expect(result).toBeNull();
    });

    it("should pass resource to new access token when refreshing", async () => {
      const refreshToken = "mcp_refresh_with_resource";

      mockPrisma.oAuthAccessToken.findUnique.mockResolvedValue({
        id: "refresh-id",
        userId: "user-1",
        clientId: "client-1",
        scope: "mcp",
        resource: "https://api.example.com",
        tokenType: "REFRESH",
        expiresAt: new Date(Date.now() + 86400000),
        revokedAt: null,
      });

      mockPrisma.oAuthAccessToken.create.mockResolvedValue({
        id: "new-access",
      });

      const result = await refreshAccessToken(refreshToken, "client-1");

      expect(result).not.toBeNull();
      expect(mockPrisma.oAuthAccessToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          resource: "https://api.example.com",
        }),
      });
    });
  });

  describe("generateTokenPair - P2003 foreign key retry", () => {
    it("should retry on P2003 foreign key constraint error", async () => {
      const p2003Error = Object.assign(
        new Error("Foreign key constraint failed"),
        { code: "P2003" },
      );
      // First create call (refresh token) throws P2003
      mockPrisma.oAuthAccessToken.create.mockRejectedValueOnce(p2003Error);
      // After retry: refresh token + access token succeed
      mockPrisma.oAuthAccessToken.create
        .mockResolvedValueOnce({ id: "retry-refresh-id" })
        .mockResolvedValueOnce({ id: "retry-access-id" });

      const result = await generateTokenPair("user-1", "client-1", "mcp");

      expect(result.accessToken).toMatch(/^mcp_/);
      expect(result.refreshToken).toMatch(/^mcp_/);
      expect(result.tokenType).toBe("Bearer");
      // ensureOAuthClient called twice: once initially, once in retry
      expect(mockPrisma.oAuthClient.upsert).toHaveBeenCalledTimes(2);
    });

    it("should retry with new tokens on P2002 unique constraint violation", async () => {
      const p2002Error = Object.assign(new Error("Unique constraint failed"), {
        code: "P2002",
      });
      mockPrisma.oAuthAccessToken.create
        .mockRejectedValueOnce(p2002Error)
        .mockResolvedValueOnce({ id: "retry-refresh-id" })
        .mockResolvedValueOnce({ id: "retry-access-id" });

      const result = await generateTokenPair("user-1", "client-1", "mcp");

      expect(result.accessToken).toMatch(/^mcp_/);
      expect(result.refreshToken).toMatch(/^mcp_/);
      expect(result.tokenType).toBe("Bearer");
      // P2002 retries with new tokens, 3 total create calls (1 failed + 2 retry)
      expect(mockPrisma.oAuthAccessToken.create).toHaveBeenCalledTimes(3);
    });

    it("should re-throw non-P2002/P2003 errors", async () => {
      const otherError = Object.assign(new Error("Unknown database error"), {
        code: "P2025",
      });
      mockPrisma.oAuthAccessToken.create.mockRejectedValueOnce(otherError);

      await expect(generateTokenPair("user-1", "client-1", "mcp"))
        .rejects.toThrow("Unknown database error");
    });
  });

  describe("generateTokenPair - with resource", () => {
    it("should pass resource to both token records", async () => {
      mockPrisma.oAuthAccessToken.create.mockResolvedValue({ id: "token-id" });

      await generateTokenPair(
        "user-1",
        "client-1",
        "mcp",
        "https://api.example.com",
      );

      const refreshCall = mockPrisma.oAuthAccessToken.create.mock.calls[0]?.[0];
      const accessCall = mockPrisma.oAuthAccessToken.create.mock.calls[1]?.[0];
      expect(refreshCall?.data?.resource).toBe("https://api.example.com");
      expect(accessCall?.data?.resource).toBe("https://api.example.com");
    });
  });

  describe("verifyPkce - length mismatch", () => {
    it("should reject when computed and challenge have different lengths", () => {
      // A very short challenge will have a different length than the SHA-256 output
      expect(verifyPkce("some-verifier", "short")).toBe(false);
    });

    it("should reject when expected length is different from challenge", () => {
      // Force timingSafeEqual length check
      // S256 verifier results in 32 byte buffer
      const result = verifyPkce("a".repeat(43), "a".repeat(10));
      expect(result).toBe(false);
    });
  });

  describe("exchangeAuthorizationCode edge cases", () => {
    it("should handle authCode being deleted between update and findUnique", async () => {
      mockPrisma.oAuthAuthorizationCode.updateMany.mockResolvedValue({ count: 1 });
      mockPrisma.oAuthAuthorizationCode.findUnique.mockResolvedValue(null);

      const result = await exchangeAuthorizationCode(
        "code",
        "client",
        "verifier",
        "uri",
      );
      expect(result).toBeNull();
    });
  });

  describe("generateTokenPair retry limit", () => {
    it("should throw after retries on unique constraint violation", async () => {
      mockPrisma.oAuthAccessToken.create.mockRejectedValue({ code: "P2002" });
      await expect(generateTokenPair("user", "client", "mcp")).rejects.toThrow();
      expect(mockPrisma.oAuthAccessToken.create).toHaveBeenCalledTimes(2);
    });
  });
});
