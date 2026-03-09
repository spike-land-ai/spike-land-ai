# Edge API Testing

How `spike-edge` should be tested going forward.

This document exists because the repo historically accumulated two different
test styles for the same edge routes:

- fast source-local route and business-logic tests under `src/edge-api/main/api/__tests__`
- slower Worker-style suites under `.tests/spike-edge/__tests__`

The Worker suites are useful for smoke coverage, but they are too expensive as
the default place for route correctness. The goal is to keep most correctness
checks in source-local tests and reserve Worker harnesses for a small number of
real integration seams.

## Target split

### 1. Business logic tests

Use pure unit tests for:

- request validation
- payload normalization
- bucketing / scoring / routing math
- cache-key resolution
- anomaly detection
- analytics event shaping
- revenue / metric aggregation

These tests should live next to the route layer in source:

- `src/edge-api/main/api/routes/*-logic.ts`
- `src/edge-api/main/api/__tests__/*.test.ts`

Examples already migrated:

- `spa-route-logic.ts`
- `health-route-logic.ts`
- `blog-audience.ts`
- `experiments-route-logic.ts`

### 2. Source-local route tests

Use Hono request tests with mocked D1/R2/fetch when you need to verify:

- status codes
- route wiring
- response payload shape
- headers
- fallback behavior across cache and database paths

These still run quickly and stay close to the code they exercise.

Examples:

- `src/edge-api/main/api/__tests__/__tests__/blog.test.ts`
- `src/edge-api/main/api/__tests__/__tests__/experiments.test.ts`

### 3. Worker smoke tests

Keep Worker-style tests only for the seams that unit tests cannot replace:

- full app boot / route table smoke tests
- Cloudflare-specific request context behavior
- service-binding integration seams
- auth middleware interaction that depends on the Worker runtime

These should be few, stable, and intentionally broad.

## What was migrated

The following route logic was already extracted out of slow Worker-style tests:

- SPA fallback and cache-header logic
- health payload/status derivation
- blog audience and GA4 targeting classification
- experiment tracking, anomaly detection, and evaluation gating

The following duplicate Worker suites were removed because equivalent
source-local coverage now exists:

- `.tests/spike-edge/__tests__/blog.test.ts`
- `.tests/spike-edge/__tests__/experiments.test.ts`

## Current rule of thumb

Before writing a new `spike-edge` test, ask:

1. Is this mostly computation or validation?
2. Does it need Cloudflare runtime objects to be meaningful?
3. Would a failing assertion point to route wiring or to business logic?

If the answer is "mostly computation or validation", write a pure source-local
test first and keep the route shell thin.

## Migration checklist

When moving a slow Worker test to source-local coverage:

1. Extract the branching logic into `*-logic.ts`
2. Keep the route file responsible only for HTTP concerns and bindings
3. Add focused unit tests for the extracted logic
4. Keep or add a small route-level test for status code and payload shape
5. Delete the duplicate Worker suite only after the source-local tests pass

## Commands

Safe Bazdmeg entrypoints for this migration:

```bash
yarn bazdmeg:status
yarn bazdmeg:dry-run
```

Use those before a real `yarn bazdmeg` run.

Run source-local edge tests:

```bash
npx vitest run --config .tests/vitest.config.ts src/edge-api/main/api/__tests__
```

Run the remaining Worker smoke suites:

```bash
npx vitest run --config .tests/vitest.config.ts .tests/spike-edge/__tests__
```

Typecheck the edge package:

```bash
npx tsc --noEmit --project packages/spike-edge/tsconfig.json
```

## What is not finished

This migration is not complete.

Remaining `.tests/spike-edge/__tests__` coverage still includes broad Worker
integration suites such as:

- `index-full.test.ts`
- `index-app.test.ts`
- `coverage-gaps.test.ts`
- overlapping route-level smoke files

Those should be trimmed or migrated case-by-case. The end state is not "zero
Worker tests". The end state is "only high-value Worker tests remain".
