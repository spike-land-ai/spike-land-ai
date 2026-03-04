# Deployment Inventory

## Infrastructure Summary

| Platform                | Count | Services                                                                                     |
| ----------------------- | ----- | -------------------------------------------------------------------------------------------- |
| Cloudflare Workers      | 8     | spike-land-backend, transpile, spike-land-mcp, mcp-auth, spike-edge, code, spike-review, image-studio-worker |
| Cloudflare Pages/Assets | 1     | spike-app (via spike-edge)                                                                   |
| npm (GitHub Packages)   | 29    | All @spike-land-ai/* packages                                                                |
| MCP stdio servers       | 5     | esbuild-wasm-mcp, hackernews-mcp, mcp-image-studio, openclaw-mcp, spike-cli                  |

## Service Details

### Cloudflare Workers

1. **spike-land-backend** — Backend API with Durable Objects, Hono framework
   - Domain: spike.land (workers route)
   - Bindings: D1, R2, Durable Objects
   - Config: `src/spike-land-backend/wrangler.toml`
   - Deploy: `npm run w:deploy:prod`

2. **transpile** — On-demand JS/TS transpilation via esbuild-wasm
   - Domain: transpile.spike.land
   - Config: `src/transpile/wrangler.toml`
   - Deploy: `npm run w:deploy:prod`

3. **spike-land-mcp** — MCP registry with 80+ tools
   - Domain: mcp.spike.land
   - Bindings: D1
   - Config: `src/spike-land-mcp/wrangler.toml`
   - Deploy: `npm run w:deploy:prod`

4. **mcp-auth** — Auth MCP server (Better Auth + Drizzle)
   - Domain: auth-mcp.spike.land
   - Bindings: D1
   - Config: `src/mcp-auth/wrangler.toml`
   - Deploy: `npm run w:deploy:prod`

5. **mcp-image-studio** — AI image generation, enhancement, albums & pipelines
   - Domain: image-studio-mcp.spike.land
   - Bindings: D1 (pixel-studio), R2 (pixel-studio)
   - Frontend: Built React SPA served from ./frontend/dist
   - Config: `src/mcp-image-studio/worker/wrangler.toml`
   - Deploy: `npm run w:deploy:prod`

6. **spike-edge** — Edge API service (Hono)
   - Domain: edge.spike.land
   - Config: `src/spike-edge/wrangler.toml`
   - Deploy: `npm run w:deploy:prod`

7. **code** — Monaco-based code editor with live preview
   - Config: `src/code/wrangler.toml`
   - Deploy: `npm run w:deploy:prod`

8. **spike-review** — AI code review bot with GitHub integration
   - Config: `src/spike-review/wrangler.toml`
   - Deploy: `npm run w:deploy:prod`

### Legacy (spike.land)

> **Note:** AWS ECS infrastructure was decommissioned on 2026-03-02. spike.land (Next.js 16) is now legacy-only and not actively deployed. See `packages/spike.land/` for the legacy codebase.

### MCP stdio Servers (local process, not deployed)

These packages are consumed as npm dependencies or run as stdio processes, not
deployed as standalone services:

9. **esbuild-wasm-mcp** — MCP server wrapping esbuild-wasm
    - Config: `src/esbuild-wasm-mcp/package.json`
    - Purpose: Exposes esbuild compilation to Claude

11. **hackernews-mcp** — MCP server for HackerNews read/write
    - Config: `src/hackernews-mcp/package.json`
    - Purpose: Provides MCP interface to HackerNews API

12. **mcp-image-studio** — CLI mode (same package as #5, different entry point)
    - Config: `src/mcp-image-studio/package.json`
    - Purpose: Stdio MCP server for image operations

13. **openclaw-mcp** — MCP bridge for OpenClaw gateway
    - Config: `src/openclaw-mcp/package.json`
    - Purpose: Proxies Claude API calls via OpenClaw

14. **spike-cli** — MCP multiplexer CLI with Claude chat integration
    - Config: `src/spike-cli/package.json`
    - Purpose: Local MCP multiplexer for command-line usage

### npm-only Packages (no runtime deployment)

These packages are published to npm but not deployed as services:

- **chess-engine** — Chess ELO engine with game/player/challenge managers
- **eslint-config** — Shared ESLint configuration
- **mcp-server-base** — Shared base utilities for MCP servers
- **qa-studio** — Browser automation utilities (Playwright)
- **react-ts-worker** — From-scratch React implementation (Fiber reconciler,
  scheduler, multi-target rendering)
- **shared** — Shared types, validations, constants, utilities
- **state-machine** — Statechart engine with guard parser and CLI
- **tsconfig** — Shared TypeScript configuration
- **vibe-dev** — Docker-based dev workflow tool
- **video** — Educational video compositions (Remotion)
- **bazdmeg-mcp** — Quality gates and workspace tooling

## D1 Databases

| Worker           | Database Name  | Purpose             | Tables                                                                                                    |
| ---------------- | -------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| spike-land-mcp   | spike-land-mcp | MCP registry        | tools, tool_categories, tool_usage, registered_tools                                                      |
| mcp-auth         | auth-mcp       | User authentication | users, sessions, accounts, verification_tokens                                                            |
| mcp-image-studio | pixel-studio   | Image management    | images, enhancement_jobs, albums, album_images, pipelines, generation_jobs, subjects, tool_calls, credits |

## R2 Buckets

| Worker             | Bucket Name           | Purpose                                        |
| ------------------ | --------------------- | ---------------------------------------------- |
| mcp-image-studio   | pixel-studio          | Image storage (user uploads, generated images) |
| spike-land-backend | (check wrangler.toml) | Asset storage                                  |

## Secrets Management

All secrets are set via `wrangler secret put <NAME>` per worker.

### mcp-image-studio

- `GEMINI_API_KEY` — Google Gemini API key for image analysis
- `CF_AIG_TOKEN` — Cloudflare AI Gateway token
- `DEMO_TOKEN` — Demo mode token
- `ANTHROPIC_API_KEY` — Anthropic API key for Claude integration
- `AUTH_SERVICE_URL` — URL to auth-mcp.spike.land (defaults to
  https://auth-mcp.spike.land)

### mcp-auth

- `BETTER_AUTH_SECRET` — Session encryption secret
- `GOOGLE_CLIENT_ID` — Google OAuth client ID
- `GOOGLE_CLIENT_SECRET` — Google OAuth client secret
- `GITHUB_CLIENT_ID` — GitHub OAuth client ID
- `GITHUB_CLIENT_SECRET` — GitHub OAuth client secret

### spike-edge

- (Check `src/spike-edge/wrangler.toml` for required secrets)

### spike-land-backend

- (Check `src/spike-land-backend/wrangler.toml` for required secrets)

## Frontend Deployment

### spike-app (Vite + TanStack Router)

**Status**: In development, replacing spike.land UI

- **Built output**: `src/spike-app/dist/`
- **Served via**: spike-edge (Cloudflare Workers)
- **Development**: `npm run dev` (Vite dev server on localhost:5173)
- **Build**: `npm run build` (production build to dist/)
- **Deployment**: Automatic via CI when merged to main

### mcp-image-studio (React frontend)

**Status**: Integrated with mcp-image-studio worker

- **Built output**: `src/mcp-image-studio/frontend/dist/`
- **Served via**: mcp-image-studio worker (Cloudflare Workers)
- **Development**: `npm run dev:frontend` (Vite dev server)
- **Build**: `npm run build:frontend` (production build)
- **Deployment**: Built and deployed with worker via `npm run w:deploy:prod`

## CI/CD Pipeline

### All packages (Node.js / TypeScript)

- **Workflow**: `.github/.github/workflows/ci-publish.yml` (reusable)
- **Triggers**: Push to main, pull requests
- **Steps**: Lint (ESLint), type check (TypeScript), tests (Vitest)
- **Publishing**: Changesets on main branch push to GitHub Packages npm registry
- **Registry**: npm.pkg.github.com/@spike-land-ai

### spike.land (legacy)

> **Note:** AWS ECS deploy pipeline was decommissioned on 2026-03-02. spike.land is legacy-only.

### Cloudflare Workers (spike-land-backend, transpile, spike-land-mcp, etc.)

- **Deploy method**: `wrangler deploy` (triggered by CI on main)
- **Auth**: Cloudflare API token (CF_API_TOKEN secret)
- **Config**: Per-package `wrangler.toml`

## Dependency Cascade System

When any `@spike-land-ai/*` package publishes, consuming repos automatically
receive a PR bumping the version.

### How it works

1. `ci-publish.yml` `notify` job fires after Changesets publishes
2. Reads `.github/dependency-map.json` to find downstream repos
3. Sends `repository_dispatch` (type: `dependency-updated`) to each consumer
4. Consumer's `receive-dispatch.yml` calls `bump-dependency.yml` (reusable)
5. `bump-dependency.yml` patches `package.json` and opens a PR with auto-merge

### Key files

- `.github/dependency-map.json` — source-of-truth DAG
- `.github/.github/workflows/bump-dependency.yml` — reusable bump workflow
- `.github/.github/workflows/dep-sync-sweep.yml` — nightly safety-net (06:00
  UTC)
- `.github/scripts/verify-deps.sh` — run locally to check for drift

### Verify drift locally

```bash
bash .github/scripts/verify-deps.sh
```

## Migration Status

| Component                    | Current State        | Target State                                           | Status         |
| ---------------------------- | -------------------- | ------------------------------------------------------ | -------------- |
| Auth in mcp-image-studio     | Embedded Better Auth | Delegated to auth-mcp.spike.land                       | In progress    |
| Domain data (images, albums) | D1 in CF Worker      | Keep D1 (CF Worker path)                                | Done           |
| Frontend                     | spike.land (Next.js) | spike-app (Vite + TanStack Router)                     | In progress    |
| Edge API                     | spike-land-backend   | spike-edge                                             | In progress    |

## Quick Reference

### Deployments by Package Type

**Cloudflare Workers**: spike-land-backend, transpile, spike-land-mcp, mcp-auth,
mcp-image-studio, spike-edge, code, spike-review

- Deploy command: `npm run w:deploy:prod`
- Config: `wrangler.toml` in each package

**npm Registry**: All 29 packages

- Deploy: Automatic via Changesets on main branch
- Registry: npm.pkg.github.com/@spike-land-ai

**MCP stdio**: esbuild-wasm-mcp, hackernews-mcp, mcp-image-studio, openclaw-mcp,
spike-cli

- Deploy method: npm installation + local execution

**npm-only (no deployment)**: chess-engine, eslint-config,
mcp-server-base, qa-studio, react-ts-worker, shared,
state-machine, tsconfig, vibe-dev, video, bazdmeg-mcp

- Deploy method: npm publication only

### Health Check

```bash
# Org-wide health check (PRs, CI, issues, worktrees, dep drift)
make health
# or: bash .github/scripts/org-health.sh
```

### Common Deploy Workflows

```bash
# Deploy all Cloudflare Workers (CI does this automatically)
# Per-package: cd src/<name> && npm run w:deploy:prod
```
