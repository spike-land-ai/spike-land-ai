export interface Env {
  IMAGE_DB: D1Database;
  IMAGE_R2: R2Bucket;
  GEMINI_API_KEY: string;
  CF_AIG_TOKEN: string;
  DEMO_TOKEN: string;
  ANTHROPIC_API_KEY: string;
  AUTH_SERVICE_URL?: string;
  ASSETS: { fetch: typeof fetch };
}
