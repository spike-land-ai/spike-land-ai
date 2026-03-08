# Product-Led Growth Strategy — spike.land

> Written: 2026-03-06
> Audience: Founder + first marketing/growth hire
> Horizon: 90 days (experiments), 12 months (strategy)

---

## What We Know Going In

Before prescribing tactics, these are the facts that shape this strategy:

- Platform is built and live. Stripe is 75% wired. spike-cli is on npm.
- The app store is no longer a side feature. It is the public distribution layer
  for MCP-native apps, skills, and future marketplace revenue.
- Zero paid customers today. Pre-revenue. Friends/family testing phase.
- Solo founder. First hires are growth lead and customer success.
- The core moat is real and defensible: MCP-native + multi-channel + 533+ tools. No competitor has this combination.
- Cross-origin MCP access and offline-capable app packaging widen distribution
  beyond the spike.land web UI.
- The analytics infrastructure exists (D1 tables, GA4 forwarding) but the cockpit dashboard shows placeholder zeros. Blind flying until that gets wired.
- Personas are documented but the developer / AI agent builder is the one who will actually drive early organic growth. The social media manager personas are legacy positioning from an earlier product direction. Treat them as secondary for now.

---

## 1. Activation and Onboarding

### What the "Aha Moment" Actually Is

For spike.land, the aha moment is not "I logged in and saw a dashboard." It is the moment a developer makes their first tool call through an AI agent they already use daily — Claude, a custom agent, anything — and it just works.

Specifically: they add spike.land as an MCP server to Claude Code in one line, call a tool, and see a real result. That is the moment the platform stops being abstract and starts being infrastructure.

```
claude mcp add spike-land --transport http https://spike.land/mcp
```

That single line is the most important UX event in the product. Everything else is setup friction that delays or enables it.

### The First 5 Minutes — What Should Happen

The current getting-started blog post (written 2026-03-04) already maps this correctly. The problem is that it is a blog post, not the product. The onboarding flow inside the product needs to replicate it.

**Minute 0-1: GitHub OAuth signup**
- Single click, no form fields, no credit card
- Land on dashboard with a welcome modal — not a tour, a checklist with three items

**Minute 1-3: The one-liner**
- Welcome modal shows the Claude Code one-liner front and center
- Below it: the npx alternative for non-Claude-Code users
- No other options. Do not show the full spike-cli install path at this step. That comes later.

**Minute 3-5: First tool call confirmation**
- After adding the MCP server, the user calls any tool
- The dashboard should detect this via the analytics_events table and flip the user's activation state from "connected" to "activated"
- Show a success state in the UI: "First tool call detected. You're set up."

**What not to do:**
- Do not show a product tour carousel
- Do not ask for team members during onboarding
- Do not surface the credit balance prominently before the first tool call — it creates anxiety before value

### Activation Metrics to Track

Wire these into the analytics_events table immediately. This is the highest-priority instrumentation gap.

| Event | Table | Description |
|---|---|---|
| `signup_completed` | analytics_events | Account created via OAuth |
| `mcp_server_connected` | analytics_events | First authenticated MCP request received |
| `first_tool_call` | analytics_events | First successful tool/call response |
| `toolset_loaded` | analytics_events | User loads a non-default toolset |
| `byok_key_added` | analytics_events | User adds their own API key |
| `upgrade_prompt_shown` | analytics_events | Credit limit hit, upgrade modal shown |
| `upgrade_completed` | credit_ledger | Payment captured |

The funnel you need to be able to query is:

```
signup -> mcp_server_connected -> first_tool_call -> second_session -> upgrade
```

Track the drop-off at each step. The first 72 hours after signup tell you everything.

**Target activation rate (first_tool_call within 24h of signup): 40%**

If it is below 25%, the one-liner installation step is broken or confusing. Fix that before running any paid acquisition.

---

## 2. Free-to-Paid Conversion

### The Correct Gating Logic

The current tier structure in SUBSCRIPTION_TIERS.md is sound. The problem is that the gates are not creating urgency at the right moments. Here is the hierarchy of what creates upgrade pressure:

**Gate 1 — Daily credit ceiling (50 credits/day on free)**

This is the primary upgrade lever. The daily limit creates a recurring friction point. The moment a user hits it, show:

1. Exactly what they were trying to do when they ran out
2. How many credits the upgrade tier gives them (1,000/month on Pro = 33/day, which is actually less per-day but "unlimited" feels different from "50/day")
3. A single CTA: "Upgrade to Pro — $29/month"

Do not show the BUSINESS tier at this moment. Two choices creates decision paralysis. Present the Pro tier as the default, with a small "Compare all plans" link below.

**Gate 2 — Pro-tier tools (image studio, most AI-heavy tools)**

When a free user tries to call a Pro-gated tool, the error message should not be generic. It should say:

> "image_enhance requires a Pro account. This tool uses Replicate under the hood — your Pro plan includes 1,000 credits/month which covers roughly 200 image enhancements. Upgrade to unlock it."

The specificity matters. Concrete numbers convert better than abstract tier names.

**Gate 3 — Team invite (Business tier)**

When a free or Pro user tries to invite a collaborator, gate them. At this moment they are explicitly trying to expand usage — they are self-qualifying for Business. Show the Business tier only at this moment.

**Gate 4 — MCP API access for agents (Business + API add-on)**

This is the highest-value gate and the one with the least current friction. A developer building a production agent on spike.land will eventually need programmatic API key access, webhook support, and higher rate limits. This is a natural Business or API PRO upgrade. The upgrade prompt here should lead with the agent/automation framing, not the credit count.

### Natural Upgrade Moments

| Moment | What to Show | Expected Conversion |
|---|---|---|
| Credit limit hit | Pro upgrade modal with credit math | 15-25% |
| Pro tool called on free tier | Inline upgrade prompt with tool context | 10-20% |
| Team invite attempted | Business tier only | 20-35% |
| Rate limit hit on MCP API | API PRO add-on | 25-40% |
| 5th consecutive day of usage | "You're a power user" email nudge | 8-15% |

### Usage Limits That Drive Expansion

The current limits are reasonable. The gap is that users cannot see how close they are to the limit in real-time. Add a persistent credit indicator to the dashboard sidebar — not just in the Credits section. Make it visible on every page.

Also: introduce credit packs ($10 for 500 credits) as a low-friction middle step. Some free users who hit the daily limit are not ready to commit to $29/month but will spend $10 to unblock themselves. This is not dilution of the subscription — it is a conversion step that creates billing relationship and habit before the subscription.

---

## 3. Expansion Revenue

### Seat-Based vs Usage-Based for Developer Tools

Vercel learned this the hard way: pure seat-based pricing breaks for developer tools because a solo developer building a production product for thousands of users should not pay the same as a 10-person team. spike.land's hybrid model (seats + credits + API call weighting) is the right architecture.

The expansion levers in priority order:

**1. Credit overages (highest immediate impact)**

Every power user who hits their monthly credit ceiling and does not immediately churn is a candidate for upgrade. The current design has them buying credit packs or upgrading. The right play is to offer metered overages — charge $0.008/credit beyond the Pro limit, billed at month end. This removes the upgrade decision entirely and lets heavy users stay on Pro longer while paying more. Net Revenue Retention goes up.

**2. Seat expansion within teams**

The path from free (1 seat) to Pro (3 seats) to Business (10 seats) creates natural team-driven expansion. The trigger is always a new team member who needs access. Make the invitation flow smooth and the "your invite link is waiting" email get sent to the person being invited, not just the account owner. External invitees who click an invite link and sign up are already pre-qualified.

**3. API PRO add-on**

Business users who activate full MCP API access and start building agents on top of spike.land will hit the 1,000 API calls/month ceiling. The API PRO add-on at $49/month and API SCALE at $149/month are the natural expansion path. The trigger is a rate limit response — handle it gracefully with an upgrade link in the error body, not just an HTTP 429.

### Identifying Enterprise Accounts

Watch for these signals in the tool_user_daily and analytics_events tables:

| Signal | What It Means | Action |
|---|---|---|
| Single user, 50+ tool calls/day for 7+ days | Power user building something real | Reach out personally |
| Team of 3+ all hitting credits simultaneously | Team is capacity-constrained | Business upgrade email |
| API key added + high call volume | Building a production integration | Proactive outreach |
| Multiple toolsets loaded in a session | Sophisticated user, high intent | Invite to early access program |
| Business signup with a company email domain | Potential team expansion | CSM follow-up within 24h |

At fewer than 1,000 users, every high-signal account deserves a personal email from the founder. This is not scalable forever but it is the most effective growth tactic at pre-seed stage. Vercel's Patrick McKenzie, Stripe's founders, Supabase's Copple — all spent significant time in personal user DMs early on.

The founder's email should be plain text, reference something specific about what they built, and ask one question: "What are you building?" That is it.

---

## 4. Developer-Specific Growth Tactics

### GitHub as the Primary Acquisition Channel

The spike-land-ai GitHub org is the top of the funnel for developer discovery. Every repo README needs:

1. A badge: `[![MCP Tools](https://img.shields.io/badge/spike.land-80%2B%20MCP%20tools-blue)](https://spike.land)`
2. A "Use with Claude" one-liner in the Getting Started section
3. A link to the tool's entry in the spike.land store

The `spike-cli` repo specifically needs to be the showcase repo — clean README, a GIF/asciinema recording of the REPL in action, and a "Star this repo" ask. At 100 GitHub stars, it becomes discoverable in GitHub trending. At 500 stars, it starts appearing in newsletter roundups.

The open-source strategy: keep spike-cli itself open source on npm. The hosted MCP server (spike-land-mcp) is the paid product. This mirrors the Supabase model — the open-source client is free, the managed backend is the business.

### npm as a Distribution Channel

spike-cli is already on npm at `@spike-land-ai/spike-cli`. Three things to do immediately:

1. Make the npm README the best one-page documentation for the product. npm is where developers discover tools while reading blog posts and Stack Overflow answers.
2. Track npm weekly downloads as a leading indicator of paid signups. The conversion from npm download to signup to paid is the funnel that tells you if developer content is working.
3. Add a `npx @spike-land-ai/spike-cli` zero-install path prominently. Reduce the install friction to zero for evaluation.

### "Powered by spike.land" Distribution

Every app deployed on spike.land (Phase 14) should carry a small footer badge by default. Free and Pro users get the badge. Business users can disable it.

This is how Vercel grew — every Next.js site deployed on Vercel showed "Powered by Vercel" to millions of end users, turning every customer into a billboard. The badge links back to spike.land with a UTM parameter so you can measure how many signups came from deployed apps.

For MCP tool builders: when someone publishes a tool to the marketplace (Phase 13), their tool's listing on smithery.ai, glama.ai, and lobeHub should show "Available on spike.land" with a link. Every tool listing is a backlink and a discovery vector.

### spike-cli as a Distribution Channel

The REPL's help text, error messages, and status outputs are marketing copy. Every time a user types `spike --help` or hits a rate limit, they read text. That text should be clear, human, and occasionally mention what upgrading unlocks.

Specifically: add a `spike upgrade` command that opens the billing page in the browser. Make upgrading a CLI-native action.

### MCP Marketplace Dynamics

The tool marketplace (Phase 13) is not just a revenue stream — it is a growth flywheel. Third-party tool builders bring their own audiences. A developer who publishes a popular HackerNews MCP tool on spike.land will tweet about it, write a blog post, and drive their followers to the registry. This is exactly how the Shopify app store grew.

To accelerate: identify 10-15 popular open-source MCP tools that exist in the ecosystem (hackernews-mcp, linear-mcp, github-mcp equivalents) and reach out to their authors about publishing on spike.land. Offer 70% revenue share and a featured listing in exchange for a launch tweet. The cost is zero and the upside is their audiences.

---

## 4.1 The App Store As The Main Growth Loop

The app store is not just a monetization feature. It is the cleanest PLG loop
in the product:

`publish -> share -> install -> embed -> reuse -> publish again`

Why it matters:

- every store app is a reusable landing page for a real MCP surface
- every install is a distribution signal
- every cross-origin embed turns another product into a referral channel
- every published skill or app expands catalog depth without founder-written
  code

The distribution advantages stack:

1. **Store listing** gives the developer a home page
2. **MCP metadata** makes the app callable by agents
3. **Cross-origin access** lets other apps embed the same capability
4. **Offline packaging** expands the range of use cases
5. **Revenue share** gives authors a reason to promote what they publish

That is the flywheel to lean into.

---

## 5. Competitive Positioning

### The True Differentiator

The ROADMAP.md positioning is correct but too long to be memorable. The single-sentence version:

**"The only MCP registry where 533+ tools work in Claude, in your terminal, and soon in WhatsApp — without stitching anything together."**

The "without stitching anything together" is the key phrase. Every developer who has tried to build with MCP knows the pain of connection management, auth flows, and toolset bloat. spike-cli solves all of it. Lead with that solution.

### Against Specific Competitors

**vs. Vercel**: Vercel is for deployment. spike.land is for developers building with AI agents. The overlap is the deployment part, which is coming in Phase 14. Until then, do not directly compete on deployment — position spike.land as the AI agent platform that will eventually include deployment, not the deployment platform that added AI.

**vs. Smithery.ai / Glama.ai / LobeHub (MCP registries)**: These are directories, not platforms. They list tools; they do not host them, rate-limit them, or bill for them. spike.land is the registry that runs the tools. List on these directories as a distribution channel, not a competitor.

**vs. Replit / Cursor**: These are IDEs. spike.land is infrastructure. They are not competing; spike.land integrates with the AI assistant that runs inside these environments.

### Switching Costs

The switching cost strategy is to make spike.land the data layer for user's tool configurations, API keys, and toolset aliases. Once a developer has:
- configured their BYOK API keys in spike.land
- set up toolset aliases (`spike load chess` vs enumerating 6 tool names)
- built agents that reference `spike-land__` namespaced tools
- published a tool to the marketplace

...the cost of switching to a raw MCP server or a competitor is real. Every integration and every configuration deepens the switching cost.

This is why the alias system and BYOK key management are more strategically important than they appear. They are lock-in features dressed as convenience features.

### Developer Trust Signals

In order of impact:

1. **Open-source spike-cli** — already done. This is the most important trust signal. Developers trust tools they can read and fork.
2. **GitHub stars and public commit history** — visible product momentum
3. **100% test coverage on the subscription service** — mention this in the security/reliability section of the docs
4. **Security audit documentation** — the SECURITY_AUDIT_REPORT.md exists. Surface it publicly.
5. **SEIS/EIS eligibility** — irrelevant to US developers but meaningful to UK developer community
6. **Uptime page** — add a public status page (BetterUptime or similar, free tier). Developers check this before adopting infrastructure tools.

---

## 6. 30-Day Growth Experiment Backlog

These are sequenced so each one unblocks the next. Do not run paid acquisition until the first three are done — you will be spending money to send developers into a leaky funnel.

---

### Experiment 1: Wire the Cockpit Dashboard (Days 1-3)

**What**: Connect `/api/cockpit/metrics` to real D1 queries. Add the five conversion funnel events to analytics_events.

**Why first**: Every experiment below requires knowing your numbers. Running growth experiments without measurement is guessing.

**How to measure**: Dashboard loads with real data. You can answer: how many users signed up today, how many made a first tool call, what is the signup-to-activation rate.

**Expected impact**: This is instrumentation, not growth. But it enables everything else.

---

### Experiment 2: The One-Liner Landing Page (Days 3-7)

**What**: Create a single landing page at spike.land that has one job — get a developer to run the Claude Code one-liner and connect. No tour, no features list, no pricing table. Just:

```
claude mcp add spike-land --transport http https://spike.land/mcp
```

Below that: "What just happened? You now have 533+ MCP tools in Claude. Try one."

Then a list of three example tool calls they can paste into Claude immediately.

**How to measure**: Conversion rate from page visit to `mcp_server_connected` event within 24 hours.

**Target**: 20% of landing page visitors complete the connection step within 24 hours.

**Why this works**: The current homepage likely tries to explain everything. This page explains one thing. Developer tooling converts when the path to value is shorter than the path to understanding.

---

### Experiment 3: The "Show HN" Post (Days 7-14)

**What**: Post to Hacker News Show HN with the title: "Show HN: spike.land — 533+ MCP tools in Claude with one line"

The post body should be two paragraphs: what the one-liner does, and what makes spike-cli's multiplexer approach different from running individual MCP servers.

**How to measure**: Signups from HN (UTM tag the link). Target: 100 signups from a front-page Show HN. Target: 20 GitHub stars on spike-cli from HN traffic.

**Timing**: Post on a weekday between 9-11am US Eastern. Monday through Wednesday tend to perform best for developer tools.

**Why this works**: The MCP ecosystem is active on HN. The chess engine, QA studio, and state machine tools are genuinely interesting to the HN audience — they are not generic CRUD wrappers. Lead with the most interesting tools, not the most useful ones.

**Risk**: If the connection experience is broken, HN will say so. This is why Experiments 1 and 2 come first.

---

### Experiment 4: The "Try It In Claude" Button (Days 14-21)

**What**: Add a "Try in Claude" button to every tool card in the spike.land store. Clicking it opens Claude.ai with a pre-filled prompt that says:

> "I have spike.land connected as an MCP server. Can you help me use the [tool_name] tool? Here's what it does: [tool_description]"

This requires that spike.land is already connected as an MCP server — which the button can detect from the auth state. If not connected, show the one-liner first.

**How to measure**: Click-through rate on the button. Whether clicking leads to a tool_call event within the session.

**Target**: 30% of users who click "Try in Claude" make at least one tool call in the following 24 hours.

**Why this works**: The activation gap is the step between "I added the MCP server" and "I know what to do with it." A pre-filled Claude prompt eliminates that gap by giving the user a starting point that does not require them to know what they want.

---

### Experiment 5: The Personal Founder Email (Days 21-30)

**What**: Pull all users who signed up in the last 30 days and made at least one tool call but have not upgraded. Send a plain-text email from the founder's personal address:

Subject: "What are you building with spike.land?"

Body:

> Hi [first_name],
>
> I'm Zoltan, the founder of spike.land. I noticed you've been using [tool_name they used most] — that is one of my favorites too.
>
> I'm curious what you're building. Are you working on something specific, or still exploring what's possible?
>
> No pitch here. Genuinely want to know what problems you're running into so we can make the tools better.
>
> — Zoltan

**How to measure**: Reply rate. Of replies, how many lead to an upgrade within 30 days. Target: 15% reply rate. Of replies, 20% upgrade to Pro within 30 days.

**Why this works**: At 100-500 users, personal founder emails have dramatically higher conversion than automated sequences. The reply itself is the goal — it opens a conversation where you learn what the user is building, which informs product decisions and gives you the raw material for case studies.

**Scaling**: This cannot be done forever. But at fewer than 1,000 users it is the highest-ROI activity the founder can do outside of shipping code.

---

## Email Sequences

### Sequence A: Activation (Triggered: Signup, not yet made first tool call)

**Email 1 — Immediate post-signup**

Subject A: "Your spike.land account is ready — here's the one line you need"
Subject B: "533+ MCP tools, one line to connect them"

Body:

> Hi [first_name],
>
> Your spike.land account is live. Free tier, no expiry, no credit card needed.
>
> The fastest way to see what spike.land does:
>
> ```
> claude mcp add spike-land --transport http https://spike.land/mcp
> ```
>
> Paste that into your terminal. If you use Claude Code, run it there. You'll be connected to 533+ MCP tools in under 60 seconds.
>
> Not using Claude Code? Here's the npx path:
>
> ```
> npx @spike-land-ai/spike-cli shell
> ```
>
> Either way, once you're connected, try this: ask Claude to start a chess game or run an image enhancement. You'll see what the tools actually do.
>
> — Zoltan at spike.land
>
> P.S. Stuck? Hit reply and tell me where you got lost. I read every email.

**Email 2 — 48 hours if no first_tool_call event**

Subject A: "Did the connection step work?"
Subject B: "Quick question about your spike.land setup"

Body:

> Hi [first_name],
>
> Checking in — did you manage to connect spike.land to Claude Code or spike-cli?
>
> If you hit a snag, the most common issue is that port 9876 is blocked during OAuth. Running `spike auth login --manual` and pasting the token directly usually fixes it.
>
> If something else went wrong, reply and tell me what you saw. I'll help you through it.
>
> — Zoltan

**Email 3 — 5 days if no first_tool_call event**

Subject: "Before you forget about spike.land..."

Body:

> Hi [first_name],
>
> This is the last email in this sequence — I don't want to spam you.
>
> If you signed up but never got around to trying spike.land, I'd genuinely like to know why. Was the setup too confusing? Did you not have a use case in mind? Did you get distracted?
>
> Reply with one sentence. It'll help me understand what's not working, and I'll leave you alone after this.
>
> Thanks either way for signing up.
>
> — Zoltan

---

### Sequence B: Engagement to Upgrade (Triggered: Has made first_tool_call, on free tier, day 7+)

**Email 1 — Day 7 after first tool call**

Subject A: "You've been using spike.land for a week"
Subject B: "Quick check-in after your first week"

Body:

> Hi [first_name],
>
> You made your first tool call seven days ago using [most_used_tool]. Since then you've made [call_count] total tool calls — good sign.
>
> A few things you might not have explored yet:
>
> - The image studio tools (image_enhance, image_generate) — these are Pro-tier, but worth knowing exist
> - Toolset aliases — run `spike alias create my-tools chess codespace` to load two toolsets at once
> - BYOK keys — add your Anthropic or Replicate key and you won't touch your spike.land credits for model calls
>
> Any questions? Hit reply.
>
> — Zoltan

**Email 2 — Credit limit hit (triggered by upgrade_prompt_shown event)**

Subject: "You hit the daily limit — here's what Pro unlocks"

Body:

> Hi [first_name],
>
> You just ran out of daily credits. That means you're actually using spike.land, which is the good news.
>
> Pro is $29/month. It gives you 1,000 credits/month (vs 50/day on free), unlocks image studio tools, and adds custom domain support.
>
> If you'd prefer not to commit monthly, you can also grab a credit pack: $10 for 500 credits, one-time purchase.
>
> Either way, you won't be blocked: [upgrade link] or [credit pack link].
>
> — Zoltan

---

### Sequence C: Cold Outreach — Developer Segment (For HN/GitHub-sourced leads)

**Email 1 — Personalized outreach to open-source MCP tool authors**

Subject A: "Your [tool_name] tool + spike.land registry"
Subject B: "Monetize [tool_name] via spike.land marketplace"

Body:

> Hi [name],
>
> I came across [tool_name] on GitHub — solid implementation of [specific thing you noticed about it].
>
> I'm building spike.land, an MCP registry with 533+ tools. We're opening a third-party marketplace in Q2 2026 where tool authors keep 70% of revenue.
>
> If you've thought about monetizing [tool_name] without managing billing, auth, or rate limiting yourself, this might fit. We handle all of that — you just submit the tool and we host it.
>
> Interested in being one of the first marketplace contributors? I can give you a featured listing and an early-access rate until launch.
>
> — Zoltan
> Founder, spike.land

**Follow-up — 5 days no reply**

Subject: "Following up on [tool_name] + spike.land"

Body:

> Hi [name],
>
> Just following up on my note from last week about listing [tool_name] on the spike.land marketplace.
>
> If the timing isn't right or you're not interested in monetizing it, no problem — I just thought the tool was well built and worth asking.
>
> If you're open to a quick call, I'm happy to walk you through how the marketplace works: [calendar link].
>
> — Zoltan

---

## Subject Line A/B Test Schedule

Run each test for 200 sends minimum before calling a winner.

| Week | Segment | Variant A | Variant B | Metric |
|---|---|---|---|---|
| 1 | Activation email 1 | "Your spike.land account is ready" | "533+ MCP tools, one line to connect" | Open rate, click to install |
| 2 | Activation email 1 | Winner from week 1 | "The one-liner that connects Claude to 533 tools" | Click to install |
| 3 | Upgrade trigger | "You hit the daily limit" | "Credits empty — here's what Pro gives you" | Upgrade conversion |
| 4 | Day-7 engagement | "You've been using spike.land for a week" | "Quick check-in after your first week" | Reply rate |

---

## Personalization Variables

Every email and in-product message should be able to use:

| Variable | Source | Use |
|---|---|---|
| `first_name` | mcp-auth users table | Greeting |
| `most_used_tool` | tool_user_daily, top tool by call_count | Reference specific behavior |
| `call_count` | tool_user_daily, SUM(call_count) | Social proof of their own usage |
| `days_since_signup` | mcp-auth users.created_at | Timing context |
| `current_tier` | Workspace.subscriptionTier | Conditional content |
| `credits_remaining` | Workspace.monthlyAiCredits - usedAiCredits | Urgency |
| `last_tool_called` | tool_user_daily, most recent day | Recency signal |

---

## Follow-Up Schedule

| Trigger | Delay | Action |
|---|---|---|
| Signup | Immediate | Activation email 1 |
| Signup, no first_tool_call | +48h | Activation email 2 |
| Signup, no first_tool_call | +5d | Activation email 3 |
| First tool call | +7d | Engagement email 1 |
| Credit limit hit | Immediate | Upgrade trigger email |
| Credit limit hit, no upgrade | +3d | Credit pack nudge |
| Upgrade to Pro | Immediate | Welcome to Pro email (not yet written) |
| 14 days no activity | — | Re-engagement email (not yet written) |

---

## Objection Handling Scripts

These are for the founder's personal reply emails and eventual CSM use.

**"I'm not sure I have a use case for this yet"**

> Fair. Most developers who sign up are in the same spot — they know MCP is useful but haven't found the specific workflow that clicks for them. Can I ask what you're currently building with AI? Even if it's not a spike.land use case, I might be able to point you at the right tool or suggest something you haven't tried.

**"It's too expensive for a side project"**

> The free tier doesn't expire — 50 credits/day is enough for exploration and small projects. If you're hitting the limit, that's actually the sign that it's worth $29. But if you're not hitting the limit yet, stay on free until you do. There's no rush.

**"I already have my own MCP server setup"**

> Makes sense. spike-cli is designed to work alongside your existing servers — you can add spike.land as one server in your multiplexer config without replacing anything. The value is the 533+ hosted tools you don't have to build or maintain. What tools are you running in your current setup?

**"How is this different from just using the MCP protocol directly?"**

> You can absolutely use MCP directly — it's a standard and we expose the same HTTP endpoint. spike.land adds auth, rate limiting, toolset organization, BYOK key management, and 533+ pre-built tools you'd otherwise have to build yourself. If you want to build all of that, the raw protocol is the right call. If you want to call a chess engine or image enhancer today without writing a server, spike.land is faster.

**"I'm worried about being dependent on a new platform"**

> Reasonable concern. spike-cli is open source — you can fork it and point it at your own MCP servers if spike.land ever goes away. Your BYOK API keys stay yours. Your tool configurations are exportable. We designed it this way intentionally because developer trust requires it.

---

## Tracking Metrics — 30-Day Dashboard

Wire these queries to the cockpit dashboard by end of week one.

| Metric | Query Source | Target (Day 30) |
|---|---|---|
| Total registered users | mcp-auth.users COUNT | 200 |
| Activation rate (first tool call within 24h) | analytics_events funnel | 40% |
| DAU | tool_user_daily distinct user_id | 20 |
| WAU | tool_user_daily distinct user_id, 7d | 60 |
| Free-to-Pro conversion rate | credit_ledger purchases / signups | 5% |
| Upgrade prompt to payment rate | analytics_events -> credit_ledger join | 15% |
| npm weekly downloads | npm API | 100/week |
| spike-cli GitHub stars | GitHub API | 50 |
| Email open rate (activation sequence) | Resend analytics | 45% |
| Email click rate (activation sequence) | Resend analytics | 15% |
| MRR | credit_ledger SUM(amount) WHERE type='purchase' | $500 |

---

## What to Do First (Priority Stack)

1. Wire the cockpit dashboard to real D1 data. Without this, nothing below is measurable.
2. Add the five conversion funnel events to analytics_events (signup, mcp_connected, first_tool_call, upgrade_prompt_shown, upgrade_completed).
3. Ship the activation email sequence via Resend. Three emails, plain text, written above.
4. Post to Hacker News Show HN. This is free and the highest-leverage distribution available right now.
5. Reach out personally to 5 open-source MCP tool authors about the marketplace.
6. Pull the first week's activation funnel data and find the biggest drop-off. Fix that one thing before running any experiment.

---

*Document owner: Founder / first growth hire*
*Review trigger: When paid users > 50, or 60 days from today, whichever comes first*
