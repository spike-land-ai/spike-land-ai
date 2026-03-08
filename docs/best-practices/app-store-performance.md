# App Store Performance

## Scope

These are the performance targets and cache policies that matter for the
spike.land app store. Treat them as internal operating targets, not contractual
SLAs.

The goal is to keep three surfaces fast:

1. public metadata
2. interactive MCP calls
3. offline-capable app bundles

---

## Current Cache Policy From Source

| Surface | Cache policy |
| --- | --- |
| `mcp.spike.land/tools` | `public, max-age=3600, stale-while-revalidate=86400` |
| `mcp.spike.land/apps` | `public, max-age=3600, stale-while-revalidate=86400` |
| `spike.land/api/store/tools` | `public, max-age=300, stale-while-revalidate=3600` |
| OAuth well-known docs | `public, max-age=86400` |
| `GET /api/experiments/active` | `public, max-age=300, stale-while-revalidate=600` |

Implication:

- app and tool catalog reads should mostly be cache hits
- live MCP execution is not a cacheable surface

---

## Performance Tiers

### Tier 1: Catalog And Discovery

Examples:

- app listings
- tool listings
- app detail metadata

Targets:

- cache hit ratio as high as possible
- p95 edge response target: under 150 ms for cached metadata
- app/tool metadata payloads should stay small enough for fast first render

### Tier 2: Interactive Tool Calls

Examples:

- installs
- ratings
- recommendations
- authenticated MCP tool execution

Targets:

- p95 non-AI tool call target: under 1000 ms
- p95 simple store action target: under 500 ms
- 429 responses must include useful retry behavior

### Tier 3: Build And Variant Workflows

Examples:

- app deployment variants
- transpilation
- experiment evaluation

Targets:

- feedback for small build/test actions within a few seconds
- experiment evaluation should run on materialized metrics, not raw event scans
- worker cold starts should stay low enough that orchestration does not feel
  like queueing infrastructure

### Tier 4: Offline Bundles

Examples:

- IndexedDB-backed browser apps
- installable PWAs

Targets:

- repeat startup should not require network
- local reads/writes should feel instant
- bundled wasm assets must be local or precached

---

## Practical Rules

1. Cache metadata aggressively.
2. Keep tool execution uncached and observable.
3. Split public discovery from authenticated runtime.
4. Prefer materialized metrics for experimentation dashboards.
5. For offline bundles, remove all startup CDN dependencies.

---

## App-Store-Specific Budgets

| Area | Budget |
| --- | --- |
| Search results render | under 1 second perceived time on normal broadband |
| App detail metadata fetch | under 500 ms from edge cache |
| Install action acknowledgment | under 500 ms before UI feedback |
| Public catalog refresh | cacheable, no origin-style bottleneck |
| Offline relaunch | no network dependency after install/precache |

---

## Monitoring Priorities

Watch these first:

- catalog cache hit rate
- `mcp` 429 volume
- tool-call p95 latency
- experiment anomaly count
- offline bundle startup failures caused by remote wasm/assets

These are the metrics that most directly affect whether the app store feels
fast, trustworthy, and portable.
