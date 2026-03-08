# Spike Land Documentation

This index is the fastest way to find the platform, app store, MCP, deployment,
security, and business docs that matter today.

**Website**: [spike.land](https://spike.land)

---

## Start Here

| Goal | Document |
| --- | --- |
| Understand the platform thesis | [PLATFORM_AND_VISION.md](./PLATFORM_AND_VISION.md) |
| Understand the core feature set | [features/FEATURES.md](./features/FEATURES.md) |
| Learn the app store model | [features/APP_STORE_OVERVIEW.md](./features/APP_STORE_OVERVIEW.md) |
| Integrate MCP from another app or origin | [mcp/CROSS_ORIGIN_INTEGRATION.md](./mcp/CROSS_ORIGIN_INTEGRATION.md) |
| See endpoint/auth details | [api/CROSS_ORIGIN_API_GUIDE.md](./api/CROSS_ORIGIN_API_GUIDE.md) |
| Deploy an app on Cloudflare Workers | [develop/DEPLOY_APP_CLOUDFLARE.md](./develop/DEPLOY_APP_CLOUDFLARE.md) |
| Build an offline browser bundle | [develop/OFFLINE_BUNDLE_GUIDE.md](./develop/OFFLINE_BUNDLE_GUIDE.md) |

---

## App Store

| Document | What it covers |
| --- | --- |
| [features/APP_STORE_OVERVIEW.md](./features/APP_STORE_OVERVIEW.md) | Discovery, installs, ratings, wishlists, app lifecycle |
| [features/SHARED_TOOL_LIBRARY.md](./features/SHARED_TOOL_LIBRARY.md) | The three-layer shared SDK and runtime model |
| [features/AB_TESTING_BUG_DETECTION.md](./features/AB_TESTING_BUG_DETECTION.md) | Variant testing, error tracking, Bayesian promotion rules |
| [security/APP_STORE_SECURITY.md](./security/APP_STORE_SECURITY.md) | Sandboxing, publication gates, trust model |
| [best-practices/app-store-performance.md](./best-practices/app-store-performance.md) | Performance targets, cache policy, latency budgets |

---

## MCP And API Integration

| Document | What it covers |
| --- | --- |
| [mcp/CROSS_ORIGIN_INTEGRATION.md](./mcp/CROSS_ORIGIN_INTEGRATION.md) | How to call spike.land MCP from any origin or product |
| [api/CROSS_ORIGIN_API_GUIDE.md](./api/CROSS_ORIGIN_API_GUIDE.md) | Base URLs, auth, rate limits, example requests |
| [mcp/DEVELOPMENT_INDEX.md](./mcp/DEVELOPMENT_INDEX.md) | MCP development map, including spike.land-specific integration paths |
| [mcp/SERVER_DEVELOPMENT.md](./mcp/SERVER_DEVELOPMENT.md) | General MCP server authoring guide |
| [mcp/TOOL_GUIDELINES.md](./mcp/TOOL_GUIDELINES.md) | Tool design and schema patterns |

---

## Build, Deploy, And Run

| Document | What it covers |
| --- | --- |
| [develop/ONBOARDING.md](./develop/ONBOARDING.md) | Monorepo orientation and quickstart paths |
| [develop/DEPLOY_APP_CLOUDFLARE.md](./develop/DEPLOY_APP_CLOUDFLARE.md) | Deploy shims, Wrangler workflow, store publication path |
| [develop/OFFLINE_BUNDLE_GUIDE.md](./develop/OFFLINE_BUNDLE_GUIDE.md) | IndexedDB, local WASM assets, service worker strategy |
| [best-practices/offline-first.md](./best-practices/offline-first.md) | Design patterns for offline-first MCP apps |
| [develop/EDGE_STACK.md](./develop/EDGE_STACK.md) | Cloudflare service map and architecture |

---

## Security

| Document | What it covers |
| --- | --- |
| [security/APP_STORE_SECURITY.md](./security/APP_STORE_SECURITY.md) | App store trust model, review gates, sandbox boundaries |
| [security/SECURITY_INDEX.md](./security/SECURITY_INDEX.md) | Security document map |
| [security/SECURITY_HARDENING.md](./security/SECURITY_HARDENING.md) | CSP and hardening controls |
| [security/SPIKE_EDGE_AUDIT.md](./security/SPIKE_EDGE_AUDIT.md) | Edge security audit details |

---

## Business And GTM

| Document | What it covers |
| --- | --- |
| [business/BUSINESS_PLAN.md](./business/BUSINESS_PLAN.md) | Commercial model with the app store as a core monetization layer |
| [business/PITCH_DECK_OUTLINE.md](./business/PITCH_DECK_OUTLINE.md) | Platform flywheel and app-store investor narrative |
| [business/ROADMAP.md](./business/ROADMAP.md) | App store, SDK, and marketplace milestones |
| [business/PLG_STRATEGY.md](./business/PLG_STRATEGY.md) | Product-led growth through app-store distribution |

---

## Directory Guide

```text
docs/
├── README.md
├── PLATFORM_AND_VISION.md
├── features/
│   ├── FEATURES.md
│   ├── APP_STORE_OVERVIEW.md
│   ├── SHARED_TOOL_LIBRARY.md
│   └── AB_TESTING_BUG_DETECTION.md
├── mcp/
│   ├── CROSS_ORIGIN_INTEGRATION.md
│   ├── DEVELOPMENT_INDEX.md
│   ├── SERVER_DEVELOPMENT.md
│   └── TOOL_GUIDELINES.md
├── api/
│   ├── CROSS_ORIGIN_API_GUIDE.md
│   ├── API_REFERENCE.md
│   └── 00_START_HERE.md
├── develop/
│   ├── ONBOARDING.md
│   ├── DEPLOY_APP_CLOUDFLARE.md
│   ├── OFFLINE_BUNDLE_GUIDE.md
│   └── EDGE_STACK.md
├── security/
│   ├── APP_STORE_SECURITY.md
│   └── SECURITY_INDEX.md
├── business/
│   ├── BUSINESS_PLAN.md
│   ├── PITCH_DECK_OUTLINE.md
│   ├── ROADMAP.md
│   └── PLG_STRATEGY.md
└── best-practices/
    ├── app-store-performance.md
    └── offline-first.md
```

---

## Source-Of-Truth Notes

- Source code lives under `src/**`.
- Deployable and publishable shims live under `packages/*`.
- The app store runtime is primarily implemented in:
  - `src/edge-api/spike-land`
  - `src/edge-api/main`
  - `src/frontend/platform-frontend`
  - `src/core/block-sdk`

If you are editing behavior, prefer those source directories. If you are
editing Worker deployment settings, follow the matching `packages/*` shim.
