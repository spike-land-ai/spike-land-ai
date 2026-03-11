# Business Plan — SPIKE LAND LTD

> **Company**: SPIKE LAND LTD (UK Company #16906682)
> **Date**: March 2026
> **Classification**: Confidential
> **Stage**: Public beta, pre-revenue
> **Primary ask**: SEIS round of up to £250,000

---

## 1. Executive Summary

Spike Land is the managed runtime, registry, and control layer for typed
AI-callable tools. The company is not two businesses. `spike.land` is the
business. `COMPASS` is the flagship proof point built on top of the platform.

The immediate commercial wedge is narrow by design:

- QA-heavy software agencies
- AI consultancies
- small AI product teams with an existing Playwright or Cypress burden

These teams already feel an acute, budgeted pain: slow CI, flaky browser tests,
and repeated per-client setup. Spike Land does not ask them to replace their
entire browser estate on day one. It asks them to start with one or two brittle,
high-friction flows and move the critical business logic below the browser into
typed tool contracts that can be exercised at function speed.

The company is pre-revenue and public beta. What is already built materially
de-risks technical execution:

- hosted MCP runtime and registry
- `spike-cli`
- 80+ natively hosted tools, with a broader tool surface available through the
  multiplexer architecture
- QA Studio and adjacent tool-first testing surfaces
- Stripe checkout and core commercial plumbing in progress

The next 12 months are not about serving four customer segments at once or
proving a marketplace thesis prematurely. They are about validating one paid
wedge, turning three customers into reference accounts, and reducing the
single-founder risk fast enough for the platform thesis to remain financeable.

---

## 2. Company Overview

| Field | Value |
| --- | --- |
| Legal Name | SPIKE LAND LTD |
| Company Number | 16906682 |
| Incorporation Date | 12 December 2025 |
| Registered Office | 42 Mighell Street, Apartment 70, Brighton BN2 0AU |
| SIC Codes | 62090, 63120 |
| Director | Zoltan Erdos |
| Current ownership | Founder-owned, no prior fundraise |
| Employees | 1 |

Founder context:

- Zoltan Erdos is a full-stack engineer with enterprise delivery experience,
  including four years at Investec.
- The initial platform was built end-to-end with AI assistance, proving unusual
  technical leverage, but also creating a real bus-factor risk that must be
  reduced during this round.

SEIS note:

- Based on current company facts, management believes the business appears to
  meet the core SEIS conditions.
- Advance Assurance and external accountant/counsel confirmation should be
  treated as diligence items, not as marketing claims.

---

## 3. What The Business Is

### 3.1 Core product

Spike Land is the managed product layer above raw edge compute. Cloudflare
Workers answers where code runs. Spike Land answers how AI-callable software is:

- packaged
- typed
- governed
- tested
- metered
- discovered
- operated across more than one surface

### 3.2 What customers buy first

Customers do not buy "an open app store" first.

They buy a way to reduce pain in a specific workflow:

- take a brittle Playwright or Cypress flow
- express the business logic as typed tools
- keep the browser as a thin smoke and visual layer
- gain faster tests, fewer false reds, and a reusable runtime surface

### 3.3 What COMPASS is

COMPASS is a flagship application built on the platform. It proves that the
same runtime can support a regulated, multilingual, offline-capable workflow.
It should be presented as a proof point and product stress-test, not as the
base-case revenue engine for this fundraise.

---

## 4. Problem

The initial customer does not have a generic "AI tooling" problem. They have a
delivery and QA problem:

1. Browser suites are slow and flaky.
2. High-value journeys such as auth, billing, permissions, and state
   transitions are often verified at the wrong layer.
3. Agencies repeat the same scaffolding across client accounts.
4. Teams can buy Playwright infrastructure, but they still have to design the
   runtime contracts, auth boundaries, metering, and auditability around it.

This creates a market opening between test frameworks and cloud primitives.

---

## 5. Initial Customer and Beachhead

### 5.1 First paid wedge

The first paid segment is:

- QA-heavy software agencies and AI consultancies with 5-50 engineers

Why this segment first:

- pain is acute and already budgeted
- value is measurable in CI time, flaky-build reduction, and reduced setup
- buyer is reachable through founder-led sales
- design-partner motion is credible at this stage

### 5.2 Adjacent segments, not first segments

These remain valid later but are not the first commercial motion:

- small AI product teams
- internal innovation teams in regulated firms
- broader developer PLG audience

### 5.3 Target buyer

Likely first buyers:

- Head of Engineering
- Head of QA / QA lead
- CTO at boutique software consultancies
- senior IC who owns the test pain and can sponsor a pilot

---

## 6. Product Wedge

### 6.1 What Spike Land offers the wedge

The platform offers:

- typed MCP contracts for high-value business flows
- direct tool-level testing at function speed
- hosted runtime, auth, and metering
- CLI, dashboard, and agent access to the same underlying contract
- browser automation retained as a thin smoke layer through QA Studio

### 6.2 What it does not claim

The product should not be sold as:

- a complete Playwright replacement
- a generic "better QA Wolf"
- a company serving four GTM motions simultaneously

The correct framing is:

> start with one brittle flow, prove the improvement, then expand

---

## 7. Go-To-Market

### 7.1 Revenue motion

The first revenue motion is founder-led design partners, not self-serve PLG.

PLG remains important for:

- awareness
- developer trust
- open-source distribution
- long-term top-of-funnel

But the first customers should come from direct conversations and scoped pilot
engagements.

### 7.2 First ten customers

The realistic path to the first ten paying customers is:

1. 3-5 design partners in agencies and consultancies
2. 3 paid reference customers with quantified outcomes
3. 5-7 adjacent teams reached through case studies, referrals, and founder-led
   outbound

### 7.3 90-day commercial objective

By the end of the initial 90-day validation window, the company should have:

- 20-30 qualified agency/consultancy conversations
- 6-8 serious discovery calls
- 3 design partners onboarded
- at least 1 customer paying or committed to paid conversion if success
  criteria are met

---

## 8. Revenue Model

### 8.1 Near-term revenue

The honest near-term model is a mix of:

- design-partner pilot fees
- team subscription revenue
- usage / API add-ons once workflows are live

Illustrative early monetization:

| Revenue Stream | Price Logic | Timing |
| --- | --- | --- |
| Design partner pilot | £2,000-£5,000 for a scoped 6-8 week engagement | Immediate |
| Team plan | from $99/month plus usage | After pilot |
| API / usage add-ons | metered where relevant | After workflow adoption |
| Marketplace take rate | deferred until platform adoption is real | Later |

### 8.2 Why the model is more credible now

This structure matches the stage of the company:

- low-volume, high-learning engagements first
- productized subscription second
- marketplace third

It avoids pretending that an unvalidated pre-revenue platform will jump
straight to broad self-serve scale.

---

## 9. Competition and Strategic Risks

### 9.1 Purpose-built QA tools

Playwright, QA Wolf, Checkly, and Reflect all address real pain.

Their strength:

- they improve browser testing directly

Spike Land's difference:

- it moves part of the verification model below the browser into reusable typed
  tool contracts

This is a harder behaviour change. It only works if the company can prove a
clear, quantified improvement on a narrow set of flows.

### 9.2 Cloudflare risk

If Spike Land were only "managed Workers plus an MCP registry", it would be too
thin. Cloudflare can ship primitives and may ship more MCP support. The
defensible layer is the workflow product above those primitives:

- tool contracts
- testing surface
- auth and governance
- metering
- auditability
- multi-surface execution

### 9.3 MCP standard risk

MCP is a useful tailwind, not the only pillar of the business.

If the market fragments, the platform still needs to expose the same underlying
tool layer through whichever interfaces matter: MCP, REST, or adapters for
other standards.

---

## 10. 18-Month Success Criteria

The business should be judged against three concrete tests by **30 September
2027**:

1. **Wedge validation**: at least 3 paid reference customers in the QA/agency
   wedge with measured improvement in CI time, flaky-build reduction, or
   browser-suite simplification.
2. **Distribution validation**: a repeatable pipeline exists beyond founder-only
   outbound, with a functioning Growth/DevRel motion and clear path from
   activation to paid.
3. **Platform validation**: customers are buying the managed runtime as a
   product, not just founder effort, and the company is no longer
   operationally bus-factor-one.

### Kill criteria

If those three things have not happened by **30 September 2027**, the current
platform thesis should be treated as broken.

---

## 11. Use of Funds

The SEIS round buys proof and resilience, not vanity scale.

Use of proceeds:

1. finish the commercial layer and design-partner onboarding
2. close and support the first three design partners
3. hire a founding Head of Growth/DevRel with technical credibility
4. hire a senior engineer to reduce bus-factor risk
5. harden documentation, runbooks, auditability, and enterprise controls

### Initial hiring plan

| Hire | Why now |
| --- | --- |
| Founding Head of Growth/DevRel | Needed to source and close design partners and build repeatable distribution |
| Senior engineer | Needed to remove single-founder execution risk and improve onboarding capacity |

---

## 12. Milestone-Based Financial View

Precision beyond this stage is misleading. The company should be measured
against milestones and revenue ranges, not false month-by-month certainty.

| Horizon | Commercial objective | Indicative revenue view |
| --- | --- | --- |
| Next 12 months | 3 paid reference customers, 3-5 design partners, early subscriptions | £20k-£60k revenue |
| 12-24 months | 10-15 paying teams, clearer land-and-expand motion | £120k-£250k ARR |
| 24-36 months | productized wedge, broader adjacent adoption | £300k-£600k ARR |

These ranges are deliberately conservative. The business case should improve by
evidence, not by spreadsheet optimism.

---

## 13. COMPASS As Proof Point

COMPASS remains strategically useful because it demonstrates that the platform
can support:

- regulated workflows
- multilingual interaction
- offline-capable product surfaces
- high-trust user journeys

The correct 12-month COMPASS objective is:

- one or two narrowly scoped institutional pilots
- evidence that the platform can support compliance-heavy use cases

The incorrect framing is:

- presenting COMPASS as the base-case source of multi-million dollar Year 1
  revenue in a £250k SEIS deck

---

## 14. Summary

The strongest version of Spike Land is not "two big ideas in one deck". It is:

- one platform business
- one narrow commercial wedge
- one flagship proof point
- one honest plan to prove or kill the thesis quickly

That is the business case investors can underwrite.
