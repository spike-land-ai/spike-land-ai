import { redis } from "@/lib/upstash/client";
import { createHash, randomBytes } from "crypto";

const QR_SESSION_TTL_SECONDS = 5 * 60; // 5 minutes
const QR_ONE_TIME_CODE_LENGTH = 32;

interface QRSession {
  status: "PENDING" | "APPROVED";
  oneTimeCode?: string;
  userId?: string;
}

/**
 * Generate a QR auth token and store its hash in Redis.
 * Returns the raw token (for QR code) and its SHA-256 hash (for polling).
 */
export async function initiateQRAuth(): Promise<{ token: string; hash: string }> {
  const token = randomBytes(32).toString("base64url");
  const hash = createHash("sha256").update(token).digest("hex");

  const session: QRSession = { status: "PENDING" };
  await redis.set(`qr_auth:${hash}`, JSON.stringify(session), { ex: QR_SESSION_TTL_SECONDS });

  return { token, hash };
}

/**
 * Poll for QR auth status. Desktop client calls this periodically.
 */
export async function pollQRAuth(hash: string): Promise<QRSession | null> {
  const data = await redis.get<string>(`qr_auth:${hash}`);
  if (!data) return null;
  return JSON.parse(typeof data === "string" ? data : JSON.stringify(data)) as QRSession;
}

/**
 * Mobile user approves the QR auth session.
 * Validates the token hash exists and is PENDING, then sets APPROVED with one-time code.
 */
export async function approveQRAuth(
  token: string,
  userId: string,
): Promise<{ hash: string; oneTimeCode: string } | null> {
  const hash = createHash("sha256").update(token).digest("hex");
  const data = await redis.get<string>(`qr_auth:${hash}`);
  if (!data) return null;

  const session = JSON.parse(typeof data === "string" ? data : JSON.stringify(data)) as QRSession;
  if (session.status !== "PENDING") return null;

  const oneTimeCode = randomBytes(QR_ONE_TIME_CODE_LENGTH).toString("base64url");

  const updatedSession: QRSession = {
    status: "APPROVED",
    oneTimeCode,
    userId,
  };

  // Keep the same TTL - get remaining TTL first
  const ttl = await redis.ttl(`qr_auth:${hash}`);
  const expirySeconds = ttl > 0 ? ttl : QR_SESSION_TTL_SECONDS;
  await redis.set(`qr_auth:${hash}`, JSON.stringify(updatedSession), { ex: expirySeconds });

  return { hash, oneTimeCode };
}

/**
 * Complete QR auth by verifying the one-time code.
 * Desktop uses this to finish authentication.
 * Deletes the session from Redis after successful verification.
 */
export async function completeQRAuth(hash: string, oneTimeCode: string): Promise<string | null> {
  const data = await redis.get<string>(`qr_auth:${hash}`);
  if (!data) return null;

  const session = JSON.parse(typeof data === "string" ? data : JSON.stringify(data)) as QRSession;
  if (session.status !== "APPROVED") return null;
  if (!session.oneTimeCode || !session.userId) return null;

  // Use timing-safe comparison for the one-time code
  const { timingSafeEqual } = await import("crypto");
  const a = Buffer.from(session.oneTimeCode);
  const b = Buffer.from(oneTimeCode);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;

  // Delete session to prevent reuse
  await redis.del(`qr_auth:${hash}`);

  return session.userId;
}
