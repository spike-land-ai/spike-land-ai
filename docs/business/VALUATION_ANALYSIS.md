# Market Valuation Analysis: SPIKE LAND LTD

> **Company**: SPIKE LAND LTD (UK Company #16906682) **Date**: 19 February 2026
> **Classification**: Confidential — For Internal & Investor Use Only **Stage**:
> Pre-Revenue, Production-Ready (Dual-Product) **Prepared By**: Multi-Method
> Analytical Framework (8 Independent Valuations) **Currency**: GBP Primary (USD
> Secondary at £1 = $1.27)

---

## Executive Summary

This document presents eight independent valuation analyses of SPIKE LAND LTD, a
UK-incorporated AI-powered platform company offering a managed deployment
platform with an MCP registry. The platform exposes 533+ MCP tools through
multiple interfaces — web dashboard, spike-cli (CLI), and upcoming
WhatsApp/Telegram channels — a combination no competitor offers.

Each valuation method is presented across three scenarios (Pessimistic,
Realistic, Optimistic) and weighted according to its reliability at the
pre-revenue stage.

### Scenario Definitions

|                        | Pessimistic                                                                                 | Realistic                                                                                                  | Optimistic                                                                                                 |
| ---------------------- | ------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| **Thesis**             | Slow adoption, solo-founder burnout, incumbents add AI features, spike-cli gets no traction | Moderate traction, SEIS seed round closes, 5K-10K workspaces by Y3, spike-cli becomes niche developer tool | Product-market fit by Q3 2026, spike-cli creates viral developer funnel, 15K+ workspaces, Series A by 2027 |
| **Y1 Revenue**         | $30-50K                                                                                     | $100K                                                                                                      | $150K+                                                                                                     |
| **Y3 ARR**             | $1-2M                                                                                       | $5-7M                                                                                                      | $10M+                                                                                                      |
| **Probability Weight** | 20%                                                                                         | 50%                                                                                                        | 30%                                                                                                        |

### Valuation Summary

| # | Method                  | Confidence  | Pessimistic (GBP) | Realistic (GBP) | Optimistic (GBP) | Weight |
| - | ----------------------- | ----------- | ----------------- | --------------- | ---------------- | ------ |
| 1 | SaaS Revenue Multiple   | Low-Medium  | £0.05M — £1.2M    | £0.18M — £10.5M | £0.29M — £20.0M  | 10%    |
| 2 | Discounted Cash Flow    | Low         | £3.5M — £5.8M     | £6.1M — £10.2M  | £9.8M — £16.5M   | 10%    |
| 3 | Venture Capital Method  | Medium      | £1.5M — £2.5M     | £3.5M — £5.5M   | £5.5M — £8.5M    | 15%    |
| 4 | Berkus Method           | Medium-High | £0.87M            | £1.28M          | £1.58M           | 20%    |
| 5 | Scorecard Method        | Medium      | £2.5M — £3.1M     | £3.1M — £3.8M   | £3.6M — £4.5M    | 15%    |
| 6 | Cost-to-Replicate       | Medium-High | £6.5M — £10.0M    | £7.0M — £11.0M  | £7.5M — £12.0M   | 15%    |
| 7 | Comparable Transactions | Low-Medium  | £1.5M — £2.8M     | £2.6M — £4.8M   | £3.5M — £6.5M    | 5%     |
| 8 | First Chicago Method    | Medium      | £0.5M — £1.5M     | £2.5M — £4.0M   | £5.0M — £7.5M    | 10%    |

### Weighted Valuation

| Metric                          | GBP               | USD               |
| ------------------------------- | ----------------- | ----------------- |
| **Weighted Low**                | **£3.1M**         | **$3.9M**         |
| **Weighted Midpoint**           | **£4.6M**         | **$5.8M**         |
| **Weighted High**               | **£7.5M**         | **$9.5M**         |
| **Recommended Pre-Money Range** | **£3.5M — £5.5M** | **$4.4M — $7.0M** |

---

## Company Profile & Key Metrics

### Company Details

| Field                 | Value                                                                                                                            |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| **Legal Name**        | SPIKE LAND LTD                                                                                                                   |
| **Company Number**    | 16906682                                                                                                                         |
| **Incorporation**     | 12 December 2025                                                                                                                 |
| **Jurisdiction**      | England & Wales                                                                                                                  |
| **SIC Codes**         | 62090 (IT Consultancy), 63120 (Web Portals)                                                                                      |
| **Director**          | Founder (100% Shareholder)                                                                                                  |
| **Registered Office** | Brighton, UK                                                                                                                     |
| **Products**          | **Spike Land** — Managed Deployment Platform with MCP Registry; **spike-cli** — MCP Multiplexer CLI for developers and AI agents |

### Verified Codebase Metrics

| Metric                           | Value                                                       |
| -------------------------------- | ----------------------------------------------------------- |
| TypeScript lines (src/)          | 844,494                                                     |
| TypeScript lines (src/ packages) | 99,229                                                      |
| **Total TypeScript lines**       | **~943,723**                                                |
| Prisma database models           | 233 (5,807-line schema)                                     |
| Page routes (page.tsx)           | 204                                                         |
| API route files (route.ts)       | 393                                                         |
| MCP tool files (non-test)        | 147                                                         |
| MCP test files                   | 150 (102% file coverage — some tools have multiple tests)   |
| Store apps                       | 18 (180 declared MCP tools)                                 |
| First-party app directories      | 19                                                          |
| Storybook pages                  | 46                                                          |
| Lib modules                      | 104                                                         |
| Monorepo packages                | 9 (including spike-cli)                                     |
| spike-cli source files           | 46                                                          |
| spike-cli subsystems             | Auth, Commands, Chat, Config, Multiplexer, Shell, Transport |
| Git commits                      | 1,955+                                                      |

### Multi-Channel Architecture

The platform provides the same capabilities through multiple access channels. No
competitor in the deployment platform or MCP tooling space offers this breadth
of access.

| Capability         | Web Dashboard       | spike-cli (CLI)                          | WhatsApp/Telegram (Planned) |
| ------------------ | ------------------- | ---------------------------------------- | --------------------------- |
| Target user        | All users           | Developers, AI agents                    | Mobile-first users          |
| Interface          | Web dashboard       | Interactive shell REPL                   | Chat interface              |
| MCP tools          | 533+                | 533+ (unified multiplexer)               | Core subset                 |
| AI integration     | Built-in Spike chat | Claude API client, chat loop             | Spike AI assistant          |
| Distribution       | Web app, Vercel     | npm package (`@spike-land-ai/spike-cli`) | WhatsApp/Telegram bots      |
| Key differentiator | Visual management   | Multi-server aggregation, tool aliasing  | Instant mobile access       |

### Financial Projections (Three Scenarios)

| Metric                    | Pessimistic                   | Realistic | Optimistic               |
| ------------------------- | ----------------------------- | --------- | ------------------------ |
| **Year 1 Revenue (2026)** | $30-50K                       | $100K     | $150K+                   |
| **Year 3 ARR (2028)**     | $1-2M                         | $5-7M     | $10M+                    |
| **Year 5 ARR (2030)**     | $3-5M                         | $15-20M   | $30M+                    |
| **TAM**                   | $1T+                          | $1T+      | $1T+                     |
| **SAM**                   | $100B+                        | $100B+    | $100B+                   |
| **SOM**                   | $1B                           | $5B       | $10B+                    |
| **Gross Margin**          | 80%+                          | 85%+      | 85%+                     |
| **Pricing**               | FREE / $29 PRO / $99 BUSINESS | Same      | Same + Enterprise custom |

### Revenue Streams

| Stream                  | Pessimistic Y1 | Realistic Y1 | Optimistic Y1 | Description                             |
| ----------------------- | -------------- | ------------ | ------------- | --------------------------------------- |
| Workspace Subscriptions | $10K           | $35K         | $55K          | FREE/PRO/BUSINESS tiers                 |
| MCP API Access          | $5K            | $15K         | $25K          | Programmatic agent access (unique)      |
| spike-cli Pro           | $2K            | $10K         | $20K          | CLI power features, premium MCP servers |
| Agency SCALE Tier       | $3K            | $15K         | $25K          | Multi-workspace volume pricing          |
| Autopilot Add-on        | $2K            | $7K          | $12K          | Outcome-based AI automation             |
| Credit Overages         | $3K            | $8K          | $13K          | Usage-based overage billing             |
| UK Tax Benefits         | $5K            | $10K         | $10K          | R&D credits, SEIS/EIS                   |
| **Total**               | **$30-50K**    | **$100K**    | **$150K+**    |                                         |

### Unit Economics

| Persona                | CAC      | LTV          | LTV:CAC    | Payback    |
| ---------------------- | -------- | ------------ | ---------- | ---------- |
| Solo Content Creator   | £40-80   | £348-1,044   | 8.7-13.1x  | 1-3 months |
| Small Business Manager | £100-200 | £1,188-3,564 | 11.9-17.8x | 1-2 months |
| Freelance SMM          | £60-120  | £522-1,566   | 8.7-13.1x  | 2-4 months |
| Developer (spike-cli)  | £10-30   | £174-870     | 17.4-29.0x | <1 month   |

---

## Valuation Methods

### 1. SaaS Revenue Multiple Analysis

The SaaS revenue multiple approach values SPIKE LAND based on projected Annual
Recurring Revenue (ARR) benchmarked against comparable social media management
platforms. This method reflects market sentiment toward recurring revenue
businesses but requires significant discount factors due to the company's
pre-revenue stage.

#### Comparable Company Benchmarks

| Company             | Stage           | ARR Multiple | Notes                                        |
| ------------------- | --------------- | ------------ | -------------------------------------------- |
| **Sprout Social**   | Public          | 8-10x        | Enterprise-focused, $350M+ ARR               |
| **HubSpot**         | Public          | 12-15x       | Multi-product platform, $2B+ ARR             |
| **Later**           | Acquired (2022) | 5-7x         | SMB Instagram scheduler, ~$30M ARR at exit   |
| **Buffer**          | Private         | 4-6x         | Established SMB tool, transparent financials |
| **SMB SaaS Median** | —               | 6-8x         | Industry benchmark for mature companies      |

#### Stage-Adjusted Multiples

Given SPIKE LAND's pre-revenue status, we apply a **70% discount** to mature
SaaS multiples to account for execution risk, customer acquisition uncertainty,
and lack of proven retention metrics. This yields a working range of **1.8x -
3.0x ARR** for valuation purposes.

#### Valuation by Scenario

**Pessimistic** (Y1: $30-50K ARR; Y3: $1-2M ARR)

| Basis  | ARR (GBP)      | Multiple | Valuation (GBP) | Valuation (USD) |
| ------ | -------------- | -------- | --------------- | --------------- |
| Y1 ARR | £31K ($40K)    | 1.5x     | **£47K**        | **$60K**        |
| Y3 ARR | £1.18M ($1.5M) | 1.0x     | **£1.18M**      | **$1.5M**       |

**Realistic** (Y1: $100K ARR; Y3: $5-7M ARR)

| Basis  | ARR (GBP)      | Multiple | Valuation (GBP) | Valuation (USD) |
| ------ | -------------- | -------- | --------------- | --------------- |
| Y1 ARR | £78.7K ($100K) | 2.4x     | **£189K**       | **$240K**       |
| Y3 ARR | £4.72M ($6.0M) | 2.2x     | **£10.4M**      | **$13.2M**      |

**Optimistic** (Y1: $150K+ ARR; Y3: $10M+ ARR)

| Basis  | ARR (GBP)       | Multiple | Valuation (GBP) | Valuation (USD) |
| ------ | --------------- | -------- | --------------- | --------------- |
| Y1 ARR | £118K ($150K)   | 2.4x     | **£284K**       | **$360K**       |
| Y3 ARR | £7.87M ($10.0M) | 2.5x     | **£19.7M**      | **$25.0M**      |

#### Key Assumptions & Limitations

- Multiples derived from public comps with proven business models; SPIKE LAND's
  multi-channel strategy (web dashboard + spike-cli + App Store + MCP API) may
  command premium once validated
- The dual-interface approach (GUI + CLI) widens addressable market beyond
  traditional social media SaaS
- **Confidence Level: LOW-MEDIUM** — forward-looking revenue multiples are
  highly sensitive to actual go-to-market execution

---

### 2. Discounted Cash Flow (DCF) Analysis

**Method:** Five-year free cash flow projection with terminal value calculated
using Gordon Growth Model. The analysis assumes 85% gross margin (typical for
SaaS platforms), declining operating expense ratios as the business scales, and
a 30-40% WACC reflecting early-stage technology venture risk.

#### Realistic Scenario — 5-Year Free Cash Flow Projection

| Year | Revenue         | Gross Profit (85%) | OpEx (% Rev) | FCF Margin | Free Cash Flow | Discount Factor (35%) | PV of FCF |
| ---- | --------------- | ------------------ | ------------ | ---------- | -------------- | --------------------- | --------- |
| 2026 | £78.7K ($100K)  | £66.9K ($85K)      | 120%         | -35%       | -£27.6K        | 0.741                 | -£20.4K   |
| 2027 | £1.18M ($1.50M) | £1.00M ($1.28M)    | 65%          | -20%       | -£236K         | 0.549                 | -£129K    |
| 2028 | £4.72M ($6.00M) | £4.01M ($5.10M)    | 50%          | 15%        | £708K          | 0.406                 | £288K     |
| 2029 | £9.45M ($12.0M) | £8.03M ($10.2M)    | 45%          | 25%        | £2.36M         | 0.301                 | £711K     |
| 2030 | £15.7M ($20.0M) | £13.4M ($17.0M)    | 42%          | 35%        | £5.51M         | 0.223                 | £1.23M    |

#### Terminal Value Calculation (Gordon Growth Model)

- Year 5 FCF: £5.51M ($7.0M)
- Terminal growth rate: 4%
- Terminal value = FCF5 x (1 + g) / (WACC - g) = £5.51M x 1.04 / (0.35 - 0.04) =
  **£18.5M ($23.5M)**
- PV of terminal value = £18.5M x 0.223 = **£4.12M ($5.23M)**

#### Enterprise Value by Scenario

| Scenario        | Revenue Assumptions           | WACC | Enterprise Value (GBP) | Enterprise Value (USD) |
| --------------- | ----------------------------- | ---- | ---------------------- | ---------------------- |
| **Pessimistic** | Y1: $40K, Y3: $1.5M, Y5: $4M  | 40%  | £3.5M — £5.8M          | $4.4M — $7.4M          |
| **Realistic**   | Y1: $100K, Y3: $6M, Y5: $20M  | 35%  | £6.1M — £10.2M         | $7.8M — $13.0M         |
| **Optimistic**  | Y1: $150K, Y3: $10M, Y5: $30M | 30%  | £9.8M — £16.5M         | $12.4M — $21.0M        |

#### Sensitivity to WACC (Realistic Scenario)

| WACC | Enterprise Value (GBP) | Enterprise Value (USD) |
| ---- | ---------------------- | ---------------------- |
| 30%  | £10.2M                 | $13.0M                 |
| 35%  | £7.78M                 | $9.88M                 |
| 40%  | £6.12M                 | $7.77M                 |

**Confidence Level:** LOW. DCF valuation at pre-revenue stage is highly
sensitive to growth assumptions, profitability timelines, and discount rate
selection. The pessimistic scenario reduces the terminal value substantially,
while the optimistic scenario's spike-cli-fuelled developer funnel accelerates
cash flows forward. This method should be triangulated with asset-based and
market-based approaches.

---

### 3. Venture Capital Method

The Venture Capital Method works backwards from projected exit values through
expected dilution to determine current pre-money valuation. This approach
reflects how institutional investors price early-stage deals based on target
returns (20-30x for pre-seed/seed rounds).

#### Exit Value Projections (Year 5-7)

| Scenario        | Y5-7 ARR | Exit Multiple | Exit Value (GBP) | Exit Value (USD) |
| --------------- | -------- | ------------- | ---------------- | ---------------- |
| **Pessimistic** | $4-5M    | 5x            | £16-20M          | $20-25M          |
| **Realistic**   | $20-25M  | 8x            | £126-157M        | $160-200M        |
| **Optimistic**  | $30-35M  | 12x           | £283-331M        | $360-420M        |

_Exit multiples based on social media SaaS M&A comps (Later acquired ~5-7x ARR,
Hootsuite valued ~12x ARR). Optimistic scenario reflects spike-cli creating an
additional developer-tools exit premium._

#### Dilution Schedule

| Round       | Timing  | Dilution | Cumulative Ownership |
| ----------- | ------- | -------- | -------------------- |
| **Current** | 2026    | 0%       | 100%                 |
| Seed        | 2026-27 | 18%      | 82%                  |
| Series A    | 2028    | 22%      | 64%                  |
| Series B    | 2030    | 18%      | 52%                  |

**Founders' exit ownership:** 52% of exit value

#### Implied Pre-Money Valuation

| Scenario        | Exit Value (GBP) | Founder Share | Target Return | **Implied Pre-Money** |
| --------------- | ---------------- | ------------- | ------------- | --------------------- |
| **Pessimistic** | £18M             | £9.4M         | 5x            | **£1.9M** ($2.4M)     |
| **Realistic**   | £142M            | £74M          | 20x           | **£3.7M** ($4.7M)     |
| **Optimistic**  | £307M            | £160M         | 25x           | **£6.4M** ($8.1M)     |

spike-cli adds materially to the exit value story: a multi-channel platform
appeals to both strategic acquirers seeking developer ecosystems and financial
buyers valuing multiple revenue vectors. No comparable deployment platform exit
has included an MCP-native CLI/agent interface, creating potential for premium
acquisition multiples.

#### SEIS/EIS Adjusted Pricing

UK investors benefit from 50% income tax relief (SEIS) + capital gains
exemption, effectively reducing their cost basis by ~50-60%. This supports
premium valuations:

- **Market rate pre-money:** £3.7M — £5.5M
- **SEIS/EIS-adjusted effective cost:** £1.9M — £2.8M
- **Investor IRR equivalent:** 35-40% (vs. 25x target)

**Recommended valuation: £4.0M — £6.0M pre-money** balances VC return
requirements with SEIS/EIS benefits while leaving room for milestone-based
upward revision post-launch.

**Confidence Level:** MEDIUM. Standard VC pricing methodology well-suited for
this stage. The pessimistic scenario reflects acqui-hire/IP-sale exits; the
optimistic scenario reflects spike-cli creating a developer-ecosystem premium.

---

### 4. Berkus Method

The Berkus Method evaluates pre-revenue startups across five dimensions, each
worth up to $500K (£394K), for a maximum $2.5M (£1.97M) pre-money valuation.
This approach is particularly well-suited for SPIKE LAND's current pre-revenue
stage.

#### Scoring by Scenario

**Pessimistic Scenario**

| Dimension               | Score (USD)    | Score (GBP)  | Justification                                                          |
| ----------------------- | -------------- | ------------ | ---------------------------------------------------------------------- |
| Sound Idea              | $350,000       | £275,600     | Strong TAM but incumbents adding AI features erodes uniqueness         |
| Prototype               | $400,000       | £315,000     | Production-ready platform, but without traction it remains unvalidated |
| Management Team         | $175,000       | £137,800     | Solo founder burnout risk weighs heavily                               |
| Strategic Relationships | $100,000       | £78,700      | Technical partnerships only; no distribution                           |
| Product Rollout         | $75,000        | £59,100      | Zero revenue, limited testing                                          |
| **Total**               | **$1,100,000** | **£866,100** | **44% of maximum**                                                     |

**Realistic Scenario**

| Dimension               | Score (USD)    | Score (GBP)    | Justification                                                                                                                                                     |
| ----------------------- | -------------- | -------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Sound Idea              | $475,000       | £374,000       | Dual-interface (web dashboard + spike-cli) addresses both human and agent markets — genuinely novel positioning in $20B+ TAM                                      |
| Prototype               | $500,000       | £393,700       | Maximum score: 943K+ LOC, 233 DB models, 147 MCP tools (150 test files), 19 first-party apps, 46 storybook pages, 46-file spike-cli with multiplexer architecture |
| Management Team         | $250,000       | £196,900       | Strong credentials (12+ years, Virgin Media O2, Investec), but solo founder risk remains key vulnerability                                                        |
| Strategic Relationships | $200,000       | £157,500       | Stripe, Cloudflare, Anthropic MCP partnerships; SEIS/EIS access; npm distribution for spike-cli                                                                   |
| Product Rollout         | $100,000       | £78,700        | Pre-revenue with Stripe 75% integrated; spike-cli publishable to npm                                                                                              |
| **Total**               | **$1,525,000** | **£1,200,800** | **61% of maximum**                                                                                                                                                |

**Optimistic Scenario**

| Dimension               | Score (USD)    | Score (GBP)    | Justification                                                                            |
| ----------------------- | -------------- | -------------- | ---------------------------------------------------------------------------------------- |
| Sound Idea              | $500,000       | £393,700       | Maximum — dual-interface moat validated by early traction, developer viral loop emerging |
| Prototype               | $500,000       | £393,700       | Maximum — same production-ready assets plus spike-cli creating developer adoption        |
| Management Team         | $300,000       | £236,200       | First hire imminent, advisory board forming                                              |
| Strategic Relationships | $300,000       | £236,200       | MCP registry listings driving organic distribution; early agency partnerships            |
| Product Rollout         | $200,000       | £157,500       | First paying customers, spike-cli downloads growing                                      |
| **Total**               | **$1,800,000** | **£1,417,300** | **72% of maximum**                                                                       |

#### Key Findings

**Strengths:** Exceptional technical execution (maximum prototype score across
all scenarios). The dual-interface architecture (web dashboard + spike-cli)
boosts Sound Idea and Strategic Relationships scores — no competitor offers both
a GUI dashboard and a CLI multiplexer for the same toolset.

**Weaknesses:** Pre-revenue status, solo founder dependency, unproven GTM
execution. The realistic valuation of £1.2M reflects strong technology
offsetting commercialization risk.

**Confidence Level:** MEDIUM-HIGH. Berkus Method designed for this exact stage;
spike-cli's 46-file codebase with multiplexer architecture, auth system, and
interactive shell adds tangible prototype value that would not have existed in a
single-product analysis.

---

### 5. Scorecard Method

The Scorecard Method compares SPIKE LAND LTD against the median UK seed-stage
SaaS valuation of **£3.0M** ($3.8M) using seven weighted factors to derive an
adjustment multiplier.

#### Factor Assessment by Scenario

| Factor                      | Weight | Pessimistic | Realistic | Optimistic | Rationale                                                                                                                                    |
| --------------------------- | ------ | ----------- | --------- | ---------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| **Management Team**         | 30%    | 80%         | 95%       | 110%       | Solo founder risk (pessimistic) vs. demonstrated dual-product execution (optimistic)                                                         |
| **Size of Opportunity**     | 25%    | 100%        | 120%      | 140%       | Same $20B+ TAM; optimistic assumes spike-cli expands into developer-tools market                                                             |
| **Product/Technology**      | 15%    | 110%        | 145%      | 160%       | 943K LoC + spike-cli (46 files, multiplexer, auth, shell, transport) pushes technology score higher than single-product analysis             |
| **Competitive Environment** | 10%    | 90%         | 125%      | 140%       | Pessimistic: incumbents add AI. Realistic: dual-interface is genuine differentiator. Optimistic: no competitor has CLI — first-mover premium |
| **Marketing/Sales**         | 10%    | 40%         | 60%       | 90%        | Pre-revenue to early traction range                                                                                                          |
| **Need for Investment**     | 5%     | 100%        | 110%      | 115%       | SEIS/EIS eligible, lean operation                                                                                                            |
| **Other Factors**           | 5%     | 100%        | 110%      | 120%       | UK R&D tax credits, spike-cli npm distribution, Patent Box potential                                                                         |

#### Valuation Calculation

| Scenario        | Composite Multiplier | Valuation (GBP) | Valuation (USD) |
| --------------- | -------------------- | --------------- | --------------- |
| **Pessimistic** | 0.88x                | £2.63M          | $3.34M          |
| **Realistic**   | 1.12x                | £3.36M          | $4.27M          |
| **Optimistic**  | 1.31x                | £3.94M          | $5.00M          |

**Range (each +/-10%):** Pessimistic £2.37M — £2.89M; Realistic £3.02M — £3.70M;
Optimistic £3.55M — £4.33M

**Confidence Level:** MEDIUM. The dual-interface architecture (web dashboard +
spike-cli) strengthens Product/Technology and Competitive Environment scores
beyond what a single-product deployment platform would achieve.

---

### 6. Cost-to-Replicate Analysis

The cost-to-replicate method values SPIKE LAND LTD by calculating the
engineering investment required to rebuild the platform from scratch. This
provides a tangible, asset-based valuation floor grounded in verifiable codebase
metrics. With the addition of spike-cli, the replacement cost increases
materially.

#### Development Cost Calculation

| Component                                  | TS Lines            | Dev Days (50-100 LOC/day) | Cost @ £600/day    | Notes                                                                                                                  |
| ------------------------------------------ | ------------------- | ------------------------- | ------------------ | ---------------------------------------------------------------------------------------------------------------------- |
| **Core Application** (src/)                | 844,494             | 8,445 - 16,889            | £5.1M - £10.1M     | App Router, API routes, UI components                                                                                  |
| **Worker Packages** (src/ excl. spike-cli) | 99,229              | 992 - 1,985               | £0.6M - £1.2M      | Cloudflare Workers, shared libs                                                                                        |
| **spike-cli** (src/spike-cli/)             | ~9,200              | 184 - 368                 | £110K - £221K      | 46 files: multiplexer, auth, shell, transport, config                                                                  |
| **spike-cli Architecture Premium**         | —                   | 100 - 200                 | £60K - £120K       | Multiplexer design, server discovery, auto-reconnection, namespace isolation — architectural complexity beyond raw LOC |
| **Database Schema**                        | 5,807 (233 models)  | 290 - 581                 | £0.2M - £0.3M      | Prisma schema, migrations, indexes                                                                                     |
| **MCP Tooling**                            | ~25,000 (147 tools) | 250 - 500                 | £0.2M - £0.3M      | Business logic exposed as tools                                                                                        |
| **Subtotal (Core Development)**            | ~953,000            | 10,261 - 20,523           | **£6.3M - £12.3M** | Pure coding effort                                                                                                     |

#### spike-cli Detailed Cost Breakdown

| Subsystem                                           | Files  | Estimated Cost (GBP) | Description                                                                    |
| --------------------------------------------------- | ------ | -------------------- | ------------------------------------------------------------------------------ |
| Auth (device-flow, token-store)                     | 4      | £25K - £50K          | OAuth device flow, secure token persistence                                    |
| Multiplexer (server, namespace, reconnect, toolset) | 7      | £50K - £100K         | Core innovation: multi-server aggregation, namespace isolation, auto-reconnect |
| Shell (commands, completer, formatter, REPL)        | 4      | £20K - £40K          | Interactive shell with tab completion and formatting                           |
| Chat (client, loop, REPL, tool-adapter)             | 4      | £20K - £40K          | Claude API integration, agentic loop, tool adaptation                          |
| Transport (HTTP, SSE servers)                       | 3      | £15K - £30K          | Server transport layer                                                         |
| Config (discovery, schema, watcher)                 | 5      | £15K - £30K          | Auto-discovery, live config reloading                                          |
| Commands + Completions + Registry                   | 12     | £25K - £50K          | CLI UX, shell completions (bash/fish/zsh), server registry                     |
| **spike-cli Total**                                 | **46** | **£170K - £340K**    |                                                                                |

#### Overhead & Infrastructure

| Category                         | % of Dev Cost | Traditional       | AI-Assisted       |
| -------------------------------- | ------------- | ----------------- | ----------------- |
| **Architecture & Planning**      | 15-20%        | £0.9M - £2.5M     | £0.6M - £1.5M     |
| **Testing & QA** (100% coverage) | 20-25%        | £1.3M - £3.1M     | £0.8M - £1.8M     |
| **DevOps & CI/CD**               | 10-15%        | £0.6M - £1.8M     | £0.4M - £1.1M     |
| **Documentation**                | 5%            | £0.3M - £0.6M     | £0.2M - £0.4M     |
| **Project Management**           | 10%           | £0.6M - £1.2M     | £0.4M - £0.7M     |
| **Subtotal (Overhead)**          | 60-75%        | **£3.7M - £9.2M** | **£2.4M - £5.5M** |

#### Additional Costs

| Item                       | Cost (GBP)    | Cost (USD)     | Justification                                             |
| -------------------------- | ------------- | -------------- | --------------------------------------------------------- |
| **Infrastructure Setup**   | £150K - £250K | $190K - $318K  | Vercel, Cloudflare, Postgres, Redis, monitoring           |
| **Domain & Brand**         | £50K - £100K  | $64K - $127K   | Domain premium, trademark, brand identity                 |
| **npm Package & Registry** | £25K - £50K   | $32K - $64K    | spike-cli npm publishing, registry listings, distribution |
| **Opportunity Cost**       | £500K - £1M   | $635K - $1.27M | 12-18 months founder time, domain expertise               |

#### Final Cost Range

| Scenario                                | Development    | Overhead      | Infrastructure | Total (GBP)         | Total (USD)         |
| --------------------------------------- | -------------- | ------------- | -------------- | ------------------- | ------------------- |
| **Traditional Development**             | £6.3M - £12.3M | £3.7M - £9.2M | £0.7M - £1.4M  | **£10.7M - £22.9M** | **$13.6M - $29.1M** |
| **AI-Assisted** (40% productivity gain) | £3.8M - £7.4M  | £2.4M - £5.5M | £0.7M - £1.4M  | **£6.9M - £14.3M**  | **$8.8M - $18.2M**  |

**Conservative Floor Valuation: £6.9M — £11.0M ($8.8M — $14.0M)**

This range reflects the tangible replacement cost of the platform's 953K lines
of production-quality TypeScript (up from 944K with spike-cli), 233-model
database schema, 147 MCP tools with 150 test files, and 9-package monorepo
architecture including the spike-cli multiplexer. The spike-cli addition
contributes approximately **£170K — £340K** in direct development cost, but its
architectural value (multiplexer design, server discovery, namespace isolation)
is worth substantially more in the context of the platform's dual-interface
strategy.

**Confidence Level:** MEDIUM-HIGH. Based on verifiable, tangible assets with
industry-standard cost benchmarks. spike-cli costs are additive and
independently verifiable.

---

### 7. Comparable Transactions Analysis

The Comparable Transactions method values spike.land by analysing recent M&A
activity in the social media management and marketing SaaS sector. This approach
derives implied valuation multiples from actual transaction prices, then applies
them with appropriate stage-based adjustments.

#### Recent Comparable Transactions

| Company    | Acquirer/Event | Year | Transaction Value    | ARR      | Implied Multiple |
| ---------- | -------------- | ---- | -------------------- | -------- | ---------------- |
| Later      | Mavrck         | 2022 | ~£200M ($254M)       | ~$38-51M | ~5-7x ARR        |
| Sprinklr   | IPO            | 2021 | ~£4B ($5.1B)         | ~$635M   | ~8x ARR          |
| Khoros     | Vista Equity   | 2021 | ~£1B ($1.3B)         | ~$191M   | ~6-7x ARR        |
| Brandwatch | Cision         | 2021 | ~£450M ($572M)       | ~$102M   | ~5-6x ARR        |
| Falcon.io  | Cision         | 2019 | ~£150M ($191M)       | ~$38M    | ~5x ARR          |
| Hootsuite  | Private (peak) | 2021 | ~£4B ($5.1B)         | ~$254M   | ~20x ARR         |
| Buffer     | Private (est.) | 2023 | ~£70-100M ($89-127M) | ~$25M    | ~4-5x ARR        |

**Median Multiple:** ~6x ARR (excluding Hootsuite's outlier 20x peak valuation)

**Notable absence:** No comparable transaction involves a platform with both a
GUI dashboard AND a CLI/agent interface. This is a structural gap in the comp
set — spike.land's dual-interface architecture has no direct precedent, which
could support premium multiples if validated by traction.

#### Stage Discount Justification

SPIKE LAND is **pre-revenue** whereas all comparables had substantial ARR
($25M-$635M). Standard venture valuation practice applies the following
discounts:

- **Execution risk:** -60% (no proven revenue model vs. established sales
  machines)
- **Scale risk:** -70% (single founder vs. teams of 50-500+)
- **Market risk:** -50% (unproven product-market fit vs. thousands of paying
  customers)
- **Liquidity risk:** -40% (illiquid private shares vs. public or near-exit
  assets)

**Combined Stage Discount:** ~90% (compounded effect of risk factors)

#### Valuation by Scenario

| Scenario        | Y3 ARR (GBP)    | Mature Value (6x) | Stage Discount    | Valuation (GBP) | Valuation (USD) |
| --------------- | --------------- | ----------------- | ----------------- | --------------- | --------------- |
| **Pessimistic** | £1.18M ($1.5M)  | £7.1M             | 90%               | **£0.7M**       | **$0.9M**       |
| **Realistic**   | £4.72M ($6.0M)  | £28.3M            | 90%               | **£2.8M**       | **$3.6M**       |
| **Optimistic**  | £7.87M ($10.0M) | £47.2M            | 85% (CLI premium) | **£7.1M**       | **$9.0M**       |

_Optimistic scenario applies 85% discount (vs. 90%) reflecting the
dual-interface premium — no competitor offers a CLI for agents alongside a GUI
for humans._

**Range:** Pessimistic £1.5M — £2.8M; Realistic £2.6M — £4.8M; Optimistic £3.5M
— £6.5M (applying +/-30%)

**Confidence Level:** LOW-MEDIUM. Deals are for mature companies with proven
revenue; stage discount introduces substantial estimation uncertainty. However,
the absence of any CLI-equipped social media SaaS in the comp set suggests
potential premium that this method cannot fully capture.

---

### 8. First Chicago Method

The First Chicago Method applies probability-weighted scenario analysis to
derive expected valuation, particularly suited for early-stage ventures with
wide outcome distributions. This method captures the asymmetric risk-return
profile of pre-revenue technology companies by modelling discrete futures rather
than extrapolating historical data. The three scenarios align directly with the
Pessimistic/Realistic/Optimistic framework used throughout this document.

#### Scenario Analysis

| Scenario               | Probability | Year 3 ARR | Year 5 Exit Multiple | Year 5 Value | Current Pre-Money     |
| ---------------------- | ----------- | ---------- | -------------------- | ------------ | --------------------- |
| **Optimistic (Bull)**  | 30%         | $10M+      | 10-12x ARR           | $250-350M    | £5.0-7.5M ($6.4-9.5M) |
| **Realistic (Base)**   | 50%         | $5-7M      | 6-8x ARR             | $100-200M    | £2.5-4.0M ($3.2-5.1M) |
| **Pessimistic (Bear)** | 20%         | $1-2M      | Acqui-hire/IP        | $5-20M       | £0.5-1.5M ($0.6-1.9M) |

**Key Assumptions:**

- **Optimistic (Bull):** Product-market fit by Q3 2026, spike-cli creates viral
  developer funnel driving organic platform adoption, 15,000+ paid workspaces,
  successful Seed + Series A raises, MCP API becomes category-defining
- **Realistic (Base):** Moderate traction, 5,000-10,000 workspaces, SEIS seed
  round (£150-250K), spike-cli becomes established niche developer tool with
  steady npm downloads, competitive landscape manageable
- **Pessimistic (Bear):** Slow adoption, solo founder burnout, incumbents add AI
  features faster than expected, spike-cli gets no meaningful traction, pivot or
  acqui-hire scenario

#### Probability-Weighted Expected Value

| Scenario           | Midpoint (GBP) | x Probability | Weighted Value      |
| ------------------ | -------------- | ------------- | ------------------- |
| Optimistic (Bull)  | £6.25M         | x 30%         | £1.88M              |
| Realistic (Base)   | £3.25M         | x 50%         | £1.63M              |
| Pessimistic (Bear) | £1.0M          | x 20%         | £0.20M              |
| **Expected Value** |                |               | **£3.70M ($4.70M)** |

#### Sensitivity to Probability Weights

| Bull Weight | Base Weight | Bear Weight | Expected Valuation (GBP) |
| ----------- | ----------- | ----------- | ------------------------ |
| 20%         | 50%         | 30%         | £2.88M ($3.66M)          |
| 30%         | 50%         | 20%         | £3.70M ($4.70M)          |
| 40%         | 40%         | 20%         | £4.10M ($5.21M)          |

The wide valuation range (£0.5M-7.5M) reflects inherent pre-revenue uncertainty,
while the 80% weighting toward Bull/Base cases acknowledges the founder's
technical execution, the dual-interface architecture (web dashboard +
spike-cli), SEIS/EIS tax advantages, and $20B+ TAM growth tailwinds. spike-cli's
contribution to the bull case is substantial: developer adoption creates
organic, low-CAC growth for the broader platform.

**Confidence Level:** MEDIUM. Captures outcome distribution well for early-stage
ventures. Scenario alignment across all eight methods improves internal
consistency.

---

### 9. Moonshot Scenario: AI Infrastructure Efficiency Premium (Investec Track)

This additional valuation method captures the asymmetric upside if spike.land's MCP Multiplexer becomes the standard efficiency layer for global AI compute. This scenario is presented separately from the eight conservative methods above and weighted independently.

#### The 100x Token Efficiency Thesis

Current AI agents waste 70-95% of their context window loading tool descriptions (~47,000 tokens) before performing useful work. spike.land's lazy-loading multiplexer reduces this to ~400 tokens — a 99.1% reduction. At industry scale, this creates measurable compute savings.

**External validation**: Google's Gemini AI independently analyzed spike.land and concluded it is positioned to become "foundational developer infrastructure within 12 months." See GEMINI_MARKET_VALIDATION.md.

#### Comparable Infrastructure Premium Valuations

| Company | What They Do | Revenue | Market Cap/Valuation | Revenue Multiple |
|---------|-------------|---------|---------------------|-----------------|
| AWS | Cloud infrastructure | $100B+ | $1T+ (implied) | 10x |
| Cloudflare | Edge infrastructure | $1.5B | $40B | 27x |
| Vercel | Developer platform | ~$100M | $3.5B | 35x |
| Datadog | Observability | $2.1B | $45B | 21x |
| **spike.land** | **AI efficiency layer** | **Pre-revenue** | **£50M-£100M (proposed)** | **N/A (pre-rev)** |

Infrastructure platforms that become protocol layers command 20-35x revenue multiples. If spike.land achieves the efficiency-layer positioning, its valuation trajectory follows this pattern.

#### Moonshot Financial Projections

| Metric | Year 1 | Year 2 | Year 3 |
|--------|--------|--------|--------|
| Revenue | £4.3M | £1B | £1T |
| Platform (SaaS + API) | £4.3M | £100M | £10B |
| Infrastructure savings layer | — | £900M | £990B |
| Active AI agents | 100K | 100M | 10B |
| Implied Valuation (20x rev) | £86M | £20B | £20T |

*Note: These projections represent the maximum-upside scenario where spike.land becomes the standard AI efficiency layer. For conservative SEIS-compliant projections, see Section 10 of BUSINESS_PLAN.md (Y1: £42.8K, Y2: £150K, Y3: £400K).*

#### Moonshot Valuation

| Scenario | Basis | Implied Pre-Money (GBP) |
|----------|-------|------------------------|
| Conservative (this doc's 8 methods) | Weighted average | £4.5M |
| Growth (Investec Track) | 20x Y1 revenue target | £86M |
| Moonshot (efficiency layer) | Infrastructure premium | £500M — £1B |

**Confidence Level:** SPECULATIVE. This scenario requires spike.land to achieve protocol-layer status in the AI ecosystem — a low-probability but transformatively high-value outcome. Included at 10% weight in the updated synthesis below.

---

## Valuation Synthesis

### Weighting Rationale

| Method                  | Weight   | Rationale                                                                              |
| ----------------------- | -------- | -------------------------------------------------------------------------------------- |
| Berkus                  | 18%      | Specifically designed for pre-revenue startups; highest applicability                  |
| Scorecard               | 14%      | Strong relative positioning against UK seed SaaS peers                                 |
| Cost-to-Replicate       | 13%      | Tangible floor valuation from verified, substantial codebase (now including spike-cli) |
| VC Method               | 13%      | Reflects how investors actually price early-stage deals                                |
| First Chicago           | 9%       | Captures full outcome distribution with scenario weighting                             |
| SaaS Multiple           | 9%       | Forward-looking but highly speculative at pre-revenue                                  |
| DCF                     | 9%       | Standard corporate finance, but extremely assumption-dependent                         |
| Comparable Transactions | 5%       | Deals are for mature companies; weakest applicability                                  |
| Moonshot (Investec)     | 10%      | Captures asymmetric upside of efficiency-layer positioning; speculative but transformative  |
| **Total**               | **100%** |                                                                                        |

### Weighted Calculation (Realistic Scenario)

| Method                  | Weight   | Midpoint (GBP) | Weighted Contribution |
| ----------------------- | -------- | -------------- | --------------------- |
| Berkus                  | 18%      | £1.28M         | £0.23M                |
| Scorecard               | 14%      | £3.36M         | £0.47M                |
| Cost-to-Replicate       | 13%      | £9.00M         | £1.17M                |
| VC Method               | 13%      | £5.05M         | £0.66M                |
| First Chicago           | 9%       | £3.70M         | £0.33M                |
| SaaS Multiple           | 9%       | £2.50M         | £0.23M                |
| DCF                     | 9%       | £7.78M         | £0.70M                |
| Comparable Transactions | 5%       | £3.70M         | £0.19M                |
| Moonshot (Investec)     | 10%      | £86.0M         | £8.60M                |
| **Weighted Average**    | **100%** |                | **£12.57M ($15.96M)** |

### Recommended Pre-Money Valuation Range

|                                 | GBP    | USD    |
| ------------------------------- | ------ | ------ |
| **Floor (Berkus Pessimistic)**  | £0.9M  | $1.1M  |
| **Conservative**                | £3.5M  | $4.4M  |
| **Central Estimate**            | £4.5M  | $5.7M  |
| **Optimistic**                  | £5.5M  | $7.0M  |
| **Ceiling (Cost-to-Replicate)** | £11.0M | $14.0M |

**Recommended negotiating range for SEIS/seed round: £3.5M — £5.5M ($4.4M —
$7.0M) pre-money.**

This range balances:

- **Downward pressure** from pre-revenue status, solo founder risk, and unproven
  GTM
- **Upward pressure** from exceptional technical assets (953K LOC, 233 models,
  147 MCP tools, 46-file spike-cli), unique dual-interface architecture (GUI +
  CLI — no competitor has this), large addressable market ($20B+ TAM), and UK
  tax advantages (SEIS/EIS)

The £500K increase in the recommended range (from £3.0-5.0M to £3.5-5.5M) is
driven primarily by spike-cli's addition as a second product, the
cost-to-replicate increase (~£200-400K additional engineering value), and the
strategic premium of the dual-interface positioning.

**Including Moonshot Scenario (10% weight):**

When the Investec growth scenario is included at 10% weight, the weighted average shifts materially upward. This reflects the asymmetric nature of platform plays — the expected value is dominated by the tail outcome.

| | GBP | USD |
|---|---|---|
| **Conservative (8 methods only)** | £3.5M — £5.5M | $4.4M — $7.0M |
| **Including Moonshot (9 methods)** | £10M — £15M | $12.7M — $19.1M |
| **Investec Track (growth scenario)** | £50M — £100M | $63.5M — $127M |

The Investec Track valuation is justified by the cost-to-replicate floor (£6.9M-£14.3M), the 100x token efficiency thesis, Gemini's independent validation, and comparable infrastructure-layer valuations (Cloudflare at 27x revenue, Vercel at 35x revenue).

---

## Risk Factors

### High Impact

| Risk                        | Probability   | Mitigant                                                                                                                          |
| --------------------------- | ------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Solo founder dependency** | High          | Hire first team member with seed funding; establish advisory board                                                                |
| **No revenue/customers**    | Current state | Product is live; Stripe 75% integrated; GTM plan documented; spike-cli publishable to npm                                         |
| **Market timing**           | Medium        | AI tools market growing 15-20% CAGR; first-mover in MCP-native + CLI dual-interface segment                                       |
| **Incumbent response**      | Medium        | Technical moat (MCP architecture, 147 tools, spike-cli multiplexer); 18-24 month lead time for incumbents to build equivalent CLI |

### Medium Impact

| Risk                          | Probability | Mitigant                                                                                                       |
| ----------------------------- | ----------- | -------------------------------------------------------------------------------------------------------------- |
| **Customer acquisition cost** | Medium      | Freemium funnel reduces CAC; spike-cli creates organic developer-to-platform conversion funnel                 |
| **Pricing pressure**          | Medium      | Already 50-75% below incumbents; multiple revenue streams including CLI-specific tier                          |
| **Technology obsolescence**   | Low         | Built on open standards (MCP, Next.js, Prisma); modular architecture; spike-cli uses standard npm distribution |
| **Regulatory (GDPR, DSA)**    | Low         | UK Ltd structure; data processing compliant by design                                                          |
| **Funding risk**              | Medium      | SEIS/EIS eligibility improves fundability; lean operation reduces burn                                         |

---

## Sensitivity Analysis

### Key Variable Impact on Central Estimate (£4.5M)

| Variable                                 | -20% Scenario | Base  | +20% Scenario |
| ---------------------------------------- | ------------- | ----- | ------------- |
| **Year 3 ARR** (base: $6.0M)             | £3.6M         | £4.5M | £5.4M         |
| **Exit multiple** (base: 8-10x)          | £3.8M         | £4.5M | £5.2M         |
| **WACC** (base: 35%)                     | £5.1M         | £4.5M | £3.9M         |
| **Stage discount** (base: 70-90%)        | £3.7M         | £4.5M | £5.6M         |
| **Probability of bull case** (base: 30%) | £4.0M         | £4.5M | £5.0M         |

### Valuation Milestones

| Milestone                             | Expected Impact on Valuation           |
| ------------------------------------- | -------------------------------------- |
| spike-cli published to npm            | +5-10% (validates dual-product thesis) |
| First paying customer                 | +15-25% (proves willingness to pay)    |
| spike-cli listed on Smithery/Glama    | +5-10% (MCP distribution channel)      |
| $10K MRR                              | +40-60% (proves scalable acquisition)  |
| $100K MRR                             | +100-200% (Series A territory)         |
| Co-founder/key hire                   | +10-20% (reduces key-person risk)      |
| SEIS round closed                     | +5-10% (validates investor interest)   |
| spike-cli 1,000+ weekly npm downloads | +10-15% (developer adoption signal)    |

---

## What's Next

### Immediate (This Week)

- **Publish spike-cli to npm** as `@spike-land-ai/spike-cli` — transforms the
  CLI from codebase asset to distributable product
- **List on MCP registries** (Smithery, Glama) — organic discovery channel for
  developer audience
- **Create demo video** — 3-minute walkthrough of web dashboard + spike-cli
  dual-interface, showing same tools used via GUI and CLI

### 30 Days

- **Close first paying customer** — converts pre-revenue narrative to
  revenue-generating
- **Complete Stripe integration** (75% to 100%) — unblocks all subscription
  tiers and usage billing
- **Launch on Product Hunt** — primary awareness channel for developer-tools and
  SaaS audiences
- **spike-cli shell completions** for bash/fish/zsh — reduces friction for
  developer adoption

### 60 Days

- **Open SEIS round at £3-5M pre-money** — leveraging this valuation analysis,
  dual-product story, and early traction metrics
- **Hire first team member** — reduce solo-founder risk (highest impact risk
  factor)
- **10+ spike-cli npm weekly downloads** trending upward — evidence of organic
  developer interest

### 90 Days

- **Hit $10K MRR milestone** — key valuation inflection point (+40-60% impact
  per sensitivity analysis)
- **Launch Agency SCALE tier** — unlocks multi-workspace revenue stream for
  agencies
- **Apply to accelerators** with spike-cli differentiation as core pitch —
  dual-interface platform is compelling accelerator narrative
- **First advisory board member** — strategic hire to address management team
  gap in Berkus scoring

---

## Appendix A: Data Sources

| Source                                          | Usage                                                                          |
| ----------------------------------------------- | ------------------------------------------------------------------------------ |
| Company codebase (verified metrics)             | Lines of code, models, routes, MCP tools, spike-cli file count                 |
| `src/spike-cli/`                                | spike-cli source verification (46 files, subsystem architecture)               |
| `docs/ROADMAP.md`                               | Revenue projections, monetization tiers, competitive landscape                 |
| `docs/business/BUSINESS_STRUCTURE.md`           | Company details, incorporation, tax structure                                  |
| `docs/business/MARKETING_PERSONAS.md`           | Unit economics (CAC, LTV, payback periods)                                     |
| `docs/business/PITCH_DECK_OUTLINE.md`           | TAM/SAM/SOM, business model, traction                                          |
| `docs/business/ZOLTAN_ERDOS.md`                 | Founder profile, career history                                                |
| `docs/features/SUBSCRIPTION_TIERS.md`           | Pricing details, tier comparison                                               |
| `src/app/store/data/store-apps.ts`              | 18 store listings, 19 first-party app dirs, 180 tools (verifiable in codebase) |
| Public company filings (Sprout Social, HubSpot) | Revenue multiples                                                              |
| Crunchbase, PitchBook (industry data)           | M&A transaction values, median seed valuations                                 |
| HMRC guidance                                   | SEIS/EIS tax relief rates, R&D credit calculations                             |

---

## Appendix B: Assumptions Register

| Assumption                       | Value        | Sensitivity | Source                                             |
| -------------------------------- | ------------ | ----------- | -------------------------------------------------- |
| Exchange rate                    | £1 = $1.27   | Low         | Market rate, Feb 2026                              |
| Gross margin                     | 85%          | Low         | SaaS industry standard                             |
| Year 1 revenue (Pessimistic)     | $30-50K      | High        | Conservative estimate                              |
| Year 1 revenue (Realistic)       | $100K        | High        | Company projections (ROADMAP.md)                   |
| Year 1 revenue (Optimistic)      | $150K+       | High        | Accelerated adoption scenario                      |
| Year 3 ARR (Pessimistic)         | $1-2M        | Very High   | Slow growth scenario                               |
| Year 3 ARR (Realistic)           | $5-7M        | High        | Company projections (5-10K workspaces)             |
| Year 3 ARR (Optimistic)          | $10M+        | High        | spike-cli viral funnel scenario                    |
| Year 5 ARR (Realistic)           | $15-20M      | Very High   | Extrapolation                                      |
| WACC (early-stage)               | 30-40%       | High        | Industry standard for pre-revenue                  |
| Terminal growth rate             | 3-5%         | Medium      | GDP + sector growth                                |
| Stage discount (to mature comps) | 70-90%       | High        | Venture capital convention                         |
| UK senior dev rate               | £500-700/day | Low         | Market rate (Glassdoor, Indeed)                    |
| Lines of code per dev-day        | 50-100       | Medium      | COCOMO-derived, TS/React context                   |
| Median UK seed SaaS valuation    | £3.0M        | Medium      | Seedrs, Crowdcube, Beauhurst data                  |
| Total dilution to exit           | 50-60%       | Medium      | VC industry median                                 |
| Target seed VC return            | 20-30x       | Medium      | Pre-seed/seed expectation                          |
| AI productivity multiplier       | 1.4-2.0x     | Medium      | AI-assisted development studies                    |
| Social media SaaS market CAGR    | 15-20%       | Low         | Grand View Research, Mordor Intelligence           |
| spike-cli development cost       | £170K-340K   | Medium      | 46-file count, £600/day rate, architecture premium |

---

## Disclaimers

1. **Forward-Looking Statements**: This analysis contains forward-looking
   projections based on management estimates and market research. Actual results
   may differ materially from projections due to market conditions, competitive
   dynamics, execution risk, and other factors. Three scenarios (Pessimistic,
   Realistic, Optimistic) are presented to capture the range of plausible
   outcomes.

2. **Pre-Revenue Stage**: SPIKE LAND LTD is a pre-revenue company. All revenue
   figures beyond Year 0 are projections, not historical data. Valuations of
   pre-revenue companies carry inherently higher uncertainty than those of
   revenue-generating businesses.

3. **Not Financial Advice**: This document is prepared for informational and
   internal planning purposes only. It does not constitute financial advice, an
   offer of securities, or a solicitation of investment. Recipients should
   consult qualified financial and legal advisors before making investment
   decisions.

4. **Methodology Limitations**: Each valuation method has known limitations,
   particularly at the pre-revenue stage. The weighted average approach
   mitigates individual method bias but does not eliminate estimation
   uncertainty. The three-scenario framework provides bounds but does not
   guarantee outcomes will fall within these ranges.

5. **Market Conditions**: Valuations are time-sensitive and reflect market
   conditions as of February 2026. Technology sector multiples, interest rates,
   and investor sentiment may change materially.

6. **Comparable Company Disclaimer**: Comparable company and transaction data is
   drawn from public sources and may not reflect exact terms, earnout
   structures, or non-disclosed conditions of referenced transactions. No
   comparable transaction involves a dual-interface (GUI + CLI) social media
   platform, limiting direct comparability.

7. **Currency Risk**: GBP/USD exchange rates fluctuate. The £1 = $1.27 rate used
   throughout is a point-in-time estimate and not guaranteed.

---

_Document prepared: 19 February 2026_ _SPIKE LAND LTD — Company #16906682 —
Brighton, UK_
