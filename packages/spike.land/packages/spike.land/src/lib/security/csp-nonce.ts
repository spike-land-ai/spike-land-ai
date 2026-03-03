export const CSP_NONCE_HEADER = "x-nonce";

export function generateNonce(): string {
  // Use crypto for cryptographically secure random number generation
  return Buffer.from(crypto.getRandomValues(new Uint8Array(16))).toString(
    "base64",
  );
}
