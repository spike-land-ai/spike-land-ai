/**
 * Mobile Sign In API Route
 *
 * Authenticates a user with email and password for mobile apps.
 * Returns a JWT token for subsequent API calls.
 */

import { createStableUserId } from "@/auth.config";
import { checkRateLimit } from "@/lib/rate-limiter";
import { getClientIp } from "@/lib/security/ip";
import { tryCatch } from "@/lib/try-catch";
import { SignJWT } from "jose";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { logger } from "@/lib/logger";

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Rate limit config: 10 signin attempts per minute per IP
const signinRateLimit = {
  maxRequests: 10,
  windowMs: 60 * 1000, // 1 minute
};

// Maximum request body size
const MAX_BODY_SIZE = 2048;

// Token expiration: 30 days
const TOKEN_EXPIRATION_DAYS = 30;

/**
 * Create a JWT token for mobile authentication
 */
async function createMobileToken(
  userId: string,
  email: string,
): Promise<{ token: string; expiresAt: Date; }> {
  const secret = new TextEncoder().encode(process.env.AUTH_SECRET);
  const expiresAt = new Date(
    Date.now() + TOKEN_EXPIRATION_DAYS * 24 * 60 * 60 * 1000,
  );

  const token = await new SignJWT({ sub: userId, email })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(Math.floor(expiresAt.getTime() / 1000))
    .sign(secret);

  return { token, expiresAt };
}

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

  // Rate limiting by IP address
  const clientIP = getClientIp(request);
  const { data: rateLimitResult, error: rateLimitError } = await tryCatch(
    checkRateLimit(`mobile_signin:${clientIP}`, signinRateLimit),
  );

  if (rateLimitError) {
    logger.error("Mobile signin error:", rateLimitError);
    return NextResponse.json(
      { error: "Failed to sign in" },
      { status: 500 },
    );
  }

  if (rateLimitResult!.isLimited) {
    return NextResponse.json(
      { error: "Too many signin attempts. Please try again later." },
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
    logger.error("Mobile signin error:", jsonError);
    return NextResponse.json(
      { error: "Invalid request body" },
      { status: 400 },
    );
  }

  const { email, password } = body;

  // Input validation: email required and must be string
  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 },
    );
  }

  // Input validation: password required and must be string
  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Password is required" },
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

  // Use local Better Auth instance for sign-in
  const { authInstance } = await import("@/auth");
  const { data: signInResult, error: authError } = await tryCatch(
    authInstance.api.signInEmail({
      body: { email: trimmedEmail, password },
    })
  );

  if (authError || !signInResult?.user) {
    if (authError) {
      logger.error("Mobile signin error:", authError);
    }
    return NextResponse.json(
      { error: "Invalid email or password" },
      { status: 401 },
    );
  }

  const user = signInResult.user;

  // Create stable user ID (consistent with auth.config)
  const stableUserId = createStableUserId(trimmedEmail);

  // Generate JWT token
  const { data: tokenData, error: tokenError } = await tryCatch(
    createMobileToken(stableUserId, trimmedEmail),
  );

  if (tokenError) {
    logger.error("Mobile signin error:", tokenError);
    return NextResponse.json(
      { error: "Failed to create session" },
      { status: 500 },
    );
  }

  // Return user info and token
  return NextResponse.json({
    user: {
      id: stableUserId,
      email: user.email,
      name: user.name,
      image: user.image,
    },
    token: tokenData.token,
    expiresAt: tokenData.expiresAt.toISOString(),
  });
}
