/**
 * Category persistence via Cloudflare KV.
 * Replaces Redis/Upstash from spike.land.
 */

const KEY_PREFIX = "mcp:enabled-categories:";
const TTL_SECONDS = 7 * 24 * 60 * 60; // 7 days

export async function loadEnabledCategories(userId: string, kv: KVNamespace): Promise<string[]> {
  try {
    const raw = await kv.get(`${KEY_PREFIX}${userId}`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string");
  } catch {
    return [];
  }
}

export async function saveEnabledCategories(
  userId: string,
  categories: string[],
  kv: KVNamespace,
): Promise<void> {
  try {
    await kv.put(`${KEY_PREFIX}${userId}`, JSON.stringify(categories), {
      expirationTtl: TTL_SECONDS,
    });
  } catch {
    // Best-effort — never block the response
  }
}
