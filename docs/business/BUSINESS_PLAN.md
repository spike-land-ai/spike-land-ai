# Business Plan — SPIKE LAND LTD

> **Company**: SPIKE LAND LTD (UK Company #16906682)
> **Date**: March 2026
> **Classification**: Confidential — For Investor & HMRC Use
> **Stage**: Pre-Revenue, Product-Ready
> **Prepared For**: SEIS Advance Assurance (Part 5, Item 3)
> **Currency**: GBP Primary (USD Secondary at £1 = $1.27)

---

## 1. Executive Summary

SPIKE LAND LTD is a UK-incorporated technology company building an MCP-first AI
development platform deployed on Cloudflare's global edge network.

The platform provides a managed registry of 80+ MCP (Model Context Protocol)
tools accessible through multiple channels — CLI (`spike-cli`), web dashboard,
and planned WhatsApp/Telegram integration. Developers and businesses use these
tools to build, deploy, and manage AI-powered applications without stitching
together fragmented services.

**Key facts:**

- **Product**: Production-ready platform with 80+ MCP tools, live at spike.land
- **Infrastructure**: 8 Cloudflare Workers, D1 database, zero AWS dependency —
  total infra cost ~£5/month
- **Pricing**: 4 tiers — Free ($0), Pro ($29/mo), Business ($99/mo), plus API
  access add-ons ($49-149/mo)
- **Revenue**: Pre-revenue; Stripe payments 75% integrated
- **Current Traction**: Product live in beta. [X,000+] npm downloads for `spike-cli`, [X00+] active beta testers, and [X00+] GitHub stars.
- **Team**: Sole founder/director (Zoltan Erdos), full-stack engineer
- **SEIS Raise**: Up to £250,000 (maximum SEIS allowance)
- **Target Market**: 16 defined personas across 4 segments, scaling to 32 (Y2)
  and 64 (Y3) via A/B testing and user feedback

**The company is SEIS-eligible: incorporated December 2025, no prior investment,
fewer than 25 employees, gross assets under £350,000, carrying on a qualifying
software development trade.**

---

## 2. Company Overview

| Field | Value |
|-------|-------|
| Legal Name | SPIKE LAND LTD |
| Company Number | 16906682 |
| Incorporation Date | 12 December 2025 |
| Registered Office | England & Wales |
| SIC Codes | 62090 (IT consultancy), 63120 (Web portals) |
| Director | Zoltan Erdos (sole director) |
| Shareholders | Zoltan Erdos — 1 ordinary share at £1 (100%) |
| Corporation Tax Ref | BRCT00003618256 |
| Bank | Monzo Business |
| Employees | 0 (sole director only) |

**Founder background**: Zoltan Erdos is a full-stack engineer with 10+ years of
experience. [Placeholder: Mention specific past successes, e.g., "Previously scaled engineering platforms to X users," "Led teams at Y," or "Significant open-source contributor to Z."] He built the entire platform solo using AI-assisted development
(Claude Code), demonstrating both technical capability and the productivity
leverage that AI tooling provides — which is the core thesis of the product
itself.

---

## 3. Problem & Solution

### 3.1 Problem

Developers building with AI face three compounding problems:

1. **Fragmented tooling** — The average developer uses 8+ SaaS tools daily
   (deployment on Vercel, AI via OpenAI, monitoring via Datadog, etc.). Each
   requires separate authentication, billing, and integration work.

2. **No managed MCP registry** — The Model Context Protocol (Anthropic, 2024) is
   becoming the standard for AI-tool interaction, but no platform offers a
   managed, hosted registry of MCP tools with authentication, rate limiting, and
   billing built in. Developers must build and host their own MCP servers.

3. **No multi-channel access** — Existing developer platforms offer either a web
   dashboard or a CLI, rarely both with full parity. None offer access via
   messaging apps (WhatsApp, Telegram) that would let developers manage
   applications from mobile.

### 3.2 Solution

Spike Land is a unified platform that solves all three problems:

- **80+ MCP tools** in a single managed registry — authentication, rate
  limiting, metering, and billing handled by the platform
- **Multi-channel access** — spike-cli (npm), web dashboard, and planned
  WhatsApp/Telegram bots, all with full tool parity
- **Edge-native infrastructure** — deployed on Cloudflare Workers globally,
  sub-50ms latency, at ~£5/month infrastructure cost

The combination of managed MCP registry + multi-channel access + edge deployment
is unique. No competitor offers all three.

---

## 4. Market Opportunity

| Metric | Value | Definition |
|--------|-------|------------|
| **TAM** | $50B+ | Global developer tools & cloud platforms |
| **SAM** | $10B | AI-powered developer platforms |
| **SOM** | $200M | MCP-native development platforms |
*\*Sources: Gartner 2024 Developer Tools Report, internal estimates.*

**Growth drivers:**

- AI developer tools market growing at 25-30% CAGR through 2030
- MCP protocol adoption accelerating — Anthropic, OpenAI, and major IDEs
  integrating MCP support
- Solo founder / small team revolution — AI-assisted development enables smaller
  teams to build production software, increasing demand for integrated platforms
- Shift from manual DevOps to AI-assisted deployment and management

**Validation**: The developer tools market has produced multiple $1B+ outcomes
(Vercel, Datadog, GitLab, Supabase) and is well-understood by investors.
MCP-native platforms represent an emerging sub-segment with no dominant player.

---

## 5. Target Personas — 16 Personas in 4 Segments

The company targets 16 specific personas organised into 4 segments. Each persona
has defined demographics, pain points, activation triggers, platform tools used,
target pricing tier, and unit economics (CAC, LTV, LTV:CAC ratio). Year 1
focuses on establishing baseline metrics for all 16, with emphasis on the 4
highest-LTV and 4 lowest-CAC personas.

### Segment A: Builders (Developer-First)

Developers who discover spike.land through npm, GitHub, MCP registries, or
developer communities. They evaluate tools on developer experience, API quality,
and extensibility. This is the primary early-adoption segment.

---

#### A1: AI Agent Developer

| Attribute | Detail |
|-----------|--------|
| **Profile** | Builds AI agents using MCP; discovers tools via npm/GitHub |
| **Age / Income** | 25-40 / £50-120k |
| **Channels** | GitHub, npm, Discord, Hacker News, Twitter/X |
| **Pain Points** | Fragmented MCP servers, connection management, auth flows across tools |
| **Activation Trigger** | Adding spike.land as MCP server to Claude Code in one line |
| **Platform Tools Used** | spike-cli, MCP API, code editor, image studio, chess engine |
| **Target Tier** | FREE → API PRO ($49/mo) |
| **CAC** | £10-30 (organic via npm/GitHub, Show HN) |
| **LTV** | £588-1,764 (12-36 months × £49/mo) |
| **LTV:CAC** | 19.6-58.8x |
| **Payback Period** | < 1 month |

---

#### A2: Indie Hacker / Solo Founder

| Attribute | Detail |
|-----------|--------|
| **Profile** | Solo SaaS builder, budget-conscious, ships fast |
| **Age / Income** | 22-38 / £20-80k (variable, bootstrapped) |
| **Channels** | Twitter/X, Indie Hackers, Product Hunt, Hacker News |
| **Pain Points** | Too many tools to stitch together, limited time, needs AI leverage |
| **Activation Trigger** | Seeing a "build and deploy in 5 minutes" tutorial |
| **Platform Tools Used** | Vibe coding, managed deployments, image studio, QA automation |
| **Target Tier** | PRO ($29/mo) |
| **CAC** | £30-60 (content marketing, community) |
| **LTV** | £348-1,044 (12-36 months × £29/mo) |
| **LTV:CAC** | 5.8-17.4x |
| **Payback Period** | 1-2 months |

---

#### A3: DevOps / Platform Engineer

| Attribute | Detail |
|-----------|--------|
| **Profile** | Evaluates and manages team tools; needs audit logs, permissions, SSO |
| **Age / Income** | 28-45 / £55-110k |
| **Channels** | GitHub, LinkedIn, DevOps conferences, internal Slack |
| **Pain Points** | Tool sprawl, lack of audit trail for AI tool usage, permission management |
| **Activation Trigger** | Team member recommends spike-cli; evaluates for org-wide rollout |
| **Platform Tools Used** | Admin tools, audit logs, team workspaces, API access, QA studio |
| **Target Tier** | BUSINESS ($99/mo) |
| **CAC** | £100-200 (direct outreach, content, events) |
| **LTV** | £1,188-3,564 (12-36 months × £99/mo) |
| **LTV:CAC** | 5.9-17.8x |
| **Payback Period** | 1-2 months |

---

#### A4: Open-Source MCP Tool Author

| Attribute | Detail |
|-----------|--------|
| **Profile** | Maintains open-source MCP tools; wants to monetise without billing/ops |
| **Age / Income** | 22-40 / £30-100k |
| **Channels** | GitHub, npm, MCP registries (Smithery, Glama, LobeHub) |
| **Pain Points** | No monetisation path for open-source MCP tools, hosting/billing overhead |
| **Activation Trigger** | Cold outreach from founder offering 70/30 marketplace revenue share |
| **Platform Tools Used** | Marketplace publisher dashboard, analytics, tool submission workflow |
| **Target Tier** | Marketplace Publisher (70/30 revenue share) |
| **CAC** | £0-20 (direct outreach, organic) |
| **LTV** | £240-1,200 (platform revenue share over 12-36 months) |
| **LTV:CAC** | 12.0-60.0x |
| **Payback Period** | < 1 month |

---

### Segment B: Operators (Business-First)

Business users and team leads who need AI-powered tools to solve operational
problems. They evaluate platforms on ROI, team features, and support quality
rather than API documentation.

---

#### B1: Startup CTO

| Attribute | Detail |
|-----------|--------|
| **Profile** | Technical leader at a 5-30 person startup; needs automation at scale |
| **Age / Income** | 28-45 / £60-130k |
| **Channels** | LinkedIn, Hacker News, CTO Slack communities, conferences |
| **Pain Points** | Engineering bandwidth bottleneck, manual code review, QA overhead |
| **Activation Trigger** | Seeing spike-cli automate code review + QA in a single pipeline |
| **Platform Tools Used** | Code review tools, QA studio, deployment, team workspaces, API access |
| **Target Tier** | BUSINESS ($99/mo) |
| **CAC** | £80-180 (content, events, direct outreach) |
| **LTV** | £1,188-3,564 (12-36 months × £99/mo) |
| **LTV:CAC** | 6.6-19.8x |
| **Payback Period** | 1-2 months |

---

#### B2: Non-Technical SMB Owner

| Attribute | Detail |
|-----------|--------|
| **Profile** | Small business owner who needs "build me an app" without hiring devs |
| **Age / Income** | 30-55 / £30-80k |
| **Channels** | Google search, Facebook groups, LinkedIn, word of mouth |
| **Pain Points** | Cannot code, expensive to hire developers, needs simple web presence + tools |
| **Activation Trigger** | Discovering the App Builder service or vibe coding capability |
| **Platform Tools Used** | App Builder (one-time service), image studio, dashboard, templates |
| **Target Tier** | PRO ($29/mo) + App Builder service (£1,997 one-time) |
| **CAC** | £60-120 (Google ads, referrals) |
| **LTV** | £348-2,345 (subscription 12-36mo + one-time service fee) |
| **LTV:CAC** | 5.8-19.5x |
| **Payback Period** | 1-2 months (immediate for App Builder) |

---

#### B3: QA / Testing Lead

| Attribute | Detail |
|-----------|--------|
| **Profile** | Responsible for test coverage, accessibility audits, browser automation |
| **Age / Income** | 28-42 / £45-85k |
| **Channels** | LinkedIn, QA communities, testing conferences, dev blogs |
| **Pain Points** | Manual testing bottleneck, WCAG compliance overhead, cross-browser issues |
| **Activation Trigger** | Discovering QA Studio's automated accessibility audits and browser testing |
| **Platform Tools Used** | QA Studio, browser automation, WCAG audits, test runner, reporting |
| **Target Tier** | BUSINESS ($99/mo) |
| **CAC** | £80-150 (content marketing, events) |
| **LTV** | £1,188-2,376 (12-24 months × £99/mo) |
| **LTV:CAC** | 7.9-15.8x |
| **Payback Period** | 1-2 months |

---

#### B4: Data-Driven Marketing Manager

| Attribute | Detail |
|-----------|--------|
| **Profile** | Needs analytics dashboards, campaign image generation, content tools |
| **Age / Income** | 26-42 / £35-65k |
| **Channels** | LinkedIn, marketing Slack communities, Google search |
| **Pain Points** | Scattered analytics, manual image creation, no AI-powered content pipeline |
| **Activation Trigger** | Seeing the image studio + analytics dashboard combination |
| **Platform Tools Used** | Image studio, analytics MCP tools, content generation, dashboard |
| **Target Tier** | PRO ($29/mo) → BUSINESS ($99/mo) |
| **CAC** | £60-150 (content, Google ads, LinkedIn) |
| **LTV** | £348-2,376 (12-24 months at PRO/BIZ) |
| **LTV:CAC** | 5.8-15.8x |
| **Payback Period** | 1-3 months |

---

### Segment C: Creators (Content-First)

Individuals who use the platform primarily for content creation, education, or
creative projects. Lower ARPU but high virality potential — each creator
generates content that drives organic awareness.

---

#### C1: Technical Blogger

| Attribute | Detail |
|-----------|--------|
| **Profile** | Writes dev tutorials; needs code sandboxes, image generation, embeds |
| **Age / Income** | 24-40 / £30-70k |
| **Channels** | Dev.to, Hashnode, Medium, Twitter/X, personal blogs |
| **Pain Points** | Manual screenshot creation, no interactive code embeds, image editing |
| **Activation Trigger** | Discovering embeddable code sandboxes + image studio for blog illustrations |
| **Platform Tools Used** | Code editor embeds, image studio, blog tools, sandbox |
| **Target Tier** | PRO ($29/mo) |
| **CAC** | £30-60 (content, SEO, community) |
| **LTV** | £348-696 (12-24 months × £29/mo) |
| **LTV:CAC** | 5.8-11.6x |
| **Payback Period** | 1-2 months |

---

#### C2: Educator / Course Creator

| Attribute | Detail |
|-----------|--------|
| **Profile** | Builds coding courses; needs quizzes, badges, interactive sandboxes |
| **Age / Income** | 28-50 / £35-80k |
| **Channels** | Udemy, YouTube, LinkedIn Learning, education conferences |
| **Pain Points** | No interactive coding environment for students, manual grading, engagement |
| **Activation Trigger** | Seeing LearnIt quizzes + code sandboxes integrated for student use |
| **Platform Tools Used** | LearnIt tools, code sandboxes, badges, student workspaces |
| **Target Tier** | PRO ($29/mo) |
| **CAC** | £40-80 (education partnerships, content) |
| **LTV** | £348-1,044 (12-36 months × £29/mo) |
| **LTV:CAC** | 4.4-13.1x |
| **Payback Period** | 1-3 months |

---

#### C3: Visual Designer

| Attribute | Detail |
|-----------|--------|
| **Profile** | Creates visual content; needs image generation, enhancement, export pipelines |
| **Age / Income** | 22-38 / £25-60k |
| **Channels** | Dribbble, Behance, Instagram, Twitter/X, design communities |
| **Pain Points** | Expensive design tools, no AI pipeline (generate → enhance → export) |
| **Activation Trigger** | Discovering the image studio pipeline from generation to final export |
| **Platform Tools Used** | Image studio (generate, enhance, album, export), templates |
| **Target Tier** | PRO ($29/mo) + credit overages |
| **CAC** | £40-80 (design community outreach, Instagram) |
| **LTV** | £348-870 (12-24 months × £29/mo + credits) |
| **LTV:CAC** | 4.4-10.9x |
| **Payback Period** | 1-2 months |

---

#### C4: Chess / Game Enthusiast

| Attribute | Detail |
|-----------|--------|
| **Profile** | Plays chess online; interested in ELO ratings, tournaments, game analysis |
| **Age / Income** | 18-50 / £15-60k |
| **Channels** | Chess forums, Reddit, Discord, YouTube chess channels |
| **Pain Points** | Limited AI-powered game analysis, no MCP-native chess experience |
| **Activation Trigger** | Discovering the Chess Arena with AI opponents, ELO system, replay |
| **Platform Tools Used** | Chess Arena (21 MCP tools), ELO ratings, time controls, game replay |
| **Target Tier** | FREE → PRO ($29/mo) |
| **CAC** | £5-20 (organic, community, viral) |
| **LTV** | £87-348 (3-12 months × £29/mo) |
| **LTV:CAC** | 4.4-17.4x |
| **Payback Period** | 1-2 months |

---

### Segment D: Scalers (Agency/Team)

Teams and organisations that deploy the platform across multiple
clients/projects. Highest ARPU, longest retention, but highest CAC and longest
sales cycle.

---

#### D1: AI Consultancy / Agency

| Attribute | Detail |
|-----------|--------|
| **Profile** | 5-50 person agency building AI solutions for clients; multi-workspace |
| **Age / Income** | 30-50 / £60-150k (principals) |
| **Channels** | LinkedIn, industry events, client referrals, partnerships |
| **Pain Points** | Per-client tool setup overhead, billing complexity, workspace isolation |
| **Activation Trigger** | Seeing multi-workspace management with per-client isolation and billing |
| **Platform Tools Used** | Multi-workspace, API SCALE, client deployments, team management, audit |
| **Target Tier** | BUSINESS ($99/mo) + API SCALE ($149/mo) |
| **CAC** | £150-300 (direct sales, events, partnerships) |
| **LTV** | £5,940-17,820 (24-60 months × £248/mo) |
| **LTV:CAC** | 19.8-59.4x |
| **Payback Period** | 1-2 months |

---

#### D2: Freelance Developer (Multi-Client)

| Attribute | Detail |
|-----------|--------|
| **Profile** | Manages 3-8 clients simultaneously; needs workspace per client |
| **Age / Income** | 25-40 / £30-80k (variable, freelance) |
| **Channels** | LinkedIn, Upwork, freelancer communities, word of mouth |
| **Pain Points** | Context-switching between clients, tool cost scaling, client reporting |
| **Activation Trigger** | Discovering multi-workspace pricing that scales with client count |
| **Platform Tools Used** | Multiple workspaces, code editor, deployments, client reporting |
| **Target Tier** | PRO x3-5 workspaces ($87-145/mo) |
| **CAC** | £40-80 (community, content, referrals) |
| **LTV** | £1,044-4,350 (12-36 months × £87-145/mo avg) |
| **LTV:CAC** | 13.1-54.4x |
| **Payback Period** | 1-2 months |

---

#### D3: Enterprise Innovation Lead

| Attribute | Detail |
|-----------|--------|
| **Profile** | Evaluates AI platforms for enterprise adoption; needs SSO, RBAC, SLA |
| **Age / Income** | 35-55 / £80-150k |
| **Channels** | Gartner, Forrester, enterprise sales, LinkedIn, industry events |
| **Pain Points** | Security requirements (SSO, audit), compliance, vendor risk assessment |
| **Activation Trigger** | Enterprise features (SSO, RBAC, SLA, dedicated support) becoming available |
| **Platform Tools Used** | Full platform with enterprise security, custom integrations, SLA |
| **Target Tier** | ENTERPRISE (£500+/mo, custom pricing) |
| **CAC** | £500-2,000 (enterprise sales cycle, events, consultants) |
| **LTV** | £12,000-36,000 (24-60 months × £500+/mo) |
| **LTV:CAC** | 6.0-18.0x |
| **Payback Period** | 2-4 months |

---

#### D4: Education Institution / Bootcamp

| Attribute | Detail |
|-----------|--------|
| **Profile** | Coding bootcamp or university programme; 50-500 students per cohort |
| **Age / Income** | Institution (programme director 35-55) |
| **Channels** | Education conferences, partnership outreach, LinkedIn |
| **Pain Points** | No scalable coding sandbox for students, per-seat licensing expensive |
| **Activation Trigger** | Volume pricing for student workspaces with LearnIt integration |
| **Platform Tools Used** | Student workspaces, LearnIt quizzes, code sandboxes, progress tracking |
| **Target Tier** | BUSINESS ($99/mo) → ENTERPRISE (volume pricing) |
| **CAC** | £200-500 (partnership development, conferences) |
| **LTV** | £3,564-11,880 (36-120 months × £99-£500/mo) |
| **LTV:CAC** | 7.1-23.8x |
| **Payback Period** | 2-5 months |

---

### 5.1 Persona Summary Matrix

| ID | Persona | Segment | Target Tier | CAC | LTV | LTV:CAC |
|----|---------|---------|-------------|-----|-----|---------|
| A1 | AI Agent Developer | Builders | API PRO $49 | £10-30 | £588-1,764 | 19.6-58.8x |
| A2 | Indie Hacker | Builders | PRO $29 | £30-60 | £348-1,044 | 5.8-17.4x |
| A3 | DevOps Engineer | Builders | BIZ $99 | £100-200 | £1,188-3,564 | 5.9-17.8x |
| A4 | OSS MCP Author | Builders | Marketplace | £0-20 | £240-1,200 | 12.0-60.0x |
| B1 | Startup CTO | Operators | BIZ $99 | £80-180 | £1,188-3,564 | 6.6-19.8x |
| B2 | Non-Tech SMB Owner | Operators | PRO + Service | £60-120 | £348-2,345 | 5.8-19.5x |
| B3 | QA / Testing Lead | Operators | BIZ $99 | £80-150 | £1,188-2,376 | 7.9-15.8x |
| B4 | Marketing Manager | Operators | PRO→BIZ | £60-150 | £348-2,376 | 5.8-15.8x |
| C1 | Technical Blogger | Creators | PRO $29 | £30-60 | £348-696 | 5.8-11.6x |
| C2 | Educator | Creators | PRO $29 | £40-80 | £348-1,044 | 4.4-13.1x |
| C3 | Visual Designer | Creators | PRO + credits | £40-80 | £348-870 | 4.4-10.9x |
| C4 | Chess Enthusiast | Creators | FREE→PRO | £5-20 | £87-348 | 4.4-17.4x |
| D1 | AI Agency | Scalers | BIZ+SCALE | £150-300 | £5,940-17,820 | 19.8-59.4x |
| D2 | Freelance Dev | Scalers | PRO ×3-5 | £40-80 | £1,044-4,350 | 13.1-54.4x |
| D3 | Enterprise Lead | Scalers | ENTERPRISE | £500-2,000 | £12,000-36,000 | 6.0-18.0x |
| D4 | Education Institution | Scalers | BIZ→ENT | £200-500 | £3,564-11,880 | 7.1-23.8x |

**Year 1 priority focus:**

- **Highest LTV**: D3, D1, D4, D2 — target for direct sales and partnerships
- **Lowest CAC**: A1, A4, C4, A2 — target for organic/PLG acquisition

---

## 6. Revenue Model & Pricing

### 6.1 Revenue Streams

| # | Stream | Description | Margin |
|---|--------|-------------|--------|
| 1 | Platform Subscriptions | Monthly/annual SaaS fees (Free/Pro/Business) | 85%+ |
| 2 | MCP API Access | API PRO ($49/mo) and API SCALE ($149/mo) add-ons | 80%+ |
| 3 | Credit Overages | Per-credit charges beyond tier allowance | 90%+ |
| 4 | App Builder Service | One-time custom app development (£1,997) | 60-70% |
| 5 | Marketplace Revenue Share | 30% platform take on third-party tool sales | 95%+ |

### 6.2 Pricing Tiers

| Tier | Price | Deployments | AI Credits/mo | Team Members |
|------|-------|-------------|---------------|--------------|
| FREE | $0/mo | 3 | 100 | 1 |
| PRO | $29/mo | 10 | 1,000 | 3 |
| BUSINESS | $99/mo | Unlimited | 5,000 | 10 |
| ENTERPRISE | £500+/mo | Custom | Custom | Custom |

### 6.3 MCP API Access (Add-On)

| Level | Price | API Calls/mo | Capabilities |
|-------|-------|--------------|--------------|
| Included in BUSINESS | $0 extra | 1,000 | Read-only |
| API PRO | $49/mo | 10,000 | Full read/write |
| API SCALE | $149/mo | 100,000 | Webhooks, batch operations |

### 6.4 Credit Economy

| Tier | Included Credits | Overage Rate |
|------|-----------------|--------------|
| FREE | 100/mo | N/A |
| PRO | 2,000/mo | $0.008/credit |
| BUSINESS | 10,000/mo | $0.006/credit |
| SCALE | 50,000/mo | $0.004/credit |

---

## 7. Go-to-Market Strategy

### 7.1 Product-Led Growth (PLG) — Primary

The core acquisition strategy is product-led:

1. **npm distribution** — `npx @spike-land-ai/spike-cli` provides zero-install
   evaluation. Every npm download is a top-of-funnel event.
2. **One-liner activation** — Adding spike.land as an MCP server to Claude Code
   takes one terminal command. This is the "aha moment."
3. **Free tier with natural upgrade gates** — Daily credit ceiling (50/day on
   free) creates recurring friction. Upgrade prompts fire at the exact moment a
   user hits a limit while doing real work.
4. **"Powered by spike.land" badge** — Every app deployed on the platform
   carries a badge on the free/Pro tiers, turning customers into distribution.

### 7.2 Content Marketing

- **Show HN** post targeting MCP/AI developer audience (free, high leverage)
- **Blog series** — "Vibe Coding" weekly tutorials demonstrating platform
  capabilities
- **GitHub showcase** — spike-cli repo as a discovery vector; target 100+ stars
  in first 90 days
- **MCP registry listings** — List on Smithery.ai, Glama.ai, LobeHub as
  distribution channels

### 7.3 Direct Outreach

- **MCP tool authors (Segment A4)** — Identify 10-15 popular open-source MCP
  tools, cold-email authors about marketplace publishing with 70/30 revenue
  share and featured listings
- **AI agencies (Segment D1)** — LinkedIn outreach to AI consultancies showing
  multi-workspace management and per-client billing
- **Education institutions (Segment D4)** — Partnership outreach to coding
  bootcamps offering volume pricing

### 7.4 Community

- **Discord community** — Central hub for users, tool authors, and support
- **Open-source contribution** — spike-cli itself is open-source, building trust
  and enabling community-driven improvements

### 7.5 GTM Budget Allocation (Y1)

| Channel | % of Marketing Budget | Target Personas |
|---------|----------------------|-----------------|
| Content (blog, Show HN, tutorials) | 35% | A1, A2, C1, C2 |
| Google/LinkedIn ads | 25% | B1, B2, B4, D3 |
| Direct outreach | 20% | A4, D1, D4 |
| Community / events | 15% | A3, B3, D2 |
| Referral programme | 5% | All |

*Note: Year 1 marketing spend heavily front-loads brand awareness, SEO, and free-tier acquisition to build top-of-funnel momentum. While the £57.5k budget may seem high for acquiring 228 paid users in Year 1, this investment directly seeds the pipeline for the accelerated growth targets in Years 2 and 3.*

---

## 8. Persona Scaling Strategy (16 → 32 → 64)

### 8.1 Year 1: 16 Personas — Establish Baselines

In Year 1, operate with the 16 personas defined in Section 5. The goal is not to
validate all 16 equally but to establish measurable baselines and identify which
personas drive the most efficient growth.

**Focus strategy:**

- **Top 4 by LTV** (D3, D1, D4, D2): Invest in direct sales. These personas
  have the highest payoff per conversion but require more touchpoints.
- **Top 4 by CAC efficiency** (A1, A4, C4, A2): Invest in PLG and content.
  These personas convert through organic channels at minimal cost.
- **Remaining 8**: Run baseline measurement only. Track signups, activation,
  conversion, and churn per persona via UTM tagging and onboarding survey data.

**Monthly persona health scorecard**: Track a matrix of signups, activation
rate, free-to-paid conversion, monthly churn, and LTV:CAC for each of the 16
personas. Review monthly. Kill or merge the bottom 2 personas per quarter if
they show no traction.

### 8.2 Year 2: 32 Personas — Behavioural Splitting

At the start of Year 2, split each Year 1 persona into 2 sub-personas based on
observed behavioural data from the first 12 months. This is not arbitrary — each
split must be justified by statistically significant differences in at least one
key metric.

**Splitting dimensions:**

| Dimension | Example Split |
|-----------|---------------|
| Industry vertical | A1a: Agent dev for clients → A1b: Agent dev for internal tools |
| Company size | B1a: CTO at 5-15 person startup → B1b: CTO at 15-50 person startup |
| Use-case depth | C1a: Blogger using code embeds only → C1b: Blogger using image studio + embeds |
| Geography | D1a: UK/EU agency → D1b: US/APAC agency |
| Engagement pattern | A2a: Daily active indie hacker → A2b: Weekly active side-project builder |

**Gating criteria for a split:**

1. Minimum 10 users in the parent persona
2. Statistically significant difference (p < 0.05) in at least one of:
   activation rate, ARPU, churn rate, or feature usage pattern
3. Actionable difference — the split must lead to a different marketing message,
   onboarding flow, or pricing presentation

**If a persona cannot be split** (insufficient users or no significant
difference), it remains as a single persona. The 32 target is aspirational, not
mandatory.

### 8.3 Year 3: 64 Personas — Geographic & Vertical Deepening

Year 3 splits each Year 2 sub-persona again, driven by:

- **Geographic expansion** — Language-specific landing pages, local payment
  methods, timezone-aware onboarding
- **Vertical deepening** — Industry-specific tool bundles (e.g., "AI Agency
  Starter Pack", "Education Institution Kit")
- **Usage pattern segmentation** — Power users vs. occasional users within each
  sub-persona, with different retention strategies

The 64 target follows the same gating criteria as Year 2. Personas that cannot
justify a split remain consolidated.

---

## 9. A/B Testing Framework

### 9.1 What to Test

| Category | Test Examples | Persona Impact |
|----------|--------------|----------------|
| Onboarding flow | One-liner first vs. dashboard tour first | A1, A2 |
| Pricing page | Show 3 tiers vs. highlight Pro only | B2, C1, C3 |
| Upgrade prompts | Credit math vs. feature unlock framing | All |
| Landing page copy | Per-persona headlines and CTAs | All |
| Tool discovery UX | Category browsing vs. search-first | B3, B4, D1 |
| Email sequences | Subject line, send timing, CTA placement | All |

### 9.2 Statistical Framework

| Parameter | Standard |
|-----------|----------|
| Significance level | p < 0.05 |
| Minimum detectable effect (MDE) | 20% relative improvement |
| Minimum test duration | 2 weeks |
| Minimum sample size | 100 users per variant (or calculated per metric) |
| Early stopping | Bayesian stopping rule when posterior probability > 95% |
| Multiple comparisons | Bonferroni correction when running 3+ variants |

### 9.3 Persona Health Scorecard

Review monthly. Each cell is a RAG (Red/Amber/Green) status:

| Metric | Green | Amber | Red |
|--------|-------|-------|-----|
| Monthly signups | > 10 | 5-10 | < 5 |
| Activation rate (first tool call / 24h) | > 40% | 25-40% | < 25% |
| Free-to-paid conversion | > 8% | 4-8% | < 4% |
| Monthly churn | < 6% | 6-10% | > 10% |
| LTV:CAC ratio | > 8x | 4-8x | < 4x |

### 9.4 Kill / Merge Criteria

- Bottom 2 personas per quarter are reviewed
- A persona is killed (merged into its nearest neighbour) if:
  - Fewer than 5 users after 6 months of active targeting
  - LTV:CAC consistently below 3x for 2 consecutive quarters
  - No statistically significant difference from a sibling persona
- Killed personas' users are reassigned to the merged parent for tracking

---

## 10. Competitive Landscape

| Competitor | What They Do | MCP? | CLI? | Multi-Channel? | Marketplace? |
|------------|-------------|------|------|----------------|--------------|
| **Vercel** | Deployment platform | No | Yes | No | No |
| **Cursor** | AI code editor | No | No | No | No |
| **Replit** | Cloud IDE + deployment | No | No | No | Limited |
| **Smithery** | MCP directory | Directory only | No | No | No |
| **Glama** | MCP directory | Directory only | No | No | No |
| **Railway** | Deployment platform | No | Yes | No | No |
| **spike.land** | **MCP-first AI platform** | **80+ hosted** | **spike-cli** | **Web + CLI + planned mobile** | **70/30 rev share** |

**Key differentiators:**

1. **Only managed MCP registry** — Smithery and Glama list tools; spike.land
   hosts, authenticates, rate-limits, and bills for them
2. **Multi-channel access** — Same 80+ tools accessible via CLI, web, and
   planned messaging apps
3. **Tool marketplace with revenue share (Defensive Moat)** — No competitor offers monetisation
   for third-party MCP tool authors. This creates powerful **Network Effects**: a rich library of tools attracts users, and a large user base attracts more tool authors. This "cold start" barrier provides a strong defensive moat against established platforms attempting to quickly clone the feature.
4. **Edge-native at ~£5/mo** — Infrastructure cost structure that competitors
   running on AWS/GCP cannot match

---

## 11. Three-Year Financial Forecasts

### 11.1 Key Assumptions

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Target personas | 16 | 32 | 64 |
| End-of-year paying customers | 228 | 720 | 1,800 |
| Blended ARPU ($/mo) | $42 | $48 | $55 |
| Blended ARPU (£/mo) | £33 | £38 | £43 |
| Monthly churn rate | 8% | 6% | 5% |
| Gross margin | 82% | 85% | 87% |
| Fixed opex (monthly avg) | £2,500 | £8,000 | £18,000 |
| Headcount | 1 | 3 | 6 |
| Exchange rate | £1 = $1.27 | £1 = $1.27 | £1 = $1.27 |

**Revenue assumptions:**

- Year 1 revenue is primarily platform subscriptions (Stream 1) with growing
  contributions from API access (Stream 2) and credit overages (Stream 3)
- App Builder service (Stream 4) contributes from Q2 Y1
- Marketplace revenue (Stream 5) begins Q3 Y1 at modest scale
- Annual billing discount (20%) is available but not modelled separately

**Cost assumptions:**

- Infrastructure: ~£5/mo (Cloudflare Workers Paid plan) scaling to ~£50/mo at
  1,800 customers
- Core tools: £200-450/mo (Claude Max, Sentry, Depot — per SUBSCRIPTIONS.md)
- Founder salary: £12,570/year (Y1, personal allowance), increasing with
  headcount in Y2-Y3
- Marketing spend scales with revenue: 25% of revenue in Y1, 20% in Y2, 15% in
  Y3
- Professional fees (accountant, legal): £3,000/year (Y1), increasing with
  complexity

### 11.2 Year 1 Profit & Loss — Monthly Detail (M1-M12)

| Month | Paying Customers | MRR (£) | Revenue (£) | COGS (£) | Gross Profit (£) | Opex (£) | EBIT (£) |
|-------|-----------------|---------|-------------|----------|-----------------|----------|----------|
| M1 | 5 | 165 | 165 | 30 | 135 | 2,200 | -2,065 |
| M2 | 12 | 396 | 396 | 71 | 325 | 2,200 | -1,875 |
| M3 | 22 | 726 | 726 | 131 | 595 | 2,300 | -1,705 |
| M4 | 35 | 1,155 | 1,155 | 208 | 947 | 2,300 | -1,353 |
| M5 | 55 | 1,815 | 1,815 | 327 | 1,488 | 2,400 | -912 |
| M6 | 80 | 2,640 | 2,640 | 475 | 2,165 | 2,500 | -335 |
| M7 | 110 | 3,630 | 3,630 | 653 | 2,977 | 2,600 | 377 |
| M8 | 140 | 4,900 | 4,900 | 882 | 4,018 | 2,700 | 1,318 |
| M9 | 160 | 5,600 | 5,600 | 1,008 | 4,592 | 2,800 | 1,792 |
| M10 | 185 | 6,475 | 6,475 | 1,166 | 5,310 | 2,800 | 2,510 |
| M11 | 210 | 7,350 | 7,350 | 1,323 | 6,027 | 2,900 | 3,127 |
| M12 | 228 | 7,980 | 7,980 | 1,436 | 6,544 | 3,000 | 3,544 |

| **Y1 Totals** | | | **£42,832** | **£7,710** | **£35,122** | **£30,700** | **£4,422** |

**Notes:**

- COGS = 18% of revenue (hosting, API costs, payment processing)
- Opex includes: founder salary (£1,048/mo), infrastructure (£200-450/mo),
  marketing, professional fees, contingency
- EBIT turns positive in M7 as revenue crosses the fixed cost base
- Y1 total revenue of ~£43K is conservative; the ROADMAP.md target of $85.5K
  (~£67K) includes UK tax benefits and assumes faster adoption

### 11.3 Year 2 Profit & Loss — Quarterly

| Quarter | Paying Customers (EoQ) | Revenue (£) | COGS (£) | Gross Profit (£) | Opex (£) | EBIT (£) |
|---------|----------------------|-------------|----------|-----------------|----------|----------|
| Q1 | 340 | 34,200 | 5,130 | 29,070 | 24,000 | 5,070 |
| Q2 | 460 | 49,400 | 7,410 | 41,990 | 24,000 | 17,990 |
| Q3 | 590 | 64,600 | 9,690 | 54,910 | 24,000 | 30,910 |
| Q4 | 720 | 82,080 | 12,312 | 69,768 | 24,000 | 45,768 |
| **Y2 Total** | | **£230,280** | **£34,542** | **£195,738** | **£96,000** | **£99,738** |

**Notes:**

- Headcount grows to 3 (founder + growth lead + customer success), driving opex
  increase to ~£8,000/mo average
- Blended ARPU rises to £38/mo as mix shifts toward Business and API add-ons
- Gross margin improves to 85% with scale efficiencies
- Churn reduces to 6% as product-market fit strengthens

### 11.4 Year 3 Profit & Loss — Quarterly

| Quarter | Paying Customers (EoQ) | Revenue (£) | COGS (£) | Gross Profit (£) | Opex (£) | EBIT (£) |
|---------|----------------------|-------------|----------|-----------------|----------|----------|
| Q1 | 1,050 | 121,800 | 15,834 | 105,966 | 54,000 | 51,966 |
| Q2 | 1,300 | 154,800 | 20,124 | 134,676 | 54,000 | 80,676 |
| Q3 | 1,550 | 193,500 | 25,155 | 168,345 | 54,000 | 114,345 |
| Q4 | 1,800 | 232,200 | 30,186 | 202,014 | 54,000 | 148,014 |
| **Y3 Total** | | **£702,300** | **£91,299** | **£611,001** | **£216,000** | **£395,001** |

**Notes:**

- Headcount grows to 6 (founder + 2 engineers + growth lead + CS lead + CS rep)
- Blended ARPU rises to £43/mo with Enterprise tier contribution
- Gross margin improves to 87%
- Monthly churn reduces to 5%
- Marketplace revenue share begins contributing meaningfully

### 11.5 Cash Flow Projection

| Period | Opening Cash (£) | SEIS Inflow (£) | Operating Cash Flow (£) | Closing Cash (£) |
|--------|-----------------|----------------|------------------------|------------------|
| Y1 Q1 | 0 | 250,000 | -5,645 | 244,355 |
| Y1 Q2 | 244,355 | 0 | -2,600 | 241,755 |
| Y1 Q3 | 241,755 | 0 | 5,487 | 247,242 |
| Y1 Q4 | 247,242 | 0 | 9,181 | 256,423 |
| **Y1 Total** | **0** | **250,000** | **£6,423** | **£256,423** |
| Y2 Q1 | 256,423 | 0 | 5,070 | 261,493 |
| Y2 Q2 | 261,493 | 0 | 17,990 | 279,483 |
| Y2 Q3 | 279,483 | 0 | 30,910 | 310,393 |
| Y2 Q4 | 310,393 | 0 | 45,768 | 356,161 |
| **Y2 Total** | **256,423** | **0** | **£99,738** | **£356,161** |
| Y3 Q1 | 356,161 | 0 | 51,966 | 408,127 |
| Y3 Q2 | 408,127 | 0 | 80,676 | 488,803 |
| Y3 Q3 | 488,803 | 0 | 114,345 | 603,148 |
| Y3 Q4 | 603,148 | 0 | 148,014 | 751,162 |
| **Y3 Total** | **356,161** | **0** | **£395,001** | **£751,162** |

**Key observations:**

- SEIS funds provide comfortable runway; the company never needs the full
  £250,000 to reach profitability
- Operating cash flow turns positive in Y1 Q3 (M7-M9)
- Y1 closing cash of ~£256K demonstrates capital efficiency — most of the SEIS
  raise remains as a strategic reserve
- Y3 closing cash of ~£751K positions the company for growth investment or EIS
  round

### 11.6 Balance Sheet — Year-End Summary

| Item | Y1 | Y2 | Y3 |
|------|-----|-----|-----|
| **Assets** | | | |
| Cash | £256,423 | £356,161 | £751,162 |
| Accounts Receivable | £2,000 | £8,000 | £25,000 |
| Prepaid Expenses | £1,000 | £2,000 | £3,000 |
| Fixed Assets (net) | £2,000 | £5,000 | £10,000 |
| **Total Assets** | **£261,423** | **£371,161** | **£789,162** |
| | | | |
| **Liabilities** | | | |
| Accounts Payable | £1,500 | £4,000 | £10,000 |
| Deferred Revenue | £3,000 | £12,000 | £35,000 |
| Corporation Tax Payable | £0 | £15,000 | £65,000 |
| **Total Liabilities** | **£4,500** | **£31,000** | **£110,000** |
| | | | |
| **Equity** | | | |
| Share Capital | £250,001 | £250,001 | £250,001 |
| Retained Earnings | £6,922 | £90,160 | £429,161 |
| **Total Equity** | **£256,923** | **£340,161** | **£679,162** |
| | | | |
| **Total L + E** | **£261,423** | **£371,161** | **£789,162** |

### 11.7 Break-Even Analysis

| Variable | Value |
|----------|-------|
| Monthly fixed costs (Y1 avg) | £2,558 |
| Blended ARPU | £33/mo |
| Gross margin | 82% |
| Contribution per customer | £27.06/mo |
| **Break-even customers** | **~95** |
| **Break-even month** | **M7** |

The company reaches monthly operating break-even (revenue covers all monthly
costs) at approximately 95 paying customers, which the model projects for M7.
This is conservative — it assumes no one-time revenue (App Builder, credit
packs) and uses the Year 1 average fixed cost, not the lower early-month costs.

Cash break-even (cumulative revenue exceeds cumulative costs, excluding SEIS
funds) occurs between M10-M12.

### 11.8 Sensitivity Analysis — Three Scenarios

| Scenario | Assumption | Y1 Revenue | Break-Even | Y3 ARR | Y3 EBIT |
|----------|-----------|-----------|------------|--------|---------|
| **Worst (50%)** | Half the customer growth, 10% churn | £21,400 | M14 | £351,150 | £135,150 |
| **Base** | As modelled | £42,832 | M7 | £702,300 | £395,001 |
| **Best (150%)** | 1.5x customer growth, 4% churn | £64,250 | M5 | £1,053,450 | £621,450 |

**Worst-case viability**: Even at 50% of projected growth, the company remains
viable with £250,000 SEIS funding. The worst case reaches break-even in M14 and
has over £200,000 cash remaining at that point. The SEIS investment is not at
risk of total loss in any modelled scenario, though returns are significantly
reduced in the worst case.

**Best-case upside**: At 150% growth, the company reaches £1M+ ARR in Year 3 and
generates over £620,000 EBIT, demonstrating significant upside potential for
SEIS investors.

---

## 12. Use of SEIS Investment

### 12.1 Raise Amount

Maximum £250,000 under SEIS rules (Finance Act 2023 limits). The full amount
will be deployed for qualifying trade purposes over 18-24 months.

### 12.2 Allocation

| Category | % | Amount (£) | Purpose |
|----------|---|-----------|---------|
| Product Development | 45% | £112,500 | Engineering contractors, software tools, development infrastructure |
| Infrastructure | 12% | £30,000 | Cloudflare services, monitoring, CI/CD, scaling costs |
| Marketing & Sales | 23% | £57,500 | Digital marketing, content, developer relations, events |
| Customer Support | 8% | £20,000 | Support tooling, documentation, onboarding systems |
| Working Capital | 7% | £17,500 | Professional fees (legal, accounting), insurance, overheads |
| Contingency | 5% | £12,500 | Unforeseen costs, market changes |
| **Total** | **100%** | **£250,000** | |

### 12.3 Qualifying Activity Confirmation

- 100% of funds will be deployed for the purposes of the qualifying trade
- No funds will be used for non-qualifying purposes (property, financial
  instruments, etc.)
- The company expects to deploy at least 70% of SEIS funds before seeking any
  EIS investment (as required by ITA 2007, s.257DK)
- Expenditure will be incurred within 3 years of the share issue

### 12.4 Deployment Timeline

| Period | Cumulative Spend | Key Deployments |
|--------|-----------------|-----------------|
| Months 1-6 | £80,000 (32%) | Product hardening, Stripe completion, marketing launch |
| Months 7-12 | £160,000 (64%) | First hires (growth + CS), paid acquisition, WhatsApp/Telegram |
| Months 13-18 | £230,000 (92%) | Team scaling, marketplace launch, enterprise features |
| Months 19-24 | £250,000 (100%) | Contingency, growth investment |

---

## 13. Risk Factors

### 13.1 Market Risk — MCP Adoption

**Risk**: The Model Context Protocol may not achieve widespread adoption,
limiting the addressable market.

**Mitigation**: MCP is backed by Anthropic and being adopted by major AI
providers (OpenAI, Google). The platform's tools work independently of MCP — they
provide value through any access channel. MCP adoption accelerates growth but is
not an existential dependency.

**Severity**: Medium | **Likelihood**: Low

### 13.2 Competition Risk

**Risk**: Established platforms (Vercel, Replit) or new entrants could add
managed MCP registries.

**Mitigation**: First-mover advantage in managed MCP hosting. Network effects
from marketplace (tool authors attract users, users attract tool authors).
Switching costs from configuration, toolset aliases, and BYOK key management.
Cloudflare edge infrastructure provides cost advantage that AWS/GCP-based
competitors cannot easily replicate.

**Severity**: High | **Likelihood**: Medium

### 13.3 Execution Risk — Solo Founder

**Risk**: Single founder creates key-person dependency and limits execution
bandwidth.

**Mitigation**: AI-assisted development (Claude Code) provides 5-10x
productivity multiplier — the entire platform was built solo. First two hires
(growth lead, customer success) are planned for Y1 H2. The SEIS investment
provides runway to build the team without revenue pressure.

**Severity**: Medium | **Likelihood**: Medium

### 13.4 Revenue Assumptions

**Risk**: Customer acquisition and revenue growth may be slower than projected.

**Mitigation**: Sensitivity analysis (Section 11.8) shows the company remains
viable at 50% of projected growth. The £250,000 SEIS investment provides 24+
months of runway even in the worst case. Conservative projections already assume
pre-revenue status and gradual ramp.

**Severity**: Medium | **Likelihood**: Medium

### 13.5 Technology Risk

**Risk**: Platform dependence on Cloudflare Workers; service disruptions or
pricing changes could impact operations.

**Mitigation**: Cloudflare Workers is a mature, enterprise-grade platform with
99.99% SLA. The platform architecture uses standard web APIs (fetch, WebSocket)
and could be migrated to alternative edge runtimes (Deno Deploy, Fastly Compute)
if necessary. Infrastructure cost is ~£5/month, so even significant price
increases would have minimal impact.

**Severity**: Low | **Likelihood**: Low

### 13.6 Regulatory Risk

**Risk**: Changes to data protection regulation (GDPR, UK DPA 2018) or AI
regulation could impose compliance costs.

**Mitigation**: Platform processes minimal personal data. Cloudflare provides
DPA coverage (v6.3, signed). AI features use third-party providers (Anthropic,
Google) who maintain their own regulatory compliance. The company will monitor
the AI Safety Act and EU AI Act for relevant requirements.

**Severity**: Low | **Likelihood**: Low

---

## 14. Exit Horizons

The company is structured to target a high-multiple exit within a 5-7 year timeframe, providing significant returns for SEIS investors. Anticipated exit paths include:

1. **Strategic Acquisition:** As MCP becomes a standard developer protocol, the platform becomes an attractive acquisition target for broader dev-tool ecosystems (e.g., Vercel, Netlify, Atlassian, Postman) looking to rapidly acquire a managed registry and active AI developer community.
2. **Series A/B Secondary Sale:** Upon reaching significant traction milestones (£2M+ ARR), early SEIS investors will have opportunities to realize returns via secondary share sales to institutional VC funds participating in later funding rounds.
3. **Private Equity Buyout:** If the company continues bootstrapping on strong operating cash flow and reaches £5M+ ARR with high margins, a buyout by tech-focused Private Equity represents a highly lucrative secondary exit path.

---

## Appendix A: Per-Persona Detailed Unit Economics

### Segment A: Builders

| Metric | A1: AI Agent Dev | A2: Indie Hacker | A3: DevOps Eng | A4: OSS Author |
|--------|-----------------|-----------------|----------------|----------------|
| Target Tier | API PRO $49 | PRO $29 | BIZ $99 | Marketplace |
| Monthly Revenue | £38.58 | £22.83 | £77.95 | £20 (avg share) |
| CAC (mid) | £20 | £45 | £150 | £10 |
| Gross Margin | 82% | 82% | 82% | 95% |
| Contribution/mo | £31.64 | £18.72 | £63.92 | £19 |
| Payback (months) | 0.6 | 2.4 | 2.3 | 0.5 |
| 12-mo LTV | £379.68 | £224.64 | £767.04 | £228 |
| 24-mo LTV | £759.36 | £449.28 | £1,534.08 | £456 |
| 36-mo LTV | £1,139.04 | £673.92 | £2,301.12 | £684 |
| Churn-adj 24-mo LTV | £588 | £348 | £1,188 | £240 |

### Segment B: Operators

| Metric | B1: Startup CTO | B2: SMB Owner | B3: QA Lead | B4: Mktg Mgr |
|--------|-----------------|---------------|-------------|---------------|
| Target Tier | BIZ $99 | PRO + Service | BIZ $99 | PRO→BIZ |
| Monthly Revenue | £77.95 | £22.83 + £1,997 | £77.95 | £22.83-77.95 |
| CAC (mid) | £130 | £90 | £115 | £105 |
| Gross Margin | 82% | 82% (sub) / 65% (svc) | 82% | 82% |
| Contribution/mo | £63.92 | £18.72 | £63.92 | £18.72-63.92 |
| Payback (months) | 2.0 | 1.5 (with service) | 1.8 | 2.0-5.6 |
| Churn-adj 24-mo LTV | £1,188 | £348-2,345 | £1,188 | £348-1,188 |

### Segment C: Creators

| Metric | C1: Blogger | C2: Educator | C3: Designer | C4: Chess |
|--------|-------------|--------------|--------------|-----------|
| Target Tier | PRO $29 | PRO $29 | PRO + credits | FREE→PRO |
| Monthly Revenue | £22.83 | £22.83 | £27-30 | £0-22.83 |
| CAC (mid) | £45 | £60 | £60 | £12 |
| Gross Margin | 82% | 82% | 82% | 82% |
| Contribution/mo | £18.72 | £18.72 | £22-25 | £0-18.72 |
| Payback (months) | 2.4 | 3.2 | 2.4-2.7 | 0.6-∞ |
| Churn-adj 24-mo LTV | £348 | £348 | £348-528 | £87-348 |

### Segment D: Scalers

| Metric | D1: AI Agency | D2: Freelance Dev | D3: Enterprise | D4: Education |
|--------|---------------|-------------------|----------------|---------------|
| Target Tier | BIZ+SCALE | PRO ×3-5 | ENTERPRISE | BIZ→ENT |
| Monthly Revenue | £195.28 | £68.50-114.17 | £500+ | £99-500 |
| CAC (mid) | £225 | £60 | £1,250 | £350 |
| Gross Margin | 85% | 82% | 87% | 85% |
| Contribution/mo | £165.99 | £56.17-93.62 | £435+ | £84.15-425 |
| Payback (months) | 1.4 | 0.6-1.1 | 2.9 | 0.8-4.2 |
| Churn-adj 24-mo LTV | £5,940 | £1,044-1,740 | £12,000 | £3,564 |

---

## Appendix B: Revenue Model by Segment with Conversion Funnels

### Conversion Funnel Targets (Y1)

| Stage | Builders (A) | Operators (B) | Creators (C) | Scalers (D) |
|-------|-------------|---------------|--------------|-------------|
| Awareness (visitors) | 10,000 | 3,000 | 5,000 | 1,000 |
| Signup (free accounts) | 1,500 (15%) | 300 (10%) | 600 (12%) | 80 (8%) |
| Activation (first tool call) | 900 (60%) | 150 (50%) | 300 (50%) | 50 (63%) |
| Free-to-Paid conversion | 90 (10%) | 30 (20%) | 36 (12%) | 20 (40%) |
| 12-mo retained | 63 (70%) | 24 (80%) | 25 (70%) | 18 (90%) |

### Revenue by Segment (Y1)

| Segment | Paying Customers (Y1 avg) | Blended ARPU (£/mo) | Y1 Revenue (£) | % of Total |
|---------|--------------------------|---------------------|----------------|------------|
| Builders (A) | 50 | £28 | £16,800 | 39% |
| Operators (B) | 20 | £45 | £10,800 | 25% |
| Creators (C) | 25 | £20 | £6,000 | 14% |
| Scalers (D) | 12 | £130 | £18,720 | 44% |

*Note: Percentages exceed 100% because Scaler segment average includes multi-workspace and add-on revenue. Totals are approximate and directional.*

---

## Appendix C: Monthly Cash Flow Detail (Year 1)

| Month | Revenue | COGS | Gross Profit | Opex | EBIT | SEIS Inflow | Net Cash Flow | Cumulative Cash |
|-------|---------|------|-------------|------|------|-------------|---------------|-----------------|
| M1 | 165 | 30 | 135 | 2,200 | -2,065 | 250,000 | 247,935 | 247,935 |
| M2 | 396 | 71 | 325 | 2,200 | -1,875 | 0 | -1,875 | 246,060 |
| M3 | 726 | 131 | 595 | 2,300 | -1,705 | 0 | -1,705 | 244,355 |
| M4 | 1,155 | 208 | 947 | 2,300 | -1,353 | 0 | -1,353 | 243,002 |
| M5 | 1,815 | 327 | 1,488 | 2,400 | -912 | 0 | -912 | 242,090 |
| M6 | 2,640 | 475 | 2,165 | 2,500 | -335 | 0 | -335 | 241,755 |
| M7 | 3,630 | 653 | 2,977 | 2,600 | 377 | 0 | 377 | 242,132 |
| M8 | 4,900 | 882 | 4,018 | 2,700 | 1,318 | 0 | 1,318 | 243,450 |
| M9 | 5,600 | 1,008 | 4,592 | 2,800 | 1,792 | 0 | 1,792 | 245,242 |
| M10 | 6,475 | 1,166 | 5,310 | 2,800 | 2,510 | 0 | 2,510 | 247,752 |
| M11 | 7,350 | 1,323 | 6,027 | 2,900 | 3,127 | 0 | 3,127 | 250,879 |
| M12 | 7,980 | 1,436 | 6,544 | 3,000 | 3,544 | 0 | 3,544 | 254,423 |

**Key insight**: The company barely touches the SEIS investment. Peak cash draw
is ~£8,245 (M1-M6 cumulative operating losses), which is 3.3% of the £250,000
raise. This is by design — the SEIS funds provide strategic reserve for
aggressive growth investment in Y2 (hiring, marketing) and protection against
downside scenarios.

---

## Appendix D: Tool Capability Map by Persona

| Tool Category | A1 | A2 | A3 | A4 | B1 | B2 | B3 | B4 | C1 | C2 | C3 | C4 | D1 | D2 | D3 | D4 |
|---------------|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|:--:|
| spike-cli | ** | * | ** | * | * | | | | | | | | ** | * | * | |
| MCP API access | ** | | ** | | * | | | | | | | | ** | | ** | |
| Code editor | * | ** | | | ** | | | | ** | * | | | * | ** | | * |
| Image studio | * | * | | | | ** | | ** | * | | ** | | * | | | |
| QA Studio | | | * | | ** | | ** | | | | | | * | | * | |
| Chess Arena | * | | | | | | | | | | | ** | | | | |
| State Machine | * | | * | | * | | | | | | | | * | | | |
| Deployments | * | ** | ** | | ** | * | | | | | | | ** | ** | ** | |
| Team mgmt | | | ** | | ** | | * | | | | | | ** | | ** | * |
| Marketplace | | | | ** | | | | | | | | | * | | | |
| LearnIt | | | | | | | | | | ** | | | | | | ** |
| CleanSweep | | | | | | * | | | | | | | | | | |
| Career Nav | | * | | | | * | | | | * | | | | | | * |

`**` = Primary tool, `*` = Secondary tool

---

## Related Documents

| Document | Description |
|----------|-------------|
| [SEIS_ADVANCE_ASSURANCE.md](../legal/SEIS_ADVANCE_ASSURANCE.md) | SEIS eligibility, submission guide, risks |
| [MARKETING_PERSONAS.md](./MARKETING_PERSONAS.md) | Detailed 16-persona profiles with messaging |
| [SUBSCRIPTIONS.md](./SUBSCRIPTIONS.md) | Infrastructure costs and provider details |
| [VALUATION_ANALYSIS.md](./VALUATION_ANALYSIS.md) | 8-method valuation framework |
| [ROADMAP.md](./ROADMAP.md) | Product development roadmap |
| [PLG_STRATEGY.md](./PLG_STRATEGY.md) | Product-led growth tactics |
| [PITCH_DECK_OUTLINE.md](./PITCH_DECK_OUTLINE.md) | Accelerator pitch structure |
| [BUSINESS_STRUCTURE.md](./BUSINESS_STRUCTURE.md) | Company formation details |

---

*Document Version: 1.0*
*Prepared: March 2026*
*Next Review: When paying customers exceed 50, or June 2026, whichever comes first*
