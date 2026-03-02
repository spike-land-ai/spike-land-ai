# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **spike-land-ai** umbrella directory containing 27 independent git repositories under the `@spike-land-ai` GitHub org. All packages live under the `packages/` directory, each as a separate git submodule with its own history. The root `package.json` uses a single Yarn workspace glob: `"workspaces": ["packages/*"]`.

All packages are published to GitHub Packages (`npm.pkg.github.com`) under the `@spike-land-ai` scope using Changesets. CI/CD is shared via a reusable workflow in `.github/.github/workflows/ci-publish.yml`.

## Packages

All packages live under `packages/`:

### SpacetimeDB (real-time backbone)

| Directory | Package | Runtime | Purpose |
|-----------|---------|---------|---------|
| `packages/spacetimedb-platform` | `@spike-land-ai/spacetimedb-platform` | SpacetimeDB 2.0 (WASM) | Platform module — users, tools, apps, agents, content, messaging (14 tables, 30+ reducers) |
| `packages/spacetimedb-mcp` | `@spike-land-ai/spacetimedb-mcp` | Node.js | MCP server for agent coordination — real-time messaging, tasks |

### New Platform Stack

| Directory | Package | Runtime | Purpose |
|-----------|---------|---------|---------|
| `packages/spike-app` | `@spike-land-ai/spike-app` | Browser (Vite + TanStack Router) | Frontend SPA replacing Next.js UI |
| `packages/spike-edge` | `@spike-land-ai/spike-edge` | Cloudflare Workers | Edge API service (Hono) |
| `packages/spike-land-mcp` | `@spike-land-ai/spike-land-mcp` | Cloudflare Workers + D1 | MCP registry with 80+ tools |
| `packages/mcp-auth` | `@spike-land-ai/mcp-auth` | Cloudflare Workers | Auth MCP server (Better Auth + Drizzle) |
| `packages/mcp-server-base` | `@spike-land-ai/mcp-server-base` | Node.js | Shared base utilities for MCP servers |

### Domain Packages

| Directory | Package | Runtime | Purpose |
|-----------|---------|---------|---------|
| `packages/chess-engine` | `@spike-land-ai/chess-engine` | Node.js | Chess ELO engine with game/player/challenge managers |
| `packages/qa-studio` | `@spike-land-ai/qa-studio` | Node.js | Browser automation utilities (Playwright) |
| `packages/state-machine` | `@spike-land-ai/state-machine` | Node.js | Statechart engine with guard parser and CLI |

### Core Infrastructure

| Directory | Package | Runtime | Purpose |
|-----------|---------|---------|---------|
| `packages/code` | `@spike-land-ai/code` | Browser (Vite) | Monaco-based code editor with live preview |
| `packages/spike-land-backend` | `@spike-land-ai/spike-land-backend` | Cloudflare Workers | Backend API with Durable Objects, Hono framework |
| `packages/transpile` | `@spike-land-ai/transpile` | Cloudflare Workers | On-demand JS/TS transpilation via esbuild-wasm |
| `packages/react-ts-worker` | `@spike-land-ai/react-ts-worker` | Browser/Workers/Node | From-scratch React implementation (Fiber reconciler, scheduler, multi-target rendering) |
| `packages/esbuild-wasm` | `@spike-land-ai/esbuild-wasm` | Browser (WASM) | Cross-platform esbuild WASM binary |
| `packages/esbuild-wasm-mcp` | `@spike-land-ai/esbuild-wasm-mcp` | Node.js | MCP server wrapping esbuild-wasm |
| `packages/shared` | `@spike-land-ai/shared` | Node/Browser | Shared types, validations, constants, utilities |

### MCP Servers & Tools

| Directory | Package | Runtime | Purpose |
|-----------|---------|---------|---------|
| `packages/spike-cli` | `@spike-land-ai/spike-cli` | Node.js CLI | MCP multiplexer CLI with Claude chat integration |
| `packages/spike-review` | `@spike-land-ai/spike-review` | Node.js | AI code review bot with GitHub integration |
| `packages/hackernews-mcp` | `@spike-land-ai/hackernews-mcp` | Node.js | MCP server for HackerNews read/write |
| `packages/mcp-image-studio` | `@spike-land-ai/mcp-image-studio` | Node.js | AI image generation, enhancement, albums & pipelines MCP tools |
| `packages/openclaw-mcp` | `@spike-land-ai/openclaw-mcp` | Node.js | MCP bridge for OpenClaw gateway |
| `packages/vibe-dev` | `@spike-land-ai/vibe-dev` | Node.js CLI | Docker-based dev workflow tool |
| `packages/video` | `@spike-land-ai/video` | Remotion | Educational video compositions |

### Shared Config

| Directory | Package | Runtime | Purpose |
|-----------|---------|---------|---------|
| `packages/eslint-config` | `@spike-land-ai/eslint-config` | — | Shared ESLint configuration |
| `packages/tsconfig` | `@spike-land-ai/tsconfig` | — | Shared TypeScript configuration |

### Legacy

| Directory | Package | Runtime | Purpose |
|-----------|---------|---------|---------|
| `packages/spike.land` | `spike-land` | Next.js 16 / AWS ECS | Legacy platform — MCP registry, app store, auth, payments (being replaced by SpacetimeDB stack) |

## Common Commands

Each package has its own scripts. The most common patterns:

```bash
# Org-wide health check (PRs, CI, issues, worktrees, dep drift)
make health
# or: bash .github/scripts/org-health.sh

# SpacetimeDB (spacetimedb-platform)
spacetime build                          # Compile WASM module
spacetime publish rightful-dirt-5033     # Deploy to maincloud
spacetime generate --lang=typescript --out-dir=src/module_bindings  # Regen bindings

# spike-app (Vite + TanStack Router frontend)
cd packages/spike-app
npm run dev           # Vite dev server
npm run build         # Production build

# spike-edge (Cloudflare Workers edge API)
cd packages/spike-edge
npm run dev           # Local wrangler dev
npm run deploy        # Deploy to production

# Most packages (Node.js / MCP servers)
npm run build         # Build TypeScript
npm test              # Run tests (Vitest)
npm run test:coverage # Tests with coverage

# Cloudflare Workers (spike-land-backend, transpile, spike-land-mcp, mcp-auth)
npm run dev           # Local wrangler dev
npm run dev:remote    # Remote wrangler dev
npm run w:deploy:prod # Deploy to production

# code (Monaco editor)
npm run dev:vite      # Vite dev server
npm run build:vite    # Build for browser

# react-ts-worker
yarn build            # Build to dist/
yarn test             # Vitest with jsdom
yarn typecheck        # Type check only

# spike.land (legacy, being replaced)
cd packages/spike.land
yarn dev              # Dev server (localhost:3000)
yarn build            # Production build
yarn lint             # ESLint
yarn typecheck        # TypeScript check
yarn test:coverage    # Vitest with enforced coverage thresholds
yarn depot:ci         # Preferred CI — fast remote builds via Depot
```

## Architecture

### SpacetimeDB Real-Time Backbone (spacetimedb-platform, spacetimedb-mcp)

The platform is migrating to SpacetimeDB 2.0 as the core data layer. The `spacetimedb-platform` module defines 14 tables and 30+ reducers covering users, tools, apps, agents, content, and messaging. The `spacetimedb-mcp` module provides agent coordination with real-time messaging and task management. Server: `maincloud`, database: `rightful-dirt-5033`.

### Frontend (spike-app)

Vite + React + TanStack Router SPA replacing the Next.js UI. Talks to spike-edge and SpacetimeDB directly.

### Edge Services (spike-edge, spike-land-mcp, mcp-auth, spike-land-backend, transpile)

Cloudflare Workers using Hono framework. `spike-edge` is the primary edge API. `spike-land-mcp` is the MCP registry (80+ tools, D1-backed). `mcp-auth` handles authentication (Better Auth + Drizzle). `spike-land-backend` provides Durable Objects for real-time sync. `transpile` provides esbuild-wasm compilation at the edge.

### Custom React (react-ts-worker)

Full React reimplementation with Fiber reconciler, lane-based scheduling, and host config pattern for multi-target rendering (DOM, Worker-DOM, server streaming). See `packages/react-ts-worker/CLAUDE.md` for architecture details.

### MCP Ecosystem

Multiple MCP servers following a common pattern: `@modelcontextprotocol/sdk` + Zod validation + Vitest tests. `mcp-server-base` provides shared utilities. `spike-land-mcp` acts as the MCP registry aggregating 80+ tools. Additional MCP servers: esbuild-wasm-mcp, hackernews-mcp, mcp-image-studio, openclaw-mcp, spacetimedb-mcp.

### Domain Packages

- `chess-engine` — Chess ELO engine with game/player/challenge managers
- `qa-studio` — Browser automation utilities (Playwright)
- `state-machine` — Statechart engine with guard parser and CLI

### Legacy Platform (spike.land)

Next.js 16 App Router application with ~520 routes, ~383 API endpoints, PostgreSQL + Prisma, Stripe payments. Being replaced by the SpacetimeDB + spike-app + spike-edge stack. Has its own detailed `packages/spike.land/CLAUDE.md` with ticket-driven workflow requirements.

## CI/CD

- Shared workflow: `.github/.github/workflows/ci-publish.yml` (reusable across all repos)
- Node 24, GitHub Packages npm registry
- Changesets for versioning and publishing on main branch push
- spike.land has its own extensive CI (legacy): ESLint, TypeScript, Vitest (4 shards), Next.js build, AWS ECS deploy

## Dependency Cascade System

When any `@spike-land-ai/*` package publishes, consuming repos automatically receive a PR bumping the version.

### How it works
1. `ci-publish.yml` `notify` job fires after Changesets publishes
2. Reads `.github/dependency-map.json` to find downstream repos
3. Sends `repository_dispatch` (type: `dependency-updated`) to each consumer
4. Consumer's `receive-dispatch.yml` calls `bump-dependency.yml` (reusable)
5. `bump-dependency.yml` patches `package.json` and opens a PR with auto-merge

### Dependency graph (source → consumers)
| Source package | Consuming repos |
|----------------|-----------------|
| `@spike-land-ai/esbuild-wasm` | esbuild-wasm-mcp, code, transpile, spike-land-backend, spike.land |
| `@spike-land-ai/esbuild-wasm-mcp` | code, spike-land-backend |
| `@spike-land-ai/code` | transpile, spike-land-backend |
| `@spike-land-ai/shared` | mcp-image-studio, spike-land-mcp, spike.land |
| `@spike-land-ai/react-ts-worker` | spike.land |
| `@spike-land-ai/spike-cli` | spike.land |
| `@spike-land-ai/eslint-config` | chess-engine, code, esbuild-wasm-mcp, hackernews-mcp, mcp-image-studio, mcp-server-base, openclaw-mcp, react-ts-worker, shared, spacetimedb-platform, spike-app, spike-cli, spike-edge, spike-review, state-machine, spike.land |
| `@spike-land-ai/tsconfig` | chess-engine, code, esbuild-wasm-mcp, hackernews-mcp, mcp-image-studio, mcp-server-base, openclaw-mcp, react-ts-worker, shared, spike-cli, spike-review, state-machine, spike.land |

### Key files
- `.github/dependency-map.json` — source-of-truth DAG
- `.github/.github/workflows/bump-dependency.yml` — reusable bump workflow
- `.github/.github/workflows/dep-sync-sweep.yml` — nightly safety-net (06:00 UTC)
- `.github/scripts/verify-deps.sh` — run locally to check for drift
- `.github/SETUP.md` — PAT setup instructions and how to add new packages

### Verify drift locally
```bash
bash .github/scripts/verify-deps.sh
```

### Excluded repos
- `vinext.spike.land` — uses git-SHA deps, not registry versions
- Leaf MCP servers (hackernews-mcp, mcp-image-studio, openclaw-mcp, spike-review, vibe-dev) — no internal deps
- New leaf packages (spacetimedb-mcp, mcp-auth, spike-app, spike-edge, qa-studio, state-machine, chess-engine) — no internal deps

## Content

User-facing documentation and blog posts live at the umbrella repo root:
- `docs/` — architecture, guides, API docs, best practices (~140 files)
- `content/blog/` — published MDX blog posts (18 files)

These are symlinked into `packages/spike.land/` for local dev (legacy setup). CI copies them.

## Key Conventions

- TypeScript strict mode across all packages
- Vitest for testing everywhere
- `@spike-land-ai/*` npm scope on GitHub Packages registry
- MCP servers follow: SDK + Zod schema + tool handler pattern
- Never use `any` type — use `unknown` or proper types
- Never use `eslint-disable`, `@ts-ignore`, or `@ts-nocheck`
- Most packages use npm. spike.land (legacy) uses Yarn.
