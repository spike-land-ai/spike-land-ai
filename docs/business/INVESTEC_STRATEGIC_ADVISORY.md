# Strategic Advisory: SPIKE LAND LTD
## Moving from 38/100 to Investment-Ready

> **Prepared by**: Integrity-led specialist bank, investor advisory function
> **Date**: March 2026
> **Classification**: Confidential
> **Audience**: Founder, Founder
> **Purpose**: Pre-investor action plan

---

## Preamble: What This Document Is

This is not a pitch document. It is a frank assessment of where the business
sits today and a specific action plan to close the gap between what you have
built and what investors need to see before committing capital.

The current external score of 38/100 is not a verdict on the quality of the
technology. The infrastructure is real, the architecture is defensible, and the
founder can ship. The score reflects the absence of commercial proof at a
moment when investors are pattern-matching on traction, not potential.

The goal of this document is to tell you exactly what to do in the next 90
days to move that score to 60 or above, without wasting motion on things that
do not move the needle.

---

## Part 1: The Five Most Impactful Actions Before Approaching Investors

### Action 1: Wire and publish a real activation funnel with live numbers

**Current state**: The analytics infrastructure exists (D1 tables, GA4
forwarding, analytics_events table) but the PLG strategy document describes
it as "placeholder zeros" — the dashboard is blind. Investors who ask for
metrics will find nothing.

**What to do**:

1. Instrument these five events in the analytics_events table within the next
   two weeks: `signup_completed`, `mcp_server_connected`, `first_tool_call`,
   second_session return, and `upgrade_completed`.
2. Build a single internal SQL view across those events that shows the daily
   funnel: signups to activations to returns.
3. Do not wait until the numbers are good before tracking. Investors value
   the existence of measurement discipline more than flattering early numbers.
4. After 30 days of data, prepare a one-page cohort summary: week-1 retention
   by signup week, activation rate, and the ratio of `first_tool_call` to
   `signup_completed`.

**Why this is first**: Every investor question traces back to this funnel.
Without it, you cannot answer "what is your activation rate" or "what does
early retention look like." With it, even modest numbers can be framed as
meaningful signal from a small beta cohort.

**Score impact**: Traction (3/10) moves to 5-6/10 once real data exists, even
with modest absolute numbers.

---

### Action 2: Fix the tool schema errors and ship sandbox_exec as real execution

**Current state**: User tests across 16 agent personas confirmed the same
critical issues: schema lies (required fields described as optional),
`sandbox_exec` advertised as code execution but silently simulated, boolean
parameters typed as strings, and pagination fields incorrectly marked required.
These are not cosmetic. They are credibility failures that will surface
immediately in any investor due diligence or technical review.

**What to do**:

1. Address the confirmed schema contradictions in bulk. The user test report
   lists every instance by tool name. Fix the `workspaces_get` OR-logic
   fields, the `auth_check_session` session_token required/optional
   contradiction, the boolean coercion landmines, and the pagination field
   errors. This is a two-to-three day sweep, not a project.
2. Either ship real code execution behind `sandbox_exec` (preferred — this is a
   genuine differentiator if it works) or rename it to `sandbox_preview` with
   accurate documentation. Do not leave a tool that advertises what it does not
   do. One investor asking a technical advisor to test the tool execution will
   find the lie immediately.
3. Add a `/health` endpoint to the MCP registry. The absence of a real-time
   health surface was flagged as an observability gap by multiple test personas.

**Why this is second**: Product credibility is the foundation of everything
else. A broken schema is the equivalent of a SaaS demo that crashes. You
cannot build trust on top of it.

**Score impact**: Moat (4/10) moves toward 6/10 when the platform behaves as
documented. Risk score also improves because investors can verify claims.

---

### Action 3: Close three to five design partners on paper before the raise

**Current state**: The company is pre-revenue with user testing limited to AI
agent personas rather than real human customers. The PLG strategy is correct
and well-reasoned, but it has not yet been validated by a paying or
committed-to-pay customer.

**What to do**:

1. Identify five target companies from the following profiles: a boutique AI
   consultancy (5-15 people) building MCP-native tooling for clients; a
   developer tools startup that needs edge-native transpilation at scale; an
   internal innovation team at a financial services firm (Investec itself is
   the obvious candidate) that wants tool-first testing infrastructure.
2. Offer each a design partner arrangement: free or heavily discounted access
   for six months in exchange for weekly feedback calls, a willingness to be
   named in investor materials (with approval), and commitment to convert to a
   paid plan if the product meets defined success criteria.
3. The success criteria should be specific and measurable. Examples: reduces
   agent context overhead by X percent in production; enables QA team to run
   tool-level tests without browser overhead; cut integration time from Y hours
   to Z.
4. Document every conversation. Investor conversations about design partners
   carry far more weight when the founder can show call logs, feedback
   summaries, and written success criteria.

**Why this is third**: Design partners do three things simultaneously: they
generate the testimonials and case studies that remove GTM doubt; they reveal
which wedge actually resonates with real buyers; and they give you ARR
commitments or letters of intent that replace speculation with signal.

**Score impact**: GTM (3/10) moves to 5-6/10. Traction score also rises. A
letter of intent from a recognisable firm — including potentially Investec
itself — is worth more than 10,000 lines of documentation.

---

### Action 4: Complete the commercial layer before the investor meeting, not after

**Current state**: Stripe checkout is 75% wired. Webhook provisioning,
metering, and self-serve onboarding are described as "being completed ahead of
commercial launch." The investor pitch says capital will be used to finish
this work. That is the wrong sequence.

**What to do**:

1. Complete the Stripe integration, metering, and self-serve onboarding before
   the first investor meeting. The ask should be for growth capital, not
   completion capital. Investors at this stage will heavily discount a valuation
   if the billing system is not live.
2. This does not require charging anyone. It requires that the path from
   signup to paid plan is functional end-to-end and that you can demonstrate
   it in a screen share. Show the checkout working. Show the webhook firing.
   Show the credit ledger updating.
3. Publish the pricing page publicly. This signals commitment to a commercial
   model and allows investors to evaluate willingness-to-pay assumptions.

**Why this is fourth**: "The commercial layer is incomplete" is currently a
red flag in the external analysis. Removing it costs approximately two to three
weeks of focused engineering. The alternative is going into investor meetings
with a known gap that sophisticated investors will find.

**Score impact**: Economics (2/10) moves to 4-5/10. The raise narrative
shifts from "build the commercial layer" to "grow what is already working."

---

### Action 5: Produce a single verified proof point that tool-first testing
delivers measurable outcomes

**Current state**: The platform's core thesis — that exposing business logic
as typed MCP tools enables faster, cheaper, more reliable testing — is
compelling and architecturally sound. It is not yet demonstrated by any
published case study, benchmark, or real-world comparison.

**What to do**:

1. Use the spike.land platform itself as the test subject. Run a comparison:
   take a representative piece of business logic (a billing calculation, an
   auth flow, a recommendation algorithm), implement it as a typed MCP tool,
   and benchmark the testing approach against a conventional browser-level
   Playwright or Cypress test.
2. Measure the following: time to write the test, time to execute, flakiness
   rate over 100 runs, and lines of test code required. Publish the comparison
   as a blog post with raw numbers.
3. This is the "AB_TESTING_BUG_DETECTION.md" content brought to life. The
   document exists. The evidence does not yet exist in verifiable form.

**Why this is fifth**: The answer to investor question four — "Proof that
tool-first testing improves outcomes?" — is currently a conceptual claim. A
published benchmark with real numbers, even from your own codebase, transforms
it into evidence. This is the kind of technical proof point that gets shared
in developer communities and generates inbound interest.

**Score impact**: Moat (4/10) approaches 7/10 when a published, reproducible
proof point exists. This is also the primary content asset for the technical
content growth strategy.

---

## Part 2: The Sharpest Possible Wedge

### Recommended Wedge: AI-native QA teams at mid-size software agencies and consultancies

**The specific profile**:
- Company size: 20-200 people
- Role: Head of QA, VP Engineering, or CTO
- Context: Running Playwright or Cypress test suites that are slow, flaky, and
  expensive to maintain
- Current pain: Browser-level end-to-end tests cost £3,000-15,000 per month
  in CI time, break on minor UI changes, and require dedicated QA engineers
  to maintain
- Current solution: Accepting the cost because there is no credible alternative

**Why this wedge**:

1. The pain is acute and measurable. You can quote a number in the first
   conversation: "How much are you spending on Playwright CI runs per month?"
   If the answer is "too much," you have a prospect.
2. The tool-first testing model directly addresses the pain. Typed MCP tools
   that test business logic without a browser are 10-50x faster and produce
   zero false positives from UI layout changes.
3. The buyer has budget. QA tooling sits in engineering budgets that already
   fund $99-500/month SaaS subscriptions. The spike.land BUSINESS tier at
   £99/month is below the psychological resistance threshold.
4. The reference case is self-reinforcing. One agency that reduces CI costs
   by 40% tells another agency. The developer tool word-of-mouth loop is fast
   in this segment.
5. This wedge does not require winning against Vercel, Cloudflare, or
   Anthropic. It requires winning against Playwright and Cypress, which are
   not products but frameworks — they do not have sales teams, renewal
   conversations, or account managers fighting to retain the account.

**The beachhead sequence**:
- Month 1-2: Sign three agencies on design partner terms
- Month 3-6: Convert to paid, generate case study with cost savings data
- Month 6-12: Use the case studies to move up-market to the QA leads at
  financial services firms (Investec's network is directly useful here)

---

## Part 3: Framing the Competitive Narrative

### The principle: incumbents as proof, not threats

The external analysis identifies Vercel, Cloudflare, GitHub, Anthropic, Replit,
and Lovable as the competitive set. This is the wrong frame. Each of those
companies is proof that the layer spike.land operates in is valuable.

The correct investor narrative is:

**"Every major platform company is racing toward the MCP runtime layer.
Cloudflare added Workers AI. Anthropic built the MCP protocol. Vercel added
AI SDK. None of them have shipped a unified, multi-channel, tool-first testing
and deployment layer with 533+ composable tools. They are all building toward
it from different directions. Spike.land is already there."**

### Handling each competitor specifically:

**Vercel**: "Vercel is the closest analogy and the strongest validation that
the Vercel-for-X pattern works. Vercel built on Node.js and Next.js. We are
building on MCP and Cloudflare Workers. These are different bets on different
timelines, and the MCP timeline is three to five years earlier than the
Next.js timeline was when Vercel raised their seed."

**Cloudflare**: "Cloudflare is a platform provider. We are a product built on
Cloudflare, not a competitor to it. Cloudflare winning means spike.land's
infrastructure costs stay near zero, not that spike.land loses. The equivalent
would be saying Heroku competed with AWS."

**Anthropic**: "Anthropic built MCP as the protocol. They need an ecosystem of
registered, discoverable tools to make that protocol valuable. Spike.land is
part of that ecosystem, not in competition with it. The analogy is Stripe
relative to Visa — the protocol needs infrastructure companies to make it
useful."

**Replit and Lovable**: "Both are consumer-facing vibe coding tools. Spike.land
is infrastructure for developers and agents. The customer profile does not
overlap. A Replit user who graduates to production-grade tooling is a potential
spike.land customer."

**GitHub**: "GitHub Copilot and GitHub Actions solve adjacent problems.
Spike.land does not replace a code editor or a CI runner. It adds a managed
MCP tool runtime layer that CI and editors can call into."

### The summary frame for slides:

"Incumbents moving into this space confirm market timing. None of them are
building the specific combination of MCP-native runtime, multi-channel access,
edge-native deployment, and open app store. The window for a focused
independent platform is now, before one of them acquires or copies the model."

---

## Part 4: Proof Points to Build in 90 Days  

The following table maps each investor concern to a specific deliverable with
a 90-day deadline.

| Investor concern | Proof point | Deadline | Owner |
|---|---|---|---|
| No verified traction | Publish weekly activation cohort chart (signups to first_tool_call) | Week 4 | Founder |
| Schema reliability | Zero outstanding schema contradictions; tool test passing CI | Week 3 | Founder |
| sandbox_exec misleading | Either real execution shipped or tool renamed and documented accurately | Week 2 | Founder |
| No design partners | 3 signed design partner agreements with named companies | Week 10 | Founder |
| No case study | Published blog post with tool-first vs browser-test benchmark numbers | Week 8 | Founder |
| Billing not live | End-to-end Stripe checkout demonstrable in screen share | Week 6 | Founder |
| No health endpoint | /health endpoint live with uptime monitoring | Week 3 | Founder |
| Activation rate unknown | Funnel query published internally: signup to second session | Week 5 | Founder |
| No retention data | Week-1 and week-4 retention cohort for first 50 real users | Week 12 | Founder |
| Moat unclear | Published MCP multiplexer architecture paper (500 words + diagram) | Week 6 | Founder |

**Critical path**: The schema fixes and billing completion unblock everything
else. Start there.

---

## Part 5: Team-Building Priorities to Reduce Founder Risk

### The honest assessment

Single-founder concentration is the hardest risk to mitigate quickly and the
one investors weight most heavily at this stage. The SEIS structure reduces
financial risk for early investors but does not address operational risk if the
founder is unavailable.

The correct response is not to hire broadly and quickly, which introduces cash
burn before revenue. It is to create documented knowledge transfer and bring in
specific advisory capacity in the next 60 days.

### Priority 1: Technical documentation for knowledge transfer (immediate)

The architecture is sophisticated and currently exists primarily in the
founder's head. Before approaching investors, document the following:

- System architecture decision record: why Cloudflare Workers over AWS, why D1
  over Postgres, why the multiplexer model for MCP
- Runbook for the three most critical operational scenarios: deploy failure,
  D1 schema migration, Stripe webhook outage
- A single onboarding document for a hypothetical technical co-founder that
  would let them become productive within one week

This costs no capital and demonstrates operational maturity.

### Priority 2: Recruit one technical advisor with a name investors recognise

Identify a senior engineer or CTO from the developer tools or cloud
infrastructure space — someone with 10 or more years of experience at a
recognisable company — who will agree to serve as a named advisor for a small
equity grant (0.25-0.5%). Their LinkedIn profile in the pitch deck does two
things: it signals that experts in the space validated the architecture, and it
demonstrates the founder's ability to attract talent.

Candidates to target: former Vercel or Cloudflare engineering leads, a former
Anthropic infrastructure engineer, or a senior engineer from a UK fintech
(Revolut, Monzo, Wise) who can speak to regulated software deployment.

### Priority 3: First hire should be GTM, not technical

The common mistake for technical solo founders is to hire another engineer.
The current architecture is functional. What is missing is distribution.

The first hire — ideally funded from the SEIS raise — should be a growth or
developer relations person with the following profile:

- 3-5 years experience in developer tools or API platforms
- Track record of building community through content and direct outreach
- Network in the AI agent developer or DevOps community
- Willing to own the design partner pipeline from outreach to close

This person does not replace the founder on engineering. They add the function
that is most constrained. Monthly salary target: £3,500-5,000 (early-stage,
part equity).

### Priority 4: Document the succession plan for investors

Investors will ask: "What happens if you are hit by a bus?" The answer does
not need to be "I have a co-founder." It can be: "The architecture is
documented, the key vendor relationships are under company contracts (not
personal accounts), and I have identified two engineers in my network who have
reviewed the codebase and could step in with three weeks of onboarding."

Confirm that all critical accounts — Cloudflare, GitHub, Stripe, Anthropic —
are under company email addresses, not personal ones. This is a quick audit
that removes a real operational risk.

---

## Part 6: Funding Ask Range and Structure

### Recommended raise: £150,000 to £250,000 SEIS

**Why SEIS is the right vehicle**:
- The company appears to meet SEIS qualifying conditions (incorporated December
  2025, fewer than 25 employees, gross assets well under £350,000, qualifying
  trade in software)
- SEIS provides 50% income tax relief to UK investors, which is the most
  powerful single tool available to reduce investor risk at this stage
- The Advance Assurance application should be filed before the investor
  conversations begin, not during them

**Why £150,000-250,000, not more**:
- This is completion and proof capital, not scaling capital
- Larger raises at this stage require more traction than currently exists
- SEIS caps individual investment at £200,000 per investor per year, which
  constrains deal size naturally
- The use of funds is defensible at this level: commercial layer completion
  (4-6 weeks of founder time equivalence), first GTM hire (12 months), design
  partner programme, and minimal conference and content spend

**Use of funds breakdown** (recommended):

| Category | Amount | Rationale |
|---|---|---|
| GTM hire (12 months) | £55,000 | Developer relations or growth lead |
| Founder salary (12 months) | £60,000 | Removes survival pressure during ramp |
| Design partner programme | £15,000 | Travel, events, tools for outreach |
| Infrastructure and tooling | £10,000 | Increased Cloudflare capacity, AI API credits |
| Legal and compliance | £10,000 | SEIS documentation, design partner contracts |
| Reserve | £20,000 | 90-day runway buffer |
| **Total** | **£170,000** | — |

**Valuation**: The internal valuation analysis suggests £3.5M-5.5M pre-money
as a realistic range. The correct framing for this raise is:

"We are raising at a pre-money valuation of £3.5M-4.0M. We are not asking
investors to value a working product at a lower number to compensate for the
absence of revenue. We are asking them to invest in the 90-day milestones
required to make that valuation defensible in the next round."

Do not lead with the £10M optimistic scenario in first meetings. It invites
scepticism. Lead with the conservative scenario and the specific milestones
that must be true for the next round to close at a step-up.

**Structure recommendation**:
- Raise from 3-6 investors rather than one lead, to diversify relationship
  risk and spread the SEIS quota
- Target angels with developer tools or fintech operating experience over
  generalist VC at this stage — the feedback loop from an operator angel is
  worth more than the brand of a generalist fund
- Include a 12-month milestone schedule in the investment agreement:
  three design partners signed by month three; first paying customer by month
  six; £10,000 MRR by month twelve. This protects both parties and signals
  founder confidence.

---

## Closing Assessment

The 38/100 score is a gap, not a verdict. The architecture is more mature than
most pre-seed companies at this stage. The MCP multiplexer approach is
genuinely differentiated. The edge-native infrastructure has real unit
economics advantages that will compound as scale increases.

The five actions in Part 1 are achievable within 90 days. Three of them — fixing
the schema errors, completing the billing layer, and instrumenting the
activation funnel — are engineering tasks that cost time, not capital.

The two that require external coordination — design partners and the advisor
recruit — are the critical path items that should begin immediately in parallel
with the technical work.

The wedge in Part 2 is specific enough to be actionable. Do not try to sell
the whole platform to every segment simultaneously. Win the QA-for-AI-agencies
segment first, then use those references to move into the next segment.

The competitive narrative in Part 3 is the reframe that makes the difference
between a pitch that sounds defensive and one that sounds inevitable. Practice
saying it out loud before the first investor meeting.

At 60/100, this business is investable under SEIS with a credible founding
story, documented traction, and a specific plan for the next 18 months. The
90-day window to get there is realistic.

---

*Prepared by Investor Advisory — Integrity-Led Specialist Bank*
*Document version: 1.0 — March 2026*
*Classification: Confidential — For Founder Use Only*
