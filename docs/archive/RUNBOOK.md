# Operational Runbook

> **Living document** — Agents add entries here when they discover operational
> knowledge, troubleshooting steps, or maintenance procedures during development
> sessions.

---

## How to Use This Runbook

### When to Add an Entry

- After resolving a non-obvious issue that future agents would encounter
- When discovering an operational procedure not documented elsewhere
- When a workaround or constraint is found that affects development or
  deployment
- After an incident or outage that reveals useful knowledge

### When NOT to Add

- If the knowledge is already in an existing guide — link to it instead
- Session-specific or temporary context (use Claude memory for that)
- Speculative or unverified conclusions

### Entry Format

```markdown
### [Short descriptive title]

**Added:** YYYY-MM-DD | **Category:** [category]

[Description of the issue, procedure, or knowledge]

**Steps / Solution:**

1. Step one
2. Step two

**Verification:**

- How to confirm the fix/procedure worked
```

---

## Deployment & Rollback

> See also: [CI/CD Debugging Guide](./guides/CI_CD_DEBUGGING.md)

### Depot is preferred for CI builds

**Added:** 2026-02-19 | **Category:** Deployment

This project has a Depot subscription. Always prefer `yarn depot:ci` over local
CI runs — it executes CI remotely with fast caching and parallelism.

**Verification:**

- `yarn depot:ci` completes without errors

### Vercel preview URL smoke test is mandatory before merge

**Added:** 2026-02-19 | **Category:** Deployment

Before merging any PR, verify on the Vercel preview URL: home page loads,
navigation works, no console errors, new features work as expected, login flow
works (if applicable).

---

## Database

> See also:
> [Database Migration Rollback](./guides/DATABASE_MIGRATION_ROLLBACK.md) |
> [Database Quick Start](./guides/DATABASE_QUICK_START.md)

### Dynamic Prisma import pattern

**Added:** 2026-02-19 | **Category:** Database

Prisma client must be imported dynamically throughout the codebase:

```ts
const prisma = (await import("@/lib/prisma")).default;
```

No type annotation needed — TypeScript infers it. This is the established
pattern; do not change it to a static import.

---

## Infrastructure

### esbuild-wasm requires explicit initialization

**Added:** 2026-02-19 | **Category:** Infrastructure

You must call `initialize()` before `transform()` or `build()` in esbuild-wasm.
The project uses a singleton init module at `src/lib/codespace/esbuild-init.ts`.
The WASM binary is at `node_modules/esbuild-wasm/esbuild.wasm`.

**Steps:**

1. Import the init module:
   `import { ensureInitialized } from "@/lib/codespace/esbuild-init"`
2. Await initialization before any esbuild operations

### PeerJS pinned to v1.5.5

**Added:** 2026-02-19 | **Category:** Infrastructure

PeerJS v1.5.5 is the latest stable release. Version 2.0 is beta-only. The
deprecation warning seen in logs is internal to the library — no upgrade is
available. Do not attempt to upgrade to 2.x.

---

## Secrets & Auth

> See also: [Credential Rotation](./guides/CREDENTIAL_ROTATION.md) |
> [Secrets Setup](./guides/SECRETS_SETUP.md)

### Claude/Anthropic auth uses OAuth tokens only

**Added:** 2026-02-19 | **Category:** Auth

**ONLY** use `CLAUDE_CODE_OAUTH_TOKEN` for Claude/Anthropic authentication.
`ANTHROPIC_API_KEY` has been completely removed from the codebase (see DEC-004).

Reason: Claude Max subscription (~GBP180/mo) provides ~GBP3000 worth of API
equivalent.

OAuth token requires different headers than API keys:

```ts
// OAuth token — use Bearer auth + beta flag
headers: {
  Authorization: `Bearer ${token}`,
  "anthropic-version": "2023-06-01",
  "anthropic-beta": "oauth-2025-04-20",
}
```

DB-stored token (AIProvider table) takes precedence via
`resolveAIProviderConfig("anthropic")`.

---

## Monitoring & Incidents

> See also: [Error Log Audit Guide](./guides/ERROR_LOG_AUDIT_GUIDE.md)

### CI coverage thresholds are enforced

**Added:** 2026-02-19 | **Category:** CI

MCP business logic (`src/lib/mcp/**/*.ts`) has enforced coverage thresholds:

- Lines: 80%, Functions: 80%, Branches: 75%, Statements: 80%

MCP tool coverage: 150 test files for 147 tool files (100%+ file coverage).

If coverage drops below thresholds, CI will fail. Run `yarn test:coverage`
locally to check before pushing.

---

## Common Fixes

### vi.mock hoisting in Vitest with forks pool

**Added:** 2026-02-19 | **Category:** Testing

Variables used inside `vi.mock()` factory must be declared with `vi.hoisted()`:

```ts
const mockRedis = vi.hoisted(() => ({ set: vi.fn(), get: vi.fn() }));
vi.mock("@/lib/upstash/client", () => ({ redis: mockRedis }));
```

Plain `const mockX = { ... }` before `vi.mock()` causes "Cannot access before
initialization" in forks pool (vitest 4+).

### Mocking Node.js built-ins requires default key

**Added:** 2026-02-19 | **Category:** Testing

When mocking `node:fs`, `node:child_process`, etc., the mock must include a
`default` key pointing to the mocked object itself:

```ts
vi.mock("node:fs", async (importOriginal) => {
  const actual = await importOriginal<typeof import("node:fs")>();
  const mocked = { ...actual, existsSync: vi.fn() };
  return { ...mocked, default: mocked };
});
```

### vi.useFakeTimers conflicts with userEvent.setup

**Added:** 2026-02-19 | **Category:** Testing

`vi.useFakeTimers()` conflicts with `userEvent.setup()`. Use per-test fake
timers with `fireEvent` instead of `userEvent` when fake timers are needed.

---

## EC2 Box Provisioning

### EC2 box provisioning and VNC sessions

**Added:** 2026-02-26 | **Category:** Infrastructure

The platform supports EC2-based box provisioning via the `Box` and `BoxTier`
Prisma models. Key components:

- **Provisioner**: `src/lib/boxes/ec2-provisioner.ts` handles launching and
  managing EC2 instances.
- **User data**: `src/lib/boxes/user-data-template.ts` generates instance
  bootstrap scripts.
- **API routes**: `src/app/api/boxes/[id]/action/route.ts` (start/stop/restart)
  and `src/app/api/boxes/[id]/vnc-session/route.ts` (VNC access).
- **Cron**: `sync-box-status` cron job keeps Box records in sync with actual EC2
  instance states.

**Verification:**

- Check box status via admin dashboard or API
- VNC session URLs are time-limited and authenticated

### Cron auth module (timing-safe comparison)

**Added:** 2026-02-26 | **Category:** Auth

The `src/lib/cron-auth.ts` module provides `validateCronSecret()` which uses
`crypto.timingSafeEqual()` for comparing the `CRON_SECRET` bearer token. This
replaces the previous fail-open `===` comparison pattern found in cron routes.

**Steps:**

1. Import: `import { validateCronSecret } from "@/lib/cron-auth"`
2. Call at the top of any cron route handler:
   `const authResult = validateCronSecret(request);`
3. If `authResult` is a `Response`, return it immediately (401 Unauthorized)

**Verification:**

- Cron routes return 401 when `CRON_SECRET` is missing or incorrect
- No timing information leaks via comparison

---

## Social Integration

### TikTok OAuth flow

**Added:** 2026-02-26 | **Category:** Auth

TikTok social integration has been added. The OAuth flow follows the standard
pattern used by other social providers (GitHub, Google, Facebook, Apple).

**Key files:**

- Social client: `src/lib/social/clients/tiktok.ts`
- Auth configuration integrated with NextAuth.js v5

**Notes:**

- TikTok `createPost()` currently throws (not yet implemented at the API level)
- `getTrendingHashtags` and `getTrendingSounds` return empty arrays (TikTok API
  limitation)

---

## Performance

### AnimationPerformanceProvider

**Added:** 2026-02-26 | **Category:** Performance

The `AnimationPerformanceProvider` React context provides frame-rate monitoring
and animation quality adaptation. It detects low-performance devices and
automatically reduces animation complexity (particle counts, transition
durations, etc.) to maintain smooth UX.

**Usage:**

- Wrap components that have heavy animations with the provider
- Use the context hook to read the current performance tier and adapt rendering

**Verification:**

- Open the app on a low-end device or throttle CPU in DevTools
- Animations should degrade gracefully instead of stuttering
