/**
 * Centralized Environment Variable Validation
 *
 * Validates all required and optional environment variables at startup
 * using Zod schemas. Import this module early (e.g., in layout.tsx or
 * next.config.ts) to fail fast on misconfigured deployments.
 */

import { z } from "zod";

/**
 * Server-side environment variables schema.
 * Required vars will fail validation if missing.
 * Optional vars have sensible defaults.
 */
const serverEnvSchema = z.object({
  // === Core (required) ===
  DATABASE_URL: z.string().min(1, "DATABASE_URL is required"),
  AUTH_SECRET: z.string().min(1, "AUTH_SECRET is required"),
  NODE_ENV: z
    .enum(["development", "production", "test"])
    .default("development"),

  // === Redis / Rate Limiting ===
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // === Stripe ===
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_TIER_BASIC: z.string().optional(),
  STRIPE_PRICE_TIER_STANDARD: z.string().optional(),
  STRIPE_PRICE_TIER_PREMIUM: z.string().optional(),

  // === AI Providers ===
  GEMINI_API_KEY: z.string().optional(),
  ELEVENLABS_API_KEY: z.string().optional(),

  // === GitHub ===
  GH_PAT_TOKEN: z.string().optional(),
  GITHUB_OWNER: z.string().optional(),
  GITHUB_REPO: z.string().optional(),

  // === Cloudflare R2 / S3 ===
  CLOUDFLARE_R2_ACCESS_KEY_ID: z.string().optional(),
  CLOUDFLARE_R2_SECRET_ACCESS_KEY: z.string().optional(),
  CLOUDFLARE_R2_BUCKET_NAME: z.string().optional(),
  CLOUDFLARE_R2_ENDPOINT: z.string().optional(),

  // === Email ===
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().optional(),

  // === Cron ===
  CRON_SECRET: z.string().optional(),

  // === Security ===
  TOKEN_ENCRYPTION_KEY: z.string().optional(),

  // === Platform ===
  VERCEL: z.string().optional(),
  BASE_URL: z.string().optional(),
  PORT: z.coerce.number().optional(),
});

/**
 * Client-side (NEXT_PUBLIC_*) environment variables schema.
 */
const clientEnvSchema = z.object({
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
});

export type ServerEnv = z.infer<typeof serverEnvSchema>;
export type ClientEnv = z.infer<typeof clientEnvSchema>;

/**
 * Validates server environment variables.
 * Call this at application startup for early failure.
 *
 * @returns Parsed and validated environment object
 * @throws ZodError if required variables are missing or malformed
 */
export function validateServerEnv(): ServerEnv {
  const result = serverEnvSchema.safeParse(process.env);

  if (!result.success) {
    const formatted = result.error.issues
      .map(issue => `  - ${issue.path.join(".")}: ${issue.message}`)
      .join("\n");

    throw new Error(
      `❌ Invalid server environment variables:\n${formatted}\n\nPlease check your .env file or deployment config.`,
    );
  }

  return result.data;
}

/**
 * Validates client environment variables.
 */
export function validateClientEnv(): ClientEnv {
  const clientVars: Record<string, string | undefined> = {};
  for (const key of Object.keys(clientEnvSchema.shape)) {
    clientVars[key] = process.env[key];
  }

  const result = clientEnvSchema.safeParse(clientVars);

  if (!result.success) {
    throw new Error(
      `❌ Invalid client environment variables:\n${result.error.message}`,
    );
  }

  return result.data;
}

// Export schemas for testing
export { clientEnvSchema, serverEnvSchema };
