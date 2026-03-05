# Monorepo Onboarding Guide

## Overview

The **spike-land-ai** monorepo contains 28 packages under the `src/` directory,
managed as a single Yarn workspace. The root `package.json` declares workspaces
as `["src/*"]`.

All packages are published to GitHub Packages (`npm.pkg.github.com`) under the
`@spike-land-ai` scope. Versioning and publishing are handled by Changesets.

**Key tools**: Yarn 4.12, TypeScript 5.9, Vitest 4, ESLint 10, Biome, Wrangler
(for Cloudflare Workers).

---

## Package Categories

### Platform Stack

The main application layer.

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@spike-land-ai/spike-app` | `src/spike-app` | Frontend SPA (Vite + TanStack Router) |
| `@spike-land-ai/spike-edge` | `src/spike-edge` | Edge API service (Hono on Cloudflare Workers) |
| `@spike-land-ai/spike-land-mcp` | `src/spike-land-mcp` | MCP registry with 80+ tools (CF Workers + D1) |
| `@spike-land-ai/mcp-auth` | `src/mcp-auth` | Auth MCP server (Better Auth + Drizzle) |
| `@spike-land-ai/mcp-server-base` | `src/mcp-server-base` | Shared base utilities for MCP servers |

### Cloudflare Workers

Services deployed to the Cloudflare edge.

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@spike-land-ai/spike-land-backend` | `src/spike-land-backend` | Backend API with Durable Objects |
| `@spike-land-ai/transpile` | `src/transpile` | On-demand JS/TS transpilation via esbuild-wasm |
| `@spike-land-ai/code` | `src/code` | Monaco-based code editor with live preview |
| `@spike-land-ai/spike-review` | `src/spike-review` | AI code review bot with GitHub integration |
| `@spike-land-ai/image-studio-worker` | `src/image-studio-worker` | Image processing worker |

### MCP Servers and Tools

Standalone MCP servers and CLI tools.

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@spike-land-ai/spike-cli` | `src/spike-cli` | MCP multiplexer CLI with Claude chat integration |
| `@spike-land-ai/hackernews-mcp` | `src/hackernews-mcp` | MCP server for HackerNews read/write |
| `@spike-land-ai/mcp-image-studio` | `src/mcp-image-studio` | AI image generation, enhancement, albums and pipelines |
| `@spike-land-ai/openclaw-mcp` | `src/openclaw-mcp` | MCP bridge for OpenClaw gateway |
| `@spike-land-ai/esbuild-wasm-mcp` | `src/esbuild-wasm-mcp` | MCP server wrapping esbuild-wasm |
| `@spike-land-ai/vibe-dev` | `src/vibe-dev` | Docker-based dev workflow tool |

### Domain Packages

Self-contained domain logic.

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@spike-land-ai/chess-engine` | `src/chess-engine` | Chess ELO engine with game/player/challenge managers |
| `@spike-land-ai/qa-studio` | `src/qa-studio` | Browser automation utilities (Playwright) |
| `@spike-land-ai/state-machine` | `src/state-machine` | Statechart engine with guard parser and CLI |

### Core Libraries

Shared runtime libraries consumed by other packages.

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@spike-land-ai/shared` | `src/shared` | Shared types, validations, constants, utilities |
| `@spike-land-ai/react-ts-worker` | `src/react-ts-worker` | From-scratch React implementation (Fiber reconciler) |
| `@spike-land-ai/block-sdk` | `src/block-sdk` | Block SDK with StorageAdapter (D1/IDB) |
| `@spike-land-ai/esbuild-wasm` | `src/esbuild-wasm` | Cross-platform esbuild WASM binary |

### Block Packages

Block-based application packages.

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@spike-land-ai/block-tasks` | `src/block-tasks` | Task management block |
| `@spike-land-ai/block-website` | `src/block-website` | Website block |

### SDK and Config

Build tooling, shared configuration, and supporting packages.

| Package | Directory | Purpose |
|---------|-----------|---------|
| `@spike-land-ai/bazdmeg-mcp` | `src/bazdmeg-mcp` | Internal MCP tooling (build, typecheck, publish, deploy) |
| `@spike-land-ai/eslint-config` | `src/eslint-config` | Shared ESLint configuration |
| `@spike-land-ai/tsconfig` | `src/tsconfig` | Shared TypeScript configuration |
| `@spike-land-ai/video` | `src/video` | Educational video compositions (Remotion) |

---

## First-Time Setup

### Prerequisites

- Node.js 24+ (via NVM recommended)
- Yarn 4 (Corepack)
- Docker (for `vibe-dev` and some integration tests)
- Wrangler CLI (installed as a devDependency, no global install needed)

### Clone and install

```bash
git clone git@github.com:spike-land-ai/spike-land-ai.git
cd spike-land-ai

# Enable Corepack so Yarn 4 is available
corepack enable

# Install all dependencies across all workspaces
yarn install
```

### Build everything

```bash
# Build all packages respecting dependency order
yarn build

# Or build only src/ packages via the shared esbuild config
yarn build:src
```

### Run tests

```bash
# Run tests across all packages
yarn test

# Run tests for only changed files
yarn test:src
```

### Lint and typecheck

```bash
yarn lint          # ESLint with auto-fix
yarn typecheck     # TypeScript type checking (incremental)
yarn format:check  # Biome format check
yarn format        # Biome auto-format
```

---

## Running a Package

Most packages follow the same pattern:

```bash
cd src/<package-name>
npm run dev
```

Common variations by package type:

**Vite apps** (spike-app, code):
```bash
cd src/spike-app
npm run dev        # Vite dev server with HMR
npm run build      # Production build
```

**Cloudflare Workers** (spike-edge, spike-land-backend, transpile, spike-land-mcp, mcp-auth):
```bash
cd src/spike-edge
npm run dev           # Local wrangler dev server
npm run dev:remote    # Remote wrangler dev (connects to real services)
npm run w:deploy:prod # Deploy to production
```

**Node.js packages** (chess-engine, state-machine, shared):
```bash
cd src/chess-engine
npm run build     # Compile TypeScript
npm test          # Run Vitest
```

---

## Adding a New Package

1. Create a directory under `src/`:
   ```bash
   mkdir src/my-new-package
   ```

2. Add a `package.json` with the `@spike-land-ai/` scope:
   ```json
   {
     "name": "@spike-land-ai/my-new-package",
     "version": "0.0.1",
     "private": false,
     "main": "dist/index.js",
     "types": "dist/index.d.ts",
     "scripts": {
       "build": "tsc",
       "test": "vitest run"
     }
   }
   ```

3. Add a `tsconfig.json` extending the shared config:
   ```json
   {
     "extends": "@spike-land-ai/tsconfig/base.json",
     "compilerOptions": {
       "outDir": "dist",
       "rootDir": "src"
     },
     "include": ["src"]
   }
   ```

4. Run `yarn install` from the repo root to link the new workspace.

5. If other packages will depend on it, add an entry to
   `.github/dependency-map.json` for the dependency cascade system.

6. Create a changeset when ready to publish:
   ```bash
   yarn changeset
   ```

---

## Key Conventions

- **TypeScript strict mode** across all packages. No exceptions.
- **Vitest** for all testing. No Jest, no Mocha.
- **No `any` type** -- use `unknown` or proper types.
- **No `eslint-disable`** comments, `@ts-ignore`, or `@ts-nocheck`.
- **`@spike-land-ai/*` scope** for all published packages on GitHub Packages.
- **MCP servers** follow the pattern: `@modelcontextprotocol/sdk` + Zod schema validation + tool handler.
- **Changesets** for versioning -- never bump versions manually.
- **Biome** for formatting, **ESLint** for linting. Run both before committing.

---

## Useful Commands Reference

| Command | What it does |
|---------|-------------|
| `yarn build` | Build all packages (dependency order) |
| `yarn test` | Run all tests |
| `yarn test:src` | Run tests for changed files only |
| `yarn typecheck` | TypeScript type checking |
| `yarn lint` | ESLint with auto-fix |
| `yarn format` | Biome auto-format |
| `yarn changeset` | Create a new changeset for publishing |
| `yarn release` | Publish packages via Changesets |
| `make health` | Org-wide health check (PRs, CI, issues, drift) |
| `bash .github/scripts/verify-deps.sh` | Check for dependency drift |
