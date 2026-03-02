import Anthropic from "@anthropic-ai/sdk";
import { execFileSync } from "node:child_process";
import { getPreferredToken, withTokenFallback } from "./token-pool";

/**
 * Shared Claude (Anthropic) client singleton.
 *
 * Auth resolution: CLAUDE_CODE_OAUTH_TOKEN (+ _2…_10 fallback pool).
 * Claude Max subscription provides cost-effective Opus 4.6 access
 * (OAuth bearer auth, not API key).
 */

const FALLBACK_CLI_VERSION = "2.1.42";

/** Detect installed Claude CLI version at startup; cache result. */
let _cachedCliVersion: string | undefined;
export function getClaudeCliVersion(): string {
  if (_cachedCliVersion) return _cachedCliVersion;
  try {
    const raw = execFileSync("claude", ["--version"], {
      timeout: 3000,
      encoding: "utf8",
    }).trim();
    // Output is e.g. "2.1.42 (Claude Code)" — extract semver
    const match = raw.match(/^(\d+\.\d+\.\d+)/);
    _cachedCliVersion = match?.[1] ?? FALLBACK_CLI_VERSION;
  } catch {
    _cachedCliVersion = FALLBACK_CLI_VERSION;
  }
  return _cachedCliVersion;
}

/** Default headers shared across all Claude API calls. */
const DEFAULT_HEADERS = {
  accept: "application/json",
  "anthropic-beta": "claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14",
  "user-agent": `claude-cli/${FALLBACK_CLI_VERSION} (external, cli)`,
  "x-app": "cli",
} as const;

/** Build an Anthropic client for a given auth token. */
function buildClient(authToken: string): Anthropic {
  return new Anthropic({
    apiKey: null,
    authToken,
    defaultHeaders: {
      ...DEFAULT_HEADERS,
      "user-agent": `claude-cli/${getClaudeCliVersion()} (external, cli)`,
    },
  });
}

let client: Anthropic | null = null;
let clientCreatedAt = 0;

/** Max age before re-resolving the token (5 minutes). */
const CLIENT_MAX_AGE_MS = 5 * 60 * 1000;

export async function getClaudeClient(): Promise<Anthropic> {
  const now = Date.now();
  // Re-resolve if client is stale (token may have been rotated)
  if (client && now - clientCreatedAt > CLIENT_MAX_AGE_MS) {
    client = null;
  }

  if (!client) {
    let authToken: string | undefined;
    let apiKey: string | undefined;

    try {
      authToken = getPreferredToken();
    } catch {
      apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;
    }

    if (apiKey) {
      client = new Anthropic({
        apiKey,
        defaultHeaders: {
          "user-agent": `claude-cli/${getClaudeCliVersion()} (external, cli)`,
        },
      });
    } else if (authToken) {
      client = buildClient(authToken);
    } else {
      throw new Error("No Anthropic auth tokens or API key available.");
    }
    clientCreatedAt = now;
  }
  return client;
}

/**
 * Execute an operation with the token-pool fallback.
 * Creates a fresh Anthropic client per token attempt.
 */
export async function withClaudeClient<T>(
  operation: (anthropic: Anthropic) => Promise<T>,
): Promise<T> {
  const apiKey = process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY;

  if (apiKey) {
    const c = new Anthropic({
      apiKey,
      defaultHeaders: {
        "user-agent": `claude-cli/${getClaudeCliVersion()} (external, cli)`,
      },
    });
    return operation(c);
  }

  const result = await withTokenFallback(async (authToken) => {
    const c = buildClient(authToken);
    return operation(c);
  });
  // On success, reset the singleton to use the (possibly new) preferred token
  client = null;
  return result;
}

/**
 * Returns true if the error is an Anthropic authentication error (401).
 */
export function isAuthError(error: unknown): boolean {
  if (error instanceof Anthropic.AuthenticationError) return true;
  if (error instanceof Error) {
    return error.message.includes("authentication_error") || error.message.includes("401");
  }
  return false;
}

/**
 * Returns true if the error is a transient network error worth retrying.
 */
export function isTransientError(error: unknown): boolean {
  const message = error instanceof Error ? error.message : String(error);
  return /ECONNRESET|ECONNREFUSED|ETIMEDOUT|socket hang up|network/i.test(message);
}

export async function isClaudeConfigured(): Promise<boolean> {
  if (process.env.CLAUDE_API_KEY || process.env.ANTHROPIC_API_KEY) {
    return true;
  }
  try {
    getPreferredToken();
    return true;
  } catch {
    return false;
  }
}

export function resetClaudeClient(): void {
  client = null;
}
