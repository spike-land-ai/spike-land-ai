# Deploy An App To Cloudflare

## Summary

In this repo, source-of-truth code lives under `src/**` and deployable Worker
shims live under `packages/*`.

If you want to deploy a single MCP app or Worker-backed app, follow that same
pattern:

1. write source in `src/**`
2. create a thin deploy shim in `packages/<app>`
3. add `wrangler.toml`
4. run `npm run dev` and `npm run deploy` from the package shim

This guide is based on the working patterns in:

- `packages/spike-land-mcp`
- `packages/transpile`
- `packages/mcp-auth`

---

## Choose Your Deployment Path

### Path A: Publish Into The Shared App Store

Choose this when:

- you want discovery inside spike.land
- your app is a bundle of MCP tools on the shared runtime
- you want installs, ratings, and future marketplace distribution

### Path B: Dedicated Worker

Choose this when:

- you need stronger runtime isolation
- you need custom bindings or routing
- your app should run as its own Worker instead of the shared registry

You can do both over time: start dedicated, then publish metadata and store
integration later.

---

## Step 1: Create Source Code In `src/**`

Example layout:

```text
src/edge-api/my-app/
├── core-logic/
│   ├── index.ts
│   └── tools/
├── api/
└── manifest.json
```

Use existing source packages as templates:

- `src/edge-api/spike-land`
- `src/edge-api/transpile`
- `src/edge-api/auth`

---

## Step 2: Create A Deploy Shim In `packages/<app>`

Thin shims re-export the source package.

Example `packages/my-app/index.ts`:

```ts
export { default } from "../../src/edge-api/my-app/core-logic/index";
export * from "../../src/edge-api/my-app/core-logic/index";
```

This mirrors the pattern used by `packages/spike-land-mcp/index.ts` and
`packages/transpile/index.ts`.

---

## Step 3: Add `package.json`

Use the existing Worker packages as references.

Minimum shape:

```json
{
  "name": "@spike-land-ai/my-app",
  "private": true,
  "type": "module",
  "main": "dist/index.js",
  "scripts": {
    "dev": "wrangler dev",
    "deploy": "wrangler deploy --minify",
    "typecheck": "tsc --noEmit",
    "test": "vitest run"
  },
  "source": "./index.ts"
}
```

If you need D1 migrations, also add commands like:

```json
{
  "db:generate": "drizzle-kit generate",
  "db:migrate:local": "wrangler d1 migrations apply my-app --local",
  "db:migrate:remote": "wrangler d1 migrations apply my-app --remote"
}
```

That is the same pattern already used in `packages/spike-land-mcp`.

---

## Step 4: Add `wrangler.toml`

Start from a real package in the repo instead of inventing a new shape.

Example:

```toml
name = "my-app"
main = "./index.ts"
compatibility_date = "2025-07-12"
compatibility_flags = ["nodejs_compat"]
workers_dev = true
```

Then add only the bindings you actually need:

- `[[d1_databases]]` for D1
- `kv_namespaces` for KV
- `[[r2_buckets]]` for R2
- `[[services]]` for service bindings
- `[[routes]]` for custom domains

Use these working files as references:

- `packages/spike-land-mcp/wrangler.toml`
- `packages/transpile/wrangler.toml`
- `packages/mcp-auth/wrangler.toml`

---

## Step 5: Run Locally

From the package shim:

```bash
cd packages/my-app
npm run dev
```

For D1-backed apps, apply local migrations before testing the full flow:

```bash
cd packages/my-app
npm run db:migrate:local
```

---

## Step 6: Deploy

```bash
cd packages/my-app
npm run deploy
```

If you need remote D1 migrations:

```bash
cd packages/my-app
npm run db:migrate:remote
```

These commands are accurate because they mirror the existing package shims in
the repo.

---

## Step 7: Make It Store-Ready

If the Worker should also appear in the spike.land app store:

1. register its tools in the shared discovery/runtime model
2. add or seed app metadata for public listing
3. provide markdown/app detail content
4. make sure publication state starts as draft and only moves live when ready

Relevant source paths:

- `src/edge-api/spike-land/core-logic/mcp/manifest.ts`
- `src/edge-api/spike-land/api/public-apps.ts`
- `scripts/seed-apps.ts`
- `content/apps/`

That is how deployment and store discovery connect.

---

## Cross-Origin Note

If you want other origins to call your Worker directly from the browser, copy
the explicit CORS posture used by `src/edge-api/spike-land/api/app.ts`.

If you want a first-party-only proxy surface, copy the stricter `spike.land`
edge pattern instead.

Do not treat those two surfaces as equivalent.
