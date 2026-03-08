# Offline-First Patterns For MCP Apps

## Core Rule

Treat the network as an optional sync layer, not the core runtime.

If an app is supposed to work offline, its main user flow must succeed against
local state first.

---

## Patterns

### Use A Storage Abstraction

Write app logic against `StorageAdapter`-style interfaces so the same app can
run on:

- D1 at the edge
- IndexedDB in the browser
- memory in tests

This is the most important pattern in the repo’s current architecture.

### Keep Local State Authoritative

For offline mode:

- write locally first
- sync later if connectivity returns
- never block core UX on a round-trip

### Vendor Runtime Assets

If your app depends on WASM:

- ship the asset locally
- precache it
- avoid remote CDN fetches during startup

Otherwise the app is not truly offline.

### Separate Sync From Interaction

Do not bury remote sync inside UI actions.

Better pattern:

1. user action updates local state
2. UI reflects success immediately
3. sync queue attempts remote replication later

### Design For Reconciliation

Eventually, local and remote state diverge.

Have a strategy for:

- conflict detection
- last-write-wins or merge rules
- failed sync retries
- user-visible “pending sync” status

---

## Good Candidates For Offline-First

- personal productivity tools
- note-taking and draft flows
- educational sandboxes
- code playgrounds with local compilation
- store demos and installable app previews

---

## Anti-Patterns

- depending on remote auth/session refresh for every action
- hard-coding D1 queries into app logic
- downloading SQL.js or esbuild WASM from a CDN at startup
- claiming “offline support” when only the shell loads offline

---

## Related Docs

- [../develop/OFFLINE_BUNDLE_GUIDE.md](../develop/OFFLINE_BUNDLE_GUIDE.md)
- [app-store-performance.md](./app-store-performance.md)
