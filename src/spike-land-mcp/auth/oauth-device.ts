import type { DrizzleDB } from "../db/index";
import { deviceAuthCodes, oauthAccessTokens } from "../db/schema";
import { eq, and, gt } from "drizzle-orm";

function generateUserCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no ambiguous chars
  let code = "";
  const bytes = new Uint8Array(8);
  crypto.getRandomValues(bytes);
  for (const b of bytes) {
    code += chars[b % chars.length];
  }
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function generateCode(prefix: string, length = 32): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return `${prefix}${hex}`;
}

async function hashToken(token: string): Promise<string> {
  const encoded = new TextEncoder().encode(token);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function createDeviceCode(
  db: DrizzleDB,
  options: { clientId?: string; scope?: string },
): Promise<{ deviceCode: string; userCode: string; expiresIn: number }> {
  const deviceCode = generateCode("dc_");
  const userCode = generateUserCode();
  const expiresIn = 600; // 10 minutes
  const expiresAt = Date.now() + expiresIn * 1000;

  await db.insert(deviceAuthCodes).values({
    id: crypto.randomUUID(),
    deviceCode,
    userCode,
    scope: options.scope ?? "mcp",
    clientId: options.clientId ?? null,
    expiresAt,
    approved: false,
    createdAt: Date.now(),
  });

  return { deviceCode, userCode, expiresIn };
}

export async function approveDeviceCode(
  db: DrizzleDB,
  userCode: string,
  userId: string,
): Promise<{ ok: boolean; error?: string }> {
  const now = Date.now();

  const result = await db
    .select()
    .from(deviceAuthCodes)
    .where(and(eq(deviceAuthCodes.userCode, userCode), gt(deviceAuthCodes.expiresAt, now)))
    .limit(1);

  if (result.length === 0) {
    return { ok: false, error: "Invalid or expired user code" };
  }

  await db
    .update(deviceAuthCodes)
    .set({ userId, approved: true })
    .where(eq(deviceAuthCodes.userCode, userCode));

  return { ok: true };
}

export async function exchangeDeviceCode(
  db: DrizzleDB,
  deviceCode: string,
): Promise<
  | { accessToken: string; tokenType: string; scope: string }
  | { error: string; errorDescription: string }
> {
  const now = Date.now();

  const result = await db
    .select()
    .from(deviceAuthCodes)
    .where(and(eq(deviceAuthCodes.deviceCode, deviceCode), gt(deviceAuthCodes.expiresAt, now)))
    .limit(1);

  if (result.length === 0) {
    return { error: "expired_token", errorDescription: "Device code expired or not found" };
  }

  const code = result[0];
  if (!code) {
    return { error: "expired_token", errorDescription: "Device code not found" };
  }

  if (!code.approved || !code.userId) {
    return {
      error: "authorization_pending",
      errorDescription: "User has not approved the device yet",
    };
  }

  // Generate access token
  const rawToken = generateCode("mcp_");
  const tokenHash = await hashToken(rawToken);
  const expiresAt = Date.now() + 90 * 24 * 60 * 60 * 1000; // 90 days

  await db.insert(oauthAccessTokens).values({
    id: crypto.randomUUID(),
    userId: code.userId,
    clientId: code.clientId,
    tokenHash,
    scope: code.scope,
    expiresAt,
    createdAt: Date.now(),
  });

  // Clean up the used device code
  await db.delete(deviceAuthCodes).where(eq(deviceAuthCodes.deviceCode, deviceCode));

  return {
    accessToken: rawToken,
    tokenType: "Bearer",
    scope: code.scope,
  };
}
