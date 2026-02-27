# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Overview

This is the **spike-land-ai** umbrella directory containing 15 independent git repositories under the `@spike-land-ai` GitHub org. Each subdirectory is a separate repo with its own git history — this is **not** a monorepo with a shared root `package.json`.

All packages are published to GitHub Packages (`npm.pkg.github.com`) under the `@spike-land-ai` scope using Changesets. CI/CD is shared via a reusable workflow in `.github/.github/workflows/ci-publish.yml`.

## Packages

| Directory | Package | Runtime | Purpose |
|-----------|---------|---------|---------|
| `spike.land` | `spike-land` | Next.js 16 / AWS ECS | Main platform — MCP registry, app store, auth, payments |
| `code` | `@spike-land-ai/code` | Browser (Vite) | Monaco-based code editor with live preview |
| `spike-land-backend` | `@spike-land-ai/spike-land-backend` | Cloudflare Workers | Backend API with Durable Objects, Hono framework |
| `transpile` | `@spike-land-ai/transpile` | Cloudflare Workers | On-demand JS/TS transpilation via esbuild-wasm |
| `react-ts-worker` | `@spike-land-ai/react-ts-worker` | Browser/Workers/Node | From-scratch React implementation (Fiber reconciler, scheduler, multi-target rendering) |
| `esbuild-wasm` | `@spike-land-ai/esbuild-wasm` | Browser (WASM) | Cross-platform esbuild WASM binary |
| `esbuild-wasm-mcp` | `@spike-land-ai/esbuild-wasm-mcp` | Node.js | MCP server wrapping esbuild-wasm |
| `shared` | `@spike-land-ai/shared` | Node/Browser | Shared types, validations, constants, utilities |
| `spike-cli` | `@spike-land-ai/spike-cli` | Node.js CLI | MCP multiplexer CLI with Claude chat integration |
| `spike-review` | `@spike-land-ai/spike-review` | Node.js | AI code review bot with GitHub integration |
| `hackernews-mcp` | `@spike-land-ai/hackernews-mcp` | Node.js | MCP server for HackerNews read/write |
| `mcp-pixel` | `@spike-land-ai/mcp-pixel` | Node.js | Image management/enhancement MCP tools |
| `openclaw-mcp` | `@spike-land-ai/openclaw-mcp` | Node.js | MCP bridge for OpenClaw gateway |
| `vibe-dev` | `@spike-land-ai/vibe-dev` | Node.js CLI | Docker-based dev workflow tool |
| `video` | `@spike-land-ai/video` | Remotion | Educational video compositions |

## Common Commands

Each package has its own scripts. The most common patterns:

```bash
# Most packages (Node.js / MCP servers)
npm run build         # Build TypeScript
npm test              # Run tests (Vitest)
npm run test:coverage # Tests with coverage

# spike.land (Next.js platform — uses Yarn)
cd spike.land
yarn dev              # Dev server (localhost:3000)
yarn build            # Production build
yarn lint             # ESLint
yarn typecheck        # TypeScript check
yarn test:coverage    # Vitest with enforced coverage thresholds
yarn depot:ci         # Preferred CI — fast remote builds via Depot

# Cloudflare Workers (spike-land-backend, transpile)
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
```

## Architecture

### Platform (spike.land)

The main platform is a Next.js 16 App Router application with:
- ~520 routes, ~383 API endpoints
- MCP server with 120+ tool files (each has a corresponding test file)
- Auth via NextAuth.js v5 (GitHub, Google, Facebook, Apple OAuth)
- PostgreSQL + Prisma ORM, Redis (Upstash) for caching/rate limiting
- Stripe payments, 17 first-party apps (chess, QA studio, audio mixer, etc.)
- CI: GitHub Actions → AWS ECS (Depot for remote builds)

Has its own detailed `spike.land/CLAUDE.md` with ticket-driven workflow requirements.

### Edge Computing (spike-land-backend, transpile)

Cloudflare Workers using Hono framework and Durable Objects. The transpile worker provides esbuild-wasm compilation at the edge.

### Custom React (react-ts-worker)

Full React reimplementation with Fiber reconciler, lane-based scheduling, and host config pattern for multi-target rendering (DOM, Worker-DOM, server streaming). See `react-ts-worker/CLAUDE.md` for architecture details.

### MCP Ecosystem

Multiple MCP servers following a common pattern: `@modelcontextprotocol/sdk` + Zod validation + Vitest tests. The spike.land platform acts as the MCP registry aggregating 455+ tools.

## CI/CD

- Shared workflow: `.github/.github/workflows/ci-publish.yml` (reusable across all repos)
- Node 24, GitHub Packages npm registry
- Changesets for versioning and publishing on main branch push
- spike.land has its own extensive CI: ESLint, TypeScript, Vitest (4 shards), Next.js build, AWS ECS deploy

## Key Conventions

- TypeScript strict mode across all packages
- Vitest for testing everywhere
- `@spike-land-ai/*` npm scope on GitHub Packages registry
- MCP servers follow: SDK + Zod schema + tool handler pattern
- Never use `any` type — use `unknown` or proper types
- Never use `eslint-disable`, `@ts-ignore`, or `@ts-nocheck`
- spike.land uses Yarn; most other packages use npm
