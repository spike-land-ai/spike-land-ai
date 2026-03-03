/**
 * Device Authorization Service (RFC 8628-inspired)
 *
 * Implements the device authorization grant flow for MCP clients.
 * Allows CLI/terminal tools to authenticate by showing a link + user code
 * that the user approves in their browser.
 */

import logger from "@/lib/logger";
import prisma from "@/lib/prisma";
import { createHash, randomBytes } from "crypto";

import { generateTokenPair } from "./token-service";

const DEVICE_CODE_TTL_MS = 15 * 60 * 1000; // 15 minutes
const DEFAULT_POLL_INTERVAL = 5; // seconds
const MIN_POLL_INTERVAL_MS = 4000; // 4 seconds minimum between polls

// Exclude ambiguous characters: 0, O, I, L, 1
const USER_CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const USER_CODE_LENGTH = 8; // XXXX-XXXX format

function generateUserCode(): string {
  const charCount = USER_CODE_CHARS.length;
  // Use rejection sampling to avoid modulo bias (RFC 8628 §6.1)
  // 256 % 31 = 8, so naive modulo would over-represent the first 8 chars.
  const maxUnbiased = 256 - (256 % charCount);
  let code = "";
  while (code.length < USER_CODE_LENGTH) {
    const [byte] = randomBytes(1);
    if (byte !== undefined && byte < maxUnbiased) {
      code += USER_CODE_CHARS[byte % charCount];
    }
  }
  // Format as XXXX-XXXX
  return `${code.slice(0, 4)}-${code.slice(4)}`;
}

function hashDeviceCode(deviceCode: string): string {
  return createHash("sha256").update(deviceCode).digest("hex");
}

interface DeviceCodeResponse {
  deviceCode: string;
  userCode: string;
  verificationUri: string;
  verificationUriComplete: string;
  expiresIn: number;
  interval: number;
}

/**
 * Generate a device code and user code for the device authorization flow.
 */
export async function generateDeviceCode(
  clientId: string,
  baseUrl: string,
): Promise<DeviceCodeResponse> {
  const deviceCode = randomBytes(32).toString("base64url");
  const userCode = generateUserCode();

  try {
    await prisma.deviceAuthorizationCode.create({
      data: {
        deviceCodeHash: hashDeviceCode(deviceCode),
        userCode,
        clientId,
        expiresAt: new Date(Date.now() + DEVICE_CODE_TTL_MS),
        interval: DEFAULT_POLL_INTERVAL,
      },
    });
  } catch (error) {
    logger.error("Failed to create device authorization code", { clientId, error });
    throw error;
  }

  const verificationUri = `${baseUrl}/mcp/auth/device`;

  return {
    deviceCode,
    userCode,
    verificationUri,
    verificationUriComplete: `${verificationUri}?user_code=${userCode}`,
    expiresIn: Math.floor(DEVICE_CODE_TTL_MS / 1000),
    interval: DEFAULT_POLL_INTERVAL,
  };
}

/**
 * Verify a user code and return the associated client name.
 * Used by the browser verification page to show what client is requesting access.
 */
export async function verifyUserCode(
  userCode: string,
): Promise<{ valid: boolean; clientName?: string; expiresAt?: Date; }> {
  const record = await prisma.deviceAuthorizationCode.findUnique({
    where: { userCode },
    select: {
      status: true,
      expiresAt: true,
      client: { select: { clientName: true } },
    },
  });

  if (!record) return { valid: false };
  if (record.status !== "PENDING") return { valid: false };
  if (record.expiresAt < new Date()) return { valid: false };

  return {
    valid: true,
    clientName: record.client.clientName,
    expiresAt: record.expiresAt,
  };
}

/**
 * Approve a device code on behalf of a user.
 * Uses atomic updateMany (same pattern as exchangeAuthorizationCode) to prevent TOCTOU.
 */
export async function approveDeviceCode(
  userCode: string,
  userId: string,
): Promise<boolean> {
  const updated = await prisma.deviceAuthorizationCode.updateMany({
    where: {
      userCode,
      status: "PENDING",
      expiresAt: { gt: new Date() },
    },
    data: {
      status: "APPROVED",
      userId,
    },
  });

  return updated.count > 0;
}

/**
 * Deny a device code.
 */
export async function denyDeviceCode(userCode: string): Promise<boolean> {
  const updated = await prisma.deviceAuthorizationCode.updateMany({
    where: {
      userCode,
      status: "PENDING",
    },
    data: {
      status: "DENIED",
    },
  });

  return updated.count > 0;
}

type PollResult =
  | { status: "authorization_pending"; }
  | { status: "slow_down"; interval: number; }
  | { status: "access_denied"; }
  | { status: "expired_token"; }
  | {
    status: "approved";
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
    tokenType: string;
    scope: string;
  };

/**
 * Poll for device code status. Called by the MCP client.
 * Returns token pair when approved, or error status otherwise.
 */
export async function pollDeviceCode(
  deviceCode: string,
  clientId: string,
): Promise<PollResult> {
  const deviceCodeHash = hashDeviceCode(deviceCode);

  const record = await prisma.deviceAuthorizationCode.findUnique({
    where: { deviceCodeHash },
    select: {
      id: true,
      clientId: true,
      userId: true,
      scope: true,
      status: true,
      expiresAt: true,
      interval: true,
      lastPolledAt: true,
    },
  });

  if (!record) return { status: "expired_token" };
  if (record.clientId !== clientId) return { status: "expired_token" };
  if (record.expiresAt < new Date()) return { status: "expired_token" };

  // Enforce polling interval (slow_down if too fast)
  const now = new Date();
  if (record.lastPolledAt) {
    const elapsed = now.getTime() - record.lastPolledAt.getTime();
    if (elapsed < MIN_POLL_INTERVAL_MS) {
      // Increase interval by 1 second per RFC 8628
      const newInterval = record.interval + 1;
      await prisma.deviceAuthorizationCode.update({
        where: { id: record.id },
        data: { lastPolledAt: now, interval: newInterval },
      });
      return { status: "slow_down", interval: newInterval };
    }
  }

  // Update lastPolledAt
  await prisma.deviceAuthorizationCode.update({
    where: { id: record.id },
    data: { lastPolledAt: now },
  });

  switch (record.status) {
    case "PENDING":
      return { status: "authorization_pending" };

    case "DENIED":
      return { status: "access_denied" };

    case "EXPIRED":
      return { status: "expired_token" };

    case "APPROVED": {
      if (!record.userId) return { status: "expired_token" };

      try {
        // Generate token pair
        const tokens = await generateTokenPair(
          record.userId,
          record.clientId,
          record.scope,
        );

        // Mark as used by deleting the record
        await prisma.deviceAuthorizationCode.delete({
          where: { id: record.id },
        });

        return {
          status: "approved",
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          expiresIn: tokens.expiresIn,
          tokenType: tokens.tokenType,
          scope: tokens.scope,
        };
      } catch (error) {
        logger.error("Failed to generate tokens for approved device code", {
          deviceCodeId: record.id,
          error,
        });
        throw error;
      }
    }

    default: {
      logger.warn("Unknown device authorization status", {
        status: record.status,
        deviceCodeId: record.id,
      });
      return { status: "expired_token" };
    }
  }
}

/**
 * Clean up expired device authorization codes.
 */
export async function cleanupExpiredDeviceCodes(): Promise<number> {
  const result = await prisma.deviceAuthorizationCode.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}
