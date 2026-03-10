# Tech Debt Registry

> Last updated: 2026-03-10 Last audit: 2026-03-10 (Sprint 6 DX Audit)

## Overview

This document tracks known technical debt across the spike.land monorepo. Items
are prioritized P0 (critical) through P3 (minor/nice-to-have).

## Active Items

### P1 - High Priority

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

## Sprint 6 Items (2026-03-10 DX Audit)

> 19 findings from 16-engineer DX audit. Full details: [BUGBOOK_SPRINT6.md](BUGBOOK_SPRINT6.md)

### P1 - High Priority

#### TD-P1-9: No log persistence (logpush removed, no replacement)

- **Status**: Open
- **Impact**: Production console logs lost after real-time tail window closes
- **Details**: `logpush = true` removed from 9 wrangler.toml in Sprint 5, but no replacement destination configured (Logpush job, tail worker, or external sink)
- **Action**: Configure a Logpush destination or deploy a tail worker that persists logs to R2/D1

#### TD-P1-10: 6 spike-chat stub endpoints

- **Status**: Open
- **Impact**: API surface advertises non-functional features
- **Details**: `read-cursors`, `bookmarks`, `threads`, `pins`, `presence`, `reactions` all return hardcoded empty responses
- **Action**: Implement or remove stub endpoints

#### TD-P1-11: spike-chat D1 database not created

- **Status**: Open
- **Impact**: spike-chat worker cannot store any data, DB operations will fail
- **Details**: `packages/spike-chat/wrangler.toml` has `database_id = "TO_BE_CREATED"`
- **Action**: Run `wrangler d1 create spike-chat` and update wrangler.toml

### P2 - Medium Priority

#### TD-P2-9: Analytics Engine bound but unused

- **Status**: Open
- **Impact**: Wasted binding, no analytics data being collected
- **Details**: `spike_analytics` dataset bound in spike-edge wrangler.toml (line 64), zero code writes to it
- **Action**: Write analytics events or remove the binding

#### TD-P2-10: Rollback script is manual stub

- **Status**: Open
- **Impact**: Slow incident response, manual rollback steps
- **Details**: `.github/scripts/rollback-workers.sh` has manual instructions only
- **Action**: Automate rollback with `wrangler rollback` or version pinning

#### TD-P2-11: Expired NPM_TOKEN for npmjs.org

- **Status**: Open (workaround: `continue-on-error: true`)
- **Impact**: Packages not published to public npm registry
- **Details**: NPM_TOKEN expired, CI silently ignores publish failures
- **Action**: Regenerate token at npmjs.com and update GitHub secret

#### TD-P2-12: Temporary Cloudflare API token

- **Status**: Open (workaround: OAuth token with ~1.5hr expiry)
- **Impact**: CI deployments fail when token expires
- **Details**: Using `wrangler login` OAuth token instead of permanent API token
- **Action**: Create permanent API token at dash.cloudflare.com/profile/api-tokens

#### TD-P2-13: No distributed tracing

- **Status**: Open
- **Impact**: Cross-service debugging requires manual log correlation
- **Details**: No OpenTelemetry or request-id correlation across workers
- **Action**: Add request-id header propagation at minimum; consider cf-trace or OTel

#### TD-P2-14: Health checks lack latency metrics

- **Status**: Open
- **Impact**: Degraded-but-not-down states invisible
- **Details**: `/health` only checks connectivity, no p50/p99 response times
- **Action**: Add timing measurements to health check responses

### P3 - Low Priority

#### TD-P3-6: Explicit `any` in chess Prisma stub

- **Status**: Open
- **Impact**: Violates monorepo "never use any" convention
- **Details**: `src/core/chess/core-logic/prisma.ts` still declares `const prismaStub: any = new Proxy(...)`
- **Action**: Replace the stub with a typed proxy shape or `unknown`-based adapter

#### TD-P3-7: Stale worktrees

- **Status**: Resolved (2026-03-10) — deleted manually

#### TD-P3-8: No GitHub issue templates

- **Status**: Open
- **Impact**: No structured templates for contributors
- **Details**: No `.github/ISSUE_TEMPLATE/` directory
- **Action**: Create bug report, feature request, and tech debt issue templates

## Resolved Items Summary

- **Sprint 5** (2026-03-05): 9 items — coverage gaps, scripts cleanup, animation constants, ScrollContainer, logpush removal, analyzeImage deprecation, esbuild pins, build artifacts, stripe-analytics export
- **Sprint 4** (2026-02-26): 6 items — 420 dead files removed, logger refactoring (300 files), category descriptions, CSS XSS fix, error boundaries
- **Sprint 3** (2026-02-14): 9 items — stub files, unused packages/fixtures, duplicate configs, Prisma migration, docs reorganization
- **Pre-Sprint 3**: TD-P0-3 (Sentry removed), TD-P1-1 (ErrorBoundary deduplicated), TD-P1-6/7/8 (block-sdk DSL/IDB/SQLite resolved), TD-P2-1/2/8 (analyzeImage/ai-sdk/esbuild resolved)
- **Moved to external repos**: TD-P1-2/3, TD-P2-3/4/5/6/7, TD-P3-3/5 — tracked in `@spike-land-ai/testing.spike.land`

## Sprint History

| Sprint   | Date                | Focus                                                                | Status                              |
| -------- | ------------------- | -------------------------------------------------------------------- | ----------------------------------- |
| Sprint 1 | 2026-01-17          | Initial stabilization                                                | Completed                           |
| Sprint 2 | 2026-01-27 (target) | Continuation                                                         | Abandoned -- superseded by Sprint 3 |
| Sprint 3 | 2026-02-14          | Comprehensive inventory and cleanup                                  | Completed                           |
| Sprint 4 | 2026-02-26          | Dead code removal, logger refactoring, error boundaries, CSS XSS fix | Completed                           |
| Sprint 5 | 2026-03-05          | Logpush cleanup, tech debt audit, build artifact fixes, export bugs  | Completed                           |
| Sprint 6 | 2026-03-10          | 16-engineer DX audit: 19 findings across infra, types, CI, features  | In Progress                         |

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
