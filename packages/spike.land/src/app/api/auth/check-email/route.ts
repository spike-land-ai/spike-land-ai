/**
 * Email Check API Route
 *
 * Checks if an email exists in the database and whether the user has a password set.
 * Used for the unified authentication flow to determine the next step.
 *
 * Rate limited to prevent email enumeration attacks.
 */

import prisma from "@/lib/prisma";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getClientIp } from "@/lib/security/ip";
import { tryCatch } from "@/lib/try-catch";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// Abort slow operations before the ALB idle timeout (60s) kills the connection
const DB_QUERY_TIMEOUT_MS = 8_000;
const RATE_LIMIT_TIMEOUT_MS = 3_000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error(`Operation timed out after ${ms}ms`)), ms)
    ),
  ]);
}

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Rate limit config: 10 checks per minute per IP (prevent enumeration)
const emailCheckRateLimit = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

// Maximum request body size
const MAX_BODY_SIZE = 1024;

// Handle CORS preflight requests
export async function OPTIONS() {
  return new NextResponse(null, { status: 204 });
}

export async function POST(request: NextRequest) {
  // Check content length to prevent oversized payloads
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  // Rate limiting by IP address (user is not authenticated yet)
  const clientIP = getClientIp(request);
  const { data: rateLimitResult, error: rateLimitError } = await tryCatch(
    withTimeout(
      checkRateLimit(`email_check:${clientIP}`, emailCheckRateLimit),
      RATE_LIMIT_TIMEOUT_MS,
    ),
  );

  if (rateLimitError) {
    logger.error("Email check error:", rateLimitError);
    return NextResponse.json(
      { error: "Failed to check email" },
      { status: 500 },
    );
  }

  if (rateLimitResult!.isLimited) {
    return NextResponse.json(
      { error: "Too many requests. Please try again later." },
      {
        status: 429,
        headers: {
          "Retry-After": String(
            Math.ceil((rateLimitResult.resetAt - Date.now()) / 1000),
          ),
          "X-RateLimit-Remaining": String(rateLimitResult.remaining),
        },
      },
    );
  }

  const { data: body, error: jsonError } = await tryCatch(request.json());

  if (jsonError) {
    logger.error("Email check error:", jsonError);
    return NextResponse.json(
      { error: "Failed to check email" },
      { status: 500 },
    );
  }

  const { email } = body;

  // Input validation: required, string type
  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 },
    );
  }

  const trimmedEmail = email.trim().toLowerCase();

  // Validate email format
  if (!EMAIL_REGEX.test(trimmedEmail)) {
    return NextResponse.json(
      { error: "Invalid email format" },
      { status: 400 },
    );
  }

  // Check if user exists in database
  const { data: user, error: dbError } = await tryCatch(
    withTimeout(
      prisma.user.findUnique({
        where: { email: trimmedEmail },
        select: {
          id: true,
        },
      }),
      DB_QUERY_TIMEOUT_MS,
    ),
  );

  if (dbError) {
    logger.error("Email check error:", dbError);
    return NextResponse.json(
      { error: "Failed to check email" },
      { status: 500 },
    );
  }

  if (!user) {
    // User doesn't exist - they can create an account
    return NextResponse.json({
      exists: false,
      hasPassword: false,
    });
  }

  // Check if user has a credential (password) account in Better Auth
  const { data: credentialAccount, error: accountError } = await tryCatch(
    withTimeout(
      prisma.account.findFirst({
        where: { userId: user.id, providerId: "credential" },
        select: { id: true },
      }),
      DB_QUERY_TIMEOUT_MS,
    ),
  );

  if (accountError) {
    logger.error("Email check account query error:", accountError);
    return NextResponse.json(
      { error: "Failed to check email" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    exists: true,
    hasPassword: !!credentialAccount,
  });
}
