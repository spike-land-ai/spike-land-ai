import type Env from "./env";
import {
  addCorsHeadersToResponse,
  createCorsErrorResponse,
  createCorsPreflightResponse,
} from "./utils";

const KV_LAST_GOOD_KEY = "anthropic:last-good-token-idx";

/** Collect available tokens from env, deduped. */
function getTokenPool(env: Env): string[] {
  const seen = new Set<string>();
  const tokens: string[] = [];
  for (const val of [
    env.CLAUDE_CODE_OAUTH_TOKEN,
    env.CLAUDE_CODE_OAUTH_TOKEN_2,
    env.CLAUDE_CODE_OAUTH_TOKEN_3,
  ]) {
    if (val && !seen.has(val)) {
      seen.add(val);
      tokens.push(val);
    }
  }
  return tokens;
}

/** Read last-good index from KV. */
async function getLastGoodIdx(kv: KVNamespace, poolSize: number): Promise<number> {
  try {
    const stored = await kv.get(KV_LAST_GOOD_KEY);
    if (stored !== null) {
      const idx = parseInt(stored, 10);
      if (idx >= 0 && idx < poolSize) return idx;
    }
  } catch {
    // KV unavailable
  }
  return 0;
}

/** Persist last-good index to KV (1h TTL). */
async function setLastGoodIdx(kv: KVNamespace, idx: number): Promise<void> {
  try {
    await kv.put(KV_LAST_GOOD_KEY, String(idx), { expirationTtl: 3600 });
  } catch {
    // KV unavailable — best effort
  }
}

export async function handleAnthropicRequest(originalRequest: Request, env: Env) {
  // Handle CORS preflight
  if (originalRequest.method === "OPTIONS") {
    return createCorsPreflightResponse();
  }

  const pool = getTokenPool(env);
  if (pool.length === 0) {
    return createCorsErrorResponse("No auth tokens configured", "Missing CLAUDE_CODE_OAUTH_TOKEN");
  }

  const debugMode = env.DEBUG_ANTHROPIC_PROXY === "true";

  try {
    const baseURL =
      "https://gateway.ai.cloudflare.com/v1/1f98921051196545ebe79a450d3c71ed/z1/anthropic";

    const originalUrl = new URL(originalRequest.url);
    const pathAfterAnthropicAi = originalUrl.pathname.split("/anthropic").pop() || "";
    const url = new URL(baseURL + pathAfterAnthropicAi);

    const clonedRequest = originalRequest.clone();

    if (debugMode && clonedRequest.method === "POST") {
      try {
        const bodyText = await clonedRequest.clone().text();
        const bodyJson = JSON.parse(bodyText);
        if (bodyJson.tools) {
          console.log(
            "[Anthropic Proxy] Request contains tools:",
            JSON.stringify(bodyJson.tools, null, 2),
          );
        }
      } catch (_e) {
        console.log("[Anthropic Proxy] Could not parse request body");
      }
    }

    const startIdx = await getLastGoodIdx(env.KV, pool.length);
    let lastError: Error | undefined;

    for (let attempt = 0; attempt < pool.length; attempt++) {
      const idx = (startIdx + attempt) % pool.length;
      const token = pool[idx];

      const headers = new Headers(clonedRequest.headers);
      headers.delete("Authorization");
      headers.delete("X-Api-Key");

      headers.set("Authorization", `Bearer ${token}`);
      headers.set("accept", "application/json");
      headers.set(
        "anthropic-beta",
        "claude-code-20250219,oauth-2025-04-20,fine-grained-tool-streaming-2025-05-14",
      );
      headers.set("user-agent", "claude-cli/2.1.42 (external, cli)");
      headers.set("x-app", "cli");

      const request = new Request(url.toString(), {
        method: clonedRequest.method,
        headers,
        body: clonedRequest.body,
      });

      const response = await fetch(request);

      if (response.ok) {
        // Token worked — persist it
        if (attempt > 0) {
          console.log(`[Anthropic Proxy] Token fallback: switched to index ${idx}`);
          await setLastGoodIdx(env.KV, idx);
        }
        return addCorsHeadersToResponse(response);
      }

      if (response.status === 401) {
        // Auth failure — try next token
        let errorDetails = "";
        try {
          errorDetails = await response.clone().text();
        } catch {
          // ignore
        }
        lastError = new Error(`Token index ${idx} auth failed (401): ${errorDetails}`);
        if (debugMode) {
          console.warn(`[Anthropic Proxy] Token ${idx} auth failed, trying next`);
        }
        continue;
      }

      // Non-401 error — don't rotate, return immediately
      let errorDetails = "";
      try {
        const errorBody = await response.clone().text();
        errorDetails = ` - ${errorBody}`;
        if (debugMode) {
          console.error("[Anthropic Proxy] API Error Response:", errorBody);
        }
      } catch (_e) {
        // Ignore
      }
      throw new Error(
        `ANTHROPIC API responded with status: ${request.url} ${response.status}${errorDetails}`,
      );
    }

    // All tokens exhausted with 401s
    throw lastError ?? new Error("All tokens failed authentication");
  } catch (error) {
    console.error("Error in handleAnthropicRequest:", error);
    return createCorsErrorResponse(
      "Failed to process request",
      error instanceof Error ? error.message : "Unknown error",
    );
  }
}
