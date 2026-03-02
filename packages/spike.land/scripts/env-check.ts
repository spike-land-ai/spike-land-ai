#!/usr/bin/env tsx
/**
 * Environment Check Script
 *
 * Validates that environment variables are not only set but actually working.
 * Makes real API calls to verify credentials are valid.
 *
 * Usage:
 *   yarn env:check           # Check all services
 *   yarn env:check --verbose # Show more details
 */

import { ListBucketsCommand, S3Client } from "@aws-sdk/client-s3";
import { config } from "dotenv";

// Load .env.local for local development
config({ path: ".env.local", quiet: true });

// Types
interface CheckResult {
  name: string;
  category: "core" | "oauth" | "services" | "social";
  status: "pass" | "fail" | "skip";
  message: string;
  required: boolean;
}

type CheckFunction = () => Promise<CheckResult>;

const TIMEOUT_MS = 5000;
const verbose = process.argv.includes("--verbose");

// Helper: fetch with timeout
async function fetchWithTimeout(
  url: string,
  options: RequestInit = {},
  timeoutMs = TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timeout);
  }
}

// =====================
// CORE CHECKS (Required)
// =====================

async function checkDatabase(): Promise<CheckResult> {
  const name = "DATABASE_URL";
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    return {
      name,
      category: "core",
      status: "fail",
      message: "Not set (required)",
      required: true,
    };
  }

  try {
    // Dynamic imports to avoid build-time issues
    const { PrismaPg } = await import("@prisma/adapter-pg");
    const { PrismaClient } = await import("@prisma/client");

    const adapter = new PrismaPg({ connectionString });
    const prisma = new PrismaClient({
      adapter,
      log: [],
    });

    // Simple query to verify connection
    await prisma.$queryRaw`SELECT 1`;
    await prisma.$disconnect();

    // Extract host from URL for display
    const match = connectionString.match(/@([^/:]+)/);
    const host = match ? match[1] : "connected";

    return {
      name,
      category: "core",
      status: "pass",
      message: `Connected (${host})`,
      required: true,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Connection failed";
    return {
      name,
      category: "core",
      status: "fail",
      message: msg.slice(0, 60),
      required: true,
    };
  }
}

async function checkAuthSecret(): Promise<CheckResult> {
  const name = "AUTH_SECRET";
  const secret = process.env.AUTH_SECRET;

  if (!secret) {
    return {
      name,
      category: "core",
      status: "fail",
      message: "Not set (required)",
      required: true,
    };
  }

  if (secret.length < 32) {
    return {
      name,
      category: "core",
      status: "fail",
      message: `Too short (${secret.length} chars, need 32+)`,
      required: true,
    };
  }

  return {
    name,
    category: "core",
    status: "pass",
    message: `Valid (${secret.length} chars)`,
    required: true,
  };
}

async function checkNextAuthUrl(): Promise<CheckResult> {
  const name = "NEXTAUTH_URL";
  const url = process.env.NEXTAUTH_URL;

  if (!url) {
    // Optional in production (Vercel sets it automatically)
    return {
      name,
      category: "core",
      status: "skip",
      message: "Not set (optional, Vercel auto-sets)",
      required: false,
    };
  }

  try {
    new URL(url);
    return {
      name,
      category: "core",
      status: "pass",
      message: url,
      required: false,
    };
  } catch {
    return {
      name,
      category: "core",
      status: "fail",
      message: "Invalid URL format",
      required: false,
    };
  }
}

// =====================
// OAUTH PROVIDERS
// =====================

async function checkGitHub(): Promise<CheckResult> {
  const name = "GitHub OAuth";
  const clientId = process.env.GITHUB_ID;
  const clientSecret = process.env.GITHUB_SECRET;

  if (!clientId || !clientSecret) {
    return {
      name,
      category: "oauth",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    // GitHub doesn't have a simple validation endpoint, so we check format
    if (clientId.length < 15 || clientSecret.length < 30) {
      return {
        name,
        category: "oauth",
        status: "fail",
        message: "Invalid credentials format",
        required: false,
      };
    }
    return {
      name,
      category: "oauth",
      status: "pass",
      message: `App ID: ${clientId.slice(0, 8)}...`,
      required: false,
    };
  } catch {
    return {
      name,
      category: "oauth",
      status: "fail",
      message: "Validation failed",
      required: false,
    };
  }
}

async function checkGoogle(): Promise<CheckResult> {
  const name = "Google OAuth";
  const clientId = process.env.GOOGLE_ID;
  const clientSecret = process.env.GOOGLE_SECRET;

  if (!clientId || !clientSecret) {
    return {
      name,
      category: "oauth",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    // Verify format (Google client IDs end with .apps.googleusercontent.com)
    if (!clientId.includes(".apps.googleusercontent.com")) {
      return {
        name,
        category: "oauth",
        status: "fail",
        message: "Invalid client ID format",
        required: false,
      };
    }
    return {
      name,
      category: "oauth",
      status: "pass",
      message: "Credentials configured",
      required: false,
    };
  } catch {
    return {
      name,
      category: "oauth",
      status: "fail",
      message: "Validation failed",
      required: false,
    };
  }
}

// =====================
// EXTERNAL SERVICES
// =====================

async function checkGemini(): Promise<CheckResult> {
  const name = "Gemini API";
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return {
      name,
      category: "services",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    const response = await fetchWithTimeout(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`,
    );

    if (!response.ok) {
      const text = await response.text();
      if (text.includes("API_KEY_INVALID")) {
        return {
          name,
          category: "services",
          status: "fail",
          message: "Invalid API key",
          required: false,
        };
      }
      return {
        name,
        category: "services",
        status: "fail",
        message: `Error: ${response.status}`,
        required: false,
      };
    }

    const data = (await response.json()) as { models?: unknown[] };
    const modelCount = data.models?.length ?? 0;
    return {
      name,
      category: "services",
      status: "pass",
      message: `Valid (${modelCount} models available)`,
      required: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Request failed";
    return {
      name,
      category: "services",
      status: "fail",
      message: msg.slice(0, 40),
      required: false,
    };
  }
}

async function checkResend(): Promise<CheckResult> {
  const name = "Resend Email";
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      name,
      category: "services",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    const response = await fetchWithTimeout("https://api.resend.com/domains", {
      headers: { Authorization: `Bearer ${apiKey}` },
    });

    if (response.status === 401) {
      return {
        name,
        category: "services",
        status: "fail",
        message: "Invalid API key",
        required: false,
      };
    }

    if (!response.ok) {
      return {
        name,
        category: "services",
        status: "fail",
        message: `Error: ${response.status}`,
        required: false,
      };
    }

    const data = (await response.json()) as { data?: { name: string }[] };
    const domains = data.data?.map((d) => d.name).join(", ") || "no domains";
    return {
      name,
      category: "services",
      status: "pass",
      message: `Valid (${domains})`,
      required: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Request failed";
    return {
      name,
      category: "services",
      status: "fail",
      message: msg.slice(0, 40),
      required: false,
    };
  }
}

async function checkR2(): Promise<CheckResult> {
  const name = "Cloudflare R2";
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  const accessKeyId = process.env.CLOUDFLARE_R2_ACCESS_KEY_ID;
  const secretAccessKey = process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY;
  const bucketName = process.env.CLOUDFLARE_R2_BUCKET_NAME;

  if (!accountId || !accessKeyId || !secretAccessKey) {
    return {
      name,
      category: "services",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    const client = new S3Client({
      region: "auto",
      endpoint: `https://${accountId}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId,
        secretAccessKey,
      },
    });

    await client.send(new ListBucketsCommand({}));
    return {
      name,
      category: "services",
      status: "pass",
      message: bucketName ? `Connected (${bucketName})` : "Connected",
      required: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Connection failed";
    if (msg.includes("InvalidAccessKeyId")) {
      return {
        name,
        category: "services",
        status: "fail",
        message: "Invalid access key",
        required: false,
      };
    }
    return {
      name,
      category: "services",
      status: "fail",
      message: msg.slice(0, 40),
      required: false,
    };
  }
}

async function checkUpstash(): Promise<CheckResult> {
  const name = "Upstash Redis";
  const url = process.env.UPSTASH_REDIS_REST_URL || process.env.KV_REST_API_URL;
  const token = process.env.UPSTASH_REDIS_REST_TOKEN || process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    return {
      name,
      category: "services",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    const response = await fetchWithTimeout(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (response.status === 401) {
      return {
        name,
        category: "services",
        status: "fail",
        message: "Invalid token",
        required: false,
      };
    }

    if (!response.ok) {
      return {
        name,
        category: "services",
        status: "fail",
        message: `Error: ${response.status}`,
        required: false,
      };
    }

    const data = (await response.json()) as { result?: string };
    if (data.result === "PONG") {
      return {
        name,
        category: "services",
        status: "pass",
        message: "Connected (PONG)",
        required: false,
      };
    }
    return {
      name,
      category: "services",
      status: "pass",
      message: "Connected",
      required: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Request failed";
    return {
      name,
      category: "services",
      status: "fail",
      message: msg.slice(0, 40),
      required: false,
    };
  }
}

async function checkStripe(): Promise<CheckResult> {
  const name = "Stripe";
  const secretKey = process.env.STRIPE_SECRET_KEY;

  if (!secretKey) {
    return {
      name,
      category: "services",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    const response = await fetchWithTimeout("https://api.stripe.com/v1/balance", {
      headers: { Authorization: `Bearer ${secretKey}` },
    });

    if (response.status === 401) {
      return {
        name,
        category: "services",
        status: "fail",
        message: "Invalid API key",
        required: false,
      };
    }

    if (!response.ok) {
      return {
        name,
        category: "services",
        status: "fail",
        message: `Error: ${response.status}`,
        required: false,
      };
    }

    const mode = secretKey.startsWith("sk_live_") ? "live" : "test";
    return {
      name,
      category: "services",
      status: "pass",
      message: `Valid (${mode} mode)`,
      required: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Request failed";
    return {
      name,
      category: "services",
      status: "fail",
      message: msg.slice(0, 40),
      required: false,
    };
  }
}

async function checkSpikeLand(): Promise<CheckResult> {
  const name = "Spike Land API";
  const apiKey = process.env.SPIKE_LAND_API_KEY;

  if (!apiKey) {
    return {
      name,
      category: "services",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  // Validate key format (no public health endpoint available)
  if (apiKey.length < 20) {
    return {
      name,
      category: "services",
      status: "fail",
      message: "API key too short",
      required: false,
    };
  }

  return {
    name,
    category: "services",
    status: "pass",
    message: `Configured (${apiKey.slice(0, 8)}...)`,
    required: false,
  };
}

// =====================
// SOCIAL APIS
// =====================

async function checkDiscord(): Promise<CheckResult> {
  const name = "Discord Bot";
  const token = process.env.DISCORD_BOT_TOKEN;

  if (!token) {
    return {
      name,
      category: "social",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    const response = await fetchWithTimeout("https://discord.com/api/v10/users/@me", {
      headers: { Authorization: `Bot ${token}` },
    });

    if (response.status === 401) {
      return {
        name,
        category: "social",
        status: "fail",
        message: "Invalid bot token",
        required: false,
      };
    }

    if (!response.ok) {
      return {
        name,
        category: "social",
        status: "fail",
        message: `Error: ${response.status}`,
        required: false,
      };
    }

    const data = (await response.json()) as {
      username?: string;
      discriminator?: string;
    };
    const botName = data.username || "Unknown";
    return {
      name,
      category: "social",
      status: "pass",
      message: `Connected as ${botName}`,
      required: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Request failed";
    return {
      name,
      category: "social",
      status: "fail",
      message: msg.slice(0, 40),
      required: false,
    };
  }
}

async function checkTwitter(): Promise<CheckResult> {
  const name = "Twitter/X";
  const clientId = process.env.TWITTER_CLIENT_ID;
  const clientSecret = process.env.TWITTER_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      name,
      category: "social",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    // Twitter OAuth 2.0 client credentials flow
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString("base64");
    const response = await fetchWithTimeout("https://api.twitter.com/2/oauth2/token", {
      method: "POST",
      headers: {
        Authorization: `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: "grant_type=client_credentials",
    });

    if (response.status === 401) {
      return {
        name,
        category: "social",
        status: "fail",
        message: "Invalid credentials",
        required: false,
      };
    }

    if (!response.ok) {
      return {
        name,
        category: "social",
        status: "fail",
        message: `Error: ${response.status}`,
        required: false,
      };
    }

    return {
      name,
      category: "social",
      status: "pass",
      message: "Credentials valid",
      required: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Request failed";
    return {
      name,
      category: "social",
      status: "fail",
      message: msg.slice(0, 40),
      required: false,
    };
  }
}

async function checkLinkedIn(): Promise<CheckResult> {
  const name = "LinkedIn";
  const clientId = process.env.LINKEDIN_CLIENT_ID;
  const clientSecret = process.env.LINKEDIN_CLIENT_SECRET;

  if (!clientId || !clientSecret) {
    return {
      name,
      category: "social",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  // LinkedIn doesn't have a simple credentials validation endpoint
  // We can only check format
  if (clientId.length < 10 || clientSecret.length < 10) {
    return {
      name,
      category: "social",
      status: "fail",
      message: "Invalid credentials format",
      required: false,
    };
  }

  return {
    name,
    category: "social",
    status: "pass",
    message: "Credentials configured",
    required: false,
  };
}

async function checkFacebookSocial(): Promise<CheckResult> {
  const name = "Facebook Social";
  const appId = process.env.FACEBOOK_SOCIAL_APP_ID;
  const appSecret = process.env.FACEBOOK_SOCIAL_APP_SECRET;

  if (!appId || !appSecret) {
    return {
      name,
      category: "social",
      status: "skip",
      message: "Not configured",
      required: false,
    };
  }

  try {
    // Get app access token and verify
    const response = await fetchWithTimeout(
      `https://graph.facebook.com/oauth/access_token?client_id=${appId}&client_secret=${appSecret}&grant_type=client_credentials`,
    );

    if (!response.ok) {
      return {
        name,
        category: "social",
        status: "fail",
        message: "Invalid credentials",
        required: false,
      };
    }

    return {
      name,
      category: "social",
      status: "pass",
      message: `App ID: ${appId}`,
      required: false,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Request failed";
    return {
      name,
      category: "social",
      status: "fail",
      message: msg.slice(0, 40),
      required: false,
    };
  }
}

// =====================
// MAIN
// =====================

const checks: CheckFunction[] = [
  // Core
  checkDatabase,
  checkAuthSecret,
  checkNextAuthUrl,
  // OAuth
  checkGitHub,
  checkGoogle,
  // Services
  checkGemini,
  checkResend,
  checkR2,
  checkUpstash,
  checkStripe,
  checkSpikeLand,
  // Social
  checkDiscord,
  checkTwitter,
  checkLinkedIn,
  checkFacebookSocial,
];

function formatStatus(status: CheckResult["status"]): string {
  switch (status) {
    case "pass":
      return "\x1b[32m✓\x1b[0m"; // Green check
    case "fail":
      return "\x1b[31m✗\x1b[0m"; // Red x
    case "skip":
      return "\x1b[33m○\x1b[0m"; // Yellow circle
  }
}

function formatCategory(category: CheckResult["category"]): string {
  const labels: Record<CheckResult["category"], string> = {
    core: "CORE (Required)",
    oauth: "OAUTH PROVIDERS",
    services: "EXTERNAL SERVICES",
    social: "SOCIAL APIS",
  };
  return labels[category];
}

async function main() {
  console.log("");
  console.log("Environment Check Results");
  console.log("=".repeat(60));

  // Run all checks in parallel
  const results = await Promise.all(checks.map((check) => check()));

  // Group by category
  const categories: CheckResult["category"][] = ["core", "oauth", "services", "social"];
  let totalPass = 0;
  let totalFail = 0;
  let totalSkip = 0;

  for (const category of categories) {
    const categoryResults = results.filter((r) => r.category === category);
    if (categoryResults.length === 0) continue;

    console.log("");
    console.log(`${formatCategory(category)}`);
    console.log("-".repeat(60));

    for (const result of categoryResults) {
      const status = formatStatus(result.status);
      const name = result.name.padEnd(20);
      console.log(`  ${status} ${name} ${result.message}`);

      if (result.status === "pass") totalPass++;
      else if (result.status === "fail") totalFail++;
      else totalSkip++;
    }
  }

  console.log("");
  console.log("=".repeat(60));
  console.log(`Summary: ${totalPass} passed, ${totalFail} failed, ${totalSkip} skipped`);
  console.log("");

  // Exit with error if any configured service failed
  // (skip doesn't count as failure - only configured services that don't work)
  if (totalFail > 0) {
    console.log("\x1b[31mError: Some configured services failed validation.\x1b[0m");
    console.log("Fix the issues above or remove the invalid environment variables.");
    process.exit(1);
  }

  if (verbose) {
    console.log("\x1b[32mAll configured services are working correctly.\x1b[0m");
  }
}

main().catch((error) => {
  console.error("Unexpected error:", error);
  process.exit(1);
});
