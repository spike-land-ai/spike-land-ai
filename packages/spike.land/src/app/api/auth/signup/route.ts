import logger from "@/lib/logger";

/**
 * User Signup API Route
 *
 * Creates a new user account with email and password.
 * Rate limited to prevent abuse. After signup, the user should
 * sign in using the credentials provider.
 */

import { checkRateLimit } from "@/lib/rate-limiter";
import { getClientIp } from "@/lib/security/ip";
import { tryCatch } from "@/lib/try-catch";
import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

// Email validation regex (RFC 5322 simplified)
const EMAIL_REGEX =
  /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

// Rate limit config: 5 signups per hour per IP
const signupRateLimit = {
  maxRequests: 5,
  windowMs: 60 * 60 * 1000, // 1 hour
};

// Maximum request body size
const MAX_BODY_SIZE = 2048;

// Minimum password length
const MIN_PASSWORD_LENGTH = 8;

async function handleSignup(request: NextRequest): Promise<NextResponse> {
  // Registration gate - email+password signups only
  if (process.env.REGISTRATION_OPEN !== "true") {
    return NextResponse.json(
      {
        error: "Registration is temporarily closed. Join our waiting list.",
        waitlistUrl: "/waitlist",
      },
      { status: 503 },
    );
  }

  // Check content length to prevent oversized payloads
  const contentLength = request.headers.get("content-length");
  if (contentLength && parseInt(contentLength, 10) > MAX_BODY_SIZE) {
    return NextResponse.json({ error: "Request too large" }, { status: 413 });
  }

  // Rate limiting by IP address
  const clientIP = getClientIp(request);
  const rateLimitResult = await checkRateLimit(
    `signup:${clientIP}`,
    signupRateLimit,
  );

  if (rateLimitResult.isLimited) {
    return NextResponse.json(
      { error: "Too many signup attempts. Please try again later." },
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

  const body = await request.json();
  const { email, password } = body;

  // Input validation: email required and must be string
  if (!email || typeof email !== "string") {
    return NextResponse.json(
      { error: "Email is required" },
      { status: 400 },
    );
  }

  // Input validation: password required, must be string, minimum length
  if (!password || typeof password !== "string") {
    return NextResponse.json(
      { error: "Password is required" },
      { status: 400 },
    );
  }

  if (password.length < MIN_PASSWORD_LENGTH) {
    return NextResponse.json(
      {
        error: `Password must be at least ${MIN_PASSWORD_LENGTH} characters`,
      },
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

  // Use local Better Auth instance for registration
  const { authInstance } = await import("@/auth");
  const { data: result, error: authError } = await tryCatch(
    authInstance.api.signUpEmail({
      body: { email: trimmedEmail, password, name: "" },
    })
  );

  if (authError) {
    logger.error("Signup error:", authError);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }

  if (!result?.user) {
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }

  // Post-signup tasks (workspace, albums, admin bootstrap) are handled
  // by databaseHooks.user.create.after in src/auth.ts

  return NextResponse.json({
    success: true,
    message: "Account created successfully",
    user: {
      id: result.user.id,
      email: result.user.email,
    },
  });
}

export async function POST(request: NextRequest) {
  const { data: response, error } = await tryCatch(handleSignup(request));

  if (error) {
    logger.error("Signup error:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 },
    );
  }

  return response;
}
