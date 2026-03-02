/**
 * Cloudflare Workers environment bindings for spike-land-mcp.
 */
export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  KV: KVNamespace;

  // Secrets
  MCP_JWT_SECRET: string;
  MCP_INTERNAL_SECRET: string; // Used for Next.js → CF Workers device approve

  // AI provider API keys
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GEMINI_API_KEY: string;
  ELEVENLABS_API_KEY: string;

  // App config
  APP_ENV: string;
  SPIKE_LAND_URL: string; // https://spike.land
}
