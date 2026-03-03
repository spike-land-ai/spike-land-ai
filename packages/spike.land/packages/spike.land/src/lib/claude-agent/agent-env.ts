import { getPreferredToken } from "@/lib/ai/token-pool";

/**
 * Build a clean environment for Agent SDK subprocesses.
 * - Strips CLAUDECODE to prevent "nested session" detection
 * - Injects the preferred OAuth token from the token pool
 */
export function agentEnv(): Record<string, string | undefined> {
  const oauthToken = getPreferredToken();

  return {
    ...process.env,
    CLAUDECODE: undefined,
    ...(oauthToken ? { CLAUDE_CODE_OAUTH_TOKEN: oauthToken } : {}),
  };
}
