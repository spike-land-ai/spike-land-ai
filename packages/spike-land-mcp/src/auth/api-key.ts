import type { DrizzleDB } from "../db/index";
import { apiKeys } from "../db/schema";
import { eq } from "drizzle-orm";

export async function hashApiKey(key: string): Promise<string> {
  const encoded = new TextEncoder().encode(key);
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoded);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function lookupApiKey(key: string, db: DrizzleDB): Promise<{ userId: string } | null> {
  const keyHash = await hashApiKey(key);

  const keyRecord = await db
    .select({ userId: apiKeys.userId, expiresAt: apiKeys.expiresAt })
    .from(apiKeys)
    .where(eq(apiKeys.keyHash, keyHash))
    .limit(1);

  if (keyRecord.length === 0) return null;

  const record = keyRecord[0];
  if (!record) return null;
  if (record.expiresAt && record.expiresAt < Date.now()) return null;

  // Update lastUsedAt fire-and-forget (no await to keep auth fast)
  void db.update(apiKeys).set({ lastUsedAt: Date.now() }).where(eq(apiKeys.keyHash, keyHash)).run();

  return { userId: record.userId };
}
