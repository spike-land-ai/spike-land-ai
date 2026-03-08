export interface Env {
  DB: D1Database;
  CHANNEL_DO: DurableObjectNamespace;
  PRESENCE_DO: DurableObjectNamespace;
  AUTH_MCP: Fetcher;
  MCP_SERVICE: Fetcher;
}
