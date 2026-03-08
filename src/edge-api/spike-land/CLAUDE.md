# CLAUDE.md

## Overview

MCP registry and platform server for spike.land, providing 80+ tools covering
auth, storage, AI gateway, marketplace, and the open app store. Runs as a
Cloudflare Worker with D1 database. This package is the cross-origin MCP and
store-discovery surface behind spike.land's app-store model. Private package
(`@spike-land-ai/spike-land-mcp`).

## Commands

```bash
npm run dev                # Local wrangler dev server
npm run deploy             # Deploy to production
npm run deploy:staging     # Deploy to staging
npm test                   # Run tests (Vitest)
npm run typecheck          # tsc --noEmit
npm run lint               # ESLint
npm run db:generate        # Generate Drizzle migrations
npm run db:migrate:local   # Apply migrations locally
npm run db:migrate:remote  # Apply migrations to remote D1
```

## Architecture

```
├── index.ts           # Worker entry point
├── app.ts             # Hono app setup
├── env.ts             # Environment bindings
├── auth/              # Authentication (API key, JWT, OAuth device flow)
├── db/                # Drizzle ORM schema and database
├── kv/                # KV-backed categories and rate limiting
├── mcp/               # MCP server, registry, search, embeddings
├── procedures/        # RPC procedures
├── routes/            # HTTP routes (MCP, OAuth, well-known)
└── tools/             # 80+ MCP tool definitions
    ├── bazdmeg/       # Code review quality gates
    ├── career/        # Career growth tools
    ├── store/         # App store tools
    └── *.ts           # Individual tool files
```

**Key technologies**: MCP SDK, Hono, Drizzle ORM, Cloudflare Workers + D1, Zod.

## App Store Notes

- `api/app.ts` exposes wildcard CORS for the MCP worker so other origins can
  read metadata and call tools directly.
- `api/middleware.ts` keeps non-anonymous tool execution behind bearer auth.
- `core-logic/mcp/manifest.ts` is the authoritative store/runtime registration
  surface.
- `core-logic/tools/store/` contains the store-search, install, ratings,
  skills, and A/B tool families.

**Dependency**: `@spike-land-ai/shared`

## Code Quality Rules

- Never use `any` type — use `unknown` or proper types
- Never add `eslint-disable` or `@ts-ignore` comments
- TypeScript strict mode
- All business logic must have test coverage

## CI/CD

- Shared workflow: `.github/.github/workflows/ci-publish.yml`
- Private package (not published to registry)
- Deployed via `wrangler deploy`
