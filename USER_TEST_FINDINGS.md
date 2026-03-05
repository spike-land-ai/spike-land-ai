# spike.land User Test Findings Summary

Tested with 16 diverse AI agent personas on 05/03/2026.

## Overview
The agents explored the homepage of spike.land and provided feedback based on their specific professional and personal backgrounds.

## Aggregate Issues & Concerns
- No mention of the recommended apps for my persona (ai-orchestrator, codespace, app-creator, ops-dashboard) — I'd expect a personalized or categorized onboarding path
- "spike-cli" is referenced heavily but there's no install command visible on the page — `npm install -g spike-cli` or similar would reduce friction to zero
- "One config file" is mentioned twice but I never see what that config looks like — a 5-line JSON snippet would massively increase trust
- No pricing page link — "Free to start" raises the immediate question: what does it cost when I scale?
- The stats (80+ tools, 8 CF Workers, one config, free) feel like they need one more: active users or deploys would add social proof
- "Build your own" says "Deploys to the registry on Cloudflare Workers instantly" — but who owns the deployed worker? Is it on my account or spike.land's?
- No explicit mention of which AI clients are supported (Claude, Cursor, Windsurf?) — I need to know this works with my setup before I invest time
- The page has no visible search or filtering for the tool registry — 80+ tools without discoverability is a wall, not a door
- No GitHub link visible in the nav — "Open source" is in the tagline but there's no immediate path to the repo
- No mention of the apps recommended for my persona (codespace, app-creator, ops-dashboard, qa-studio) anywhere on the homepage — the page doesn't speak to "idea to launch" at all
- The value proposition is tool-count-first ("80+"), not outcome-first ("ship your product faster") — misses the job-to-be-done for solo devs
- "MCP multiplexer" in the tagline assumes familiarity with MCP jargon; a newcomer has no context for why they need a multiplexer
- No screenshots, demos, or visuals of the actual product — the accessibility tree shows only two images (blog thumbnails), nothing showing the platform UI
- No "getting started" or onboarding path visible — what do I actually *do* after signing in?
- "Write an MCP tool in the browser" is listed as a feature, but this is a build-for-platform pitch, not a use-the-platform pitch
- No social proof relevant to my use case (testimonials from indie devs, shipped products, etc.)
- "One config file" is a benefit for power users who already have sprawling AI setups; meaningless to someone just starting out
- The stats block (80+ tools, 8 CF Workers, One config, Free to start) mixes infrastructure metrics with user benefits in a confusing way — "8 CF Workers" means nothing to me as a user
- No clear pricing page link or explanation of what "Free to start" means — what does it cost later?
- The blog section feels disconnected from the product — I can't tell if this is a product page or a dev blog

## Individual Persona Reports

# Persona: AI Indie
## Reaction
This page speaks to me directly. "80+ MCP tools. One CLI." is exactly the kind of headline that cuts through noise — I'm not reading marketing fluff, I'm reading a technical value prop. As someone building AI products solo, the promise of lazy-loading tool groups so my agent only sees what it needs is genuinely interesting. The free tier mention removes friction. The "Build your own" item in the registry section is a hook — I can contribute back, which matters for an indie builder who wants to be part of an ecosystem rather than just a consumer.

The blog posts are a bonus: "A Chemist Walked Into a Codebase" and the bug ELO rating post signal this is a team with a distinct voice and technical depth, not a VC-backed content farm.

One slight mismatch: my recommended apps (ai-orchestrator, codespace, app-creator, ops-dashboard) aren't mentioned anywhere on this page. That's a gap.

## Proactivity
High. I'd click in this order:

1. **"Browse the MCP tool registry" (ref=4)** — I want to see the actual tools before committing to anything. Is image gen, QA automation, and code compilation enough for my stack?
2. **"Add a new MCP tool" (ref=5)** — I want to understand the contribution flow. How hard is it? Browser-based deploy is intriguing.
3. **"A Chemist Walked Into a Codebase" blog post (ref=9)** — This headline is written for me. I want to know if this is a real story or a thought piece.
4. **"Sign in" (ref=2)** — Only after I've validated the tools are useful. I don't sign up blind.

## Issues & Concerns
- No mention of the recommended apps for my persona (ai-orchestrator, codespace, app-creator, ops-dashboard) — I'd expect a personalized or categorized onboarding path
- "spike-cli" is referenced heavily but there's no install command visible on the page — `npm install -g spike-cli` or similar would reduce friction to zero
- "One config file" is mentioned twice but I never see what that config looks like — a 5-line JSON snippet would massively increase trust
- No pricing page link — "Free to start" raises the immediate question: what does it cost when I scale?
- The stats (80+ tools, 8 CF Workers, one config, free) feel like they need one more: active users or deploys would add social proof
- "Build your own" says "Deploys to the registry on Cloudflare Workers instantly" — but who owns the deployed worker? Is it on my account or spike.land's?
- No explicit mention of which AI clients are supported (Claude, Cursor, Windsurf?) — I need to know this works with my setup before I invest time
- The page has no visible search or filtering for the tool registry — 80+ tools without discoverability is a wall, not a door
- No GitHub link visible in the nav — "Open source" is in the tagline but there's no immediate path to the repo

---

# Persona: Classic Indie
## Reaction
This page feels like it's written for AI power users and MCP enthusiasts, not for me. As a solo dev who just wants to ship a product, the headline "80+ MCP tools. One CLI." doesn't immediately tell me what problem this solves for *my* workflow. I know what MCP is, but the pitch leans hard into infrastructure jargon ("Cloudflare Edge," "Durable Objects," "MCP multiplexer") before telling me what I can actually *build*. The recommended apps for my persona — codespace, app-creator, ops-dashboard, qa-studio — are mentioned nowhere on this page. That's a missed opportunity to hook me.

The blog posts are interesting. "A Chemist Walked Into a Codebase" sounds like a vibe-coding success story that might resonate with me, but I have to click through to find out.

The "Free to start" stat is reassuring. The "80+ MCP Tools" number is impressive but abstract without examples relevant to my use case.

## Proactivity
Moderate. I'd explore cautiously, not excitedly.

1. **Click "Browse the MCP tool registry" (ref=4)** — I need to see if any of these 80 tools are relevant to building and shipping a traditional app. If the registry feels useful, I stay. If it's 80 tools for AI-specific workflows I don't recognize, I bounce.
2. **Click the "A Chemist Walked Into a Codebase" blog post (ref=9)** — the "three production apps, £90K of software" hook is the most relatable thing on the page. I want to see if this is actually for someone like me.
3. **Click "Sign in" (ref=2)** only if the registry convinces me there's something worth trying.
4. I would *not* click "Add a new MCP tool" — I'm here to use tools, not build them.

## Issues & Concerns
- No mention of the apps recommended for my persona (codespace, app-creator, ops-dashboard, qa-studio) anywhere on the homepage — the page doesn't speak to "idea to launch" at all
- The value proposition is tool-count-first ("80+"), not outcome-first ("ship your product faster") — misses the job-to-be-done for solo devs
- "MCP multiplexer" in the tagline assumes familiarity with MCP jargon; a newcomer has no context for why they need a multiplexer
- No screenshots, demos, or visuals of the actual product — the accessibility tree shows only two images (blog thumbnails), nothing showing the platform UI
- No "getting started" or onboarding path visible — what do I actually *do* after signing in?
- "Write an MCP tool in the browser" is listed as a feature, but this is a build-for-platform pitch, not a use-the-platform pitch
- No social proof relevant to my use case (testimonials from indie devs, shipped products, etc.)
- "One config file" is a benefit for power users who already have sprawling AI setups; meaningless to someone just starting out
- The stats block (80+ tools, 8 CF Workers, One config, Free to start) mixes infrastructure metrics with user benefits in a confusing way — "8 CF Workers" means nothing to me as a user
- No clear pricing page link or explanation of what "Free to start" means — what does it cost later?
- The blog section feels disconnected from the product — I can't tell if this is a product page or a dev blog