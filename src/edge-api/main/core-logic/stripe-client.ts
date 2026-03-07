/**
 * Shared Stripe REST API helpers (no SDK dependency).
 */

export interface StripeResponse {
  ok: boolean;
  data: Record<string, unknown>;
}

export async function stripePost(
  key: string,
  path: string,
  body: Record<string, string>,
  idempotencyKey?: string,
): Promise<StripeResponse> {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
  };
  if (idempotencyKey) {
    headers["Idempotency-Key"] = idempotencyKey;
  }
  const res = await fetch(`https://api.stripe.com${path}`, {
    method: "POST",
    headers,
    body: new URLSearchParams(body).toString(),
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, data };
}

export async function stripeGet(
  key: string,
  path: string,
  params: Record<string, string>,
): Promise<StripeResponse> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`https://api.stripe.com${path}?${qs}`, {
    headers: { Authorization: `Bearer ${key}` },
  });
  const data = (await res.json()) as Record<string, unknown>;
  return { ok: res.ok, data };
}
