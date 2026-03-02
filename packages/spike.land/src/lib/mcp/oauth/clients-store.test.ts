import { createHash } from "crypto";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Hoisted mocks
const { mockPrisma } = vi.hoisted(() => ({
  mockPrisma: {
    oAuthClient: {
      create: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock("@/lib/prisma", () => ({
  default: mockPrisma,
}));

import { getClient, registerClient, verifyClientSecret } from "./clients-store";

describe("clients-store", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("registerClient", () => {
    const validRequest = {
      client_name: "Test Client",
      redirect_uris: ["https://example.com/callback"],
    };

    it("should register a valid client with default grant_types", async () => {
      mockPrisma.oAuthClient.create.mockResolvedValue({
        clientId: "gen-client-id",
        clientName: "Test Client",
        clientSecretHash: null,
        redirectUris: ["https://example.com/callback"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenEndpointAuthMethod: "none",
      });

      const result = await registerClient(validRequest, "127.0.0.1");

      expect(result).toEqual({
        client_id: "gen-client-id",
        client_secret: undefined,
        client_name: "Test Client",
        redirect_uris: ["https://example.com/callback"],
        grant_types: ["authorization_code", "refresh_token"],
        token_endpoint_auth_method: "none",
      });

      expect(mockPrisma.oAuthClient.create).toHaveBeenCalledWith({
        data: {
          clientName: "Test Client",
          clientSecretHash: null,
          redirectUris: ["https://example.com/callback"],
          grantTypes: ["authorization_code", "refresh_token"],
          tokenEndpointAuthMethod: "none",
        },
      });
    });

    it("should register a client with custom grant_types", async () => {
      mockPrisma.oAuthClient.create.mockResolvedValue({
        clientId: "gen-client-id",
        clientName: "Test Client",
        clientSecretHash: null,
        redirectUris: ["https://example.com/callback"],
        grantTypes: ["authorization_code"],
        tokenEndpointAuthMethod: "none",
      });

      const result = await registerClient(
        { ...validRequest, grant_types: ["authorization_code"] },
        "127.0.0.2",
      );

      expect(result).not.toHaveProperty("error");
      expect(mockPrisma.oAuthClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            grantTypes: ["authorization_code"],
          }),
        }),
      );
    });

    it("should generate client_secret for client_secret_post auth method", async () => {
      // Capture the actual secret generated at runtime
      let capturedSecretHash: string | null = null;
      mockPrisma.oAuthClient.create.mockImplementation(
        (args: { data: { clientSecretHash: string | null } }) => {
          capturedSecretHash = args.data.clientSecretHash;
          return Promise.resolve({
            clientId: "gen-client-id",
            clientName: "Secret Client",
            clientSecretHash: args.data.clientSecretHash,
            redirectUris: ["https://example.com/callback"],
            grantTypes: ["authorization_code", "refresh_token"],
            tokenEndpointAuthMethod: "client_secret_post",
          });
        },
      );

      const result = await registerClient(
        {
          ...validRequest,
          client_name: "Secret Client",
          token_endpoint_auth_method: "client_secret_post",
        },
        "127.0.0.3",
      );

      expect(result).not.toHaveProperty("error");
      // A hash was stored
      expect(capturedSecretHash).toMatch(/^[a-f0-9]{64}$/);
      // The response includes a client_secret
      const response = result as { client_secret?: string };
      expect(response.client_secret).toBeDefined();
      expect(typeof response.client_secret).toBe("string");
      // Verify the hash matches the secret
      const recomputedHash = createHash("sha256").update(response.client_secret!).digest("hex");
      expect(recomputedHash).toBe(capturedSecretHash);
    });

    it("should generate client_secret for client_secret_basic auth method", async () => {
      mockPrisma.oAuthClient.create.mockImplementation(
        (args: { data: { clientSecretHash: string | null } }) => {
          return Promise.resolve({
            clientId: "gen-client-id",
            clientName: "Basic Client",
            clientSecretHash: args.data.clientSecretHash,
            redirectUris: ["https://example.com/callback"],
            grantTypes: ["authorization_code", "refresh_token"],
            tokenEndpointAuthMethod: "client_secret_basic",
          });
        },
      );

      const result = await registerClient(
        {
          ...validRequest,
          client_name: "Basic Client",
          token_endpoint_auth_method: "client_secret_basic",
        },
        "127.0.0.4",
      );

      expect(result).not.toHaveProperty("error");
      const response = result as { client_secret?: string };
      expect(response.client_secret).toBeDefined();
      expect(typeof response.client_secret).toBe("string");
      // The stored hash should be a SHA-256 hex
      expect(mockPrisma.oAuthClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientSecretHash: expect.stringMatching(/^[a-f0-9]{64}$/),
            tokenEndpointAuthMethod: "client_secret_basic",
          }),
        }),
      );
    });

    it("should return error when client_name is missing", async () => {
      const result = await registerClient(
        { client_name: "", redirect_uris: ["https://example.com/callback"] },
        "127.0.0.5",
      );

      expect(result).toEqual({
        error: "client_name is required (max 200 chars)",
        status: 400,
      });
      expect(mockPrisma.oAuthClient.create).not.toHaveBeenCalled();
    });

    it("should return error when client_name is too long", async () => {
      const result = await registerClient(
        {
          client_name: "x".repeat(201),
          redirect_uris: ["https://example.com/callback"],
        },
        "127.0.0.6",
      );

      expect(result).toEqual({
        error: "client_name is required (max 200 chars)",
        status: 400,
      });
    });

    it("should return error when redirect_uris is empty for non-device-flow", async () => {
      const result = await registerClient({ client_name: "Test", redirect_uris: [] }, "127.0.0.7");

      expect(result).toEqual({
        error: "At least one redirect_uri is required",
        status: 400,
      });
    });

    it("should allow device code flow registration without redirect_uris", async () => {
      mockPrisma.oAuthClient.create.mockResolvedValue({
        clientId: "gen-device-client-id",
        clientName: "spike-cli",
        clientSecretHash: null,
        redirectUris: [],
        grantTypes: ["urn:ietf:params:oauth:grant-type:device_code"],
        tokenEndpointAuthMethod: "none",
      });

      const result = await registerClient(
        {
          client_name: "spike-cli",
          grant_types: ["urn:ietf:params:oauth:grant-type:device_code"],
          token_endpoint_auth_method: "none",
        },
        "127.0.0.30",
      );

      expect(result).not.toHaveProperty("error");
      expect(result).toEqual({
        client_id: "gen-device-client-id",
        client_secret: undefined,
        client_name: "spike-cli",
        redirect_uris: [],
        grant_types: ["urn:ietf:params:oauth:grant-type:device_code"],
        token_endpoint_auth_method: "none",
      });

      expect(mockPrisma.oAuthClient.create).toHaveBeenCalledWith({
        data: {
          clientName: "spike-cli",
          clientSecretHash: null,
          redirectUris: [],
          grantTypes: ["urn:ietf:params:oauth:grant-type:device_code"],
          tokenEndpointAuthMethod: "none",
        },
      });
    });

    it("should return error for invalid URI format", async () => {
      const result = await registerClient(
        { client_name: "Test", redirect_uris: ["not-a-valid-uri"] },
        "127.0.0.8",
      );

      expect(result).toEqual({
        error: "Invalid redirect_uri: not-a-valid-uri",
        status: 400,
      });
    });

    it("should return error for non-https URI (not localhost)", async () => {
      const result = await registerClient(
        { client_name: "Test", redirect_uris: ["http://example.com/callback"] },
        "127.0.0.9",
      );

      expect(result).toEqual({
        error: "redirect_uri must use HTTPS (except localhost): http://example.com/callback",
        status: 400,
      });
    });

    it("should allow http for localhost redirect_uris", async () => {
      mockPrisma.oAuthClient.create.mockResolvedValue({
        clientId: "gen-localhost-id",
        clientName: "Localhost Client",
        clientSecretHash: null,
        redirectUris: ["http://localhost:3000/callback"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenEndpointAuthMethod: "none",
      });

      const result = await registerClient(
        {
          client_name: "Localhost Client",
          redirect_uris: ["http://localhost:3000/callback"],
        },
        "127.0.0.10",
      );

      expect(result).not.toHaveProperty("error");
      expect(mockPrisma.oAuthClient.create).toHaveBeenCalled();
    });

    it("should return error when rate limit exceeded (>10 registrations per hour)", async () => {
      // Use a unique IP for rate limit testing
      const rateLimitIp = "10.0.0.1";

      mockPrisma.oAuthClient.create.mockResolvedValue({
        clientId: "gen-id",
        clientName: "Test",
        clientSecretHash: null,
        redirectUris: ["https://example.com/callback"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenEndpointAuthMethod: "none",
      });

      // Register 10 clients (the limit)
      for (let i = 0; i < 10; i++) {
        const result = await registerClient(validRequest, rateLimitIp);
        expect(result).not.toHaveProperty("error");
      }

      // 11th registration should fail
      const result = await registerClient(validRequest, rateLimitIp);
      expect(result).toEqual({
        error: "Too many client registrations. Try again later.",
        status: 429,
      });
    });

    it("should reset rate limit after 1 hour", async () => {
      const rateLimitIp = "10.0.0.2";

      mockPrisma.oAuthClient.create.mockResolvedValue({
        clientId: "gen-id",
        clientName: "Test",
        clientSecretHash: null,
        redirectUris: ["https://example.com/callback"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenEndpointAuthMethod: "none",
      });

      // Use up the rate limit
      for (let i = 0; i < 10; i++) {
        await registerClient(validRequest, rateLimitIp);
      }

      // Verify it's rate limited
      const blockedResult = await registerClient(validRequest, rateLimitIp);
      expect(blockedResult).toHaveProperty("error");

      // Advance time by 1 hour + 1ms
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 60 * 60 * 1000 + 1);

      // Should be allowed again
      const result = await registerClient(validRequest, rateLimitIp);
      expect(result).not.toHaveProperty("error");

      vi.useRealTimers();
    });

    it("should not generate client_secret when auth method is none", async () => {
      mockPrisma.oAuthClient.create.mockResolvedValue({
        clientId: "gen-id",
        clientName: "No Secret",
        clientSecretHash: null,
        redirectUris: ["https://example.com/callback"],
        grantTypes: ["authorization_code", "refresh_token"],
        tokenEndpointAuthMethod: "none",
      });

      await registerClient({ ...validRequest, token_endpoint_auth_method: "none" }, "127.0.0.20");

      expect(mockPrisma.oAuthClient.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            clientSecretHash: null,
          }),
        }),
      );
    });
  });

  describe("getClient", () => {
    it("should find an existing client by clientId", async () => {
      const mockClient = {
        clientId: "existing-client",
        clientName: "Existing Client",
        clientSecretHash: null,
        redirectUris: ["https://example.com/callback"],
        grantTypes: ["authorization_code"],
        tokenEndpointAuthMethod: "none",
      };

      mockPrisma.oAuthClient.findUnique.mockResolvedValue(mockClient);

      const result = await getClient("existing-client");

      expect(result).toEqual(mockClient);
      expect(mockPrisma.oAuthClient.findUnique).toHaveBeenCalledWith({
        where: { clientId: "existing-client" },
        select: {
          clientId: true,
          clientName: true,
          clientSecretHash: true,
          redirectUris: true,
          grantTypes: true,
          tokenEndpointAuthMethod: true,
        },
      });
    });

    it("should return null for nonexistent client", async () => {
      mockPrisma.oAuthClient.findUnique.mockResolvedValue(null);

      const result = await getClient("nonexistent-client");

      expect(result).toBeNull();
    });
  });

  describe("verifyClientSecret", () => {
    it("should return true for matching secrets", () => {
      const secret = "my-super-secret";
      const hash = createHash("sha256").update(secret).digest("hex");

      const result = verifyClientSecret(hash, secret);

      expect(result).toBe(true);
    });

    it("should return false for non-matching secrets", () => {
      const hash = createHash("sha256").update("correct-secret").digest("hex");

      const result = verifyClientSecret(hash, "wrong-secret");

      expect(result).toBe(false);
    });

    it("should return false when hashes have different lengths", () => {
      // A stored hash that is shorter than the standard SHA-256 hex length
      const shortHash = "abcdef";
      const secret = "any-secret";

      const result = verifyClientSecret(shortHash, secret);

      expect(result).toBe(false);
    });

    it("should return false when storedHash is longer than providedHash", () => {
      const longHash = "a".repeat(100);
      const secret = "secret";
      const result = verifyClientSecret(longHash, secret);
      expect(result).toBe(false);
    });
  });

  describe("registerClient validation failure", () => {
    it("should return error when validation fails", async () => {
      // client_name too long is already tested, let's try another one if possible
      // or just ensure the branch is covered by any failure.
      const result = await registerClient(
        {
          client_name: "test",
          redirect_uris: ["not-a-url"],
        } as unknown as Parameters<typeof registerClient>[0],
        "127.0.0.1",
      );
      expect(result).toHaveProperty("error");
    });
  });
});
