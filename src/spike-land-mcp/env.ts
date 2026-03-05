/**
 * Cloudflare Workers environment bindings for spike-land-mcp.
 */
export interface Env {
  // Cloudflare bindings
  DB: D1Database;
  KV: KVNamespace;

  // Secrets
  MCP_JWT_SECRET: string;
  MCP_INTERNAL_SECRET: string; // Used for spike-app → CF Workers device approve

  // AI provider API keys
  ANTHROPIC_API_KEY: string;
  OPENAI_API_KEY: string;
  GEMINI_API_KEY: string;
  ELEVENLABS_API_KEY: string;

  // Vault
  VAULT_SECRET: string; // Server-side pepper for vault encryption (PBKDF2 input)

  // Analytics
  GA_MEASUREMENT_ID: string;
  GA_API_SECRET: string;

  // Service bindings
  SPIKE_EDGE: Fetcher; // Bugbook + ELO service

  // App config
  APP_ENV: string;
  SPIKE_LAND_URL: string; // https://spike.land
}
