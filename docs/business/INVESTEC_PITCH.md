# SPIKE LAND LTD — Investec Brief

> **Prepared For**: Investec
> **Date**: March 2026
> **Classification**: Confidential
> **Stage**: Public beta, pre-revenue

---

## Thesis

Spike Land is the platform business.

More specifically, it is the managed runtime, registry, and control layer for
typed AI-callable tools. The first commercial wedge is not "all developers." It
is QA-heavy software agencies and AI consultancies that already live with slow,
flaky Playwright or Cypress suites.

COMPASS is not a second company. It is the flagship proof point built on the
same platform.

---

## What Exists Today

This is not a concept deck. The product base already exists:

| Area | Current state |
| --- | --- |
| Runtime | Cloudflare Workers, Durable Objects, D1, R2, edge-native deployment |
| Product | web platform, `spike-cli`, hosted runtime, MCP registry |
| Tools | 80+ natively hosted tools plus broader tool access via multiplexer |
| QA wedge assets | QA Studio, browser automation surface, tool-first testing model |
| Commercial | public beta, Stripe checkout and onboarding layer nearing completion |
| Proof point | COMPASS running on the same platform architecture |

Build risk is not zero, but it is not the primary open question anymore. The
primary question is whether the company can convert technical leverage into a
narrow, repeatable commercial wedge.

---

## The First Paying Customer

The first customer is not buying generic AI infrastructure.

They are buying relief from a specific pain:

- slow CI
- flaky browser tests
- repeated setup across projects

Spike Land should be sold as:

> take one brittle billing, auth, permissions, or state-transition flow and
> move the critical verification below the browser into typed tool contracts

Playwright or Cypress remains in place as a smoke and visual layer. The first
adoption path is not rip-and-replace.

---

## Why Teams Pay Instead of Using Workers Directly

Cloudflare Workers is the compute primitive.

It does not by itself provide:

- typed tool contracts
- registry and discovery
- auth and governance above raw compute
- metering
- auditability
- multi-surface execution
- a workflow model for tool-first verification

If Spike Land were only "managed Workers plus MCP registry," that would be too
thin. The bet is that the workflow layer above the primitives is valuable and
defensible if it wins a specific use case before the platform vendors care.

---

## Why COMPASS Is Included

COMPASS is included because it is a hard proof point, not because the current
raise depends on underwriting government-scale revenue projections.

What it proves:

- regulated workflow handling
- multilingual product surface
- offline-capable interaction
- ability to run a higher-trust use case on the same runtime

What it does not justify:

- treating speculative Year 1 institutional revenue as part of the base case
  for this SEIS round

---

## The 90-Day Plan

The next 90 days are about proving the QA wedge:

1. unify deck, site, and outreach around the wedge
2. build a target-account list, starting with Brighton and London agencies
3. run discovery on painful browser-heavy workflows
4. close 3 design partners
5. convert the strongest result into a paid reference customer

This is the shortest path from "architecturally interesting" to "investable."

---

## Strategic Risks

### 1. GTM risk

The company is still founder-carried commercially. That is the largest near-term
risk after bus factor.

### 2. Cloudflare risk

If Cloudflare ships more MCP surface area, the company only survives if the
workflow layer above the primitives is real and valued.

### 3. MCP risk

MCP may not become universal. The platform must remain capable of exposing the
same tool layer through other interfaces if needed.

### 4. Founder risk

The codebase and product decisions are highly concentrated in one person. This
round must reduce that risk quickly.

---

## 18-Month Success And Kill Criteria

By **30 September 2027**, three things must be true:

1. at least 3 paid reference customers exist in the QA/agency wedge
2. the business is no longer fully founder-carried commercially
3. customers are adopting the managed runtime as a product, not simply buying
   founder effort

If those conditions are not met, the current thesis should be treated as
broken.

---

## Use Of Capital

The raise buys proof and resilience:

1. finish commercial onboarding and metering
2. close and support the first design partners
3. hire founding Head of Growth/DevRel
4. hire senior engineer
5. improve docs, runbooks, governance, and enterprise controls

---

## Closing

The strongest version of Spike Land is straightforward:

- one platform business
- one narrow commercial wedge
- one flagship proof point
- one honest 18-month scorecard

That is the version worth taking into diligence.
