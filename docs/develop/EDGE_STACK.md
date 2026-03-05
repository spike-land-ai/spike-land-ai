# Edge Stack Architecture

All production services in spike-land-ai run on Cloudflare Workers. This
document covers the 8 deployed workers, their bindings, inter-service
communication, and deployment.

## Workers at a Glance

| # | Worker Name            | Package Directory          | Purpose                                                  |
|---|------------------------|----------------------------|----------------------------------------------------------|
| 1 | `spike-edge`           | `src/spike-edge`           | Primary edge API -- CORS, auth, proxy, R2, SPA serving   |
| 2 | `spike-land-mcp`       | `src/spike-land-mcp`       | MCP registry with 80+ tools, D1-backed                   |
| 3 | `mcp-auth`             | `src/mcp-auth`             | Authentication server (Better Auth + Drizzle)             |
| 4 | `spike-land`           | `src/spike-land-backend`   | Real-time collaboration backend with Durable Objects      |
| 5 | `esbuild`              | `src/transpile`            | On-demand JS/TS transpilation via esbuild-wasm            |
| 6 | `spike-land-frontend`  | `src/code`                 | Monaco code editor SPA with worker-based asset serving    |
| 7 | `spike-review`         | `src/spike-review`         | AI code review bot, GitHub webhook receiver               |
| 8 | `image-studio-mcp`     | `src/image-studio-worker`  | AI image generation, albums, and pipelines                |

## Service Map

| Worker Name           | Domain / Route                                                    | Bindings                                                                                                             | Secrets                                                          |
|-----------------------|-------------------------------------------------------------------|----------------------------------------------------------------------------------------------------------------------|------------------------------------------------------------------|
| `spike-edge`          | `edge.spike.land` (custom domain), `spike.land/*`, `www.spike.land/*` | R2: `R2` (spike-platform), `SPA_ASSETS` (spike-app-assets); DO: `LIMITERS` (RateLimiter); Service: `AUTH_MCP` (mcp-auth) | QUIZ_BADGE_SECRET, GA_API_SECRET, STRIPE_SECRET_KEY, GEMINI_API_KEY, CLAUDE_OAUTH_TOKEN, GITHUB_TOKEN |
| `spike-land-mcp`      | `mcp.spike.land/*` (prod), `mcp-staging.spike.land/*` (staging)   | D1: `DB` (spike-land-mcp); KV: `KV`                                                                                  | GA_API_SECRET                                                    |
| `mcp-auth`            | `auth-mcp.spike.land` (custom domain)                             | D1: `AUTH_DB` (spike-auth-production); R2: `AUTH_R2` (spike-auth-assets)                                              | DB_PASSWORD, BETTER_AUTH_SECRET                                  |
| `spike-land`          | workers.dev (no custom domain in config)                          | KV: `KV`; DO: `CODE` (Code), `LIMITERS` (CodeRateLimiter); R2: `R2` (npmprod), `X9` (code-chain); Site assets        | --                                                               |
| `esbuild`             | workers.dev (no custom domain in config)                          | CompiledWasm rule (`**/*.wasm`)                                                                                       | --                                                               |
| `spike-land-frontend` | `testing.spike.land` (custom domain)                              | Static assets (`./dist-vite/client`, SPA mode)                                                                        | --                                                               |
| `spike-review`        | workers.dev (no custom domain in config)                          | None                                                                                                                  | GITHUB_TOKEN, GITHUB_WEBHOOK_SECRET, CLAUDE_CODE_OAUTH_TOKEN    |
| `image-studio-mcp`    | `image-studio-mcp.spike.land` (custom domain)                     | D1: `IMAGE_DB` (pixel-studio); R2: `IMAGE_R2` (pixel-studio); Static assets (`./frontend/dist`)                      | --                                                               |

### Binding Summary

- **D1 databases (3)**: spike-land-mcp (`DB`), spike-auth-production (`AUTH_DB`), pixel-studio (`IMAGE_DB`)
- **R2 buckets (6)**: spike-platform, spike-app-assets, spike-auth-assets, npmprod, code-chain, pixel-studio
- **KV namespaces (2)**: spike-land-mcp (`KV`), spike-land-backend (`KV`)
- **Durable Objects (3 classes)**: RateLimiter (spike-edge), Code (spike-land-backend), CodeRateLimiter (spike-land-backend)
- **Service bindings (1)**: spike-edge -> mcp-auth (`AUTH_MCP`)

## Inter-Service Communication

### Service Bindings (zero-latency, same-datacenter)

```
spike-edge ──AUTH_MCP──> mcp-auth
```

spike-edge uses a Cloudflare service binding (`AUTH_MCP`) to call mcp-auth for
session validation. This is a zero-network-hop call within the same Cloudflare
datacenter. The auth middleware in `src/spike-edge/middleware/auth.ts` invokes
this binding on protected routes (`/proxy/*` and R2 mutations).

### HTTP-based Communication

Workers without service bindings communicate over HTTPS when needed:

- **spike-app** (browser SPA) calls `spike-edge` as its primary API gateway.
- **spike-edge** proxies authenticated requests to external APIs (Stripe,
  Anthropic, Google Gemini, GitHub) via `/proxy/*` routes.
- **spike-land-mcp** is accessed directly by MCP clients at `mcp.spike.land`.
- **spike-land** (backend) provides WebSocket connections for real-time
  collaboration via its Durable Objects.
- **esbuild** (transpile) is called for on-demand code transpilation.
- **spike-review** receives GitHub webhook POSTs for PR review events.
- **image-studio-mcp** is accessed directly by MCP clients and serves its own
  frontend.

### No Direct Worker-to-Worker HTTP

Apart from the spike-edge -> mcp-auth service binding, workers do not call each
other at runtime. Each worker is independently addressable and serves its own
domain or clients directly.

## Request Flow: spike-app to spike-edge

```
Browser (spike-app SPA)
  │
  │  HTTPS
  ▼
spike-edge  (edge.spike.land / spike.land/*)
  │
  ├─── Middleware pipeline:
  │      1. CORS (dynamic allowed origins)
  │      2. Security headers (CSP, HSTS, etc.)
  │      3. Auth (session validation via AUTH_MCP service binding)
  │      4. Error handler
  │
  ├─── GET /health ──────────────> R2 connectivity check
  │
  ├─── GET/POST/DELETE /r2/:key ─> R2 (spike-platform bucket)
  │
  ├─── POST /proxy/stripe ──────> https://api.stripe.com/*
  │                                (injects STRIPE_SECRET_KEY)
  │
  ├─── POST /proxy/ai ──────────> Anthropic API / Google Gemini API
  │                                (injects CLAUDE_OAUTH_TOKEN or GEMINI_API_KEY)
  │
  ├─── POST /proxy/github ──────> https://api.github.com/*
  │                                (injects GITHUB_TOKEN)
  │
  ├─── /live/* ──────────────────> Live update endpoints
  │
  ├─── /analytics ───────────────> Analytics ingestion
  │
  └─── /* (catch-all) ──────────> SPA_ASSETS R2 bucket
                                   (serves spike-app build artifacts)
```

Auth validation on protected routes:

```
spike-edge ──service binding──> mcp-auth
                                  │
                                  ▼
                                AUTH_DB (D1)
                                AUTH_R2 (R2)
```

## Deployment Commands

| Worker               | Command                                         | Notes                          |
|----------------------|-------------------------------------------------|--------------------------------|
| `spike-edge`         | `cd src/spike-edge && npm run deploy`            | `wrangler deploy --minify`     |
| `spike-land-mcp`     | `cd src/spike-land-mcp && npm run deploy`        | Production                     |
| `spike-land-mcp`     | `cd src/spike-land-mcp && npm run deploy:staging`| Staging environment            |
| `mcp-auth`           | `cd src/mcp-auth && npm run deploy`              | `wrangler deploy`              |
| `spike-land`         | `cd src/spike-land-backend && npm run deploy`    | `wrangler deploy --minify`     |
| `spike-land` (test)  | `cd src/spike-land-backend && npm run deploy:dev`| Testing environment            |
| `esbuild`            | `cd src/transpile && npm run deploy:prod`        | `wrangler deploy --minify`     |
| `spike-land-frontend`| `cd src/code && wrangler deploy`                 | Serves code editor SPA         |
| `spike-review`       | `cd src/spike-review && wrangler deploy`         | Webhook receiver               |
| `image-studio-mcp`   | `cd src/image-studio-worker && wrangler deploy`  | Image studio + frontend        |

### Database Migrations

Workers with D1 databases require migration management:

```bash
# spike-land-mcp
cd src/spike-land-mcp
npm run db:generate         # Generate Drizzle migrations
npm run db:migrate:local    # Apply locally
npm run db:migrate:remote   # Apply to remote D1

# mcp-auth
cd src/mcp-auth
npm run db:generate         # Generate Drizzle migrations
npm run db:push             # Push schema to database

# image-studio-mcp
cd src/image-studio-worker
# Migrations in ./migrations directory, applied via wrangler d1 migrations
```

## Compatibility

| Worker               | Compat Date  | Compat Flags     |
|----------------------|-------------|------------------|
| `spike-edge`         | 2025-01-01  | `nodejs_compat`  |
| `spike-land-mcp`     | 2025-07-12  | `nodejs_compat`  |
| `mcp-auth`           | 2025-02-28  | `nodejs_compat`  |
| `spike-land`         | 2025-07-12  | `nodejs_compat`  |
| `esbuild`            | 2024-12-01  | `nodejs_compat`  |
| `spike-land-frontend`| 2025-11-11  | --               |
| `spike-review`       | 2025-07-12  | `nodejs_compat`  |
| `image-studio-mcp`   | 2025-02-28  | `nodejs_compat`  |
