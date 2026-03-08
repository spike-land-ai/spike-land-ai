/**
 * Tests for routes/internal-byok.ts
 */
import { describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import type { Env } from "../../../src/edge-api/spike-land/core-logic/env";

// Control what the mocked db.select returns across tests
let _mockDbRows: Record<string, unknown>[] = [];

vi.mock("../../../src/edge-api/spike-land/db/db/db-index", () => {
  return {
    createDb: () => ({
      select: () => ({
        from: () => ({
          where: () => ({
            limit: async () => _mockDbRows,
          }),
        }),
      }),
    }),
  };
});

/**
 * Encrypt a plaintext API key using the same algorithm as the production BYOK code.
 * v=2: key = PBKDF2(vaultSecret:userId, salt)
 */
async function encryptByokKey(
  userId: string,
  plaintext: string,
  vaultSecret: string,
): Promise<string> {
  const encoder = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));

  const keyInput = `${vaultSecret}:${userId}`;
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
    ["encrypt"],
  );

  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    cryptoKey,
    encoder.encode(plaintext),
  );

  const toBase64 = (buf: ArrayBuffer | Uint8Array) => {
    const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
    let str = "";
    for (const b of bytes) str += String.fromCharCode(b);
    return btoa(str);
  };

  const payload = JSON.stringify({
    v: 2,
    iv: toBase64(iv),
    data: toBase64(encrypted),
    salt: toBase64(salt),
  });
  return btoa(payload);
}

describe("internalByokRoute POST /byok/get", () => {
  it("returns 400 when userId is missing", async () => {
    _mockDbRows = [];
    const { internalByokRoute } = await import(
      "../../../src/edge-api/spike-land/api/internal-byok"
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route("/internal", internalByokRoute);
    const env = { DB: {} as D1Database, VAULT_SECRET: "secret" } as unknown as Env;

    const res = await app.request(
      "/internal/byok/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ provider: "openai" }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("userId");
  });

  it("returns 400 when provider is missing", async () => {
    _mockDbRows = [];
    const { internalByokRoute } = await import(
      "../../../src/edge-api/spike-land/api/internal-byok"
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route("/internal", internalByokRoute);
    const env = { DB: {} as D1Database, VAULT_SECRET: "secret" } as unknown as Env;

    const res = await app.request(
      "/internal/byok/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-1" }),
      },
      env,
    );

    expect(res.status).toBe(400);
    const body = (await res.json()) as { error: string };
    expect(body.error).toContain("provider");
  });

  it("returns null key when no vault record found", async () => {
    _mockDbRows = []; // empty — no record
    const { internalByokRoute } = await import(
      "../../../src/edge-api/spike-land/api/internal-byok"
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route("/internal", internalByokRoute);
    const env = { DB: {} as D1Database, VAULT_SECRET: "secret" } as unknown as Env;

    const res = await app.request(
      "/internal/byok/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-1", provider: "openai" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: null };
    expect(body.key).toBeNull();
  });

  it("returns null key when decryption fails for invalid ciphertext", async () => {
    // Provide a record with invalid ciphertext (will fail AES-GCM decrypt)
    const invalidEncryptedKey = btoa(
      JSON.stringify({
        v: 2,
        iv: btoa("short"),
        data: btoa("not-real-encrypted-data"),
        salt: btoa("salt-value"),
      }),
    );

    _mockDbRows = [{ encryptedKey: invalidEncryptedKey }];
    const { internalByokRoute } = await import(
      "../../../src/edge-api/spike-land/api/internal-byok"
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route("/internal", internalByokRoute);
    const env = { DB: {} as D1Database, VAULT_SECRET: "secret" } as unknown as Env;

    const res = await app.request(
      "/internal/byok/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: "user-1", provider: "openai" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: null };
    // Decryption will fail for invalid ciphertext → returns null
    expect(body.key).toBeNull();
  });

  it("returns 400 when body is not valid JSON", async () => {
    _mockDbRows = [];
    const { internalByokRoute } = await import(
      "../../../src/edge-api/spike-land/api/internal-byok"
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route("/internal", internalByokRoute);
    const env = { DB: {} as D1Database, VAULT_SECRET: "secret" } as unknown as Env;

    const res = await app.request(
      "/internal/byok/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not-json",
      },
      env,
    );

    // Hono JSON parse error returns 400
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  it("decrypts and returns the key when encryption is valid (v=2)", async () => {
    const userId = "user-byok-test";
    const vaultSecret = "test-vault-secret-32chars-long!";
    const originalKey = "sk-openai-my-real-api-key";

    // Encrypt the key using the same algorithm as production
    const encryptedKey = await encryptByokKey(userId, originalKey, vaultSecret);

    // The mocked createDb returns this row directly from select().from().where().limit()
    _mockDbRows = [{ encryptedKey }];

    const { internalByokRoute } = await import(
      "../../../src/edge-api/spike-land/api/internal-byok"
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route("/internal", internalByokRoute);
    const env = { DB: {} as D1Database, VAULT_SECRET: vaultSecret } as unknown as Env;

    const res = await app.request(
      "/internal/byok/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, provider: "openai" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: string };
    expect(body.key).toBe(originalKey);
  });

  it("uses empty string as VAULT_SECRET when env.VAULT_SECRET is undefined (line 77 branch)", async () => {
    // With no VAULT_SECRET, the ?? "" fallback is used — decryption will fail (wrong key),
    // returning { key: null } from the catch block. The important thing is the branch is covered.
    const userId = "user-no-vault";
    const vaultSecret = "correct-vault-secret-32chars!!";
    const originalKey = "sk-some-key";
    const encryptedKey = await encryptByokKey(userId, originalKey, vaultSecret);

    _mockDbRows = [{ encryptedKey }];

    const { internalByokRoute } = await import(
      "../../../src/edge-api/spike-land/api/internal-byok"
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route("/internal", internalByokRoute);
    // No VAULT_SECRET in env — triggers ?? "" branch on line 77
    const env = { DB: {} as D1Database } as unknown as Env;

    const res = await app.request(
      "/internal/byok/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, provider: "openai" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: null };
    // Decryption fails with wrong key → catch returns null
    expect(body.key).toBeNull();
  });

  it("uses legacy key derivation (v!=2) when v field is absent", async () => {
    // Legacy: keyInput = userId (no vaultSecret prefix)
    const userId = "user-legacy";
    const plaintext = "sk-legacy-key";

    const encoder = new TextEncoder();
    const salt = crypto.getRandomValues(new Uint8Array(16));
    const iv = crypto.getRandomValues(new Uint8Array(12));

    const keyMaterial = await crypto.subtle.importKey(
      "raw",
      encoder.encode(userId),
      "PBKDF2",
      false,
      ["deriveKey"],
    );
    const cryptoKey = await crypto.subtle.deriveKey(
      { name: "PBKDF2", salt, iterations: 100000, hash: "SHA-256" },
      keyMaterial,
      { name: "AES-GCM", length: 256 },
      false,
      ["encrypt"],
    );
    const encrypted = await crypto.subtle.encrypt(
      { name: "AES-GCM", iv },
      cryptoKey,
      encoder.encode(plaintext),
    );

    const toBase64 = (buf: ArrayBuffer | Uint8Array) => {
      const bytes = buf instanceof Uint8Array ? buf : new Uint8Array(buf);
      let str = "";
      for (const b of bytes) str += String.fromCharCode(b);
      return btoa(str);
    };

    // No v field — triggers the legacy (v !== 2) branch in decryptByokKey
    const payload = JSON.stringify({
      iv: toBase64(iv),
      data: toBase64(encrypted),
      salt: toBase64(salt),
    });
    const encryptedKey = btoa(payload);

    _mockDbRows = [{ encryptedKey }];

    const { internalByokRoute } = await import(
      "../../../src/edge-api/spike-land/api/internal-byok"
    );
    const app = new Hono<{ Bindings: Env }>();
    app.route("/internal", internalByokRoute);
    const env = { DB: {} as D1Database, VAULT_SECRET: "some-vault-secret" } as unknown as Env;

    const res = await app.request(
      "/internal/byok/get",
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, provider: "openai" }),
      },
      env,
    );

    expect(res.status).toBe(200);
    const body = (await res.json()) as { key: string };
    expect(body.key).toBe(plaintext);
  });
});
