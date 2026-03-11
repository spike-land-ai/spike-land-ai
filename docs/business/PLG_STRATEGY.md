# Product-Led Growth Strategy — spike.land

> **Written**: 11 March 2026
> **Audience**: Founder + first growth hire
> **Reality check**: PLG supports awareness; founder-led sales closes the first revenue

---

## 1. What PLG Is And Is Not Here

PLG matters for Spike Land because developers need to trust the runtime before
they will adopt it. But PLG is not the first revenue motion.

For the next phase:

- **PLG** = awareness, activation, credibility, and a growing developer top of
  funnel
- **founder-led sales** = the path to the first design partners and paying
  customers

If the company treats PLG as a substitute for discovery and selling, it will
stay technically impressive and commercially vague.

---

## 2. The Actual Commercial Focus

### First paid wedge

- QA-heavy software agencies
- AI consultancies
- adjacent small AI product teams with a clear browser-testing burden

### Why this is the right first wedge

- the pain is acute
- the buyer already spends against the problem
- value can be measured quickly
- founder-led outreach is realistic

### What the company is really selling first

Not "an app store" and not "all developer tooling in one place."

The first sell is:

> take one brittle browser-heavy workflow and move the important verification
> below the browser into typed tool contracts

---

## 3. PLG Aha Moment

The product aha moment is still operationally important:

1. a user connects spike.land as an MCP server
2. they make a first tool call
3. they see the same underlying contract available across terminal, UI, and
   agent workflows

For the wedge, the commercial aha moment is slightly different:

1. the team identifies one painful flow
2. Spike Land models it below the browser
3. the team sees a real CI-time or flake-reduction improvement

That means the product and commercial funnels must be measured separately.

---

## 4. Activation Funnel To Track

Instrument these immediately:

| Event | Meaning |
| --- | --- |
| `signup_completed` | account created |
| `mcp_server_connected` | authenticated MCP traffic seen |
| `first_tool_call` | first successful use |
| `second_session` | user came back |
| `design_partner_interest` | high-intent account entered outbound pipeline |
| `pilot_started` | workflow baseline and success criteria agreed |
| `upgrade_completed` | payment captured |

Critical funnels:

```text
signup -> mcp_server_connected -> first_tool_call -> second_session
outreach -> discovery -> design_partner_interest -> pilot_started -> paid
```

---

## 5. Messaging Strategy

### Public-site message

The site should say:

- broad platform exists
- first commercial wedge is tool-first QA for high-friction flows
- COMPASS is proof point, not second business

### Outbound message

The email and call message should say:

- "you already have Playwright/Cypress"
- "you do not need to rip it out"
- "start with one flaky billing/auth/permissions flow"
- "we keep the browser as a thin smoke layer and move the real logic below it"

### What to stop saying

- "does everything"
- "app store for the agent internet" as the primary commercial message
- "USB-C for AI integrations"
- "join thousands of developers" style social proof that is not the current
  business reality

---

## 6. Founder-Led Sales Motion

### Target profile

- software agencies and consultancies with 5-50 engineers
- buyer is CTO, Head of Engineering, or QA lead
- already living with Playwright/Cypress pain

### Outreach channels

- warm intros first
- targeted email and LinkedIn outreach second
- founder-led demos third
- local network leverage in Brighton and London

### What a successful first call looks like

By the end of the call, you should know:

- which workflow hurts
- who owns the pain
- what success would look like numerically
- whether they will give you access to a real workflow
- whether there is a path to paid if the pilot works

---

## 7. Design-Partner Offer

Offer structure:

- 6-8 week scoped pilot
- one or two high-friction workflows
- weekly 30-minute check-in
- shared before/after metrics
- discounted or fixed pilot fee
- paid conversion if agreed success criteria are met

What the partner gives:

- access to a real workflow
- baseline metrics
- honest feedback
- permission to use the result as an anonymized or attributed case study

---

## 8. Content Strategy

Content should support selling, not replace selling.

The first proof assets should be:

1. benchmark: browser-heavy check versus tool-first contract check
2. case study: first design-partner result
3. technical explainer: why "keep Playwright, thin it down" is a better first
   adoption path than demanding a full migration

Good content themes:

- flaky-build reduction
- CI-time reduction
- tool-first verification patterns
- typed contracts across CI, CLI, and agents

Low-priority content for now:

- generic thought leadership
- broad marketplace futurism
- COMPASS market-size storytelling in fundraising materials

---

## 9. Hire Trigger

Hire the first commercial person when all three are true:

1. a clear design-partner offer exists
2. discovery calls are converting into real pilot discussions
3. the founder has enough signal to teach the motion to someone else

That hire should be:

- Founding Head of Growth/DevRel

Not:

- generic marketer
- pure account executive with no developer credibility

---

## 10. PLG Success Criteria

PLG is working if it produces:

- qualified technical conversations
- shorter sales cycles because trust is already partially built
- clear activation patterns that inform the product

PLG is not working if it produces:

- vanity signups
- vague interest with no workflow attached
- more developer curiosity but no paid design-partner motion
