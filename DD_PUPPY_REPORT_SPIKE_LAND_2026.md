# Due Diligence Report — SPIKE LAND LTD

> **Report ID**: DD-PUPPY-2026-001
> **Created**: 11 March 2026
> **Analysis Mode**: Full document set — evidence-native
> **Currency Default**: GBP (£)
> **Analyst Lens**: Senior fintech operator (14+ years institutional banking, startup MD, B2B fintech advisor seed→Series B+)

---

## Company

| Field | Value |
|---|---|
| **Company Name** | Spike Land |
| **Legal Name** | SPIKE LAND LTD |
| **Website** | spike.land |
| **Incorporation Country** | England & Wales |
| **Headquarters** | Brighton, UK |
| **Company Number** | 16906682 |
| **Founding Year** | 2025 (incorporated 12 December 2025; project origin 2020) |
| **Stage** | Pre-revenue, public beta |
| **Sector** | Developer tools / AI tooling infrastructure |
| **Customer Model** | B2B (QA-heavy agencies, AI consultancies) |
| **Business Model Primary** | SaaS subscriptions + usage-based pricing |

**Summary**: Spike Land is a managed runtime, registry, and control layer for typed AI-callable tools (MCP — Model Context Protocol). The company is attempting to insert itself between raw edge compute (Cloudflare Workers) and the emerging MCP ecosystem, with the first commercial wedge targeting QA-heavy software agencies whose Playwright/Cypress suites are slow and flaky. The product is technically advanced — 80+ hosted tools, a working CLI multiplexer, and a monorepo of 25+ packages — but is entirely pre-revenue, sole-founder operated, and commercially unbuilt.

- **Confidence**: 0.85
- **Evidence IDs**: E-01, E-02, E-03, E-04

---

## Document Set

| Document ID | Type | Title | Reliability Tier |
|---|---|---|---|
| DOC-01 | Investor brief | INVESTEC_PITCH.md | Tier 2 — Founder-prepared |
| DOC-02 | Business plan | BUSINESS_PLAN.md | Tier 2 — Founder-prepared |
| DOC-03 | Company structure | BUSINESS_STRUCTURE.md | Tier 1 — Contains verifiable public facts |
| DOC-04 | Founder profile | ZOLTAN_ERDOS.md | Tier 3 — Self-reported |
| DOC-05 | Valuation analysis | VALUATION_ANALYSIS.md | Tier 3 — Self-prepared, no external validation |
| DOC-06 | Risk assessment | RISK_ASSESSMENT.md | Tier 2 — Internally rigorous |
| DOC-07 | Design partners | DESIGN_PARTNERS.md | Tier 2 — Operational document |
| DOC-08 | Target accounts | BRIGHTON_TARGET_ACCOUNTS.md | Tier 2 — Operational document |
| DOC-09 | Subscriptions & costs | SUBSCRIPTIONS.md | Tier 1 — Verifiable cost data |
| DOC-10 | SEIS guidance | SEIS_ADVANCE_ASSURANCE.md | Tier 2 — Legal working document |
| DOC-11 | Competitive positioning | COMPETITIVE_POSITIONING_MEMO.md | Tier 3 — Aspirational framing |
| DOC-12 | Founding bench plan | FOUNDING_BENCH_PLAN.md | Tier 2 — Operational document |
| DOC-13 | Technical appendix | INVESTEC_PITCH_APPENDIX.md | Tier 2 — Founder-prepared |
| DOC-14 | Codebase metadata | CLAUDE.md / package.json | Tier 1 — Verifiable from source |

**Source Coverage**: MEDIUM — Strong on product/technical documentation, company structure, and operational planning. Weak on: financial accounts, cap table detail, customer validation evidence, independent market data, external references. No third-party validation of any claim.

---

## Classification

| Dimension | Value | Confidence | Rationale |
|---|---|---|---|
| **Commercialization Status** | Pre-commercial (no billing, no pricing, no customers) | 0.95 | Confirmed across all docs. Stripe checkout described as "nearing completion" [DOC-01] and "in progress" [DOC-02] |
| **Capital Intensity** | Low-medium | 0.80 | Infrastructure runs on Cloudflare at ~£450/month. Scaling costs are usage-based. Hiring is the primary capital need. |
| **Regulatory Exposure** | Low (current), medium (if COMPASS pursues regulated use cases) | 0.70 | No regulated activity today. COMPASS positioned as "regulated workflow" proof point but no actual regulatory engagement. |
| **Execution Complexity** | High | 0.90 | Requires simultaneous: product hardening, commercial buildout from zero, founder de-risking, hiring, and wedge validation. All on £250k. |

---

## Executive View

### One-Line Summary

A technically impressive but commercially unproven solo-founder platform play that is honest about its gaps but has not yet validated whether anyone will pay for the product.

- **Confidence**: 0.85
- **Evidence IDs**: E-01, E-02, E-05, E-06, E-15

### Overall Assessment

Spike Land presents an unusual combination: genuine technical depth, unusually honest self-assessment, and zero commercial proof. The founder has built something real — a working edge-native runtime, 80+ MCP tools, a CLI multiplexer, QA automation tooling — but has done so entirely alone, with no revenue, no customers, no billing infrastructure, and no commercial hire. The Investec pitch and business plan are notable for their discipline: the company openly identifies key-person risk, Cloudflare dependency, and GTM weakness as the primary threats, and frames the raise explicitly as "buying proof and resilience, not vanity scale."

The QA wedge (replacing brittle Playwright/Cypress flows with typed tool contracts) is a credible first customer motion, but it remains a hypothesis. Zero discovery calls have been completed. Zero design partners are onboarded. The Brighton target account list is five local agencies, all at "prospect" status. The gap between "architecturally interesting" and "investable" — which the company itself names as the core challenge — is entirely intact.

From a Jamie-weighted scoring perspective: founder-market fit is partially credible (strong technical, weak commercial), traction is absent, regulatory readiness is not yet relevant, financial sustainability cannot be assessed (no financials disclosed), and the market is real but crowded.

**The most important thing this report can say**: the company's own documents are more honest than most seed decks. The risk is not that the founder is hiding problems. The risk is that the problems are real and the capital may be insufficient to solve them.

- **Confidence**: 0.80
- **Evidence IDs**: E-01 through E-15

### Top Strengths

1. **Unusual self-awareness and honesty** — The pitch and plan explicitly identify key-person risk, commercial absence, and Cloudflare dependency. This is rare. It reduces information risk for an investor, even if it does not reduce execution risk. (Confidence: 0.90, Evidence: E-01, E-02, E-06)

2. **Technical product exists and is verifiable** — This is not a concept deck. The codebase is open-source, the monorepo has 25+ packages, 80+ tools, 943K lines of TypeScript (claimed), and the infrastructure runs on Cloudflare Workers today. Technical execution risk is materially lower than typical pre-seed. (Confidence: 0.85, Evidence: E-04, E-14)

3. **Low infrastructure cost base** — Monthly burn on infrastructure is ~£450. The company can survive at founder-only level for an extended period on minimal capital. This creates optionality. (Confidence: 0.90, Evidence: E-09)

4. **Credible first wedge hypothesis** — The QA pain (slow CI, flaky browser tests, repeated setup) is real and felt by agencies. The tool-first verification thesis is architecturally sound. Whether agencies will pay a solo-founder startup to address it is unknown, but the pain is genuine. (Confidence: 0.65, Evidence: E-01, E-02, E-07)

### Top Concerns

1. **Zero commercial proof** — No revenue, no customers, no design partners, no discovery calls completed, no pricing page, no billing infrastructure. The company is commercially at absolute zero. This is the single most important fact in the assessment. (Severity: Critical, Confidence: 0.95, Evidence: E-06, E-02)

2. **Sole founder with no commercial counterpart** — The company is entirely Zoltan Erdos. If he is incapacitated, the company ceases. He is also the only person who has ever spoken to a potential customer about the product. There is no GTM function, no sales, no DevRel, no second engineer. (Severity: Critical, Confidence: 0.95, Evidence: E-06, E-03, E-04)

3. **Valuation analysis is internally generated and optimistic** — The company's own valuation doc recommends £3.5M-£5.5M pre-money for a pre-revenue, single-person company with zero customers. This is detached from market reality for a UK SEIS round. The cost-to-replicate method (£6.5M-£12M) is particularly misleading — it values code-written-by-one-person at multi-engineer-team replacement cost. (Severity: High, Confidence: 0.85, Evidence: E-05)

4. **Capital may be insufficient** — £250k SEIS needs to fund: completing billing, closing design partners, hiring Head of Growth (£70-90k), hiring senior engineer (£80-100k), and running the business. At realistic UK salary levels plus NI/pension, the hiring budget alone consumes the raise. Runway after hiring may be 6-9 months at best. (Severity: High, Confidence: 0.80, Evidence: E-02, E-06, E-09)

---

## Extracted Facts

| Fact ID | Category | Field | Value | Confidence | Evidence |
|---|---|---|---|---|---|
| F-01 | Company | Legal entity | SPIKE LAND LTD, Company #16906682 | 1.00 | E-03 |
| F-02 | Company | Incorporation date | 12 December 2025 | 1.00 | E-03 |
| F-03 | Company | Registered address | 42 Mighell Street, Apt 70, Brighton BN2 0AU | 1.00 | E-03 |
| F-04 | Company | Employees | 0 (sole director) | 0.95 | E-02, E-03 |
| F-05 | Company | Ownership | 100% Zoltan Erdos, 1 ordinary share at £1 | 0.95 | E-03, E-10 |
| F-06 | Financial | Monthly infrastructure cost | ~£450 | 0.90 | E-09 |
| F-07 | Financial | Annual fixed costs | ~£5,400 (mid-range with usage) | 0.85 | E-09 |
| F-08 | Financial | Revenue | £0 | 1.00 | E-01, E-02 |
| F-09 | Financial | Fundraise target | Up to £250,000 SEIS | 0.90 | E-02, E-10 |
| F-10 | Product | MCP tools hosted | 80+ (pitch docs); 533+ (valuation doc) | 0.60 | E-01 vs E-05 — contradiction |
| F-11 | Product | Codebase size | ~943,723 lines TypeScript (claimed) | 0.50 | E-05 — self-reported, unverified |
| F-12 | Product | Git commits | 1,955+ | 0.70 | E-05 — self-reported |
| F-13 | Team | Founder background | 12+ years full-stack, 4 years at Investec (contractor), VMO2 (contractor) | 0.80 | E-04 |
| F-14 | Team | Founder education | ELTE Budapest, CS & Mathematics | 0.75 | E-04 — self-reported |
| F-15 | GTM | Design partners active | 0 | 1.00 | E-07 |
| F-16 | GTM | Discovery calls completed | 0 | 0.95 | E-07, E-08 |
| F-17 | GTM | Target accounts identified | 5 (all Brighton local, all "prospect" status) | 0.95 | E-07, E-08 |
| F-18 | Legal | SEIS advance assurance | Not yet applied | 0.90 | E-10 |
| F-19 | Legal | ICO registration | Unknown | 0.90 | E-06 |
| F-20 | Company | Prior fundraise | None | 0.95 | E-02, E-03 |

---

## Claim Register

| Claim ID | Claim | Category | Materiality | Status | Confidence | Support | Challenge |
|---|---|---|---|---|---|---|---|
| CL-01 | "The product base already exists" | Product | High | **Partial** | 0.75 | Codebase is open-source, deployments verifiable on Cloudflare | Billing, pricing, onboarding, and metering do not exist. "Product" in commercial sense is incomplete. |
| CL-02 | "Build risk is not the primary open question" | Product | High | **Partial** | 0.70 | Significant technical surface exists | Commercial infrastructure is zero. Build risk for the *commercial* product is entirely open. |
| CL-03 | "Pain is acute and already budgeted" (QA wedge) | Market | Critical | **Unverified** | 0.40 | QA pain in agencies is generally real | No evidence of conversations with target customers. "Already budgeted" is asserted without proof. |
| CL-04 | "80+ natively hosted tools" | Product | Medium | **Partial** | 0.60 | CLAUDE.md references 80+ tools. Valuation doc claims 533+ | Internal contradiction (80 vs 533). Neither count independently verified. |
| CL-05 | "Company appears to meet SEIS conditions" | Legal | High | **Unverified** | 0.55 | Working SEIS document is thorough and legally literate | No advance assurance applied for. No external accountant or counsel confirmed. |
| CL-06 | "£3.5M-£5.5M recommended pre-money" | Financial | Critical | **Contradicted** | 0.20 | Valuation doc uses 8 methods | All methods are self-applied with no external validation. Cost-to-replicate is inflated. Comparable transactions have no disclosed sources. For a zero-revenue, single-person UK SEIS company, market comparables suggest £500k-£1.5M pre-money. |
| CL-07 | "Spike Land is not two businesses" | Strategy | Medium | **Confirmed** | 0.80 | Pitch and plan consistently frame COMPASS as proof point, not revenue engine | However, earlier materials and valuation doc appear to present COMPASS as a material revenue driver. Messaging is inconsistent across doc set. |
| CL-08 | "Close 3 design partners in 90 days" | GTM | High | **Unverified** | 0.30 | Target list exists. Process documented. | Zero conversations started. No warm intros evident. 90-day timeline with zero pipeline is aggressive. |
| CL-09 | "First paid customer within 9 months of close" | GTM | Critical | **Unverified** | 0.35 | Revenue model and pricing indicative | No billing infrastructure. No pricing page. No validated willingness to pay. |
| CL-10 | "£20k-£60k revenue in 12 months" | Financial | High | **Unverified** | 0.30 | Business plan states range | Pre-revenue with zero pipeline. Even the low end requires multiple paying customers from a standing start. |
| CL-11 | "Zoltan has enterprise delivery experience including 4 years at Investec" | Team | Medium | **Partial** | 0.70 | LinkedIn-style profile confirms roles | Roles were contractor positions, not permanent. "4 years at Investec" as a contractor is different from "led teams at Investec" — the language in different docs varies in implication. |
| CL-12 | "No competitor offers this stack simultaneously" | Market | Medium | **Inferred** | 0.45 | Competitive positioning memo makes the argument | Self-assessed. No independent market validation. The combination may be unique because nobody else values it, not because it is defensible. |

---

## Team Analysis

### Founder

| Field | Value |
|---|---|
| **Name** | Zoltan Erdos |
| **Role** | Founder, CEO, sole director, sole developer |
| **Background** | 12+ years full-stack engineering. ELTE Budapest (CS & Math). Contractor at Investec (2018-2023), VMO2 (2023-present), TalkTalk (2014-2018), Keytree, Emarsys. |
| **Domain Fit** | Strong on developer tooling and infrastructure. Weak on QA-agency buyer relationships and enterprise sales. |
| **Execution Fit** | Exceptional on solo technical delivery. No evidence of commercial execution, hiring, or team leadership. |
| **Founder-Market Fit** | Partial. Understands the technical pain deeply. Has not demonstrated ability to sell, close, or build a commercial organisation. |
| **Availability** | Full-time on Spike Land (appears to still be contracting at VMO2 — status unclear) |
| **Prior Wins** | No prior startup exits. No prior fundraises. No prior product-market fit. |
| **Concerns** | ADHD disclosed openly (commendable). All roles were contractor/IC — no management experience visible. "Solo founder proving one person can build enterprise-grade software" is a belief system, not a commercial strategy. |
| **Confidence** | 0.70 |
| **Evidence** | E-04 |

### Team Size

- **Value**: 1 person
- **Status**: Confirmed
- **Confidence**: 0.95

### Hiring Gaps

| Role | Urgency | Reason |
|---|---|---|
| Head of Growth / DevRel | Critical — immediate post-close | Cannot validate wedge without someone who can sell and close design partners |
| Senior Engineer | High — months 3-6 | Bus factor = 1 is existential. Must reduce before commercial commitments. |
| Accountant / financial controller | Medium — pre-close | No management accounts, no financial model, no cap table disclosure |
| Legal counsel (external) | Medium — pre-close | ToS, privacy policy, DPA, SEIS assurance, shareholder agreements all outstanding |

### Key-Person Risk

- **Value**: CRITICAL — The entire company is one person. All technical knowledge, all commercial relationships, all strategic decisions, all infrastructure access.
- **Rationale**: Open-source codebase partially mitigates technical loss, but commercial continuity would be zero. No second signatory on bank account. No emergency access procedures documented (per risk assessment — these are recommended but status unclear).
- **Confidence**: 0.95

---

## Traction Analysis

### Traction Summary

- **Value**: Zero. No revenue, no customers, no design partners, no discovery calls, no qualified pipeline, no LOIs, no pilots.
- **Status**: Confirmed
- **Confidence**: 0.95
- **Evidence**: E-01, E-02, E-06, E-07, E-08

### Revenue

- **Amount**: £0
- **Period**: Since incorporation (Dec 2025)
- **Status**: Confirmed
- **Confidence**: 1.00

### Commercial Proof

| Proof Type | Description | Strength | Confidence |
|---|---|---|---|
| Product exists | Working platform, 80+ tools, CLI, open-source codebase | Moderate — proves technical capability, not commercial demand | 0.80 |
| Target account list | 5 Brighton agencies identified | Weak — no outreach conducted | 0.60 |
| Design partner framework | Detailed process doc, success metrics, onboarding checklist | Weak-Moderate — operational readiness without operational proof | 0.50 |

### Growth Metrics

None. The company has no users, no signups, no tool invocations, no community metrics, and no developer engagement data in the document set.

---

## Financial Analysis

### Current Revenue Quality

- **Value**: N/A — zero revenue
- **Confidence**: 1.00

### Burn Rate (Monthly)

- **Value**: ~£450 (infrastructure only) + unknown founder living costs
- **Status**: Partially confirmed (infrastructure costs verified, personal burn unknown)
- **Confidence**: 0.60
- **Rationale**: If the founder is still contracting at VMO2, personal runway is partially self-funded. If not, the burn is higher than disclosed.

### Runway (Months)

- **Value**: Unknown without management accounts
- **Status**: Unverified
- **Confidence**: 0.20

### Fundraising

| Field | Value |
|---|---|
| Raising now | Yes |
| Target amount | Up to £250,000 |
| Currency | GBP |
| Instrument | SEIS ordinary shares |
| Use of funds | 1) Finish billing, 2) Close design partners, 3) Hire Head of Growth, 4) Hire senior engineer, 5) Docs/governance |
| Status | Pre-fundraise (no term sheet, no SEIS assurance) |
| Confidence | 0.85 |

### Financial Red Flags

| Flag | Severity | Evidence | Confidence |
|---|---|---|---|
| No management accounts produced | High | E-06 explicitly requires this as pre-condition | 0.90 |
| No financial model with scenarios | High | E-06 requires this before term sheet | 0.90 |
| Founder employment status unclear | Medium | Profile says VMO2 "2023-present" but pitch implies full-time on Spike Land | 0.65 |
| £250k insufficient for stated use of funds | High | Two hires at UK rates consume the entire raise | 0.80 |
| Valuation expectation disconnected from stage | High | Self-assessed at £3.5-5.5M pre-money with zero revenue and zero customers | 0.85 |

---

## Risk Engine

### Overall Risk Level

- **Value**: HIGH
- **Confidence**: 0.85

### Overall Risk Score

- **Value**: 72/100 (higher = more risk)
- **Methodology**: Jamie-weighted (Team 30%, Traction 25%, Regulatory 15%, Financial 15%, Market/Ops 15%)

### Dimension Scores

| Dimension | Score (1-10) | Level | Rationale |
|---|---|---|---|
| **Market** | 6/10 | Medium | MCP tailwind is real. Developer tooling market is large. But crowded, with incumbents (Vercel, Cloudflare, GitHub) better-resourced. QA wedge is niche but unvalidated. |
| **Product** | 4/10 | Low-Medium | Product technically exists and is advanced for a solo founder. But commercial product (billing, pricing, onboarding) is absent. Custom React implementation adds maintenance burden. |
| **Traction** | 9/10 | Critical | Zero on every commercial dimension. No revenue, no customers, no pipeline, no discovery calls. This is the single highest-risk dimension. |
| **Financial** | 8/10 | High | No management accounts, no financial model, unknown burn rate, raise likely insufficient for stated hiring plan, valuation expectations disconnected from reality. |
| **Team** | 8/10 | High | One person. No commercial capability. No management experience. No co-founder. Bus factor = 1 on everything. ADHD disclosed (mitigated by routine, but adds to key-person risk assessment). |
| **Legal/Regulatory** | 5/10 | Medium | UK Ltd is clean and recent. SEIS appears eligible but not yet assured. No ToS, no privacy policy, no ICO registration, no DPA template. Low regulatory exposure currently but gaps need closing before commercial launch. |
| **Operational** | 7/10 | High | No operations beyond the founder. No support infrastructure, no SLAs, no incident response, no documented credential access. Excellent internal docs about what *should* exist, but the things don't exist yet. |

### Top Risks

| Risk ID | Title | Category | Severity | Likelihood | Time Horizon | Why It Exists | Mitigation |
|---|---|---|---|---|---|---|---|
| R-01 | Sole-founder failure (health, burnout, departure) | Team | Critical | Medium | 0-12 months | One person holds all knowledge, all relationships, all access | Key-man insurance, emergency docs, second engineer within 6 months, documented runbooks |
| R-02 | Commercial stall — zero to first customer | Traction | Critical | High | 0-12 months | No billing, no pricing, no validated demand, no sales capability | Must complete billing in 60 days, hire commercial person in 90 days, or thesis is dead |
| R-03 | Capital insufficiency | Financial | High | High | 0-12 months | £250k cannot fund two UK hires AND build the business | Either reduce scope (one hire not two), accept longer timeline, or raise more |
| R-04 | Cloudflare ships competing MCP surface | Market | High | Medium | 12-24 months | Cloudflare already building Workers AI and AI Gateway | Race to community lock-in and developer switching costs before Cloudflare moves |
| R-05 | MCP protocol does not become standard | Market | High | Medium | 12-36 months | MCP is Anthropic-led, not universally adopted | Architecture must remain protocol-agnostic where possible |
| R-06 | Valuation expectations prevent funding | Financial | High | Medium-High | 0-6 months | £3.5-5.5M expectation for zero-revenue company will be rejected by most SEIS angels | Reset expectations to £500k-£1.5M pre-money for realistic SEIS close |
| R-07 | Wedge hypothesis is wrong — agencies don't buy | Traction | High | Medium | 6-12 months | Typed tool contracts require behaviour change from target buyers | Must validate with 20+ conversations before investing in GTM hire |

---

## Scenario Analysis

### Base Case

The company closes a small SEIS round (£100-150k at £750k-£1M pre-money) from UK angel investors after demonstrating initial design partner traction. The founder hires one person (likely engineer) and continues founder-led sales. By month 12, 1-2 paying customers exist at small monthly values. By month 18, the company either raises a follow-on or becomes a profitable micro-SaaS. The MCP ecosystem grows modestly. Exit path: small acqui-hire or niche product company generating £200-500k ARR.

- **Confidence**: 0.40

### Upside Case

MCP becomes the dominant standard for AI tool integration. The QA wedge validates quickly (3+ paying customers by month 9). A Series A of £1-2M closes on the back of traction. The founder successfully hires a commercial counterpart. The platform achieves meaningful developer adoption (5,000+ registered developers). The company becomes a credible acquisition target for Cloudflare, Vercel, or a larger infrastructure player at £5-20M within 3-5 years.

- **Key assumptions**: MCP wins, wedge validates, founder can hire and delegate, Cloudflare does not replicate
- **Confidence**: 0.15

### Downside Case

The raise takes 6+ months or fails entirely. The founder burns out or returns to contracting. No design partners convert. The £250k (if raised) is consumed by hiring two people who don't produce commercial results. MCP is eclipsed by a competing standard or absorbed into a major platform. The company winds down within 18-24 months with capital returned to investors at a loss.

- **Key assumptions**: Founder bandwidth collapses, market does not develop, capital insufficient
- **Confidence**: 0.35

---

## Diligence Assistant

### Missing Information (Decision-Blocking)

| Item | Why Material | Priority | Blocks Decision |
|---|---|---|---|
| Management accounts since incorporation | Cannot assess burn rate, runway, or financial health | P0 | YES |
| Founder employment status (still contracting at VMO2?) | Affects full-time commitment and personal runway | P0 | YES |
| Cap table and any option/equity commitments | Must confirm clean structure before investing | P0 | YES |
| Evidence of any customer conversations | Cannot assess demand without even qualitative signal | P1 | YES |
| Financial model with 3 scenarios | Required by company's own risk assessment | P1 | YES |
| ICO registration status | Legal compliance requirement | P1 | Partially |
| Articles of Association | Must confirm SEIS-compatible share structure | P1 | YES |
| Key-man insurance quote | Required at close per risk assessment | P2 | At close |

### Questions To Ask The Founder

| Question | Purpose | Priority |
|---|---|---|
| Are you still contracting at VMO2? If so, when do you stop? | Determines commitment level and personal runway | P0 |
| What are your personal monthly living costs? How long can you survive without salary? | Sizes the real runway and whether £250k is enough | P0 |
| Have you spoken to ANY potential customer about this product? Even informally? | Validates whether demand signal exists at any level | P0 |
| Why do you believe the company is worth £3.5-5.5M pre-money? Would you accept £750k-£1M? | Tests valuation flexibility and deal feasibility | P0 |
| What happens to the company if you get ill for 3 months tomorrow? | Tests key-person risk awareness and practical preparedness | P1 |
| Why haven't you applied for SEIS advance assurance yet? | Tests execution pace on a critical fundraise enabler | P1 |
| What's your honest assessment of the probability that 3 design partners sign in 90 days? | Tests founder realism and commercial self-awareness | P1 |
| Have you considered raising less (£100-150k) and validating the wedge before a larger raise? | Tests capital efficiency thinking | P1 |

### Documents To Request

| Document | Purpose | Priority |
|---|---|---|
| Bank statements (last 6 months) | Verify spend, confirm no undisclosed liabilities | P0 |
| Management accounts since incorporation | Financial baseline | P0 |
| Cap table in spreadsheet form | Confirm clean ownership | P0 |
| Articles of Association | Confirm SEIS share compatibility | P0 |
| Founder's personal financial position (confidential) | Assess runway without salary | P1 |
| Any email/Slack exchanges with potential customers | Earliest demand signal | P1 |

---

## Decision Support

### Investability Bucket

- **Value**: CONDITIONAL — Not investable today. Could become investable within 60-90 days if specific conditions are met.
- **Confidence**: 0.75
- **Rationale**: The company has genuine technical assets, an honest founder, and a credible (if unvalidated) wedge hypothesis. But zero commercial proof, missing financial infrastructure, a single-person team, and disconnected valuation expectations make it uninvestable in its current state. The quality of the internal documentation is unusually high and suggests the founder can execute if given the right structure.

### Recommendation

**Action**: CONDITIONAL PASS — Engage with conditions

**Explanation**: The company is not ready for a term sheet today. However, the founder's self-awareness, the technical product, and the honest framing of risks justify continued engagement with clear milestones.

**Conditions for investment readiness**:

1. **Valuation reset**: Accept pre-money of £500k-£1M for a £100-150k initial SEIS tranche, not £3.5-5.5M.
2. **Customer signal**: Complete at least 10 discovery calls with target agencies and demonstrate at least 1 warm design-partner commitment before close.
3. **Financial disclosure**: Produce management accounts, a simple 18-month financial model (3 scenarios), and confirm personal financial position.
4. **SEIS advance assurance**: Apply within 30 days.
5. **Founder commitment**: Confirm full-time status (no contracting) from date of close.
6. **Scope the raise realistically**: If hiring 2 people on £250k, runway is ~6 months. Either raise more, hire one person, or accept the timeline risk explicitly.

**Confidence**: 0.70

---

## Evidence Library

| Evidence ID | Type | Direction | Statement | Origin | Confidence |
|---|---|---|---|---|---|
| E-01 | Document | Neutral | Investec pitch brief — honest framing of pre-revenue status and key risks | INVESTEC_PITCH.md | 0.85 |
| E-02 | Document | Neutral | Business plan with detailed use of funds, revenue model, and kill criteria | BUSINESS_PLAN.md | 0.85 |
| E-03 | Document | Supportive | Company structure verified: UK Ltd, #16906682, Dec 2025, Brighton | BUSINESS_STRUCTURE.md | 0.95 |
| E-04 | Document | Mixed | Founder profile: strong technical, contractor history, no management/sales experience | ZOLTAN_ERDOS.md | 0.70 |
| E-05 | Document | Contradictory | Valuation analysis: 8 methods, self-prepared, inflated for stage | VALUATION_ANALYSIS.md | 0.30 |
| E-06 | Document | Supportive | Risk assessment: thorough, identifies all major risks, recommends conditions | RISK_ASSESSMENT.md | 0.85 |
| E-07 | Document | Mixed | Design partner framework: well-structured process but zero active partners | DESIGN_PARTNERS.md | 0.60 |
| E-08 | Document | Weak | Brighton target accounts: 5 local agencies, all at "prospect" status, no outreach | BRIGHTON_TARGET_ACCOUNTS.md | 0.50 |
| E-09 | Document | Supportive | Cost base: ~£450/month, low burn, sustainable at founder-only level | SUBSCRIPTIONS.md | 0.90 |
| E-10 | Document | Neutral | SEIS working guide: legally literate, thorough, but not yet submitted | SEIS_ADVANCE_ASSURANCE.md | 0.75 |
| E-11 | Document | Aspirational | Competitive positioning: claims unique quadrant position, self-assessed | COMPETITIVE_POSITIONING_MEMO.md | 0.40 |
| E-12 | Document | Supportive | Founding bench plan: disciplined hiring approach, outputs-first, no sentimental equity | FOUNDING_BENCH_PLAN.md | 0.80 |
| E-13 | Document | Mixed | Technical appendix: detailed architecture, strong technical claims, speculative future directions | INVESTEC_PITCH_APPENDIX.md | 0.65 |
| E-14 | Document | Supportive | Codebase metadata (CLAUDE.md): confirms monorepo structure, 25+ packages, package descriptions | CLAUDE.md | 0.85 |
| E-15 | Observation | Concerning | Internal document contradiction: 80+ tools (pitch) vs 533+ tools (valuation doc) | Cross-document | 0.80 |

---

## Reference Library

| Ref ID | Title | Type | Trust Level |
|---|---|---|---|
| REF-01 | INVESTEC_PITCH.md | Internal document | Tier 2 |
| REF-02 | BUSINESS_PLAN.md | Internal document | Tier 2 |
| REF-03 | BUSINESS_STRUCTURE.md | Internal document | Tier 1 (verifiable public data) |
| REF-04 | Companies House #16906682 | External verifiable | Tier 1 |
| REF-05 | RISK_ASSESSMENT.md | Internal document | Tier 2 |
| REF-06 | VALUATION_ANALYSIS.md | Internal document | Tier 3 (self-prepared) |
| REF-07 | spike.land (website) | External verifiable | Tier 1 |
| REF-08 | github.com/zerdos | External verifiable | Tier 1 |

---

## Meta

| Metric | Value |
|---|---|
| **Analysis Confidence** | 0.70 — Strong document set but zero external validation, zero customer data, missing financials |
| **Contradiction Count** | 3 (tool count 80 vs 533, valuation vs market norms, "full-time" vs VMO2 contracting status) |
| **Unresolved Claim Count** | 8 |
| **Critical Risk Count** | 3 (sole founder, commercial zero, capital insufficiency) |
| **Coverage Gaps** | Management accounts, cap table, customer validation, personal financial position, SEIS assurance status, ICO registration |

---

*This document was prepared for internal advisory purposes using the Due Diligence Puppy framework. It does not constitute investment advice. All assessments are based on documents provided by or about the subject company as of the preparation date. No external validation of any claim has been performed. Sniff sniff — there's something here, but it needs a lot more kibble before it's ready for the show ring.*
