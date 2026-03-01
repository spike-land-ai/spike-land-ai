import type { NextConfig } from "next";
import path from "path";

/**
 * Security headers configuration
 *
 * These headers protect against common web vulnerabilities:
 * - X-DNS-Prefetch-Control: Enables DNS prefetching for performance
 * - X-Frame-Options: Prevents clickjacking attacks (OWASP A5:2017)
 * - X-Content-Type-Options: Prevents MIME type sniffing attacks
 * - X-XSS-Protection: Legacy XSS filter for older browsers
 * - Referrer-Policy: Controls referrer information leakage
 * - Permissions-Policy: Restricts browser feature access
 * - Content-Security-Policy: Restricts resource loading (OWASP A03)
 *
 * @see https://owasp.org/www-project-secure-headers/
 */
const securityHeaders = [
  {
    key: "X-DNS-Prefetch-Control",
    value: "on",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=31536000; includeSubDomains; preload",
  },
  {
    // Use SAMEORIGIN to allow admin sitemap preview while preventing cross-origin clickjacking
    key: "X-Frame-Options",
    value: "SAMEORIGIN",
  },
  {
    key: "X-Content-Type-Options",
    value: "nosniff",
  },
  {
    key: "X-XSS-Protection",
    value: "1; mode=block",
  },
  {
    key: "Referrer-Policy",
    value: "strict-origin-when-cross-origin",
  },
  {
    key: "Permissions-Policy",
    // camera=(self) needed for QA Studio browser automation and chess arena webcam features
    value: "camera=(self), microphone=(self), geolocation=()",
  },
  {
    // SECURITY: Global CSP for non-codespace pages.
    // Codespace/live/bundle routes set their own more permissive CSP inline.
    // OWASP A03:2021 — default-src 'self' prevents most XSS vectors.
    key: "Content-Security-Policy",
    value: [
      "default-src 'self'",
      "script-src 'self' 'unsafe-inline' 'unsafe-eval' https://vercel.live",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob: https:",
      "font-src 'self' data:",
      "connect-src 'self' https: wss:",
      "frame-src 'self' https://vercel.live https://testing.spike.land",
      "frame-ancestors 'self'",
      "object-src 'none'",
      "base-uri 'self'",
      "form-action 'self'",
      "upgrade-insecure-requests",
    ].join("; "),
  },
];

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      allowedOrigins: [
        "spike.land",
        "www.spike.land",
        "localhost:3000",
        "*.elb.amazonaws.com",
        "*.amazonaws.com",
      ],
    },
  },
  // Exclude heavy native/platform-specific packages from the server bundle.
  serverExternalPackages: [
    "@spike-land-ai/esbuild-wasm",
    "@spike-land-ai/react-ts-worker",
    "esbuild",
    "@swc/core",
    "@swc/wasm",
    "@spike-land-ai/spike-cli",
    "typescript",
    "webpack",
  ],
  // Turbopack configuration
  turbopack: {
    root: __dirname,
  },
  // Transpile ESM packages to avoid runtime resolution issues with PnP
  transpilePackages: ["next-mdx-remote"],
  typescript: {
    // TypeScript checking is handled by CI's `tsc --noEmit` step
    // Skip during build to reduce memory usage when SKIP_TS_BUILD_CHECK=true
    ignoreBuildErrors: process.env.SKIP_TS_BUILD_CHECK === "true",
  },
  // Standalone output for Docker/ECS deployment (~200MB vs ~1GB).
  output: "standalone" as const,
  // Exclude heavy platform-specific binaries from output tracing.
  // serverExternalPackages only prevents webpack bundling; outputFileTracingExcludes
  // prevents these from being included in the standalone output.
  outputFileTracingExcludes: {
    "*": [
      // SWC platform binaries (~175MB total across all platforms)
      "node_modules/@swc/core-*/**",
      "node_modules/@swc/core/**",
      "node_modules/@swc/wasm/**",
      // esbuild platform binaries (~52MB total)
      "node_modules/@esbuild/**",
      "node_modules/esbuild/**",
      "node_modules/esbuild-wasm/**",
      // Cloudflare workerd binary
      "node_modules/workerd/**",
      // Dev-only tools that shouldn't be in production
      "node_modules/typescript/**",
      "node_modules/webpack/**",
      "node_modules/terser/**",
    ],
  },
  images: {
    dangerouslyAllowSVG: true,
    contentDispositionType: "attachment",
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
    remotePatterns: [
      {
        protocol: "https",
        hostname: "pub-cf0adddb5752426a96ef090997e0da95.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.r2.dev",
      },
      {
        protocol: "https",
        hostname: "*.r2.cloudflarestorage.com",
      },
      {
        protocol: "https",
        hostname: "images.unsplash.com",
      },
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
  async headers() {
    // CORS headers for API routes (allows mobile app in development)
    const corsHeaders = [
      {
        key: "Access-Control-Allow-Origin",
        value: process.env.NODE_ENV === "development"
          ? "*"
          : "https://spike.land",
      },
      {
        key: "Access-Control-Allow-Methods",
        value: "GET, POST, PUT, DELETE, PATCH, OPTIONS",
      },
      {
        key: "Access-Control-Allow-Headers",
        value: "Content-Type, Authorization, X-API-Key",
      },
      {
        key: "Access-Control-Max-Age",
        value: "86400",
      },
    ];

    // Apply security headers to all routes
    // Note: X-Frame-Options: SAMEORIGIN and frame-ancestors 'self' allow
    // same-origin iframes (used by admin sitemap preview) while preventing
    // cross-origin clickjacking attacks
    return [
      {
        source: "/.well-known/:path*",
        headers: [
          { key: "Access-Control-Allow-Origin", value: "*" },
          { key: "Access-Control-Allow-Methods", value: "GET, OPTIONS" },
          { key: "Access-Control-Allow-Headers", value: "Content-Type" },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        source: "/api/mcp",
        headers: [
          {
            key: "Access-Control-Allow-Origin",
            value: process.env.NODE_ENV === "development"
              ? "*"
              : "https://spike.land",
          },
          {
            key: "Access-Control-Allow-Methods",
            value: "GET, POST, DELETE, OPTIONS",
          },
          {
            key: "Access-Control-Allow-Headers",
            value: "Content-Type, Authorization",
          },
          { key: "Access-Control-Max-Age", value: "86400" },
        ],
      },
      {
        source: "/api/:path*",
        headers: corsHeaders,
      },
      {
        source: "/:path*",
        headers: securityHeaders,
      },
    ];
  },
  async redirects() {
    return [
      {
        source: "/docs/SKILLS",
        destination: "/store/skills/bazdmeg",
        permanent: false,
      },
      // Landing theme pages → dynamic pages
      {
        source: "/landing/apple",
        destination: "/p/landing-apple",
        permanent: true,
      },
      {
        source: "/landing/stripe",
        destination: "/p/landing-stripe",
        permanent: true,
      },
      {
        source: "/landing/vercel",
        destination: "/p/landing-vercel",
        permanent: true,
      },
      {
        source: "/landing/linear",
        destination: "/p/landing-linear",
        permanent: true,
      },
      {
        source: "/landing/figma",
        destination: "/p/landing-figma",
        permanent: true,
      },
      {
        source: "/landing/notion",
        destination: "/p/landing-notion",
        permanent: true,
      },
      {
        source: "/landing/discord",
        destination: "/p/landing-discord",
        permanent: true,
      },
      {
        source: "/landing/framer",
        destination: "/p/landing-framer",
        permanent: true,
      },
      {
        source: "/landing/supabase",
        destination: "/p/landing-supabase",
        permanent: true,
      },
      {
        source: "/landing/brutalist",
        destination: "/p/landing-brutalist",
        permanent: true,
      },
      {
        source: "/landing",
        destination: "/p/landing-gallery",
        permanent: true,
      },
      // Feature pages → dynamic pages
      {
        source: "/features/ab-testing",
        destination: "/p/features-ab-testing",
        permanent: true,
      },
      {
        source: "/features/ai-calendar",
        destination: "/p/features-ai-calendar",
        permanent: true,
      },
      {
        source: "/features/ai-tools",
        destination: "/p/features-ai-tools",
        permanent: true,
      },
      {
        source: "/features/analytics",
        destination: "/p/features-analytics",
        permanent: true,
      },
      {
        source: "/features/brand-brain",
        destination: "/p/features-brand-brain",
        permanent: true,
      },
      {
        source: "/features/calendar",
        destination: "/p/features-calendar",
        permanent: true,
      },
      { source: "/features", destination: "/p/features", permanent: true },
      // Persona pages → dynamic pages
      {
        source: "/personas/:slug",
        destination: "/p/persona-:slug",
        permanent: true,
      },
      { source: "/personas", destination: "/p/personas", permanent: true },
      // App redirects (migrated from page-level redirects)
      { source: "/apps", destination: "/apps/store", permanent: true },
      { source: "/store", destination: "/apps/store", permanent: true },
      { source: "/albums", destination: "/apps/pixel", permanent: true },
      { source: "/mcp", destination: "/apps/mcp-explorer", permanent: true },
      {
        source: "/admin/qa-studio",
        destination: "/apps/qa-studio",
        permanent: false,
      },
      {
        source: "/apps/display",
        destination: "/apps/display/run",
        permanent: false,
      },
    ];
  },
  // Webpack configuration for Yarn PnP compatibility
  webpack: config => {
    // Map @prisma/client to the generated Prisma client location
    // This ensures both TypeScript and webpack resolve to the same generated client
    config.resolve.alias["@prisma/client"] = path.resolve(
      __dirname,
      "src/generated/prisma",
    );
    return config;
  },
};

export default nextConfig;
