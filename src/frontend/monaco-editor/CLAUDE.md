# CLAUDE.md

## Overview

Monaco-based collaborative code editor with live preview, TypeScript support,
and Web Worker compilation. Browser runtime (Vite), published as
`@spike-land-ai/code`.

## Commands

```bash
npm run dev          # Full dev (Vite + types:watch + workers)
npm run dev:vite     # Vite dev server only
npm run build        # Full production build (Vite + types + workers)
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm test             # Run tests (Vitest)
npm run test:coverage # Tests with coverage
```

## Architecture

```
├── modules.ts        # Main library entry point
├── App.tsx           # Root React component
├── start.ts          # Application bootstrap
├── index.html        # HTML entry
├── @/                # Internal modules (aliased as @/)
│   ├── lib/          # Core libraries (esbuild integration)
│   └── workers/      # Web Worker scripts (Monaco workers)
├── components/       # React components
├── hooks/            # React hooks
├── routes/           # TanStack Router routes
├── services/         # Service layer
├── types/            # TypeScript types
├── utils/            # Utilities
├── sw.ts             # Service worker
└── __tests__/        # Test files
```

**Key technologies**: Vite, Monaco Editor, TanStack Router, esbuild-wasm
(in-browser compilation), Web Workers.

**Dependencies**: `esbuild-wasm`,
`esbuild-wasm-mcp`, `@spike-land-ai/shared`

## Code Quality Rules

- Never use `any` type — use `unknown` or proper types
- Never add `eslint-disable` or `@ts-ignore` comments
- TypeScript strict mode
- All business logic must have test coverage

## CI/CD

- Shared workflow: `.github/.github/workflows/ci-publish.yml`
- Changesets for versioning
- Publishes to GitHub Packages (`@spike-land-ai/*`)
- Consumed by: transpile, spike-land-backend
