# spike.land — Features

## Overview

spike.land is an open, MCP-first app store where apps are made from composable
tools instead of opaque backends. The same platform surface powers the web UI,
`spike-cli`, external Cloudflare Workers, and browser clients that want to call
tools directly.

This page focuses on the platform features that matter most to the app store
story. Use the linked docs for deeper implementation detail.

---

## Core App Store Features

### Open App Store

Anyone can build toward the store model: package an app, define its tool
surface, add discovery metadata, and publish it into the shared catalog.

The store already supports the major marketplace motions:

- app discovery
- installs and uninstall
- ratings and reviews
- wishlists
- personalized recommendations
- skill distribution
- A/B variant workflows for app deployments

Read more: [APP_STORE_OVERVIEW.md](./APP_STORE_OVERVIEW.md)

### MCP-First App Model

Every app is a set of MCP tools plus metadata.

That matters because it means:

- humans and agents use the same feature surface
- tool contracts double as documentation
- apps can be composed from shared building blocks
- app functionality stays callable outside the spike.land UI

The public app catalog lives alongside the public tool catalog. A store app is
not just a screenshot and a landing page. It is a callable runtime contract.

### Dynamic Discovery

Discovery is not a static category grid frozen in a CMS.

The platform combines:

- registry categories
- full-text search
- featured and new listings
- tag-overlap recommendations
- install-history personalization
- persona-based recommendations

That is why the docs describe categories as AI-curated and evolving: the store
can keep re-ranking and regrouping apps without changing the underlying MCP
transport.

### Shared Tool Library

Store apps are built on a common three-layer system:

1. a shared core MCP runtime
2. a category and discovery layer
3. a developer SDK layer for storage, bundling, and deployment

This keeps the store from turning into a pile of disconnected micro-products.

Read more: [SHARED_TOOL_LIBRARY.md](./SHARED_TOOL_LIBRARY.md)

### Cross-Origin MCP Access

The store is open to external integration.

- `mcp.spike.land` exposes wildcard CORS on the MCP worker
- public app and tool metadata can be fetched without auth
- authenticated tool calls work with API keys or OAuth device-flow tokens
- existing products can embed spike.land tools without moving onto the same
  origin

Read more: [../mcp/CROSS_ORIGIN_INTEGRATION.md](../mcp/CROSS_ORIGIN_INTEGRATION.md)

### Cloudflare Worker Deployment

The platform’s default hosting model is Cloudflare Workers plus D1/KV/R2 where
needed. The repo uses deploy shims in `packages/*` so one source tree can power
local development, publishing, and Worker deployment.

Read more: [../develop/DEPLOY_APP_CLOUDFLARE.md](../develop/DEPLOY_APP_CLOUDFLARE.md)

### Offline-First Bundles

Not every app should depend on a live edge service. spike.land’s storage and
build tooling also support fully local browser deployments:

- IndexedDB for durable local data
- SQL semantics in-browser through the block SDK
- esbuild-wasm for local compilation
- service-worker caching and PWA packaging

Read more: [../develop/OFFLINE_BUNDLE_GUIDE.md](../develop/OFFLINE_BUNDLE_GUIDE.md)

### OpenAI-Compatible API

Agents and external clients can call spike.land MCP tools using the standard
OpenAI chat completions format (`POST /v1/chat/completions`). This means any
tool or agent that already speaks the OpenAI API can use spike.land as a drop-in
backend — no custom SDK required.

The endpoint supports:

- streaming and non-streaming responses
- tool/function calling mapped to MCP tools
- model routing (Claude, Gemini) behind a single interface

Source: `src/edge-api/main/api/routes/openai-compatible.ts`

### AI-Powered A/B Bug Detection

The platform ships both app-specific variant tooling and a generic experiments
engine.

The workflow is:

1. generate or deploy variants
2. assign visitors consistently
3. record impressions, engagement, and errors
4. compare outcomes statistically
5. promote the winner and monitor anomalies

The decision engine is deterministic and measurable. AI is used to generate
variants, propose fixes, and interpret failures.

Read more: [AB_TESTING_BUG_DETECTION.md](./AB_TESTING_BUG_DETECTION.md)

### App Sandboxing And Submission Trust

Open submissions only work if the runtime stays bounded.

Current platform controls include:

- authenticated access for non-anonymous tool calls
- publication state gates for apps and tools
- explicit anonymous-tool allowlists
- simulated sandboxes in the shared Worker runtime
- reviewable tool registration through manifests and metadata

Read more: [../security/APP_STORE_SECURITY.md](../security/APP_STORE_SECURITY.md)

---

## Store MCP Surface

The app store is backed by dedicated MCP categories, not just UI buttons.

| Category | What it covers | Representative tools |
| --- | --- | --- |
| `store-search` | App discovery | `store_search`, `store_browse_category`, `store_featured_apps`, `store_app_detail` |
| `store-install` | Installs and install state | `store_app_install`, `store_app_uninstall`, `store_app_install_status` |
| `store` | Ratings, reviews, wishlists, recommendations | `store_app_rate`, `store_app_reviews`, `store_wishlist_add`, `store_recommendations_get` |
| `store-skills` | Skill marketplace | `store_skills_list`, `store_skills_get`, `store_skills_install` |
| `store-ab` | Deployment variants and experiment workflows | `store_app_deploy`, `store_app_add_variant`, `store_app_assign_visitor`, `store_app_get_results` |

This is the core rule of the platform: if something matters in the store, it
should be accessible as tools.

---

## Access Channels

### Browser

- Store UI
- app detail pages
- install and rating flows
- public tool and app metadata

### CLI

- `spike-cli`
- external MCP clients
- automated workflows that call the same store/search/install surface

### External Apps

- custom frontends on another origin
- existing products embedding spike.land tools
- Cloudflare Workers calling the MCP endpoint directly

### Offline Bundles

- browser-only apps with IndexedDB
- self-contained demos
- installable PWAs for local-first usage

---

## Why These Features Compound

Each feature gets stronger because it sits on the same shared runtime:

- cross-origin access grows distribution
- shared tools lower app development cost
- offline support broadens deployment options
- A/B workflows improve app quality
- open publishing increases catalog depth
- better discovery brings more installs back into the store

That is the app-store flywheel:

`more tools -> more apps -> more integrations -> more usage data -> better discovery -> more developers`

---

## Next Reads

- [APP_STORE_OVERVIEW.md](./APP_STORE_OVERVIEW.md)
- [SHARED_TOOL_LIBRARY.md](./SHARED_TOOL_LIBRARY.md)
- [AB_TESTING_BUG_DETECTION.md](./AB_TESTING_BUG_DETECTION.md)
- [../mcp/CROSS_ORIGIN_INTEGRATION.md](../mcp/CROSS_ORIGIN_INTEGRATION.md)
- [../security/APP_STORE_SECURITY.md](../security/APP_STORE_SECURITY.md)
- [../best-practices/app-store-performance.md](../best-practices/app-store-performance.md)
