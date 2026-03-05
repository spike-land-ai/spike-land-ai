# Tech Debt Registry

> Last updated: 2026-03-05 Last audit: 2026-03-05 (Sprint 5 Cleanup)

## Overview

This document tracks known technical debt across the spike.land monorepo. Items
are prioritized P0 (critical) through P3 (minor/nice-to-have).

## Active Items

### P0 - Critical

#### TD-P0-3: Sentry integration (REMOVED)

- **Status**: Resolved — Sentry fully removed (Feb 2026). Error querying now
  uses D1-backed `query_errors` and `error_summary` MCP tools.

### P1 - High Priority

#### TD-P1-1: Duplicate ErrorBoundary implementations

- **Status**: Resolved (packages extracted)
- **Impact**: Code duplication, potential behavioral differences
- **Details**: ErrorBoundary previously existed in both
  `src/components/errors/error-boundary.tsx` and
  `src/code/@/components/app/error-boundary.tsx`.
- **Resolution**: `src/code` extracted to external `@spike-land-ai/code` repo.
  Only `src/components/errors/error-boundary.tsx` remains in this repo.

#### TD-P1-2: Duplicate route handling logic in testing.spike.land

- **Status**: Moved to external repo
- **Impact**: Hard to trace request flow, risk of route conflicts
- **Details**: Request routing scattered across `chat.ts`,
  `mainFetchHandler.ts`, `fetchHandler.ts`, and `routeHandler.ts`.
- **Action**: Track in `@spike-land-ai/testing.spike.land` repo.

#### TD-P1-3: Inconsistent error handling patterns in testing.spike.land

- **Status**: Moved to external repo
- **Details**: Mixed error handling approaches in worker handlers.
- **Action**: Track in `@spike-land-ai/testing.spike.land` repo.

#### TD-P1-4: Unused dependencies (66 total per knip analysis)

- **Status**: Mostly resolved (14 packages extracted to external repos)
- **Impact**: Bloated node_modules, slower installs, unnecessary security
  surface
- **Details**: Previously `src/code` had 38 unused, `src/testing.spike.land` had
  8, `src/js.spike.land` had 1. All 14 packages now extracted to
  `@spike-land-ai` npm org.
- **Action**: Continue cleaning root-level unused dependencies.

#### TD-P1-5: Unused files (253 total per knip analysis)

- **Status**: Mostly resolved (~420 files removed + 14 packages extracted)
- **Impact**: Code maintenance burden, confusing codebase navigation
- **Details**: ~420 dead code files removed in Feb 2026 cleanup. 14 packages
  extracted to external repos. Only `src/store-apps` remains.
- **Action**: Continue reviewing remaining unused files in `src/`.

#### TD-P1-6: block-sdk schema DSL limitations

- **Status**: Resolved (2026-03-04)
- **Impact**: Developers must use Drizzle for anything beyond simple CRUD tables
- **Details**: `defineTable()` supports only 5 column types with `primaryKey()` and `optional()` modifiers. Missing: foreign keys, indexes, composite primary keys, column defaults, check constraints.
- **Resolution**: Extended schema DSL with `.default()`, `.references()`, `.index()` methods. `schemaToSQL()` generates DEFAULT clauses, inline REFERENCES, and CREATE INDEX statements. Composite PKs and check constraints still require Drizzle.

#### TD-P1-7: block-sdk IDB adapter — regex SQL parser

- **Status**: Resolved (2026-03-04)
- **Impact**: Browser-side blocks limited to basic CRUD patterns
- **Details**: The IDB adapter previously used regex matching instead of a real SQL parser.
- **Resolution**: Replaced regex parser with sql.js WASM (lazy-loaded on first SQL call). IDB remains durable persistence; sql.js provides full SQL (ORDER BY, LIMIT, JOIN, GROUP BY, OR, subqueries). See `src/block-sdk/adapters/idb.ts` and `sql-js-loader.ts`.

#### TD-P1-8: block-sdk has no SQLite adapter for Node.js

- **Status**: Resolved (2026-03-04)
- **Impact**: Node.js testing doesn't exercise real SQL semantics
- **Details**: The memory adapter uses an in-memory Map with a regex parser.
- **Resolution**: Created `sqliteAdapter()` using better-sqlite3 with WAL mode and FK enforcement. Available at `@spike-land-ai/block-sdk/adapters/sqlite`. Supports in-memory (`:memory:`) and file-backed databases.

### P2 - Medium Priority

#### TD-P2-1: Deprecated analyzeImage in gemini-client.ts

- **Status**: Resolved (2026-03-05)
- **Impact**: Using deprecated function pattern
- **Details**: `analyzeImage` deprecated in favor of `analyzeImageV2` in the
  legacy spike.land codebase (now deleted).
- **Resolution**: Legacy spike.land fully deleted (2026-03-04). Current image
  analysis in mcp-image-studio uses modern `@google/genai` SDK with
  `describeImage()` and `extractPalette()`. No `analyzeImage` references remain.

#### TD-P2-2: @ai-sdk/anthropic not in root package.json

- **Status**: Resolved (packages extracted)
- **Details**: `@ai-sdk/anthropic` was used in `src/testing.spike.land` and
  `src/code`, both now extracted to external repos.

#### TD-P2-3: Wrangler compatibility dates need update

- **Status**: Moved to external repos
- **Details**: Worker packages now in `@spike-land-ai` org repos.
- **Action**: Track in respective external repos.

#### TD-P2-4: Hardcoded URLs and origins in testing.spike.land

- **Status**: Moved to external repo
- **Action**: Track in `@spike-land-ai/testing.spike.land` repo.

#### TD-P2-5: Session storage migration code in chatRoom.ts

- **Status**: Moved to external repo
- **Action**: Track in `@spike-land-ai/testing.spike.land` repo.

#### TD-P2-6: R2 storage keys not namespaced

- **Status**: Moved to external repo
- **Action**: Track in `@spike-land-ai/testing.spike.land` repo.

#### TD-P2-7: Commented-out auto-save system in chatRoom.ts

- **Status**: Moved to external repo
- **Action**: Track in `@spike-land-ai/testing.spike.land` repo.

#### TD-P2-8: esbuild resolution pins may be obsolete

- **Status**: Resolved (2026-03-05)
- **Impact**: May prevent esbuild upgrades
- **Details**: Root `package.json` previously had a resolution pinning
  `esbuild@0.23.1` to `0.25.0` (TECH_DEBT.md incorrectly referenced 0.14.47).
- **Resolution**: Resolution was removed when `@tanstack/router-generator`
  dependency was dropped. Current esbuild is `^0.27.3` with no pinning issues.

### P3 - Low Priority / Nice-to-Have

#### TD-P3-3: Inconsistent async patterns

- **Status**: Moved to external repo
- **Details**: Some handlers in `liveRoutes.ts` (testing.spike.land) are marked
  `async` but contain no `await` expressions.
- **Action**: Track in `@spike-land-ai/testing.spike.land` repo.

#### TD-P3-5: TypeScript config issues in testing.spike.land

- **Status**: Moved to external repo
- **Action**: Track in `@spike-land-ai/testing.spike.land` repo.

## Resolved Items (Sprint 5 - 2026-03-05)

| Item                                       | Resolution                                                       | Date       |
| ------------------------------------------ | ---------------------------------------------------------------- | ---------- |
| Test coverage gaps (TD-P0-2)               | Fixed coverage for mcp-auth (98%), gates/engine (100%), schema-optimizer (96%) | 2026-03-05 |
| Scripts cleanup (TD-P3-1)                  | Deleted 6 unused prompt versions, archived stripe-setup.ts       | 2026-03-05 |
| Magic animation timings (TD-P3-2)          | Extracted UI_ANIMATIONS constants and updated 5+ files           | 2026-03-05 |
| ScrollContainer component (TD-P3-4)        | Created reusable ScrollContainer and updated 4+ files            | 2026-03-05 |
| Logpush with no destination (9 workers)    | Removed `logpush = true` from all 9 wrangler.toml files         | 2026-03-05 |
| analyzeImage deprecation (TD-P2-1)         | Confirmed fully removed with legacy spike.land deletion          | 2026-03-05 |
| esbuild resolution pins (TD-P2-8)          | Confirmed removed; current esbuild ^0.27.3 with no conflicts    | 2026-03-05 |
| Build artifacts in src/mcp-server-base/    | Added .gitignore for tsc output artifacts                        | 2026-03-05 |
| stripe-analytics-mcp export bug            | Fixed .js → .ts export in packages/stripe-analytics-mcp/index.ts | 2026-03-05 |

## Resolved Items (Sprint 4 - 2026-02-26)

| Item                                       | Resolution                                                       | Date       |
| ------------------------------------------ | ---------------------------------------------------------------- | ---------- |
| Dead code removal (~420 files)             | Removed unused files across codebase                             | 2026-02-26 |
| Logger refactoring (~300 files)            | Standardized logging across ~300 files                           | 2026-02-26 |
| Missing CATEGORY_DESCRIPTIONS (51 entries) | Added 51 CATEGORY_DESCRIPTIONS in tool-registry.ts               | 2026-02-26 |
| CSS XSS vulnerability (CSS injection)      | Added CSS sanitization to prevent CSS injection attacks          | 2026-02-26 |
| Missing error boundaries                   | Added 16 error.tsx and 23 loading.tsx files across app routes    | 2026-02-26 |
| Unused file reduction (TD-P1-5)            | ~420 dead files removed, significantly reducing codebase clutter | 2026-02-26 |

## Resolved Items (Sprint 3 - 2026-02-14)

| Item                                                           | Resolution                                  | Date       |
| -------------------------------------------------------------- | ------------------------------------------- | ---------- |
| Empty/stub files (12 files)                                    | Deleted in Sprint 3 cleanup                 | 2026-02-14 |
| Stub MCP tools (canvas, tabletop)                              | Deleted -- no backing models exist          | 2026-02-14 |
| Unused test fixtures (marketing-mocks, sse-mock)               | Deleted -- no imports found                 | 2026-02-14 |
| Unused packages (react-app-examples, opfs-node-adapter, video) | Deleted -- never imported                   | 2026-02-14 |
| Duplicate rollup.config.js                                     | Deleted -- kept .mjs version                | 2026-02-14 |
| Duplicate Prisma migration (20260211133638)                    | Older duplicate removed, DB records cleaned | 2026-02-14 |
| Unorganized docs/ (73 files)                                   | Reorganized into subdirectories             | 2026-02-14 |
| Stale docs (Stripe, Tabletop, Vibeathon, Sprint 2)             | Archived to docs/archive/                   | 2026-02-14 |
| .eslintcache in repo                                           | Already in .gitignore -- no action needed   | 2026-02-14 |

## Architecture Notes

### Durable Object State Management

> **Note**: The Cloudflare Worker (testing.spike.land) is now in the external
> `@spike-land-ai/testing.spike.land` repository. These notes are kept for
> reference since spike-edge integrates with it.

The `Code` class in `chatRoom.ts` manages session state with this structure:

```
Storage Keys:
  session_core      -> Metadata (codeSpace, etc.)
  session_code      -> Source code (TSX)
  session_transpiled -> Transpiled JS
  version_count     -> Number of saved versions
  version_{N}       -> Individual version snapshots
  (R2) r2_html_{codeSpace} -> Rendered HTML
  (R2) r2_css_{codeSpace}  -> CSS styles
```

## Sprint History

| Sprint   | Date                | Focus                                                                | Status                              |
| -------- | ------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| Sprint 1 | 2026-01-17          | Initial stabilization                                                | Completed                           |
| Sprint 2 | 2026-01-27 (target) | Continuation                                                         | Abandoned -- superseded by Sprint 3 |
| Sprint 3 | 2026-02-14          | Comprehensive inventory and cleanup                                  | Completed                           |
| Sprint 4 | 2026-02-26          | Dead code removal, logger refactoring, error boundaries, CSS XSS fix | Completed                           |
| Sprint 5 | 2026-03-05          | Logpush cleanup, tech debt audit, build artifact fixes, export bugs  | Completed                           |

## Contributing

When adding new tech debt items:

1. Assign a priority (P0-P3) and a unique ID (e.g., TD-P1-6)
2. Include specific file locations
3. Describe the impact
4. Suggest a fix if known
5. Create a GitHub issue and link it here

Priority definitions:

- **P0 (Critical)**: Blocks development or causes production issues
- **P1 (High)**: Significant code quality or maintainability impact
- **P2 (Medium)**: Should be addressed but not urgent
- **P3 (Low)**: Nice-to-have improvements
