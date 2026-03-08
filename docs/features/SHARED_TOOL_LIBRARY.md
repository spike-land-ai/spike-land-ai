# Shared Tool Library

## Why A Shared Library Exists

The spike.land app store works because apps do not start from zero. They are
built on top of a shared library of tools, categories, and runtime helpers.

This document describes that library as three layers:

1. the core MCP tool layer
2. the category and discovery layer
3. the developer SDK layer

Together, those layers are what let one app run as a hosted edge service, an
embedded integration, or an offline-first browser bundle.

---

## Layer 1: Core MCP Tools

This is the execution layer.

It includes:

- 80+ native tools in the main registry
- public tool metadata through `mcp.spike.land/tools`
- authenticated tool calls through `mcp.spike.land/mcp`
- structured errors, analytics, rate limiting, and auth

Examples of tool families in the shared runtime:

- app creation and codespaces
- filesystems and storage
- store search/install/rating flows
- skills and registry discovery
- orchestration, sandbox, and build utilities
- observability and reporting

The app store depends on this layer because every app is ultimately a way of
grouping and exposing tools.

---

## Layer 2: Category And Discovery

The second layer makes the tool library usable at scale.

It includes:

- `CATEGORY_DESCRIPTIONS`
- registry category indexing
- gateway tools such as `search_tools` and `enable_category`
- store search and browse tools
- app recommendations and personalization

This layer solves the real problem with large MCP surfaces: discoverability.

Without it, the app store would become an unstructured list of tools. With it,
the platform can:

- progressively disclose relevant capability
- group apps and tools into understandable slices
- rank and recommend based on usage signals
- evolve categories without changing transport or auth

This is why the platform describes categories as dynamic and AI-curated. The
catalog can keep reorganizing itself while the core tools remain stable.

---

## Layer 3: Developer SDK

The third layer is what developers build on.

### Storage Abstraction

`block-sdk` provides a `StorageAdapter` contract with multiple targets:

- D1 for Cloudflare Workers
- IndexedDB for browser/offline mode
- memory for tests
- SQLite for local Node flows

That is the backbone of portable app logic.

### Bundling And Compilation

The repo includes esbuild-wasm packaging and an edge transpile worker, which
gives developers two ways to compile app code:

- remotely at the edge
- locally in browser-compatible environments

### Distribution And Runtime Access

The SDK surface also includes:

- `spike-cli`
- public MCP metadata endpoints
- deploy shims in `packages/*`
- block packages such as `block-tasks`

These pieces make the store more than a catalog. They make it a developer
workflow.

---

## Composition Model

An app on spike.land usually composes shared pieces instead of reinventing
them.

Typical composition looks like:

1. use shared storage primitives
2. reuse category-level tool families
3. expose a smaller app-specific surface
4. add metadata, markdown, and install flow
5. publish to the store

The store therefore benefits from every new core tool. A stronger shared
library means faster app creation and more consistent behavior across the
catalog.

---

## Why This Matters For The App Store

Because the library is shared:

- new apps ship faster
- categories stay coherent
- auth and error behavior stay predictable
- cross-origin integrations do not need app-specific adapters
- offline-first variants can reuse the same logic

That creates compounding leverage:

`shared tools -> faster publishing -> larger catalog -> more installs -> better discovery -> more developers`

---

## Build Once, Run In Multiple Shapes

The same app logic can be packaged into multiple delivery models:

- hosted app on Cloudflare Workers
- embedded tool surface in another product
- local browser bundle using IndexedDB

This is possible because the shared library separates app logic from storage and
transport details.

That portability is a core part of spike.land’s positioning. The platform is an
open app store, not a closed app host.
