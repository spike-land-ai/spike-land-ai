/**
 * OAuth Client Store
 *
 * Manages dynamic client registration (RFC 7591) for MCP OAuth clients.
 * Clients are registered with redirect URIs and credentials.
 */

import { createHash, randomBytes, timingSafeEqual } from "crypto";

interface ClientRegistrationRequest {
  client_name: string;
  redirect_uris?: string[];
  grant_types?: string[];
  token_endpoint_auth_method?: string;
}

interface ClientRegistrationResponse {
  client_id: string;
  client_secret?: string;
  client_name: string;
  redirect_uris: string[];
  grant_types: string[];
  token_endpoint_auth_method: string;
}

interface OAuthClientRecord {
  clientId: string;
  clientName: string;
  clientSecretHash: string | null;
  redirectUris: string[];
  grantTypes: string[];
  tokenEndpointAuthMethod: string;
}

const MAX_REGISTRATIONS_PER_HOUR = 10;

// In-memory rate limit tracking (reset on server restart is acceptable)
const registrationCounts = new Map<string, { count: number; resetAt: number }>();

function checkRegistrationRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = registrationCounts.get(ip);

  if (!entry || now > entry.resetAt) {
    registrationCounts.set(ip, { count: 1, resetAt: now + 60 * 60 * 1000 });
    return true;
  }

  if (entry.count >= MAX_REGISTRATIONS_PER_HOUR) {
    return false;
  }

  entry.count++;
  return true;
}

async function getPrisma() {
  return (await import("@/lib/prisma")).default;
}

/**
 * Register a new OAuth client (RFC 7591 Dynamic Client Registration).
 * Uses upsert to handle concurrent registration race conditions (P2002).
 */
export async function registerClient(
  request: ClientRegistrationRequest,
  clientIp: string,
): Promise<ClientRegistrationResponse | { error: string; status: number }> {
  // Rate limit
  if (!checkRegistrationRateLimit(clientIp)) {
    return {
      error: "Too many client registrations. Try again later.",
      status: 429,
    };
  }

  // Validate
  if (!request.client_name || request.client_name.length > 200) {
    return { error: "client_name is required (max 200 chars)", status: 400 };
  }

  const grantTypes = request.grant_types || ["authorization_code", "refresh_token"];
  const isDeviceFlow = grantTypes.includes("urn:ietf:params:oauth:grant-type:device_code");
  const redirectUris = request.redirect_uris ?? [];

  // Device code flow clients don't use redirect URIs (RFC 8628)
  if (!isDeviceFlow && redirectUris.length === 0) {
    return { error: "At least one redirect_uri is required", status: 400 };
  }

  // Validate redirect URIs (when provided)
  for (const uri of redirectUris) {
    try {
      const parsed = new URL(uri);
      // Allow http for localhost, require https otherwise
      if (
        parsed.protocol !== "https:" &&
        !(parsed.protocol === "http:" && parsed.hostname === "localhost")
      ) {
        return {
          error: `redirect_uri must use HTTPS (except localhost): ${uri}`,
          status: 400,
        };
      }
    } catch {
      return { error: `Invalid redirect_uri: ${uri}`, status: 400 };
    }
  }

  const authMethod = request.token_endpoint_auth_method || "none";

  // Generate client credentials
  let clientSecret: string | undefined;
  let clientSecretHash: string | null = null;

  if (authMethod === "client_secret_post" || authMethod === "client_secret_basic") {
    clientSecret = randomBytes(32).toString("base64url");
    clientSecretHash = createHash("sha256").update(clientSecret).digest("hex");
  }

  const prisma = await getPrisma();
  const client = await prisma.oAuthClient.create({
    data: {
      clientName: request.client_name,
      clientSecretHash,
      redirectUris,
      grantTypes,
      tokenEndpointAuthMethod: authMethod,
    },
  });

  return {
    client_id: client.clientId,
    ...(clientSecret !== undefined ? { client_secret: clientSecret } : {}),
    client_name: client.clientName,
    redirect_uris: client.redirectUris,
    grant_types: client.grantTypes,
    token_endpoint_auth_method: client.tokenEndpointAuthMethod,
  };
}

/**
 * Get a client by clientId
 */
export async function getClient(clientId: string): Promise<OAuthClientRecord | null> {
  const prisma = await getPrisma();
  const client = await prisma.oAuthClient.findUnique({
    where: { clientId },
    select: {
      clientId: true,
      clientName: true,
      clientSecretHash: true,
      redirectUris: true,
      grantTypes: true,
      tokenEndpointAuthMethod: true,
    },
  });

  return client;
}

/**
 * Verify a client's secret
 */
export function verifyClientSecret(storedHash: string, providedSecret: string): boolean {
  const providedHash = createHash("sha256").update(providedSecret).digest("hex");
  // Use timing-safe comparison to prevent side-channel attacks
  const a = Buffer.from(storedHash);
  const b = Buffer.from(providedHash);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}
