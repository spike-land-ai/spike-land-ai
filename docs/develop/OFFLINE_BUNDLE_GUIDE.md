# Offline Bundle Guide

## Goal

Build an MCP-style app that runs fully in the browser with no live backend,
using local persistence and bundled WASM assets.

spike.land already contains most of the primitives:

- `block-sdk` storage abstraction
- IndexedDB adapter
- sql.js-backed browser SQL layer
- esbuild-wasm packaging
- PWA manifest examples in frontend packages

What you still need is the packaging glue for a truly offline build.

---

## Current Repo Primitives

### Storage

Use the browser adapter exposed through:

- `@spike-land-ai/block-sdk/adapters/idb`
- source implementation in `src/core/block-sdk/db/idb.ts`

This gives you:

- IndexedDB-backed KV
- browser blob storage
- SQL semantics via sql.js

### Browser-Only App Example

`packages/block-tasks/browser.ts` shows the intended usage:

- create an IDB adapter
- run block initialization
- expose client/hooks against local storage

That is the cleanest existing reference for a local-first app path.

### Build Tooling

For compilation you have:

- `esbuild-wasm` package assets in `packages/esbuild-wasm`
- Worker-side transpile support in `src/edge-api/transpile`

For a true offline bundle, you should ship the WASM file locally with the app
instead of fetching it from a remote origin.

---

## Important Gap To Close

The current `sql-js` loader in `src/core/block-sdk/db/sql-js-loader.ts` resolves
WASM from `https://sql.js.org/dist/`.

That is fine for online usage but not for a fully offline bundle.

To make an app genuinely offline:

1. vendor the SQL.js WASM asset into your app bundle
2. replace the remote `locateFile()` path with a local asset URL
3. precache that asset in your service worker

Do the same for any esbuild-wasm asset you need at runtime.

---

## Recommended Architecture

### 1. Keep App Logic Transport-Neutral

Write app logic against `StorageAdapter`, not direct D1 or fetch calls.

Good:

- shared block logic
- tool-like functions that operate on local state

Avoid:

- hard-coding server-only APIs into the core app layer

### 2. Persist State In IndexedDB

Use the IDB adapter as the durable source of truth.

This keeps:

- user data local
- repeat visits fast
- the app usable without connectivity

### 3. Bundle WASM Locally

Ship local assets for:

- SQL.js
- esbuild-wasm if the app compiles code client-side

Do not depend on third-party CDNs if “offline” is a real requirement.

### 4. Add A Service Worker

The repo documents service-worker strategy in best-practices docs, but it does
not ship a generic offline app-store worker implementation.

Your app should precache:

- HTML shell
- JS/CSS bundles
- wasm assets
- manifest icons

### 5. Add A PWA Manifest

Reference existing manifests such as:

- `src/frontend/platform-frontend/public/manifest.webmanifest`
- `src/frontend/monaco-editor/assets/manifest.webmanifest`

This gives you installability and a cleaner offline UX on mobile and desktop.

---

## Suggested Build Flow

1. Build app logic against `block-sdk`.
2. Initialize storage with the IDB adapter.
3. Vendor SQL.js and esbuild WASM locally.
4. Bundle the frontend with Vite or your browser build of choice.
5. Precache assets in a service worker.
6. Test with network disabled.

If the app still reaches for a remote URL during startup, it is not offline yet.

---

## Minimal Example Shape

```ts
import { idbAdapter } from "@spike-land-ai/block-sdk/adapters/idb";

const storage = idbAdapter({
  dbName: "my-offline-app",
  version: 1,
  tables: ["items", "sessions"],
});
```

From there:

- initialize your block/app
- expose local actions as UI commands
- optionally mirror them to MCP-style contracts for portability

---

## Sync Strategy

If you want an app that works offline first and syncs later:

- treat local IndexedDB as the write target
- queue sync jobs separately
- make remote sync optional, not required for the core UX

That keeps the offline experience honest.

See [../best-practices/offline-first.md](../best-practices/offline-first.md)
for design rules.

---

## What “Offline” Should Mean Here

A good offline bundle should:

- open with no network
- read and write local state
- load all required wasm/assets from cache or local bundle
- degrade gracefully when remote sync is unavailable

If your app only works after the first network bootstrap, call it “local-first”
instead of “fully offline.”
