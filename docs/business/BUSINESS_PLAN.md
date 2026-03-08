# Business Plan — SPIKE LAND LTD

> **Company**: SPIKE LAND LTD (UK Company #16906682)
> **Date**: March 2026
> **Classification**: Confidential — For Investor & HMRC Use
> **Stage**: Pre-Revenue, Public Beta / Commercialization Stage
> **Prepared For**: SEIS Advance Assurance (Part 5, Item 3)
> **Currency**: GBP Primary (USD Secondary at £1 = $1.27)

---

## 1. Executive Summary

SPIKE LAND LTD is a UK-incorporated technology company building an open MCP
(Model Context Protocol) app store and managed runtime platform. The platform
enables developers and AI-native teams to discover, run, publish, and monetize
AI apps through one hosted system rather than stitching together separate MCP
servers and services.

The product is live in public beta at spike.land, featuring a working CLI
(`spike-cli`), a web dashboard, a public app-store surface, and a managed
hosted tool layer deployed on a global edge network. The company remains
pre-revenue while it completes billing, onboarding, and commercialization
workflows ahead of full launch.

The SEIS raise of up to £250,000 will be used to accelerate go-to-market, expand the hosted tool ecosystem, and fund early hiring in growth and customer success.

*\*Note: The beta platform currently includes 86 natively hosted MCP tools, with 533+ total tools accessible through its MCP Multiplexer architecture — an industry-first lazy-loading system that reduces AI agent context window usage by up to 100x.*

**Based on the company's current facts, management believes it appears to meet the core SEIS conditions: incorporated December 2025, no prior risk-finance investment, fewer than 25 employees, gross assets under £350,000, and carrying on or preparing to carry on a qualifying software development trade. Advance Assurance is being sought on that basis.**

---

## 2. Company Overview

| Field | Value |
|-------|-------|
| Legal Name | SPIKE LAND LTD |
| Company Number | 16906682 |
| Incorporation Date | 12 December 2025 |
| Registered Office | 42 Mighell Street, Apartment 70, Brighton BN2 0AU |
| SIC Codes | 62090 (IT consultancy), 63120 (Web portals) |
| Director | Zoltan Erdos (sole director) |
| Shareholders | Zoltan Erdos — 1 ordinary share at £1 (100%) |
| Corporation Tax Ref | BRCT00003618256 |
| Corporate Structure | Independent entity; no subsidiaries |
| Funding History | No prior fundraising; no shares issued under SEIS/EIS |

**Founder background**: Zoltan Erdos is a full-stack engineer with 10+ years of experience, bringing rigorous enterprise engineering background (formerly at VMO2) to his work. What began as a highly technical open-source side project is now architecturally ready to scale into a commercial platform. He built the initial platform end-to-end using AI-assisted development, demonstrating both technical execution capability and deep familiarity with developer tooling, platform architecture, and emerging AI workflows.

---

## 3. Product Readiness & Technical Status

While the company is pre-revenue and still completing commercialization work, the technical execution model is materially de-risked relative to a typical first-time infrastructure startup.

- **Product Status**: Public beta launched in March 2026. Core infrastructure and the edge database are operational in beta; current work is focused on product hardening, onboarding, billing workflows, and enterprise controls ahead of commercial launch.
- **Tool Ecosystem**: 86 natively hosted MCP tools are integrated and functional on the platform, with multiplexer support extending access to 450+ third-party tools (533+ total tools reachable across the ecosystem).
- **Access Channels**: `spike-cli` is published and functional; web dashboard is live.
- **Open Source Foundation**: Selected core platform components and architecture are open-sourced to support developer adoption, transparency, and ecosystem trust. The company retains ownership of its commercial platform, product integration layer, hosting infrastructure, billing workflows, and go-to-market execution.
- **Commercial Readiness**: Stripe subscription checkout is implemented; webhook provisioning, metering, and self-serve onboarding are being completed ahead of commercial launch.

---

## 4. Problem & Solution

### 4.1 Problem

Developers building with AI face two compounding problems:

1. **Fragmented tooling** — The average developer uses 8+ SaaS tools daily (deployment, monitoring, QA, etc.). Each requires separate authentication, billing, and integration work.
2. **No managed MCP registry** — The Model Context Protocol (Anthropic, 2024) is emerging as a standard for AI-tool interaction. Developers currently have limited options for a managed MCP platform that combines hosted tools, authentication, rate limiting, and billing in one offering, so many teams still end up building, hosting, and securing their own MCP servers.
3. **Context window waste** — AI agents load all available tool descriptions (often 47,000+ tokens) at the start of every session, consuming 70-95% of their cognitive capacity before doing any useful work. As tool ecosystems grow, this problem compounds exponentially.

### 4.2 Solution

Spike Land provides a unified platform to solve this:

- **Open MCP App Store** — developers can package MCP-native apps for
  discovery, installation, recommendation, and future revenue share rather than
  shipping isolated private integrations.
- **Managed MCP Registry** — 86 natively hosted tools (533+ total via
  multiplexer), with lazy-loading toolsets that reduce agent context overhead
  from ~47,000 tokens to ~400 tokens, plus authentication, rate limiting, and
  metering handled by the platform.
- **Unified Access** — tools and apps can be invoked identically via the
  `spike-cli`, the web dashboard, or external cross-origin integrations.
- **Edge-Native Infrastructure** — deployed primarily on Cloudflare
  infrastructure, designed for low-latency global access and highly efficient
  unit economics.

---

## 5. Market Opportunity

Our initial Year 1-2 go-to-market is built around a focused **bottom-up milestone**:
Targeting a niche of 5,000 highly active AI agent developers and indie hackers. Converting 5% (250 users) to a blended paid plan of ~£35/month implies an ARR milestone of ~£105,000 once the paid base is fully ramped. This is used here as a product-market-fit milestone, not as recognized Year 1 revenue.

---

## 6. Target Personas (Primary Beachhead)

Rather than targeting the entire market from day one, Spike Land is focusing on a sharp initial wedge of early adopters. Customer Acquisition Cost (CAC) and Lifetime Value (LTV) figures are currently planning hypotheses to be tested and validated in Year 1.

1. **AI Agent Developer**: Builds AI agents using MCP. Discovers tools via npm and GitHub. Pain point: managing fragmented MCP server connections. Target: API PRO ($49/mo). Expected low CAC due to organic technical channels.
2. **Indie Hacker / Solo Founder**: Solo SaaS builders who need AI leverage. Pain point: tool sprawl and limited budget. Target: PRO ($29/mo). 
3. **AI Consultancy / Agency**: Small teams building AI solutions for clients. Needs multi-workspace management and per-client isolation. Target: BUSINESS ($99/mo) + API add-ons.
4. **DevOps / QA Team Lead**: Evaluates tools for team rollout. Needs audit logs, CI/CD integrations, and permission management. Target: BUSINESS ($99/mo).

---

## 7. Revenue Model & Pricing

The commercial model focuses on subscription recurring revenue (SaaS) and
usage-based API add-ons.

The app store adds a second structural revenue layer: marketplace distribution.
Developers publish into the catalog, users install through the shared runtime,
and the platform captures marketplace take rate while increasing the value of
the core subscription and API products.

### 7.1 Current vs. Planned Revenue Streams

| Revenue Stream | Status | Timing |
|---|---|---|
| **Platform Subscriptions** | Planned for commercial launch | Y1 |
| **API Add-ons (PRO / SCALE)** | Planned for commercial launch | Y1 |
| **Credit Overages** | Planned after initial usage baseline | Y1 H2 |
| **Marketplace Take Rate (30%)** | Planned | Y2 |
| **App Builder Services** | Opportunistic / Founder-led | As needed |

### 7.2 Core Pricing Tiers

| Tier | Price | Deployments | AI Credits/mo | Team Members |
|------|-------|-------------|---------------|--------------|
| FREE | $0/mo | 3 | 100 | 1 |
| PRO | $29/mo | 10 | 1,000 | 3 |
| BUSINESS | $99/mo | Unlimited | 5,000 | 10 |

*\*Note: All USD prices convert at £1 = $1.27. The financial model conservatively assumes a blended ARPU of ~£33/mo.*

### 7.3 MCP API Access (Add-Ons)

For heavy programmatic usage (e.g., AI Agent Developers running large workloads):
- **Included in BUSINESS**: 1,000 API calls/mo (Read-only)
- **API PRO**: $49/mo (10,000 calls, full read/write)
- **API SCALE**: $149/mo (100,000 calls, webhooks, batch operations)

---

## 8. Go-to-Market Strategy

As a developer-first tool, acquisition relies heavily on Product-Led Growth
(PLG) rather than expensive paid media.

1. **npm / CLI Distribution**: `npx @spike-land-ai/spike-cli` provides zero-install evaluation. This is the primary top-of-funnel engine.
2. **One-Liner Activation**: Adding spike.land as an MCP server to an AI IDE (like Claude Code) takes one terminal command.
3. **GitHub & Docs SEO**: Creating high-quality technical content, tutorials, and a strong open-source presence to capture developer search intent.
4. **App Store Distribution**: Store listings, installs, public metadata, and
   cross-origin embeddability create a second acquisition loop beyond the CLI.
5. **Direct Outreach**: Targeting MCP tool authors with a compelling
   revenue-share proposition to rapidly populate the platform's marketplace.
6. **Community**: Leveraging Discord and developer communities (Hacker News,
   Indie Hackers) for organic word-of-mouth.

---

## 9. Competitive Landscape

The company believes its current combination of hosted MCP tooling, CLI access, and edge-native infrastructure is differentiated from existing point solutions and directories. The market remains underserved by managed MCP platforms that combine hosted tools, authentication, rate limiting, and billing in one offering.

OpenAI’s December 18, 2025 app directory update validates the broader trend toward AI tool and application marketplaces. Spike Land remains differentiated by focusing on model-agnostic, granular MCP tool access for developers and small teams rather than model-specific app ecosystems.

| Competitor | Core Focus | Managed MCP Hosting? | CLI Access? | Tool Marketplace? |
|------------|-------------|------|------|--------------|
| **Vercel** | Web deployment | No | Yes | No |
| **Replit** | Cloud IDE | No | No | Limited |
| **Smithery/Glama** | MCP Directories | Directory only (No hosting) | No | No |
| **Anthropic Claude Marketplace** | Enterprise AI app procurement | No (apps, not MCP tools) | No | Yes (enterprise procurement layer) |
| **Self-Hosted MCP (DIY)** | Infrastructure | No | No | No |
| **spike.land** | **MCP Multiplexer Platform** | **Yes (86 native, 533+ total)** | **Yes (`spike-cli`)** | **Yes (70/30 rev share)** |

**Potential Defensibility**: Spike Land's differentiation is audience and access model. Developers and small teams can onboard via CLI and API in minutes, invoke granular tools rather than buy complete SaaS suites, and avoid model lock-in. The planned marketplace is designed to introduce **network effects**: a rich library of tools attracts developers, which in turn attracts more tool authors seeking distribution and monetization.

---

## 10. Three-Year Financial Forecasts

### 10.1 Key Assumptions
- Year 1 focuses on controlled growth, product hardening, and establishing baseline retention.
- Core hosting infrastructure uses Cloudflare, offering a highly capital-efficient baseline with predictable scaling costs as usage grows.
- **Important Note on Capital Use**: The £250,000 SEIS raise is explicitly intended to *accelerate growth*. The Year 1 model assumes approximately £102.7k of gross cash outflows (COGS plus OpEx), primarily into product hardening, GTM, and early hires. After £42.8k of forecast revenue, year-end cash is forecast at approximately £190.1k, leaving roughly £147.3k of undeployed raise capital plus revenue-generated cash available entering Year 2.
- **Sensitivity / Downside Scenario**: If customer acquisition tracks at roughly half the base case, ending Year 1 at approximately 114 paying customers rather than 228, Year 1 revenue would be roughly £21k-22k. In that case the company would still retain material runway into Year 2 to continue iterating on product-market fit.

### 10.2 Year 1 Profit & Loss — Monthly Detail (M1-M12)

| Month | Paying Customers | Revenue (£) | COGS (£) | Gross Profit (£) | Opex (£) | EBIT (£) |
|-------|-----------------|-------------|----------|-----------------|----------|----------|
| M1 | 5 | 165 | 30 | 135 | 4,000 | -3,865 |
| M2 | 12 | 396 | 71 | 325 | 4,000 | -3,675 |
| M3 | 22 | 726 | 131 | 595 | 4,500 | -3,905 |
| M4 | 35 | 1,155 | 208 | 947 | 4,500 | -3,553 |
| M5 | 55 | 1,815 | 327 | 1,488 | 5,000 | -3,512 |
| M6 | 80 | 2,640 | 475 | 2,165 | 8,500 | -6,335 |
| M7 | 110 | 3,630 | 653 | 2,977 | 8,500 | -5,523 |
| M8 | 140 | 4,900 | 882 | 4,018 | 9,000 | -4,982 |
| M9 | 160 | 5,600 | 1,008 | 4,592 | 11,500 | -6,908 |
| M10 | 185 | 6,475 | 1,166 | 5,309 | 11,500 | -6,191 |
| M11 | 210 | 7,350 | 1,323 | 6,027 | 12,000 | -5,973 |
| M12 | 228 | 7,980 | 1,436 | 6,544 | 12,000 | -5,456 |
| **Total**| | **£42,832** | **£7,710** | **£35,122** | **£95,000** | **-£59,878** |

*\*Notes on Y1 P&L:* 
- *COGS (modeled at 18% of revenue) includes Stripe processing fees (2.9%), third-party API pass-through costs, and LLM inference costs for AI credits.*
- *OpEx reflects the founder, infrastructure, and SaaS tooling in M1-M5. The ramp from M6+ reflects the introduction of a dedicated Growth Lead hire and increased GTM spend.*

### 10.3 Post-Raise Multi-Year Financial Summary

To demonstrate the path from SEIS-funded strategic burn to eventual profitability, the following table summarizes the three-year P&L trajectory feeding the balance sheet.

| Metric | Year 1 | Year 2 (Forecast) | Year 3 (Forecast) |
|---|---|---|---|
| **Revenue** | £42,832 | £150,000 | £400,000 |
| **COGS** (18%) | £7,710 | £27,000 | £72,000 |
| **Gross Profit** | £35,122 | £123,000 | £328,000 |
| **OpEx** | £95,000 | £143,000 | £218,000 |
| **EBIT / Net Income** | **-£59,878** | **-£20,000** | **£110,000** |

*\*Note on Year 3 Revenue: Year 3 revenue growth reflects the combined effect of continued subscription growth, the launch of the marketplace revenue-share model, and the introduction of API SCALE tier adoption.*

### 10.4 Year-End Balance Sheet & Cash Summary

| Item | Year 1 | Year 2 (Forecast) | Year 3 (Forecast) |
|------|--------|-------------------|-------------------|
| **Cash at Bank** | £190,123 | £170,123 | £260,123 |
| Other Assets | £3,000 | £10,000 | £28,000 |
| **Total Assets** | **£193,123** | **£180,123** | **£288,123** |
| | | | |
| Liabilities* | £3,000 | £10,000 | £8,000 |
| **Net Assets** | **£190,123** | **£170,123** | **£280,123** |
| | | | |
| **Equity** | | | |
| Share Capital | £1 | £1 | £1 |
| Share Premium | £250,000 | £250,000 | £250,000 |
| Retained Earnings | -£59,878 | -£79,878 | £30,122 |
| **Total Equity** | **£190,123** | **£170,123** | **£280,123** |

*\*Note: Liabilities consist primarily of accrued expenses and short-term trade creditors. Share Premium figure represents the forecast position post-SEIS raise.*

---

## 11. Use of Funds & Milestones

The maximum £250,000 SEIS raise will be deployed over 18-24 months for qualifying trade purposes to achieve specific growth milestones.

| Milestone / Objective | Estimated Spend | Intended Outcome |
|-----------------------|-----------------|------------------|
| **Commercial Launch & Billing** | £25,000 | Stripe live, paid plans activated, self-serve onboarding. |
| **Platform Hardening & Docs** | £35,000 | Comprehensive developer documentation, analytics, and robust APIs. |
| **Tool Registry Expansion** | £40,000 | Scale platform to 120+ hosted tools; implement marketplace revenue share. |
| **GTM & Content Marketing** | £50,000 | Founder-led demos, SEO content, initial push to first 100 paying customers. |
| **Growth & Engineering Hires** | £80,000 | Hire Growth Lead & CS/Engineering support to lower churn and drive acquisition. |
| **Working Capital / Contingency** | £20,000 | Professional fees, legal, accounting, and buffer. |
| **Total** | **£250,000** | |

---

## 12. SEIS Risk-to-Capital Statement

The company is structured to satisfy the HMRC Risk-to-Capital condition:
- **Long-term growth:** SPIKE LAND LTD is a genuine commercial software business seeking to build long-term value, increase its customer base, and expand its team.
- **Capital at Risk:** The company is pre-revenue. Success is highly uncertain in a competitive and rapidly evolving AI market.
- **No capital protection:** There are no asset backings, downside protections, or capital preservation arrangements in place. 
- **Return profile:** Investor returns depend entirely on the commercial success and future enterprise value of the company, not on tax relief alone. The company is not structured to provide low-risk returns or early extraction of capital.

---

## 13. Risk Factors

1. **Market Risk (MCP Adoption):** The Model Context Protocol may not achieve widespread industry adoption. *Mitigation:* MCP is backed by major ecosystem participants, and platform tools can also be exposed through standard API channels rather than relying exclusively on one protocol surface.
2. **Competition Risk (Developer Platforms):** Established platforms such as Vercel, Replit, or hosted MCP providers could add overlapping managed-tool functionality. *Mitigation:* Spike Land is targeting a narrow initial wedge, using CLI-led developer distribution and tool-level workflows rather than generic hosting positioning.
3. **Platform Marketplace Risk (Model Providers):** Major model providers are beginning to launch proprietary app marketplaces, including Anthropic's March 2026 Claude Marketplace and OpenAI's expanding app ecosystem. *Mitigation:* Spike Land is model-agnostic, focused on granular tool access rather than full SaaS procurement, and oriented toward developers and small teams rather than enterprise committed-spend budgets.
4. **Concentration Risk (AI Providers):** Core user workflows depend heavily on Anthropic/OpenAI/Google APIs. Pricing or policy changes by these providers could affect margins or product behavior. *Mitigation:* The platform architecture is model-agnostic, allowing developers to route requests to alternative open-source or proprietary LLMs.
5. **Execution Risk:** A single founder creates a key-person dependency. *Mitigation:* AI-assisted development enables the founder to ship quickly and operate efficiently at the current stage, while the raise provides capital to reduce single-founder execution risk through targeted hiring (Growth Lead and CS support in Y1 H2).

---

## 14. 18–24 Month Milestones

Rather than engineering speculative exit scenarios at this pre-revenue stage, the company is entirely focused on achieving the following operational and commercial milestones over the next 18 to 24 months to maximize enterprise value:

1. **Commercial Launch Completed:** Transition from public beta to full Stripe-integrated billing with self-serve onboarding.
2. **First 100 Paying Customers:** Achieve initial product-market fit within the core developer/indie hacker beachhead.
3. **Marketplace Launched:** Open the platform to third-party MCP tool publishers with a 70/30 revenue share model.
4. **First Agency/Team Customers Onboarded:** Validate the higher-LTV "BUSINESS" tier through multi-workspace usage.
5. **Enterprise-Ready Access Controls:** Deploy robust audit logs, RBAC, and SSO to unlock larger organizational deployments.
6. **ARR Target:** Reach a baseline of £105k+ ARR to establish strong momentum for a potential Series A or secondary EIS round.

---

## 15. Related Documents

For growth-scenario projections beyond the SEIS-compliant forecasts in this document, see:
- **INVESTEC_PITCH.md** — Moonshot growth projections for institutional investors
- **GEMINI_MARKET_VALIDATION.md** — Independent third-party market validation
- **VALUATION_ANALYSIS.md** — Eight-method valuation framework

---
*Document Version: 2.3 (SEIS Advance Assurance Edition)*
*Prepared: March 2026*
