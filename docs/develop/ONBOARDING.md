# Monorepo Onboarding

## Overview

This repo has two important layers:

- `src/**` is the source of truth
- `packages/*` contains deploy/publish shims and package entrypoints

That split matters a lot for the app store work:

- app-store runtime code lives in `src/edge-api/spike-land`
- first-party edge proxy code lives in `src/edge-api/main`
- frontend store UI lives in `src/frontend/platform-frontend`
- portable app logic and offline storage primitives live in `src/core/block-sdk`

The root workspace configuration is package-oriented, but the platform logic you
will actually read and edit mostly lives in `src/**`.

---

## Where To Look First

| Area | Source path | Why it matters |
| --- | --- | --- |
| App store MCP runtime | `src/edge-api/spike-land` | Public tools, auth, categories, store tool families |
| First-party edge API | `src/edge-api/main` | Public proxy routes, store tool catalog API, experiments |
| Frontend app store UI | `src/frontend/platform-frontend` | Store screens, app pages, install/discovery UX |
| Offline/runtime abstraction | `src/core/block-sdk` | D1/IndexedDB/memory storage portability |
| Deploy shims | `packages/*` | Wrangler and publish entrypoints |

---

## Quickstart Paths

### 1. I Want To Work On The App Store Narrative

Read:

- `docs/PLATFORM_AND_VISION.md`
- `docs/features/FEATURES.md`
- `docs/features/APP_STORE_OVERVIEW.md`

### 2. I Want To Publish Or Register Store Tools

Read:

- `src/edge-api/spike-land/core-logic/mcp/manifest.ts`
- `src/edge-api/spike-land/core-logic/mcp/categories.ts`
- `src/edge-api/spike-land/core-logic/tools/store/`

### 3. I Want To Build A Cross-Origin Integration

Read:

- `src/edge-api/spike-land/api/app.ts`
- `src/edge-api/spike-land/api/middleware.ts`
- `src/edge-api/spike-land/api/oauth.ts`
- `docs/mcp/CROSS_ORIGIN_INTEGRATION.md`
- `docs/api/CROSS_ORIGIN_API_GUIDE.md`

### 4. I Want To Deploy A Single App On Cloudflare

Read:

- `packages/spike-land-mcp`
- `packages/transpile`
- `docs/develop/DEPLOY_APP_CLOUDFLARE.md`

### 5. I Want To Build An Offline Browser Bundle

Read:

- `src/core/block-sdk/db/idb.ts`
- `src/core/block-sdk/db/sql-js-loader.ts`
- `packages/block-tasks/browser.ts`
- `docs/develop/OFFLINE_BUNDLE_GUIDE.md`

---

## Common Commands

### Repo-Level

```bash
yarn install
yarn test
yarn typecheck
yarn lint
yarn build
```

### Shared MCP Runtime

```bash
cd packages/spike-land-mcp
npm run dev
npm run deploy
npm run db:migrate:local
npm run db:migrate:remote
```

### Edge Transpile Worker

```bash
cd packages/transpile
npm run dev
npm run deploy
```

### Frontend App (Astro SPA)

```bash
cd src/spike-app
npm run dev
npm run build
```

---

## App Store Mental Model

Keep these rules in your head when working in this repo:

1. Every meaningful store action should have a tool surface.
2. Public discovery and authenticated execution are separate concerns.
3. Source changes go in `src/**`; deployment config changes usually go in
   `packages/*`.
4. Offline support is a real architecture path, not just a marketing claim.
5. The store is a platform surface, not only a frontend route.

---

## Related Docs

- [../README.md](../README.md)
- [../PLATFORM_AND_VISION.md](../PLATFORM_AND_VISION.md)
- [DEPLOY_APP_CLOUDFLARE.md](./DEPLOY_APP_CLOUDFLARE.md)
- [OFFLINE_BUNDLE_GUIDE.md](./OFFLINE_BUNDLE_GUIDE.md)
