# Security Audit Report — spike-land Platform

**Date:** 2026-03-04
**Auditor:** Security Agent (claude-sonnet-4-6)
**Scope:** src/spike-edge, src/spike-land-mcp, src/mcp-auth
**OWASP Reference:** OWASP Top 10 2021

---

## Executive Summary

The platform has solid foundational security: parameterized D1 queries throughout, BYOK
keys encrypted at rest with AES-GCM-256 + PBKDF2, no dangerouslySetInnerHTML in frontend,
and auth middleware consistently applied to mutation routes. However, one **Critical** and
two **High** severity issues require immediate remediation before public launch.

---

## Findings

### CRITICAL-01: Live Stripe Secret Key Committed to Tracked File

**Severity:** Critical
**File:** `src/spike-edge/.env.local` (line 2)
**OWASP:** A02:2021 Cryptographic Failures / Sensitive Data Exposure

**Description:**

The file `src/spike-edge/.env.local` contains live production Stripe credentials:

```
STRIPE_SECRET_KEY="sk_live_51S3FaDAkyFJEcifu..."
STRIPE_WEBHOOK_SECRET="whsec_mlS2JpOy..."
```

While `.env.local` is listed in the root `.gitignore`, the file currently exists on disk.
The risk is that:
1. If it was ever committed (e.g., before the gitignore rule was added), it lives in git history.
2. Any CI/CD log, error dump, or accidental `git add .` could expose these live keys.
3. `sk_live_*` keys allow full Stripe API access including refunds, customer data, and
   subscription manipulation.

**Recommended Fix:**

1. **Immediately rotate** both `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET` in the
   Stripe dashboard. The committed values must be considered compromised.
2. Verify the file was never committed: `git log --all -- src/spike-edge/.env.local`
3. If it was committed, purge from history with `git filter-repo` or BFG Repo Cleaner.
4. Store all secrets in Cloudflare Workers secrets (`wrangler secret put`) — never in
   `.env.local` alongside the codebase.
5. Add a pre-commit hook (e.g., `gitleaks`, `detect-secrets`) to block future accidental
   credential commits.

---

### HIGH-01: Webhook Signature Comparison Not Timing-Safe

**Severity:** High
**Files:**
- `src/spike-edge/routes/stripe-webhook.ts` line 48
- `src/spike-edge/routes/whatsapp.ts` line 35

**OWASP:** A02:2021 Cryptographic Failures

**Description:**

Both webhook signature verifiers use `===` for the final comparison:

```typescript
// stripe-webhook.ts line 48
return expected === v1Signature;

// whatsapp.ts line 35
return expected === signature;
```

String equality (`===`) is subject to early-exit short-circuit evaluation, which leaks
timing information. A remote attacker making many requests could use timing differences to
forge a valid signature byte-by-byte (timing attack / HMAC oracle).

The correct approach is a constant-time comparison using `crypto.subtle` or a dedicated
`timingSafeEqual` utility.

**Recommended Fix:**

Replace both comparisons with a timing-safe implementation. Example for
`stripe-webhook.ts`:

```typescript
// Replace: return expected === v1Signature;
// With:
async function timingSafeEqual(a: string, b: string): Promise<boolean> {
  if (a.length !== b.length) return false;
  const enc = new TextEncoder();
  const aKey = await crypto.subtle.importKey(
    "raw", enc.encode(a), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const aSig = await crypto.subtle.sign("HMAC", aKey, enc.encode("spike"));
  const bKey = await crypto.subtle.importKey(
    "raw", enc.encode(b), { name: "HMAC", hash: "SHA-256" }, false, ["sign"],
  );
  const bSig = await crypto.subtle.sign("HMAC", bKey, enc.encode("spike"));
  // Compare the HMACs — equal inputs produce equal outputs
  const aArr = new Uint8Array(aSig);
  const bArr = new Uint8Array(bSig);
  let diff = 0;
  for (let i = 0; i < aArr.length; i++) diff |= aArr[i]! ^ bArr[i]!;
  return diff === 0;
}
```

Apply the same fix in `whatsapp.ts` `verifyHmac()`.

---

### HIGH-02: BYOK Fallback Allows Unencrypted Key Storage

**Severity:** High
**File:** `src/spike-land-mcp/tools/byok.ts` lines 21–55, `src/spike-land-mcp/routes/internal-byok.ts` line 33

**OWASP:** A02:2021 Cryptographic Failures

**Description:**

The encryption envelope includes a version flag:

```typescript
// byok.ts line 24
const keyInput = vaultSecret ? `${vaultSecret}:${userId}` : userId;

// byok.ts line 48-51
const envelope = {
  v: vaultSecret ? 2 : 1,   // v=1 means only userId was used as key material
  ...
};
```

When `VAULT_SECRET` is not set (or empty string), the encryption key is derived solely
from `userId`, which is a UUID stored in the database. An attacker who compromises the D1
database can trivially brute-force or derive the decryption key for all v=1 stored keys,
since UUIDs are not secret.

**Recommended Fix:**

1. Ensure `VAULT_SECRET` is always configured as a Cloudflare secret before launch.
2. Add a startup check that refuses to operate in degraded mode:
   ```typescript
   if (!vaultSecret) {
     throw new Error("VAULT_SECRET must be configured — refusing to store keys without server-side encryption");
   }
   ```
3. Consider migrating any existing v=1 records by re-encrypting on next user access.
4. Log a warning when a v=1 record is decrypted and prompt re-storage with VAULT_SECRET.

---

### MEDIUM-01: CSP Missing Stripe.js Domains

**Severity:** Medium
**File:** `src/spike-edge/index.ts` lines 68–85

**OWASP:** A05:2021 Security Misconfiguration

**Description:**

The Content-Security-Policy does not include Stripe's required script and frame domains:

```
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com
frame-src 'self' https://edge.spike.land
```

Stripe.js (`https://js.stripe.com`) and the Stripe hosted checkout (`https://checkout.stripe.com`)
are absent from `script-src` and `frame-src`. The `connect-src` also lacks `https://api.stripe.com`
for direct Stripe API calls from the frontend. This will block Stripe Elements from loading
in browsers that enforce CSP.

**Recommended Fix:**

Update the CSP in `src/spike-edge/index.ts`:

```typescript
"script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: https://static.cloudflareinsights.com https://js.stripe.com",
"frame-src 'self' https://edge.spike.land https://checkout.stripe.com https://js.stripe.com",
"connect-src 'self' https://edge.spike.land https://auth-mcp.spike.land https://mcp.spike.land wss://spike.land https://api.stripe.com blob: data:",
```

---

### MEDIUM-02: Rate Limiter Not Applied to Auth, Checkout, or Webhook Routes

**Severity:** Medium
**File:** `src/spike-edge/index.ts`, `src/spike-edge/rate-limiter.ts`

**OWASP:** A05:2021 Security Misconfiguration

**Description:**

The `RateLimiter` Durable Object is defined but not wired to any auth, checkout, or
webhook route in `index.ts`. The current grace limit (4 POST requests in 20 seconds per
Durable Object ID) is also very permissive. High-risk endpoints with no rate limiting:

- `POST /api/auth/*` (proxied to Better Auth) — brute-force password attempts
- `POST /api/checkout` — checkout session creation spam / Stripe abuse
- `POST /stripe/webhook` — webhook DoS (though Stripe IPs should be filtered)
- `POST /proxy/ai` — while auth-gated, no per-user rate limit cap on AI calls

**Recommended Fix:**

Wire rate limiting to high-risk routes. Example for checkout:

```typescript
app.use("/api/checkout", authMiddleware, async (c, next) => {
  const userId = c.get("userId" as never) as string;
  const id = c.env.LIMITERS.idFromName(`checkout:${userId}`);
  const stub = c.env.LIMITERS.get(id);
  const resp = await stub.fetch(new Request("https://limiter.internal/", { method: "POST" }));
  const cooldown = Number(await resp.text());
  if (cooldown > 0) return c.json({ error: "Too many requests" }, 429);
  return next();
});
```

Apply similar limits to `/api/auth/sign-in` and `/proxy/ai`.

---

### MEDIUM-03: `/mcp` POST Endpoint Has No Authentication

**Severity:** Medium
**File:** `src/spike-edge/index.ts` lines 179–192

**OWASP:** A01:2021 Broken Access Control

**Description:**

The MCP JSON-RPC proxy endpoint accepts unauthenticated POST requests:

```typescript
// index.ts line 179 — no authMiddleware applied
app.post("/mcp", async (c) => {
  // Proxies directly to MCP service binding
});
```

While the downstream `spike-land-mcp` service binding applies its own auth middleware,
unauthenticated requests that generate 401 responses still consume Cloudflare Worker CPU
time and create noise in logs. More critically, if a misconfiguration in the MCP service
binding ever removed its auth check, this gateway would become an open proxy.

**Recommended Fix:**

Add `authMiddleware` at the spike-edge layer as a defense-in-depth measure:

```typescript
app.post("/mcp", authMiddleware, async (c) => {
```

---

### MEDIUM-04: WhatsApp OTP Lacks Brute-Force Protection

**Severity:** Medium
**File:** `src/spike-edge/routes/whatsapp.ts` lines 140–173

**OWASP:** A07:2021 Identification and Authentication Failures

**Description:**

The `/whatsapp/link/verify` endpoint verifies a 6-digit OTP:

```typescript
if (link.link_code !== body.code) {
  return c.json({ error: "Invalid code" }, 400);
}
```

There is no attempt counter or lockout mechanism. A 6-digit OTP has 1,000,000 possible
values. An attacker who can make ~500 requests per minute (easily achievable) could
brute-force a valid code in under 33 minutes. The 10-minute expiry window reduces this to
~5,000 attempts needed (0.5% chance of success per request burst).

**Recommended Fix:**

1. Track failed attempts in D1: add `verify_attempts` column to `whatsapp_links`.
2. Lock out after 5 failed attempts, requiring re-initiation:
   ```typescript
   if (link.verify_attempts >= 5) {
     // Delete the link record, force re-initiation
     await c.env.DB.prepare("DELETE FROM whatsapp_links WHERE id = ?").bind(link.id).run();
     return c.json({ error: "Too many failed attempts. Request a new code." }, 429);
   }
   ```
3. Consider using an 8-digit OTP to increase the entropy.

---

### LOW-01: `unsafe-inline` in `script-src` CSP Directive

**Severity:** Low
**File:** `src/spike-edge/index.ts` line 72

**OWASP:** A03:2021 Injection (XSS)

**Description:**

```
script-src 'self' 'unsafe-inline' 'wasm-unsafe-eval' blob: ...
```

`'unsafe-inline'` allows inline `<script>` tags and `javascript:` URIs, significantly
weakening XSS protection. This is likely needed for the Monaco editor and live preview
features but should be scoped as narrowly as possible.

**Recommended Fix:**

If inline scripts cannot be avoided, use nonce-based CSP:

```typescript
const nonce = crypto.randomUUID().replace(/-/g, "");
c.res.headers.set("Content-Security-Policy",
  `script-src 'self' 'nonce-${nonce}' 'wasm-unsafe-eval' blob: https://js.stripe.com`
);
```

Inject the nonce into the HTML response for script tags that genuinely need inline
execution. Remove `'unsafe-inline'` entirely once nonces are in place.

---

### LOW-02: Internal BYOK Route Accessible Without Network-Level Auth

**Severity:** Low
**File:** `src/spike-land-mcp/app.ts` lines 28–29

**OWASP:** A01:2021 Broken Access Control

**Description:**

```typescript
// Internal routes (service-binding only, no auth)
app.route("/internal", internalByokRoute);
```

The `/internal/byok/get` route decrypts and returns user API keys. While Cloudflare
Workers service bindings are not publicly routable (only other Workers in the same account
can call them), the comment "service-binding only" relies on a Cloudflare network
guarantee rather than application-level enforcement. If the MCP service were ever exposed
directly (e.g., a custom domain added to it), this route would be an unauthenticated key
exfiltration endpoint.

**Recommended Fix:**

Add an internal shared secret header validated at the route level:

```typescript
internalByokRoute.use("*", async (c, next) => {
  const secret = c.req.header("X-Internal-Secret");
  if (secret !== c.env.INTERNAL_SERVICE_SECRET) {
    return c.json({ error: "Forbidden" }, 403);
  }
  return next();
});
```

Have `spike-edge` inject this header when calling via service binding.

---

### LOW-03: Error Logs Written to D1 Including Stack Traces

**Severity:** Low
**File:** `src/spike-edge/index.ts` lines 105–111

**OWASP:** A09:2021 Security Logging and Monitoring Failures

**Description:**

```typescript
"INSERT INTO error_logs (service_name, error_code, message, stack_trace, severity) VALUES ..."
.bind("spike-edge", "INTERNAL_ERROR", err.message, err.stack ?? null, "error")
```

Full stack traces are persisted to D1. Stack traces can contain file paths, variable
names, and internal implementation details. If D1 is ever accessed by a lower-privileged
role or queried through an analytics endpoint, this is information leakage.

**Recommended Fix:**

Truncate stack traces before storage and never expose them in API responses (already done
for the 500 response — good). Consider hashing or redacting sensitive path segments:

```typescript
const safeStack = err.stack?.split("\n").slice(0, 5).join("\n") ?? null;
```

---

## Summary Table

| ID         | Severity | Area                  | Status      |
|------------|----------|-----------------------|-------------|
| CRITICAL-01| Critical | Credentials in repo   | Needs fix   |
| HIGH-01    | High     | Timing-safe HMAC      | Needs fix   |
| HIGH-02    | High     | BYOK key encryption   | Needs fix   |
| MEDIUM-01  | Medium   | CSP / Stripe.js       | Needs fix   |
| MEDIUM-02  | Medium   | Rate limiting gaps    | Needs fix   |
| MEDIUM-03  | Medium   | /mcp auth gap         | Needs fix   |
| MEDIUM-04  | Medium   | OTP brute-force       | Needs fix   |
| LOW-01     | Low      | unsafe-inline CSP     | Acceptable  |
| LOW-02     | Low      | Internal route auth   | Recommended |
| LOW-03     | Low      | Stack trace in logs   | Recommended |

---

## Positive Findings

- All D1 queries use parameterized binding (`.bind(...)`), not string concatenation.
  No SQL injection risk found. (OWASP A03)
- BYOK keys are encrypted with AES-GCM-256 + PBKDF2 (100,000 iterations) at rest.
- The `byok_list_keys` tool correctly returns only provider name and dates — never key values.
- Proxy routes (`/proxy/stripe`, `/proxy/ai`, `/proxy/github`) validate URL allowlists and
  sanitize caller headers against an explicit allowlist — no SSRF via header injection.
- Frontend (`src/spike-app`) has no `dangerouslySetInnerHTML` usage found.
- HSTS header set with `max-age=63072000; includeSubDomains; preload` (2 years).
- MCP auth middleware hashes OAuth tokens with SHA-256 before D1 lookup — tokens never
  stored in plaintext.
- WhatsApp phone numbers are stored as SHA-256 hashes, not in plaintext.
- CORS is scoped to `https://spike.land` only (not wildcard `*`).
