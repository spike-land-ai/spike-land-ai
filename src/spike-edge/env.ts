/// <reference types="@cloudflare/workers-types" />

export interface Env {
  R2: R2Bucket;
  SPA_ASSETS: R2Bucket;
  LIMITERS: DurableObjectNamespace;
  AUTH_MCP: Fetcher;
  STRIPE_SECRET_KEY: string;
  AI_API_KEY: string;
  GITHUB_TOKEN: string;
  ALLOWED_ORIGINS: string;
  QUIZ_BADGE_SECRET: string;
}
