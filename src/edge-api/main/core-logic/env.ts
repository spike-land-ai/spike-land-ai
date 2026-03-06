/// <reference types="@cloudflare/workers-types" />

export interface Variables {
  userId: string;
  requestId: string;
}

export interface Env {
  R2: R2Bucket;
  SPA_ASSETS: R2Bucket;
  DB: D1Database;
  LIMITERS: DurableObjectNamespace;
  AUTH_MCP: Fetcher;
  MCP_SERVICE: Fetcher;
  STRIPE_SECRET_KEY: string;
  STRIPE_WEBHOOK_SECRET: string;
  GEMINI_API_KEY: string;
  CLAUDE_OAUTH_TOKEN: string;
  GITHUB_TOKEN: string;
  ALLOWED_ORIGINS: string;
  QUIZ_BADGE_SECRET: string;
  GA_MEASUREMENT_ID: string;
  CACHE_VERSION: string;
  GA_API_SECRET: string;
  INTERNAL_SERVICE_SECRET: string;
  WHATSAPP_APP_SECRET: string;
  WHATSAPP_ACCESS_TOKEN: string;
  WHATSAPP_PHONE_NUMBER_ID: string;
  WHATSAPP_VERIFY_TOKEN: string;
  MCP_INTERNAL_SECRET: string;
  CF_ZONE_ID: string;
  CF_CACHE_PURGE_TOKEN: string;
  ANALYTICS: AnalyticsEngineDataset;
}
