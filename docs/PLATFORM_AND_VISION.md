# spike.land — Platform & Vision

> Open AI app store. MCP-first runtime. Edge-native delivery. Built so anyone
> can vibe code, publish, and run apps from anywhere.

---

## Platform In One Page

spike.land is an open app store for MCP-native software. Every app is a bundle
of composable MCP tools, a discovery record, and an execution surface that can
run in the browser, on Cloudflare Workers, or inside an existing agent
workflow.

The core bet is simple:

1. MCP is the product surface, not a sidecar API.
2. App discovery should be open, searchable, and callable from any origin.
3. The same app should be able to run online at the edge or offline in the
   browser with local persistence.

That gives spike.land a very different shape from a normal SaaS marketplace.
The store is not just a gallery of links. It is the public interface to a
shared tool runtime.

---

## The App Store Thesis

The app store turns MCP tools into publishable products.

- Developers can package workflows as apps instead of shipping one-off prompts
  or private scripts.
- Users can discover apps through search, category browsing, ratings,
  wishlists, installs, and personalized recommendations.
- Agents can inspect the same surface programmatically through the MCP gateway,
  public tool metadata, and app catalog endpoints.

In practice, spike.land already exposes the pieces that make this real:

- Public tool metadata at `mcp.spike.land/tools`
- Public app metadata at `mcp.spike.land/apps`
- Authenticated MCP calls at `mcp.spike.land/mcp`
- Store categories for search, installs, skills, ratings, and A/B workflows in
  `src/edge-api/spike-land/core-logic/tools/store/`

The store UI is one client. `spike-cli`, external Workers, custom browser apps,
and existing products can all consume the same platform.

---

## Three Shared Layers

### 1. Core Tool Runtime

The foundation is a shared MCP tool library: 80+ native tools in the main
registry, plus broader ecosystem access through the multiplexer model and
registry integrations.

This layer is responsible for:

- Typed tool contracts
- Auth, rate limiting, and analytics
- Public metadata discovery
- Structured error handling
- Category-aware progressive disclosure

### 2. Taxonomy And Discovery

spike.land does not treat categories as static marketing buckets.

Discovery blends:

- category metadata from `CATEGORY_DESCRIPTIONS`
- search and browse tools in the store surface
- tag overlap recommendations
- install-history personalization
- persona-based recommended app slugs

The result is an app store where categories can evolve with usage instead of
locking the platform into a fixed menu forever.

### 3. Developer SDK Surface

Apps sit on top of a shared developer layer:

- `block-sdk` for packaging schema, logic, UI, and MCP tools together
- `StorageAdapter` targets for D1, IndexedDB, SQLite, and memory
- esbuild-wasm and the transpile worker for browser and edge compilation
- deploy shims in `packages/*` that map publishable/deployable packages back to
  `src/**`

This is what makes “build once, run in multiple environments” practical.

---

## Open By Default

The platform is intentionally open to external integration.

- `src/edge-api/spike-land/api/app.ts` applies `origin: "*"` CORS on the MCP
  worker.
- Public metadata endpoints are readable without authentication.
- Authenticated tool calls accept bearer tokens from API keys (`sk_*`) or OAuth
  device-flow tokens (`mcp_*`).
- OAuth discovery is published through `.well-known` metadata.

Important distinction:

- `mcp.spike.land` is the cross-origin MCP surface.
- `auth-mcp.spike.land` remains origin-allowlisted for auth/session flows.
- `spike.land` proxies part of the MCP surface for first-party UX, but browser
  integrations that need wildcard CORS should call `mcp.spike.land` directly.

This is what “MCP APIs available from any origin” means in practice: you can
embed the tool runtime into an existing app, Cloudflare Worker, or browser
client without having to co-host on spike.land.

---

## Offline-First Is A First-Class Path

spike.land is designed so an app does not have to stay online forever.

The core pieces already exist in the repo:

- `block-sdk` supports IndexedDB-backed storage with SQL semantics in the
  browser.
- the same `StorageAdapter` contract can point at D1 in Workers or memory in
  tests.
- `@spike-land-ai/block-tasks` includes a browser entry that runs entirely on
  IndexedDB.
- esbuild-wasm packaging exists both as a standalone package and as an edge
  transpile worker.

That means a published MCP app can follow three deployment shapes:

1. managed edge app on Cloudflare Workers
2. embedded tool/app in an existing product
3. offline browser bundle with local persistence

The store is therefore not just a hosted marketplace. It is also a distribution
channel for portable app runtimes.

---

## Quality As A Platform Primitive

The platform uses experimentation and observability as part of the product, not
only as internal operations.

Two systems matter here:

- Store deployment tooling for app variants, visitor assignment, impressions,
  error tracking, and winner declaration
- The generic experiments engine in `src/edge-api/main/api/routes/experiments.ts`
  that enforces minimum runtime, sample size, Bayesian evaluation, and anomaly
  monitoring

The AI part is the authoring and diagnosis loop: generate variants, instrument
them, compare outcomes, and feed failures back into iteration. The shipping
decision logic stays deterministic and auditable.

This is how spike.land can market “AI-powered A/B bug detection” without hiding
behind vague claims. AI proposes and explains. The production engine measures
and decides.

---

## Trust Model

The app store is open, but it is not a free-for-all.

- Anonymous access is limited to an explicit allowlist of discovery tools.
- Shared registry tools are statically registered through the manifest.
- Public app records only appear once their status is promoted out of draft.
- Marketplace-style tool records already use draft/published states.
- Worker sandboxes are simulated in the shared edge runtime; they do not spawn
  arbitrary processes.

Operationally, the intended submission path is:

`submit -> automated checks -> review -> publish -> install`

Code and policy work together here. The code enforces scope, auth, categories,
and publication state. The review workflow decides what is safe to promote.

---

## Vision

The long-term vision is an app store where anyone can vibe code and publish
useful software without rebuilding infrastructure from scratch.

That requires five properties:

1. Every app must be expressible as composable MCP tools.
2. The catalog must stay open to external callers, not trapped in one UI.
3. Categories must evolve with usage and recommendation data.
4. Deployment must span edge-hosted and offline-local modes.
5. Quality signals must be built into the runtime, not bolted on later.

spike.land is being built around those properties now. The result is not just a
marketplace for AI apps. It is an operating system for publishing MCP-native
software.
