/// <reference types="@cloudflare/workers-types" />

export interface Env {
  R2: R2Bucket;
  SPA_ASSETS: R2Bucket;
  LIMITERS: DurableObjectNamespace;
  STRIPE_SECRET_KEY: string;
  AI_API_KEY: string;
  GITHUB_TOKEN: string;
  SPACETIMEDB_URI: string;
  ALLOWED_ORIGINS: string;
}
