/**
 * Internal BYOK Route
 *
 * Called via service binding from spike-edge to resolve a user's
 * BYOK API key for a given provider. No auth — only accessible
 * internally via CF Workers service bindings.
 */

import { Hono } from "hono";
import { eq, and } from "drizzle-orm";
import type { Env } from "../core-logic/env";
import { createDb } from "../db/db/db-index.ts";
import { userApiKeyVault } from "../db/db/schema";

const internalByokRoute = new Hono<{ Bindings: Env }>();

async function decryptByokKey(
  userId: string,
  encrypted: string,
  vaultSecret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const parsed = JSON.parse(atob(encrypted)) as {
    v?: number;
    iv: string;
    data: string;
    salt: string;
  };
  const iv = Uint8Array.from(atob(parsed.iv), (c) => c.charCodeAt(0));
  const data = Uint8Array.from(atob(parsed.data), (c) => c.charCodeAt(0));
  const salt = Uint8Array.from(atob(parsed.salt), (c) => c.charCodeAt(0));

  const keyInput = parsed.v === 2 && vaultSecret ? `${vaultSecret}:${userId}` : userId;

  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    encoder.encode(keyInput),
    "PBKDF2",
    false,
    ["deriveKey"],
  );
  const cryptoKey = await crypto.subtle.deriveKey(
    { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"],
  );

  const decrypted = await crypto.subtle.decrypt({ name: "AES-GCM", iv }, cryptoKey, data);
  return new TextDecoder().decode(decrypted);
}

internalByokRoute.post("/byok/get", async (c) => {
  const body = await c.req.json<{ userId?: string; provider?: string }>();
  if (!body.userId || !body.provider) {
    return c.json({ error: "userId and provider required" }, 400);
  }

  const db = createDb(c.env.DB);
  const row = await db
    .select({ encryptedKey: userApiKeyVault.encryptedKey })
    .from(userApiKeyVault)
    .where(
      and(
        eq(userApiKeyVault.userId, body.userId),
        eq(userApiKeyVault.provider, body.provider),
      ),
    )
    .limit(1);

  if (row.length === 0 || !row[0]) {
    return c.json({ key: null });
  }

  try {
    const key = await decryptByokKey(body.userId, row[0].encryptedKey, c.env.VAULT_SECRET ?? "");
    return c.json({ key });
  } catch (error) {
    console.error("[internal-byok] Decryption failed:", error);
    return c.json({ key: null });
  }
});

export { internalByokRoute };
