# CLAUDE.md

## Overview

Cloudflare Worker providing on-demand JavaScript/TypeScript transpilation using
esbuild-wasm at the edge. Published as `@spike-land-ai/transpile` (private).

## Commands

```bash
npm run dev          # Local wrangler dev server
npm run dev:remote   # Remote wrangler dev
npm run deploy:prod  # Deploy to production (wrangler deploy --minify)
npm test             # Run tests (Vitest)
npm run test:coverage # Tests with coverage
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
```

## Architecture

```
├── index.ts       # Worker entry point (fetch handler)
├── index.spec.ts  # Tests
└── wasm.d.ts      # WASM type declarations
```

**Runtime**: Cloudflare Workers. Receives code via HTTP, transpiles with
esbuild-wasm, returns result.

**Dependencies**: `@spike-land-ai/code`, `esbuild-wasm`

## Code Quality Rules

- Never use `any` type — use `unknown` or proper types
- Never add `eslint-disable` or `@ts-ignore` comments
- TypeScript strict mode
- All business logic must have test coverage

## CI/CD

- Shared workflow: `.github/.github/workflows/ci-publish.yml`
- Deployed via `wrangler deploy` (Cloudflare Workers)
- Private package (not published to registry)
