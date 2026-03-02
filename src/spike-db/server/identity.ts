const DEFAULT_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function toBase64Url(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer);
  let binary = "";
  for (const byte of bytes) {
    binary += String.fromCharCode(byte);
  }
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(str: string): Uint8Array {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
  const binary = atob(padded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

async function hmacSign(secret: string, data: string): Promise<string> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
  return toBase64Url(signature);
}

async function hmacVerify(secret: string, data: string, signatureB64: string): Promise<boolean> {
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["verify"],
  );
  const signatureBytes = fromBase64Url(signatureB64);
  return crypto.subtle.verify("HMAC", key, signatureBytes, encoder.encode(data));
}

/** Generate a new identity (64 hex chars) and signed token. */
export async function generateIdentity(secret: string): Promise<{ identity: string; token: string }> {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const identity = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  const token = await signToken(identity, secret);
  return { identity, token };
}

/** Verify a token, return the identity string or null. */
export async function verifyToken(
  token: string,
  secret: string,
  maxAgeMs: number = DEFAULT_MAX_AGE_MS,
): Promise<string | null> {
  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [identity, timestampStr, signature] = parts;
  const timestamp = Number(timestampStr);
  if (!Number.isFinite(timestamp)) return null;

  const age = Date.now() - timestamp;
  if (age > maxAgeMs) return null;

  const data = `${identity}.${timestampStr}`;
  try {
    const valid = await hmacVerify(secret, data, signature);
    return valid ? identity : null;
  } catch {
    return null;
  }
}

/** Create a new token for an existing identity. */
export async function signToken(identity: string, secret: string): Promise<string> {
  const timestamp = Date.now().toString();
  const data = `${identity}.${timestamp}`;
  const signature = await hmacSign(secret, data);
  return `${identity}.${timestamp}.${signature}`;
}
