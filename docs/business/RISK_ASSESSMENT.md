# SPIKE LAND LTD — Structured Risk Assessment

**Prepared by:** Internal Risk Advisory
**Date:** 9 March 2026
**Classification:** Internal — Advisory Only
**Subject:** SPIKE LAND LTD (Company No. 16906682), Brighton, UK
**Purpose:** Pre-investment due diligence risk framework

---

## Executive Summary

Spike Land Ltd is an early-stage developer platform company building an edge-native AI tooling runtime on Cloudflare Workers. The company is pre-revenue, sole-founder led, and has reached functional public beta with an open-source codebase and 80+ MCP tools. The opportunity is credible and technically sophisticated. The risk profile is high across multiple dimensions, with key-person concentration and absence of commercial infrastructure representing the most immediate concerns. This assessment does not constitute investment advice.

**Composite Risk Score: 38/50 (High)**

---

## 1. Risk Register

Risk scores are the product of severity (1-5) and likelihood (1-5), giving a maximum of 25. Scores above 15 are classified High, 9-15 Medium, below 9 Low.

---

### 1.1 Founder / Team Risks

| ID | Risk | Severity | Likelihood | Score | Classification |
|----|------|----------|------------|-------|----------------|
| FT-01 | Sole founder incapacitation (health, burnout, departure) | 5 | 3 | 15 | High |
| FT-02 | No second technical leader — bus factor = 1 | 4 | 4 | 16 | High |
| FT-03 | No commercial or GTM counterpart | 4 | 5 | 20 | High |
| FT-04 | Founder bandwidth limits simultaneous build/sell/hire | 3 | 5 | 15 | High |

**FT-01 Mitigation:** Immediate documentation of architecture, credentials, and runbooks. Appoint a technical co-founder or VP Engineering within 6 months. Ensure key-man insurance prior to any investment close. Timeline: 0-3 months for documentation, 3-9 months for hire.

**FT-02 Mitigation:** Open-source codebase partially mitigates this (community can fork), but commercial continuity requires a second senior engineer with architectural context. Timeline: 3-6 months.

**FT-03 Mitigation:** Earliest commercial hire should be a Founding Head of Growth/DevRel with technical credibility, not a generic seller. The role exists to source and close design partners, then translate that learning into repeatable distribution. Timeline: immediately after the first design-partner proof points, not 6-12 months post-seed.

**FT-04 Mitigation:** Structured founder time-boxing — fixed days per week on product, business development, and hiring. External fractional COO for 3-6 months to absorb operational load. Timeline: Immediate.

---

### 1.2 Market Risks

| ID | Risk | Severity | Likelihood | Score | Classification |
|----|------|----------|------------|-------|----------------|
| MK-01 | Category crowded: Vercel, Netlify, Supabase, Fly.io, Deno Deploy | 4 | 4 | 16 | High |
| MK-02 | AI tooling market consolidates around 2-3 dominant platforms | 4 | 3 | 12 | Medium |
| MK-03 | MCP protocol fails to achieve standard adoption | 4 | 3 | 12 | Medium |
| MK-04 | Developer platform spend freezes in macro downturn | 3 | 2 | 6 | Low |
| MK-05 | Anthropic, OpenAI, or Google ship a competing MCP registry | 5 | 3 | 15 | High |

**MK-01 Mitigation:** Differentiation must be specific and defensible. The combination that matters commercially is tool-first verification plus the managed runtime above raw edge compute, not a broad "app store" claim. The risk is that without customers, that workflow-layer thesis remains unproven. Timeline: validate it with 20+ targeted conversations and 3 design partners within 90 days.

**MK-03 Mitigation:** MCP (Model Context Protocol) is an Anthropic-led standard with growing ecosystem adoption. The risk is real but partially mitigated by the company's early positioning. Hedge by ensuring the platform is protocol-layer agnostic where possible. Timeline: Monitor quarterly.

**MK-05 Mitigation:** First-mover advantage in open registries and community tooling is real but narrow. The company needs developer community lock-in (stars, contributors, extensions) before a well-resourced incumbent can replicate. Timeline: Community growth is the single most important 12-month metric.

---

### 1.3 Technology Risks

| ID | Risk | Severity | Likelihood | Score | Classification |
|----|------|----------|------------|-------|----------------|
| TK-01 | Custom React implementation introduces maintenance overhead vs upstream | 3 | 4 | 12 | Medium |
| TK-02 | WASM esbuild dependency creates edge compatibility fragility | 3 | 3 | 9 | Medium |
| TK-03 | Monorepo scale (25 packages) creates integration complexity | 2 | 4 | 8 | Low |
| TK-04 | Security vulnerabilities in open-source MCP surface | 4 | 3 | 12 | Medium |
| TK-05 | D1 (Cloudflare) as primary database — no independent persistence layer | 4 | 2 | 8 | Low |

**TK-01 Mitigation:** The custom React implementation (react-ts-worker) represents a meaningful technical bet. If the Founder departs, this becomes effectively unmaintainable. Document the architecture thoroughly. Consider whether it remains in scope for commercial product or is quarantined as a research artifact. Timeline: 3 months.

**TK-04 Mitigation:** Open-source exposure means vulnerabilities are public. Implement automated dependency scanning (Dependabot or equivalent), a responsible disclosure policy, and a security contact address. Timeline: Immediate, prior to commercial launch.

---

### 1.4 Commercial Risks

| ID | Risk | Severity | Likelihood | Score | Classification |
|----|------|----------|------------|-------|----------------|
| CM-01 | No billing or metering infrastructure | 4 | 5 | 20 | High |
| CM-02 | No disclosed pricing model | 4 | 5 | 20 | High |
| CM-03 | Open-source model may prevent monetisation of core product | 4 | 3 | 12 | Medium |
| CM-04 | Developer-first GTM requires long sales cycles for enterprise | 3 | 4 | 12 | Medium |
| CM-05 | No design-partner success or support infrastructure | 3 | 5 | 15 | High |

**CM-01 / CM-02 Mitigation:** This is the highest-priority risk after key-person. The company cannot convert beta users to paying customers without billing infrastructure. Stripe + usage metering can be stood up within 6-8 weeks by a single engineer once pricing is decided. The pricing model decision should be made before any commercial hire. Timeline: 60 days.

**CM-03 Mitigation:** Open-core is a proven model (HashiCorp, Grafana, Supabase). The company must clearly define what is open (the runtime, the SDK, the protocol adapters) and what is commercial (hosted infrastructure, SLAs, enterprise SSO, audit logs, team management). This line must be drawn now. Timeline: 60 days, prior to any fundraise narrative.

---

### 1.5 Financial Risks

| ID | Risk | Severity | Likelihood | Score | Classification |
|----|------|----------|------------|-------|----------------|
| FN-01 | Unknown burn rate and runway — no disclosed financials | 5 | 5 | 25 | Critical |
| FN-02 | Pre-revenue means zero financial resilience to delay | 4 | 4 | 16 | High |
| FN-03 | Seed capital may be insufficient for commercial buildout | 3 | 3 | 9 | Medium |
| FN-04 | No disclosed cap table structure post-incorporation | 3 | 3 | 9 | Medium |

**FN-01 Mitigation:** An investor cannot size a position without knowing the burn rate and runway. This is a blocking condition for any capital commitment. The founder must produce a 24-month financial model with three scenarios (lean/base/growth) before close. Timeline: Required before term sheet.

**FN-04 Mitigation:** Company was incorporated recently (implied by company number range). Confirm cap table is clean — no undisclosed option grants, founder vesting schedule in place, no co-founder equity disputes dormant. Timeline: Legal review within 30 days.

---

### 1.6 Legal / Regulatory Risks

| ID | Risk | Severity | Likelihood | Score | Classification |
|----|------|----------|------------|-------|----------------|
| LG-01 | UK GDPR compliance for platform handling user data and AI outputs | 4 | 3 | 12 | Medium |
| LG-02 | EU AI Act applicability as AI tooling provider | 3 | 2 | 6 | Low |
| LG-03 | Open-source licence compliance (dependencies, redistribution) | 3 | 3 | 9 | Medium |
| LG-04 | No disclosed terms of service or acceptable use policy | 3 | 4 | 12 | Medium |
| LG-05 | IP ownership unclear if any code written by contractors | 3 | 2 | 6 | Low |

**LG-01 Mitigation:** If the platform processes developer or end-user data, a Data Protection Officer appointment (or equivalent) and a privacy notice are legally required under UK GDPR. Register with the ICO. Timeline: Immediate, prior to commercial launch.

**LG-03 Mitigation:** Review all open-source dependencies for licence compatibility before commercial launch. Pay particular attention to any GPL-licensed transitive dependencies in the commercial product. Timeline: 30-day audit.

---

### 1.7 Platform Dependency Risks

Addressed in detail in Section 3 below.

| ID | Risk | Severity | Likelihood | Score | Classification |
|----|------|----------|------------|-------|----------------|
| PD-01 | Cloudflare pricing change making unit economics unviable | 4 | 2 | 8 | Low |
| PD-02 | Cloudflare discontinues D1, Durable Objects, or Workers | 4 | 2 | 8 | Low |
| PD-03 | Cloudflare becomes a direct competitor in MCP tooling | 4 | 3 | 12 | Medium |
| PD-04 | Cloudflare account suspension (ToS violation or error) | 5 | 1 | 5 | Low |
| PD-05 | Vendor lock-in prevents future infrastructure negotiation | 3 | 4 | 12 | Medium |

---

## 2. Key-Person Risk Mitigation Plan

The company is currently a single-person operation. This is the most structurally dangerous risk at this stage: not because the founder is weak, but because the entire company's institutional knowledge, technical architecture, and commercial relationships are held in a single person.

### Phase 1: Immediate Documentation (Months 0-3)

The objective of this phase is to ensure the company could survive a 4-week founder absence without total operational failure.

**Architecture and systems documentation:**
- Full written architecture overview for each of the 25 packages, particularly spike-edge, spike-land-mcp, mcp-auth, and the custom React runtime
- Operational runbooks: deployment procedure, incident response, Cloudflare configuration, DNS, secrets rotation
- All credentials stored in a team-accessible secrets manager (1Password Teams or Bitwarden) — not on the founder's personal device
- Domain registrar and Cloudflare account must have a secondary owner or emergency access contact

**Legal and governance:**
- Appoint a named emergency contact with power of attorney for company operations in case of incapacitation
- Ensure company bank account has a second authorised signatory

**Codebase legibility:**
- All core modules must have a README explaining purpose, interfaces, and design decisions
- No undocumented internal packages

### Phase 2: First Hires (Months 3-9)

The hiring priority order is not arbitrary. Each hire removes a specific single point of failure.

**Hire 1 — Founding Head of Growth/DevRel (months 3-5):**
This is the commercial unlock. The company needs someone who can run technical discovery, close design partners, and build a repeatable account pipeline without losing credibility with engineering teams. They are not a generic marketer. Budget: Senior UK commercial operator with developer-tools credibility, £70-90k base plus equity.

**Hire 2 — Senior Full-Stack Engineer (months 4-7):**
Must have Cloudflare Workers experience or adjacent edge background. Primary purpose is to absorb architectural context, improve onboarding capacity, and remove the bus-factor-one risk from customer support and runtime hardening. Budget: Senior UK engineer, £80-100k base plus equity.

**Advisory board (months 1-3):**
Recruit 2-3 advisors with specific gaps to fill: one enterprise SaaS commercial operator, one Cloudflare ecosystem insider, one UK/EU legal counsel specialising in technology companies. Advisors cost equity (typically 0.1-0.25% each with a 2-year vest) and provide accountability, warm introductions, and pattern-matching.

### Phase 3: Governance (Months 9-12)

Once a seed round is closed, establish a formal board with at least one independent non-executive director. Institute monthly management accounts, quarterly board reporting, and annual financial audit. The company should be run as if it already has institutional shareholders — because it will.

---

## 3. Platform Dependency Analysis

### Current Exposure

The entire production stack runs on Cloudflare:

- **Compute:** Workers (edge functions)
- **Database:** D1 (SQLite at edge)
- **State:** Durable Objects (real-time sync)
- **Compilation:** esbuild-wasm at edge
- **Routing and CDN:** Cloudflare network

This is not inherently wrong. For a solo founder building an edge-native platform, Cloudflare's developer experience, pricing model, and global footprint are genuinely superior to alternatives at this stage. The dependency becomes a risk at commercial scale, not at pre-revenue stage.

### Scenario 1: Cloudflare Pricing Change

Cloudflare has historically been developer-friendly on pricing, and Workers pricing has not increased materially since launch. However, Cloudflare is a public company (NET) with shareholder obligations and has raised prices on other products. If Workers or D1 pricing increases 3-5x, the company's unit economics could become unviable depending on usage patterns.

**Mitigation:** Build cost monitoring from day one. Understand the marginal cost per active user, per tool invocation, and per D1 query. If the unit economics are healthy at current pricing with 2-3x headroom, the near-term risk is manageable. If the business is already margin-negative at current pricing, that is the more urgent problem.

**Migration path:** The MCP runtime and tool handlers are Hono-based and could be migrated to Deno Deploy, Fastly Compute, or a Node.js host (Railway, Render, Fly.io) with meaningful but finite engineering effort — estimated at 4-8 weeks for a 2-person team. D1 migration to PlanetScale or Turso (edge SQLite, architecturally similar) would be the most friction-intensive component.

### Scenario 2: Cloudflare Discontinues a Core Product

D1 and Durable Objects are relatively new products. Cloudflare has a history of shipping and then investing heavily in products rather than discontinuing them, but neither D1 nor Durable Objects has been formally GA for long. Cloudflare has provided no contractual commitment to perpetual product availability.

**Mitigation:** The block-sdk storage adapter pattern described in the codebase (D1/IndexedDB/memory adapters) is architecturally sound. If the abstraction is maintained, swapping the underlying D1 adapter for a different SQLite-compatible edge store is feasible. The key question is whether the Durable Objects usage (real-time sync in spike-land-backend) can be abstracted similarly. If Durable Objects is tightly coupled, that is the highest migration risk.

**Recommendation:** Formally document which components are tightly coupled to Cloudflare primitives versus which are behind an abstraction layer. This should be a 1-page architectural decision record (ADR), not a full refactor.

### Scenario 3: Cloudflare Becomes a Direct Competitor

This is the highest-probability scenario of the three. Cloudflare has launched Workers AI, AI Gateway, and Vectorize. It is actively building AI infrastructure. The MCP tooling and app store layer is a plausible product extension for Cloudflare given their existing developer relationships.

**Mitigation:** The competitive moat against Cloudflare specifically is not the technology — it is the community, the open standard, and the ecosystem of third-party tools. Cloudflare can build infrastructure. It cannot easily replicate a community-driven tool registry with hundreds of contributed tools. The company should aggressively grow the contributor ecosystem precisely because that is the one asset Cloudflare cannot replicate quickly.

Additionally: being acquired by Cloudflare is a plausible and not-unfavourable exit scenario. That framing should inform how the company positions itself technically.

### Scenario 4: Cloudflare Account Suspension

Low probability but existential if it occurs. Could result from accidental ToS violation, security incident, or erroneous automated enforcement.

**Mitigation:** Maintain a parallel Cloudflare account (separate billing entity) with a staging deployment that could be promoted to production. Keep DNS TTLs low on production domains. Maintain regular exports of all D1 data. Have a documented recovery procedure that could restore production in under 24 hours. This is standard disaster recovery hygiene.

---

## 4. Commercial Readiness Scorecard

Scores are 0-10. 0 = absent, 5 = partially in place, 10 = production-ready.

| Dimension | Score | Evidence | What 10 Looks Like |
|-----------|-------|----------|-------------------|
| Pricing model clarity | 1/10 | No disclosed pricing. No public pricing page. | Clear tier structure (free/pro/team/enterprise) with defined limits, published on website |
| Billing infrastructure | 0/10 | No billing layer in codebase. No Stripe integration. | Stripe Billing with usage-based metering, invoice generation, dunning management |
| Onboarding flow | 3/10 | Auth MCP server exists (Better Auth). Unclear what the first 10 minutes of user experience is. | Documented onboarding funnel with activation metric defined and measured |
| Support capability | 1/10 | No disclosed support channel. Open-source issues on GitHub only. | Tiered support (community/email/SLA-backed) with defined response times per tier |
| Contract / legal readiness | 1/10 | No disclosed ToS, privacy policy, or DPA template. | Published ToS, privacy policy, DPA template, enterprise MSA, and software licence terms |
| Compliance posture | 2/10 | UK-incorporated. ICO registration status unknown. GDPR readiness unknown. | ICO registered, GDPR-compliant data flows documented, SOC 2 Type I in progress |
| Sales materials | 0/10 | No pitch deck, one-pager, or case studies visible. | Pitch deck, 1-page leave-behind, customer case studies, ROI calculator |
| Design-partner success process | 1/10 | Pre-revenue and no formal design-partner operating cadence documented in product systems yet. | Named owner, weekly operating review, shared success criteria, renewal path, and a documented conversion process from pilot to paid |

**Composite Commercial Readiness Score: 8/80 (10%)**

This score reflects a company that is technically functional but commercially pre-launch. This is expected at pre-revenue beta stage. However, it means that capital raised now will need to fund the entire commercial buildout from scratch — which should be reflected in the valuation and milestone structure of any investment.

---

## 5. Investment Conditions

The following conditions are recommended before committing capital. They are structured as pre-condition requirements, close conditions, and post-close covenants.

### Pre-Conditions (Required Before Term Sheet Signature)

1. **Financial disclosure:** Full management accounts since incorporation, a 24-month financial model with three scenarios, and a clear statement of current monthly burn rate and runway at current spend.

2. **Cap table disclosure:** Full capitalisation table, confirmation of founder vesting schedule (standard: 4 years, 1-year cliff), confirmation of no undisclosed equity obligations.

3. **Legal health check:** External solicitor review of incorporation documents, any existing contracts, IP assignment confirmations, and absence of encumbrances on the company's assets.

4. **Data protection status:** Confirm ICO registration status and provide a basic data flow map confirming personal data handling.

5. **20 developer interviews:** Evidence of at least 20 structured conversations with target users (developers, AI engineers, platform engineers) confirming the problem hypothesis and product-market fit indicators.

### Close Conditions (Required Before Funds Release)

1. **Key-man insurance:** Minimum £1m policy on the founding director, with the company as beneficiary.

2. **Emergency documentation package:** Architecture runbook, credential access documentation, and emergency operational procedure delivered to a nominated escrow or legal firm.

3. **Second authorised signatory:** Company bank account must have a second authorised signatory (investor nominee or independent director).

4. **Board composition:** Investor board seat (or observer right at minimum) established at close.

5. **Pricing and commercial model decision:** A written decision on the open-core commercial model — what is free, what is paid, and indicative pricing — delivered to investors before funds released.

### Post-Close Covenants (Ongoing Obligations)

1. **Monthly management accounts** delivered within 15 business days of month-end, covering: revenue, burn, runway, key operating metrics (active users, tool invocations, developer signups).

2. **Quarterly board meetings** with a written board pack delivered 5 business days in advance.

3. **Hiring plan milestones:** First senior engineer hired within 6 months of close. First commercial/DevRel hire within 12 months of close. Written justification required if milestones are missed.

4. **Commercial infrastructure milestones:** Stripe billing live within 90 days of close. Pricing page published within 60 days of close. First paying customer within 9 months of close.

5. **Information rights:** Investor right to inspect the codebase, financial records, and company documents on 5 business days' notice.

6. **Consent rights:** Investor consent required for: sale of the company, issue of new shares above a defined threshold, any single commercial contract above £50k, any debt facility above £25k, change of business purpose.

7. **Leaver provisions:** Standard good/bad leaver provisions on founder shares with reverse vesting from date of incorporation.

---

## 6. Scenario Analysis

### Bull Case: 10x Return in 5 Years

**What must be true:**

The MCP protocol achieves the same kind of ecosystem primacy that REST achieved in the 2010s — it becomes the default interface for AI tool integration, and spike.land is the dominant public registry for MCP tools, analogous to npm for Node.js or Docker Hub for containers.

Specific conditions required:

- Anthropic and at least one other major AI lab (Google, Meta, Mistral) formally adopt MCP as a first-class standard, driving millions of developers to the protocol
- Spike.land captures at least 15-20% of tool publishing and discovery in the MCP ecosystem within 3 years
- The platform monetises via a combination of: hosted execution (per-invocation fees), enterprise registry (private tool registries on self-hosted or managed infrastructure), and a marketplace take-rate on commercial tool transactions
- A Series A of £3-5m closes within 18 months, funding a 6-8 person team capable of sustaining the community and building the enterprise layer
- The founder successfully hires a commercially-oriented co-leader (CTO or COO equivalent) within 12 months who takes over operational execution

**Financial illustration:** At 15% registry market share in a 10m-developer ecosystem, with average revenue per developer of £100/year (conservative for SaaS infrastructure), annual revenue would be approximately £150m. At a 10x revenue multiple (reasonable for infrastructure SaaS), that implies a £1.5bn exit or market capitalisation. A seed investment at £3-5m valuation today implies a 300-500x return in that scenario. A 10x return requires a much more modest outcome — roughly £30-50m exit — which is achievable if the company establishes itself as the go-to tool registry and is acquired by a larger infrastructure player (Cloudflare, Vercel, GitHub/Microsoft, Atlassian).

### Base Case: Realistic Outcome with Current Trajectory

The company raises a seed round of £500k-£1.5m in H1 2026, likely from UK angel investors or a pre-seed specialist fund (Entrepreneur First, Seedcamp, LocalGlobe). The founder hires one senior engineer and begins building commercial infrastructure in parallel with community growth.

The platform achieves 5,000-10,000 registered developers within 18 months, with a conversion rate of 2-5% to paid tiers. Revenue reaches £200-500k ARR by end of year 2. The company raises a Series A on the back of this traction but at a modest valuation given the crowded category.

At year 5, the company either: (a) achieves £2-5m ARR and becomes a profitable small infrastructure business with a sustainable niche in the MCP ecosystem, or (b) is acquired for £5-20m by a larger platform player seeking to internalise the tool registry capability. Neither outcome is a venture-scale return at today's likely entry valuation, but both represent capital preservation with modest upside.

**Key pivot risk:** If MCP fails to achieve broad adoption, the company needs to pivot to either a more general developer tooling platform (competing more directly with established players) or a vertical application layer. The technical assets (edge runtime, open-source codebase, Cloudflare expertise) remain valuable in either direction, but the pivot would cost 6-12 months.

### Bear Case: What Kills the Company

**Scenario A — Founder burnout or departure.** The company is entirely dependent on a single person. If Founder steps back for any reason — health, competing opportunity, personal circumstances — the company has no operational continuity. Without a commercial layer, there are no customers to fight for the company's survival. The open-source codebase would continue to exist on GitHub, but the company would cease to operate. This is the most probable path to failure.

**Scenario B — Commercial stall.** The company raises seed capital, builds a team, but fails to convert developer interest into paying customers. Developer platforms have notoriously long adoption curves and low willingness-to-pay at the individual level. If the company spends 18 months building community without building revenue infrastructure, it exhausts its runway before achieving commercial traction. At this point, it is too early for a strategic acquirer and too small for a venture rescue round.

**Scenario C — Ecosystem consolidation by incumbents.** Anthropic ships a first-party MCP tool registry as part of Claude.ai. Cloudflare ships Workers AI tooling with a native registry. GitHub (Microsoft) ships a Copilot extensions marketplace. Each of these is plausible within 24 months. If two or three incumbents ship competing solutions simultaneously, the oxygen in the room is removed. The open-source community may migrate to whichever registry has the most distribution. Spike.land, without an established commercial moat, cannot compete on distribution.

**Scenario D — Regulatory or IP event.** Less likely but non-trivial: a GDPR enforcement action arising from mishandled user data on the platform, or a claim that open-source tool contributions contain IP from undisclosed sources, could impose legal costs that are existential at this capital level.

---

## Summary: Highest-Priority Actions

In priority order, the following actions are recommended before any capital commitment is made:

1. Produce management accounts and a financial model (required before term sheet)
2. Document all architecture, credentials, and operational procedures (required before close)
3. Obtain key-man insurance (required before close)
4. Define the open-core commercial boundary and draft pricing tiers (required within 60 days of close)
5. Stand up Stripe billing and usage metering (required within 90 days of close)
6. Register with the ICO and publish ToS and privacy policy (required before commercial launch)
7. Make first senior engineering hire (required within 6 months of close)
8. Make first DevRel / GTM hire (required within 12 months of close)

---

*This document was prepared for internal advisory purposes only and does not constitute investment advice, a recommendation to invest, or a valuation opinion. All risk assessments are based on publicly available information and disclosed characteristics of the company as of the preparation date. No representations are made as to the accuracy or completeness of the information provided by or about the subject company.*
