import { createLogger } from "@spike-land-ai/shared";

const log = createLogger("spike-edge");

export type ByokProvider = "anthropic" | "openai" | "google";

/**
 * Resolve a decrypted BYOK key for the given user/provider via the internal MCP service.
 * Returns null when no key exists or the internal lookup fails.
 */
export async function resolveByokKey(
  mcpService: Fetcher,
  userId: string,
  provider: ByokProvider,
  mcpInternalSecret?: string,
): Promise<string | null> {
  try {
    const res = await mcpService.fetch(
      new Request("https://mcp/internal/byok/get", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(mcpInternalSecret ? { "x-internal-secret": mcpInternalSecret } : {}),
        },
        body: JSON.stringify({ userId, provider }),
      }),
    );
    if (!res.ok) {
      return null;
    }

    const data = await res.json<{ key?: string | null }>();
    return data.key ?? null;
  } catch (err) {
    log.error("BYOK key resolution failed", {
      error: String(err),
      provider,
    });
    return null;
  }
}
