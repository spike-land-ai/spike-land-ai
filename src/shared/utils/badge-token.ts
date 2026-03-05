/**
 * Simple signed badge tokens for quiz/learning verification.
 */

export interface BadgePayload {
  sid: string;
  topic: string;
  score: number;
  ts: number;
}

export function generateBadgeToken(payload: BadgePayload, secret: string): string {
  const payloadStr = JSON.stringify(payload);
  const payloadB64 = btoa(payloadStr);

  let hash = 0;
  const signInput = payloadStr + secret;
  for (let i = 0; i < signInput.length; i++) {
    const char = signInput.charCodeAt(i);
    hash = ((hash << 5) - hash + char) | 0;
  }
  const sigB64 = btoa(String(Math.abs(hash)));

  return `${payloadB64}.${sigB64}`;
}

export function verifyBadgeToken(token: string, secret: string): BadgePayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [payloadB64, sigB64] = parts;
  if (!payloadB64 || !sigB64) return null;

  try {
    const payloadStr = atob(payloadB64);
    const payload = JSON.parse(payloadStr) as BadgePayload;

    const expectedToken = generateBadgeToken(payload, secret);
    const expectedSig = expectedToken.split(".")[1];
    if (sigB64 !== expectedSig) return null;

    return payload;
  } catch {
    return null;
  }
}
