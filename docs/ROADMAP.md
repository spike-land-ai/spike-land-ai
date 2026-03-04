# Spike Land - Development Roadmap

> **Last Updated**: 2026-03-04 **Current Phase**: Platform Launch & Growth
> **Business Structure**: UK Limited Company (SPIKE LAND LTD - Company
> #16906682)

---

## Vision: The Managed Deployment Platform with MCP Registry

**Spike Land is a managed deployment platform where developers vibe code
full-stack apps and deploy them instantly -- powered by Spike, your personalized
AI assistant with 455+ tools accessible via CLI, web chat, WhatsApp, and
Telegram.**

spike-cli lets you build, deploy, and manage applications from the command line.
The web platform provides a visual dashboard. Every capability is exposed as an
MCP tool. Every workflow can be automated by AI agents through the Model Context
Protocol.

**The moat is three things no competitor has together:**

1. **MCP-native architecture with multi-channel access** - 455+ tools callable
   by any AI agent via standard protocol, accessible through spike-cli (CLI),
   web chat, WhatsApp, and Telegram. No competitor offers this breadth of access
   channels.
2. **Managed deployment with vibe coding** - Build full-stack apps with AI
   assistance and deploy them to managed infrastructure in one command.
3. **UK Ltd with Stripe-first billing** - Global payments, VAT handling,
   SEIS/EIS eligible

**Positioning**: Managed Deployment Platform with MCP Registry **Core Product**:
spike-cli (MCP multiplexer CLI), Spike web chat, WhatsApp & Telegram bots
**Supporting Tools**: App Store (19 first-party apps), vibe coding, real-time
code editor **Target Market**: Developers, AI agent builders, solo founders,
small teams

---

## Current State (March 2026)

### What's Built

| Area                   | Status     | Details                                                                                                |
| ---------------------- | ---------- | ------------------------------------------------------------------------------------------------------ |
| **MCP Server**         | Production | 147 tool files, 150 test files (100% file coverage)                                                    |
| **spike-cli**          | Production | MCP multiplexer CLI (`@spike-land-ai/spike-cli`), 46 TS source files, auth, chat REPL, shell, registry |
| **App Store**          | Production | 18 store app listings, 19 first-party app dirs, 6 categories, 180 declared MCP tools                   |
| **Chess Arena**        | Production | 21 MCP tools, ELO ratings, time controls, profiles, game replay                                        |
| **State Machine**      | Production | Engine, types, visualizer template, 14 MCP tools                                                       |
| **QA Studio**          | Production | Browser automation, WCAG a11y audits, test runner, coverage                                            |
| **CleanSweep**         | Production | ADHD-friendly gamified cleaning, 14 MCP tools                                                          |
| **Career Navigator**   | Production | Skills assessment, ESCO taxonomy, salary data                                                          |
| **Auth**               | Production | Better Auth (GitHub, Google, Facebook, Apple)                                                          |
| **Stripe**             | 75%        | Subscriptions + one-time payments                                                                      |
| **Dev Workflow Tools** | Production | 5 MCP tools for local development                                                                      |
| **Security**           | Hardened   | Durable Object rate limiting, command injection prevention                                               |

### Tech Stack

- **Frontend**: spike-app (Vite + React + TanStack Router)
- **Edge API**: spike-edge, spike-land-mcp, mcp-auth (Cloudflare Workers + Hono)
- **Database**: D1 (SQLite at edge) + Drizzle ORM
- **Auth**: Better Auth (sessions, OAuth, device flow)
- **AI**: Google Gemini (gemini-3-flash), Anthropic Claude (Agent SDK)
- **Testing**: Vitest 4.0 (80% line/function coverage enforced in CI)
- **Payments**: Stripe | **Email**: Resend
- **Infra**: Cloudflare Workers (8 total) — zero AWS

### Scale

- 29 packages in `src/` (monorepo)
- 8 Cloudflare Workers (spike-edge, spike-land-mcp, mcp-auth, spike-land-backend, transpile, code, spike-review, image-studio-worker)
- 80+ MCP tools
- D1 database with 17 tables in spike-land-mcp (Drizzle-managed)
- block-sdk for composable storage blocks

---

## Monetization Strategy

### Tier 1: Platform Subscriptions (Live)

| Tier     | Price | Deployments | AI Credits/mo | Team Members |
| -------- | ----- | ----------- | ------------- | ------------ |
| FREE     | $0    | 3           | 100           | 1            |
| PRO      | $29   | 10          | 1,000         | 3            |
| BUSINESS | $99   | Unlimited   | 5,000         | 10           |

### Tier 2: MCP API Access (Q1-Q2 2026) - THE DIFFERENTIATOR

No competitor offers this. Package the MCP server as a paid API product for AI
agents.

| Access Level         | Price    | API Calls/mo | Capabilities                   |
| -------------------- | -------- | ------------ | ------------------------------ |
| Included in BUSINESS | $0 extra | 1,000        | Read-only (reports, analytics) |
| API PRO add-on       | $49/mo   | 10,000       | Full read/write                |
| API SCALE add-on     | $149/mo  | 100,000      | Webhooks, batch operations     |

**Call weighting**: Read = 1 call, Write = 5, AI operation = 10, Batch = 25

### Tier 3: Tool Marketplace (Q2-Q3 2026)

Third-party developers can publish MCP tools to the Spike registry. Revenue
share: 70% developer / 30% platform.

### Tier 4: Unified Credit Economy (Ongoing)

Merge all credits into "Spike Credits":

| Tier     | Included Credits | Overage Rate  |
| -------- | ---------------- | ------------- |
| FREE     | 100              | N/A           |
| PRO      | 2,000            | $0.008/credit |
| BUSINESS | 10,000           | $0.006/credit |
| SCALE    | 50,000           | $0.004/credit |

---

## UK Tax Advantages & Funding

### Available Now

| Scheme                 | Benefit                                         | Estimated Value            |
| ---------------------- | ----------------------------------------------- | -------------------------- |
| R&D Tax Credits (RDEC) | 20% credit on qualifying AI/ML R&D spend        | $6,000-8,100 on $30K spend |
| SEIS                   | 50% investor tax relief, $250K lifetime         | First funding round        |
| EIS                    | 30% investor tax relief, $5M annual             | Follow-on rounds           |
| Patent Box             | Reduces Corporation Tax to 10% on qualifying IP | When profitable            |

### Grants to Apply For

| Grant                              | Amount           | Timeline                   |
| ---------------------------------- | ---------------- | -------------------------- |
| Sovereign AI PoC Grant             | $50-84K          | Applications open Aug 2025 |
| British Business Bank Startup Loan | $25K at 6% fixed | Apply anytime              |
| Innovate UK Smart Grant            | $25-500K         | Rolling applications       |

---

## Development Phases

### Completed Phases

| Phase | Name                   | Status | Notes                                                      |
| ----- | ---------------------- | ------ | ---------------------------------------------------------- |
| 0     | Business Foundation    | Done   | UK Ltd incorporated Dec 2025, Monzo Business, UTR received |
| 1     | Database Schema        | Done   | PostgreSQL + Prisma, 233 models                            |
| 2     | Backend Infrastructure | Done   | Auth, MCP server, AI integration                           |
| 3     | Frontend Development   | Done   | UI, ~557 routes, shadcn/ui                                 |
| 4     | Testing & QA           | Done   | Vitest, 80% coverage enforced                              |

### In Progress

#### Phase 5: Stripe Integration (75%)

- [x] Payment intent creation
- [x] Webhook handling
- [x] Subscription management
- [ ] Annual billing with 20% discount
- [ ] Metered billing for API usage
- [ ] Credit pack one-time purchases ($10 for 500 credits)

#### Phase 10: Recent Feature Completions (February 2026)

- [x] TikTok social integration (4 API routes: connect, callback, metrics,
      posts)
- [x] 12 app storybook pages with components and unit tests (46 storybooks
      total)
- [x] Error boundaries across the app (16 error.tsx, 23 loading.tsx)
- [x] Dead code removal (~420 files removed)
- [x] Logger refactoring (~300 files)
- [x] 51 CATEGORY_DESCRIPTIONS added to tool-registry.ts
- [x] CSS XSS fix (sanitization)
- [x] State machine guard conditions and action handlers
- [x] AnimationPerformanceProvider
- [x] cron-auth module
- [x] Device detection
- [x] Cache system tests
- [x] Social engagement fetcher tests

#### Phase 11: Tech Debt Reduction (60%)

- [x] Full repo audit
- [x] 8 stale smoke test issues closed
- [x] Root-level unused deps removed
- [x] 6 critical security bugs fixed (command injection prevention)
- [x] Dev workflow MCP tools added (5 tools, 25 tests)
- [x] Dead code removal (~420 files removed)
- [x] Logger refactoring (~300 files)
- [x] Remove unused deps from src/code (extracted to external repo)
- [ ] Increase test coverage to 80% (from ~30%)

### Upcoming

#### Phase 12: WhatsApp & Telegram Integration (Q1-Q2 2026)

**Goal**: Multi-channel access to Spike AI assistant

| Task                                                        | Priority | Status  |
| ----------------------------------------------------------- | -------- | ------- |
| WhatsApp Business API integration                           | Critical | Planned |
| Telegram Bot API integration                                | Critical | Planned |
| Unified message routing (web chat, WhatsApp, Telegram, CLI) | Critical | Planned |
| Channel-specific formatting (markdown, rich cards)          | High     | Planned |
| Media support (images, files) across channels               | High     | Planned |
| Session persistence across channels                         | Medium   | Planned |

**Exit criteria**: Users can interact with Spike via WhatsApp and Telegram with
the same capabilities as web chat and spike-cli.

#### Phase 13: Expanded MCP Registry (Q2 2026)

**Goal**: Package MCP server as paid API product, open tool marketplace

| Task                                                | Priority | Status          |
| --------------------------------------------------- | -------- | --------------- |
| API rate limiting per account                       | Critical | Planned         |
| API key management UI                               | Critical | Partially built |
| Usage metering (calls tracked in DB)                | Critical | Planned         |
| Developer documentation                             | High     | Planned         |
| MCP marketplace listings (Smithery, Glama, LobeHub) | High     | Planned         |
| Third-party tool submission workflow                | High     | Planned         |
| Tool review and approval pipeline                   | Medium   | Planned         |
| Webhook subscriptions for API SCALE                 | Medium   | Planned         |

**Exit criteria**: API PRO add-on purchasable, rate-limited, metered,
documented. Third-party developers can submit tools.

#### Phase 14: Managed Deployments (Q3 2026)

**Goal**: One-command deployment for vibe-coded apps

| Task                            | Priority | Status  |
| ------------------------------- | -------- | ------- |
| `spike deploy` CLI command      | Critical | Planned |
| Managed hosting infrastructure  | Critical | Planned |
| Custom domain support           | High     | Planned |
| Environment variable management | High     | Planned |
| Deployment logs and monitoring  | High     | Planned |
| Rollback support                | Medium   | Planned |

**Exit criteria**: Users can deploy full-stack apps from spike-cli with
`spike deploy`.

---

## Revenue Projections

### Year 1 Targets (2026)

| Revenue Stream         | Q1        | Q2      | Q3       | Q4       | Annual     |
| ---------------------- | --------- | ------- | -------- | -------- | ---------- |
| Platform subscriptions | $2K       | $5K     | $10K     | $18K     | $35K       |
| MCP API access         | -         | $2K     | $5K      | $8K      | $15K       |
| Tool marketplace       | -         | -       | $3K      | $8K      | $11K       |
| Credit overages        | $500      | $1K     | $3K      | $5K      | $9.5K      |
| UK tax benefits        | -         | -       | -        | $15K     | $15K       |
| **Total**              | **$2.5K** | **$8K** | **$21K** | **$54K** | **$85.5K** |

### Key Metrics to Track

- **Credit utilization rate** by tier (hitting limits? too much headroom?)
- **Overage conversion rate** (% who hit limits and buy more vs. churn)
- **MCP API adoption rate** (% of BUSINESS users enabling API access)
- **Multi-channel usage** (% of users engaging via WhatsApp/Telegram vs. web)
- **Tool marketplace submissions** (third-party developer engagement)
- **Net Revenue Retention** (target: >110%)

---

## Competitive Landscape

| Competitor     | Price    | MCP?    | CLI?                | Multi-Channel?               | Our Advantage             |
| -------------- | -------- | ------- | ------------------- | ---------------------------- | ------------------------- |
| Vercel         | $20+/mo  | No      | Yes                 | No                           | MCP-native + AI assistant |
| Railway        | $5+/mo   | No      | Yes                 | No                           | 455+ tools + vibe coding  |
| Render         | $7+/mo   | No      | Yes                 | No                           | AI-first deployment       |
| Replit         | $25+/mo  | No      | No                  | No                           | MCP registry + CLI        |
| **Spike Land** | $0-99/mo | **Yes** | **Yes (spike-cli)** | **Yes (WhatsApp, Telegram)** | Full platform             |

**No deployment platform offers a programmable AI agent with 455+ MCP tools
accessible via CLI, web, WhatsApp, and Telegram.** This is the differentiator.

---

## Growth Playbook (First 90 Days)

### Month 1: Foundation

- [ ] List MCP server on Smithery, Glama.ai, LobeHub
- [ ] Publish spike-cli to npm (`@spike-land-ai/spike-cli`) and list on MCP
      registries
- [ ] Create "Build and deploy an app in 5 minutes" tutorial (using spike-cli)
- [ ] Launch on Product Hunt (managed deployment + AI assistant angle)

### Month 2: Multi-Channel Launch

- [ ] Launch WhatsApp integration (beta)
- [ ] Launch Telegram integration (beta)
- [ ] Publish weekly "Vibe Coding" blog series
- [ ] Create MCP tool development template for third-party devs
- [ ] Partner with 3-5 AI tool creators for cross-promotion

### Month 3: Marketplace

- [ ] Launch MCP tool marketplace (third-party submissions)
- [ ] Run first paid ads (target: developers, AI builders)
- [ ] Apply for Sovereign AI PoC Grant
- [ ] Begin SEIS funding round (target: $150K)

---

## MCP Ecosystem

### Current MCP Tool Categories (147 files)

| Category            | Files | Examples                                                        |
| ------------------- | ----- | --------------------------------------------------------------- |
| Chess               | 4     | chess-game, chess-player, chess-challenge, chess-replay         |
| Clean (CleanSweep)  | 7     | clean-photo, clean-scanner, clean-tasks, clean-streaks          |
| Content & Media     | 9     | image, audio, gallery, blog, newsletter, pages                  |
| Admin & Auth        | 5     | admin, auth, permissions, settings, audit                       |
| AI & Orchestration  | 8     | creative, orchestrator, swarm, sandbox, architect               |
| Dev & Infra         | 10    | dev, environment, vercel-bridge, sentry-bridge, github-admin    |
| Social              | 3+    | social-engagement, tiktok integration                           |
| EC2 / Boxes         | 3+    | box provisioning, sync-box-status, VNC sessions                 |
| Billing & Credits   | 4     | billing, credits, merch, skill-store                            |
| State Machine       | 1     | state-machine (with guard conditions & action handlers)         |
| QA Studio           | 1     | qa-studio                                                       |
| Workspace & Apps    | 4     | workspaces, apps, codespace, create                             |
| Distributed Systems | 4     | bft, crdt, netsim, raft                                         |
| Templates & Helpers | 4     | crud-template, permission-gated, workspace-scoped, index        |
| Other               | 80+   | career, chat, dashboard, email, filesystem, notifications, etc. |

### Planned Additions

| Tool                      | Priority | Phase    |
| ------------------------- | -------- | -------- |
| `deploy_app`              | Critical | Phase 14 |
| `manage_deployment`       | Critical | Phase 14 |
| `whatsapp_send`           | High     | Phase 12 |
| `telegram_send`           | High     | Phase 12 |
| `marketplace_submit_tool` | High     | Phase 13 |
| `marketplace_review_tool` | Medium   | Phase 13 |

---

## Legacy Phases (Historical Reference)

The following phases represent earlier roadmap iterations, now superseded:

| Phase                         | Name       | Status                                                                               |
| ----------------------------- | ---------- | ------------------------------------------------------------------------------------ |
| Pixel App & Token Economy     | Superseded | Image enhancement app; token system remains as platform credits                      |
| Orbit Social Media Management | Superseded | Social media command center; MCP tools remain, repositioned as platform capabilities |
| Agency SCALE Tier             | Superseded | Multi-workspace volume pricing; may be revisited for deployment teams                |
| Autopilot (outcome-based AI)  | Deferred   | Outcome-based automation; concept may evolve into deployment automation              |

---

## How to Contribute

1. Pick a task from "In Progress" or "Upcoming" phases
2. Create a feature branch: `git checkout -b feature/task-name`
3. Implement with tests (must satisfy CI coverage thresholds: 80%
   lines/functions, 75% branches)
4. Submit PR with detailed description
5. Wait for CI checks and code review

See [CLAUDE.md](../CLAUDE.md) for detailed development guidelines.
