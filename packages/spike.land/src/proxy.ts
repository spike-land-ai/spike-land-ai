/**
 * Next.js Proxy for Protected Routes
 *
 * This proxy handles authentication-based route protection for the Spike Land platform.
 * It checks user authentication status and redirects unauthenticated users attempting to
 * access protected routes to the home page with a callback URL.
 *
 * Protected Routes:
 * - /settings - User settings page
 * - /profile - User profile page
 *
 * Public Routes:
 * - / - Home page
 * - /apps/* - Public applications directory
 * - /api/auth/* - NextAuth authentication endpoints
 * - All other routes not explicitly protected
 *
 * E2E Test Bypass:
 * - Requests with header 'x-e2e-auth-bypass' matching E2E_BYPASS_SECRET env var bypass authentication
 * - This allows E2E tests to access protected routes securely without real authentication
 */

import { KNOWN_ROUTE_SEGMENTS } from "@/lib/known-routes";
import { CSP_NONCE_HEADER, generateNonce } from "@/lib/security/csp-nonce";
import { secureCompare } from "@/lib/security/timing";
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const ONBOARDED_COOKIE = "spike-onboarded";
const SESSION_COOKIES = ["better-auth.session_token", "__Secure-better-auth.session_token"];

/**
 * Known route prefixes that should NOT be rewritten to /g/<path>.
 * Combines real app routes with Next.js internal prefixes.
 */
const KNOWN_PREFIXES = new Set([
  ...KNOWN_ROUTE_SEGMENTS,
  "_next", // Next.js internal assets
]);

/**
 * Check if a route is unknown and should be rewritten to /g/<path>
 * for dynamic app generation.
 */
export function shouldRewriteToGenerate(pathname: string): boolean {
  if (pathname === "/") return false;
  const firstSegment = pathname.split("/")[1];
  if (!firstSegment) return false;
  if (KNOWN_PREFIXES.has(firstSegment)) return false;
  // Skip paths that look like static files (dot in any segment, e.g. /docs-data/search-index.json)
  if (pathname.includes(".")) return false;
  return true;
}

/**
 * List of path patterns that require authentication
 * Paths are matched using startsWith for path prefixes
 */
const PROTECTED_PATHS = ["/settings", "/profile", "/enhance", "/admin"] as const;

/**
 * List of path patterns that are always public
 * These paths bypass authentication checks
 */
const PUBLIC_PATHS = [
  "/",
  "/apps",
  "/api/auth",
  "/auth/signin",
  "/auth/error",
  "/auth/qr-verify",
] as const;

/**
 * Checks if a given pathname requires authentication
 *
 * @param pathname - The URL pathname to check
 * @returns true if the path requires authentication, false otherwise
 */
export function isProtectedPath(pathname: string): boolean {
  // First check if path is explicitly public
  if (PUBLIC_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"))) {
    return false;
  }

  // Check if path matches any protected patterns
  return PROTECTED_PATHS.some((path) => pathname === path || pathname.startsWith(path + "/"));
}

/**
 * Helper to add CORS headers for development
 */
function addCorsHeaders(response: NextResponse, origin: string): NextResponse {
  if (process.env.NODE_ENV === "development") {
    const allowedOrigins = [
      "http://localhost:8081",
      "http://localhost:3000",
      "http://localhost:19006",
    ];
    if (allowedOrigins.includes(origin) || !origin) {
      response.headers.set("Access-Control-Allow-Origin", origin || "*");
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
  }
  return response;
}

/**
 * Next.js Proxy Function
 *
 * Executed for every request that matches the config matcher.
 * Checks authentication status for protected routes and redirects
 * unauthenticated users to the home page with a callback URL.
 *
 * @param request - The incoming Next.js request
 * @returns NextResponse - Either continues the request or redirects
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const origin = request.headers.get("origin") || "";

  // --- Deployment skew protection ---
  // When a client from a stale deployment calls a server action, return 409
  // to trigger a hard reload (prevents "Failed to find Server Action" errors).
  const DEPLOYMENT_ID =
    process.env.NEXT_DEPLOYMENT_ID ||
    process.env.CF_DEPLOYMENT_ID ||
    process.env.VERCEL_DEPLOYMENT_ID ||
    process.env.VERCEL_GIT_COMMIT_SHA ||
    "";
  const DEPLOYMENT_COOKIE = "__deployment_id";

  const isServerAction = request.method === "POST" && request.headers.has("next-action");

  if (isServerAction && DEPLOYMENT_ID) {
    const clientDeploymentId = request.cookies.get(DEPLOYMENT_COOKIE)?.value;
    if (clientDeploymentId && clientDeploymentId !== DEPLOYMENT_ID) {
      return new NextResponse(null, {
        status: 409,
        headers: { "x-nextjs-reload": "1" },
      });
    }
  }

  // Redirect POST requests to page-only auth routes.
  // These pages only render on GET; POST requests (from bots or misconfigured
  // clients) cause Next.js to call request.formData() looking for server action
  // IDs, which throws "Failed to parse body as FormData" when the body isn't
  // valid FormData. Using 303 See Other converts POST to GET per HTTP spec.
  if (request.method === "POST" && (pathname === "/auth/signin" || pathname === "/auth/error")) {
    const url = request.nextUrl.clone();
    return NextResponse.redirect(url, 303);
  }

  // Handle CORS preflight requests for API routes
  if (request.method === "OPTIONS" && pathname.startsWith("/api/")) {
    const response = new NextResponse(null, { status: 204 });
    if (process.env.NODE_ENV === "development") {
      response.headers.set("Access-Control-Allow-Origin", origin || "*");
      response.headers.set(
        "Access-Control-Allow-Methods",
        "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      );
      response.headers.set(
        "Access-Control-Allow-Headers",
        "Content-Type, Authorization, X-API-Key, X-Requested-With",
      );
      response.headers.set("Access-Control-Max-Age", "86400");
      response.headers.set("Access-Control-Allow-Credentials", "true");
    }
    return response;
  }

  // Rewrite unknown routes to /g/<path> for dynamic generation
  if (shouldRewriteToGenerate(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = `/g${pathname}`;
    return NextResponse.rewrite(url);
  }

  // Redirect authenticated but un-onboarded users from home to /onboarding.
  // Uses a lightweight cookie check (no DB hit).
  if (pathname === "/") {
    const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));
    const isOnboarded = request.cookies.has(ONBOARDED_COOKIE);
    if (hasSession && !isOnboarded) {
      return NextResponse.redirect(new URL("/onboarding", request.url));
    }
    // Returning users: check if AVL tree has grown since last round
    const profileRound = request.cookies.get("spike-profile-round")?.value;
    if (hasSession && isOnboarded && profileRound !== undefined) {
      // The onboarding page itself will check via API if new questions are available
      // Just redirect if the cookie hints at a new round being available
      const roundNum = parseInt(profileRound, 10);
      if (!isNaN(roundNum) && roundNum >= 0) {
        // Set a flag cookie to avoid redirect loops
        const lastRedirectRound = request.cookies.get("spike-last-redirect-round")?.value;
        if (lastRedirectRound !== profileRound) {
          const response = NextResponse.redirect(new URL("/onboarding", request.url));
          response.cookies.set("spike-last-redirect-round", profileRound, {
            path: "/",
            maxAge: 60 * 60 * 24 * 365,
            sameSite: "lax",
          });
          return response;
        }
      }
    }
  }

  // Embed routes serve self-contained HTML with inline scripts and esm.sh
  // imports. They set their own CSP — don't override it from middleware.
  const isEmbedRoute =
    /^\/api\/codespace\/[^/]+\/(embed|bundle|version\/\d+\/(embed|bundle))$/.test(pathname);

  // Generate CSP Nonce and Header
  const nonce = generateNonce();
  const cspHeader = `
    default-src 'self';
    img-src 'self' https://*.r2.dev https://*.r2.cloudflarestorage.com https://images.unsplash.com https://avatars.githubusercontent.com https://lh3.googleusercontent.com https://www.facebook.com https://platform-lookaside.fbsbx.com https://vercel.live https://vercel.com data: blob:;
    script-src 'self' 'unsafe-eval' 'unsafe-inline' 'wasm-unsafe-eval' 'nonce-${nonce}' blob: https://va.vercel-scripts.com https://connect.facebook.net https://vercel.live https://www.googletagmanager.com;
    style-src 'self' 'unsafe-inline' https://vercel.live;
    object-src 'none';
    font-src 'self' https://vercel.live https://assets.vercel.com https://fonts.gstatic.com data:;
    frame-src 'self' https://testing.spike.land https://vercel.live http://localhost:3000 https://www.facebook.com https://staticxx.facebook.com;
    connect-src 'self' blob: data: https://testing.spike.land wss://testing.spike.land https://*.r2.dev https://*.r2.cloudflarestorage.com https://generativelanguage.googleapis.com https://va.vercel-analytics.com https://vitals.vercel-insights.com https://www.facebook.com https://connect.facebook.net https://vercel.live https://fonts.gstatic.com https://fonts.googleapis.com wss://ws-us3.pusher.com wss://*.peerjs.com https://*.google-analytics.com https://*.analytics.google.com https://*.googletagmanager.com;
    worker-src 'self' blob: data:;
    media-src * blob: data:;
    frame-ancestors 'self';
    base-uri 'self';
    form-action 'self';
    ${process.env.NODE_ENV === "production" ? "upgrade-insecure-requests;" : ""}
  `
    .replace(/\s{2,}/g, " ")
    .trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set(CSP_NONCE_HEADER, nonce);
  if (!isEmbedRoute) {
    requestHeaders.set("Content-Security-Policy", cspHeader);
    // Next.js/vinext uses this header to detect CSP from middleware
    // and apply the nonce to dynamically generated inline scripts
    requestHeaders.set("x-middleware-request-content-security-policy", cspHeader);
  }

  // Helper to apply headers to response
  const applyHeaders = (response: NextResponse) => {
    if (!isEmbedRoute) {
      response.headers.set("Content-Security-Policy", cspHeader);
    }
    // Set deployment ID cookie for skew protection
    if (DEPLOYMENT_ID) {
      response.cookies.set(DEPLOYMENT_COOKIE, DEPLOYMENT_ID, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      });
    }
    // Add CORS headers for API routes in development
    if (pathname.startsWith("/api/")) {
      addCorsHeaders(response, origin);
    }
    // Set deployment ID cookie for skew protection
    if (DEPLOYMENT_ID) {
      response.cookies.set(DEPLOYMENT_COOKIE, DEPLOYMENT_ID, {
        httpOnly: true,
        sameSite: "strict",
        path: "/",
      });
    }
    return response;
  };

  // Skip proxy for non-protected paths
  if (!isProtectedPath(pathname)) {
    return applyHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
    );
  }

  // Check for E2E test bypass header with secret validation
  // This allows E2E tests to bypass authentication securely
  // Uses constant-time comparison to prevent timing attacks
  // SECURITY: Only enabled in non-production environments
  const e2eBypassHeader = request.headers.get("x-e2e-auth-bypass");
  // Sanitize the secret to handle any trailing whitespace/newlines from environment
  const e2eBypassSecret = process.env.E2E_BYPASS_SECRET?.trim().replace(/[\r\n]/g, "");

  // Only allow E2E bypass in non-production environments
  // This prevents accidental bypass in production even if the secret leaks
  // Staging (next.spike.land) is allowed to use E2E bypass for smoke tests
  // Use environment variable for domain check to prevent Host header injection
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "";
  const isStagingDomain = appUrl === "https://next.spike.land" || appUrl.includes("localhost");
  const isProduction =
    process.env.NODE_ENV === "production" &&
    process.env.APP_ENV === "production" &&
    !isStagingDomain;

  // Check for E2E bypass via header (primary method)
  const hasValidHeader =
    !isProduction &&
    e2eBypassSecret &&
    e2eBypassHeader &&
    secureCompare(e2eBypassHeader, e2eBypassSecret);

  // Check for E2E bypass via cookies (fallback method)
  // This handles cases where the header is sent but cookies are already set
  // SECURITY: Require key validation matching the header implementation
  const e2eRoleCookie = request.cookies.get("e2e-user-role")?.value;
  const e2eSecretCookie = request.cookies.get("e2e-bypass-secret")?.value;

  const hasValidCookie =
    !isProduction &&
    e2eBypassSecret &&
    e2eSecretCookie &&
    secureCompare(e2eSecretCookie, e2eBypassSecret) &&
    e2eRoleCookie !== undefined;

  // SECURITY: Never allow E2E bypass on admin routes
  const isAdminRoute = pathname.startsWith("/admin") || pathname.startsWith("/api/admin");

  if ((hasValidHeader || hasValidCookie) && !isAdminRoute) {
    // Determine which method succeeded for logging
    const bypassMethod = hasValidHeader ? "header" : "cookie";

    // Audit log for security monitoring and debugging
    console.warn("[E2E Bypass]", {
      timestamp: new Date().toISOString(),
      path: pathname,
      method: bypassMethod,
      environment: {
        NODE_ENV: process.env.NODE_ENV,
        APP_ENV: process.env.APP_ENV,
      },
    });
    return applyHeaders(
      NextResponse.next({
        request: {
          headers: requestHeaders,
        },
      }),
    );
  }

  // Check authentication via session cookie presence.
  // On Cloudflare Workers, self-fetch (loopback) is not possible, so we use
  // a lightweight cookie check instead of calling /api/auth/get-session.
  // The actual session validity is verified server-side when the page loads.
  const hasSession = SESSION_COOKIES.some((name) => request.cookies.has(name));

  // If user is not authenticated, redirect to sign in page with callback URL
  if (!hasSession) {
    const url = new URL("/", request.url);
    url.searchParams.set("auth", "required");
    url.searchParams.set("callbackUrl", pathname);
    return applyHeaders(NextResponse.redirect(url));
  }

  // User is authenticated, allow access
  return applyHeaders(
    NextResponse.next({
      request: {
        headers: requestHeaders,
      },
    }),
  );
}

/**
 * Proxy Configuration
 *
 * Defines which routes the proxy should run on.
 * Using a matcher to exclude static files, images, and internal Next.js routes
 * for better performance.
 */
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - public folder files (images, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};

// Export default proxy for Next.js middleware compatibility
export default proxy;
