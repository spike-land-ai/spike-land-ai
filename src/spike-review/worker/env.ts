/**
 * Cloudflare Worker Environment Bindings
 *
 * Type-safe interface for wrangler secrets and bindings.
 */

export interface Env {
  /** GitHub PAT or App installation token */
  GITHUB_TOKEN: string;
  /** Webhook secret for HMAC-SHA256 verification */
  GITHUB_WEBHOOK_SECRET: string;
  /** Claude OAuth token for AI review */
  CLAUDE_CODE_OAUTH_TOKEN: string;
}
