# CLAUDE.md

## Overview

Main backend for spike.land — real-time collaboration, API services, AI
integrations, and static asset hosting. Runs on Cloudflare Workers with Durable
Objects and Hono framework. Published as `@spike-land-ai/spike-land-backend`
(private).

## Commands

```bash
npm run dev          # Local wrangler dev server
npm run dev:remote   # Remote wrangler dev
npm run deploy       # Deploy to production (wrangler deploy --minify)
npm run deploy:dev   # Deploy to testing env
npm test             # Run tests (Vitest)
npm run test:coverage # Tests with coverage
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

## Architecture

```
├── mainFetchHandler.ts   # Top-level request router
├── fetchHandler.ts       # Primary fetch handler
├── routeHandler.ts       # Route matching
├── apiHandler.ts         # API endpoint handler
├── chatRoom.ts           # Durable Object — real-time chat rooms
├── websocketHandler.ts   # WebSocket connection manager
├── anthropicHandler.ts   # Anthropic AI integration
├── openaiHandler.ts      # OpenAI-compatible handler
├── replicateHandler.ts   # Replicate AI integration
├── r2bucket.ts           # Cloudflare R2 storage
├── rateLimiter.ts        # Rate limiting
├── Logs.ts               # Logging service
├── handlers/             # Request handlers by category
├── routes/               # Route definitions
├── services/             # Business logic services
├── mcp/                  # MCP server integration
├── frontend/             # Frontend asset serving
├── types/                # TypeScript types
└── utils/                # Shared utilities
```

**Runtime**: Cloudflare Workers + Durable Objects + R2 + Hono framework.

**Dependencies**: `esbuild-wasm-mcp`, `@spike-land-ai/shared`,
`esbuild-wasm`, `@spike-land-ai/code` (dev), AI SDKs (Anthropic,
Google, Vercel AI)

## Code Quality Rules

- Never use `any` type — use `unknown` or proper types
- Never add `eslint-disable` or `@ts-ignore` comments
- TypeScript strict mode
- All business logic must have test coverage

## CI/CD

- Shared workflow: `.github/.github/workflows/ci-publish.yml`
- Deployed via `wrangler deploy` (Cloudflare Workers)
- Private package (not published to registry)
