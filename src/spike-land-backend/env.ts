/// <reference types="@cloudflare/workers-types" />

export default interface Env {
  OPENAI_API_KEY: string;
  AI: Ai;
  KV: KVNamespace;
  __STATIC_CONTENT: KVNamespace;
  REPLICATE_API_TOKEN: string;
  CLAUDE_CODE_OAUTH_TOKEN: string;
  CLAUDE_CODE_OAUTH_TOKEN_2?: string;
  CLAUDE_CODE_OAUTH_TOKEN_3?: string;
  GEMINI_API_KEY: string;
  CF_REAL_TURN_TOKEN: string;
  ESBUILD: Fetcher;
  CODE: DurableObjectNamespace;
  LIMITERS: DurableObjectNamespace;
  R2: R2Bucket;
  X9: R2Bucket;
  DISABLE_AI_TOOLS?: string; // Set to "true" to disable AI tools (workaround for AI SDK v4 issue)
  DEBUG_ANTHROPIC_PROXY?: string; // Set to "true" to enable debug logging in Anthropic proxy
}
