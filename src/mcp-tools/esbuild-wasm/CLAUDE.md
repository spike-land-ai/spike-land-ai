# CLAUDE.md

## Overview

MCP server wrapping esbuild-wasm with full WASM lifecycle control — initialize,
bundle, transform, and dispose. Node.js runtime, published as
`esbuild-wasm-mcp`.

## Commands

```bash
npm run build        # Compile TypeScript (tsc)
npm test             # Run tests (Vitest)
npm run test:coverage # Tests with coverage
npm run typecheck    # tsc --noEmit
npm run lint         # ESLint
npm start            # Run the MCP server
```

## Architecture

```
├── index.ts     # MCP server entry point + tool registration
├── wasm-api.ts  # esbuild WASM lifecycle (init, build, transform, stop)
├── errors.ts    # Error types
└── tools/       # MCP tool implementations
```

**Dependencies**: `esbuild-wasm`, `@modelcontextprotocol/sdk`,
Zod.

## Code Quality Rules

- Never use `any` type — use `unknown` or proper types
- Never add `eslint-disable` or `@ts-ignore` comments
- TypeScript strict mode
- All business logic must have test coverage

## CI/CD

- Shared workflow: `.github/.github/workflows/ci-publish.yml`
- Changesets for versioning
- Publishes to GitHub Packages (`@spike-land-ai/*`)
- Depends on: `esbuild-wasm`
