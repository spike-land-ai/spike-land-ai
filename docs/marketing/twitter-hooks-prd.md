# Twitter Marketing Hooks PRD

> **Author:** Radix | **Date:** 2026-03-12
> **Source material:** 32+ blog posts on spike.land
> **Goal:** Ready-to-schedule Twitter hooks — mix of provocative/contrarian and educational/helpful

---

## Expert Panel

Six personas review the entire blog catalogue. Each contributes hooks from their specialty.

| Expert | Lens | Strength |
|--------|------|----------|
| **The Growth Hacker** | Viral loops, FOMO, metrics-driven | Numbers, scarcity, "you're leaving money on the table" |
| **The Developer Advocate** | Technical credibility, "I built this" | Authenticity, show-don't-tell, code snippets |
| **The Storyteller** | Narrative, personal anecdotes | Emotional resonance, relatability, cliffhangers |
| **The Contrarian** | Hot takes, challenge consensus | Spark debate, quote-tweet bait, "unpopular opinion" |
| **The Community Builder** | Engagement questions, polls | Reply magnets, "what's your experience?", community |
| **The Data Nerd** | Stats, benchmarks, before/after | Credibility through numbers, proof, receipts |

---

## Category 1: Context Engineering

**Posts:**
- *Context Engineering Your Zero-Shot Prompt*
- *How Claude Code Engineers Context*
- *Docker Layers Are Just Like LLM Context Caching*
- *Why Your Claude Agent Is Wasting 70% of Its Context Window on Tool Descriptions*

### Standalone Tweets

**Growth Hacker:**
> Your Claude agent is wasting 70% of its context window on tool descriptions it never uses. One lazy-loading pattern fixes it. `[DEV]` `[AI]`

**Developer Advocate:**
> I interviewed Claude Opus about how it assembles context for plans. The answer changed how I write CLAUDE.md files forever. `[DEV]` `[AI]`

**Contrarian:**
> Unpopular opinion: prompt engineering is dead. Context engineering killed it. The difference? One tweaks words, the other designs information architecture. `[DEV]` `[AI]` `[FOUNDER]`

**Data Nerd:**
> Adding 10 MCP tools to a Claude agent consumed 40% of its context window before a single user message. We measured it. Here's the fix. `[DEV]` `[AI]`

**Storyteller:**
> I spent 3 hours iterating on a prompt. Then I spent 10 minutes restructuring the context. The 10-minute version worked on the first try. `[DEV]` `[AI]`

**Community Builder:**
> How do you manage context windows in your AI agents? a) Stuff everything in b) Summarize aggressively c) Lazy-load tools d) Pray `[DEV]` `[AI]`

### Thread Openers

**Developer Advocate:**
> Docker layers and LLM context caching follow the exact same optimization law. Let me explain why this matters for your AI workflow. (thread) `[DEV]` `[AI]`
>
> **Thread structure:** 1) The analogy (stable prefix = cached layers) 2) Why early changes are expensive in both 3) How to structure your context like a Dockerfile 4) Practical CLAUDE.md template 5) Link to full post

**Contrarian:**
> Zero-shot prompting isn't about writing better prompts. It's about front-loading so much context that the model can't get it wrong. Here's how. (thread) `[DEV]` `[AI]`
>
> **Thread structure:** 1) The myth of the perfect prompt 2) What "context engineering" actually means 3) Three patterns that work 4) Before/after examples 5) Link

### Poll Ideas

> What kills your AI agent's performance the most?
> - Too many tools loaded
> - Bad system prompts
> - No context structure
> - Model limitations
> `[DEV]` `[AI]`

### Quote-Tweet / Engagement Bait

> Next time someone says "just use a better prompt," ask them how many tokens their tool descriptions consume before the model even sees the user's question. `[DEV]` `[AI]`

---

## Category 2: Testing Revolution

**Posts:**
- *The Testing Pyramid Is Upside Down*
- *Tool-First Testing vs Browser Testing: A Benchmark on spike.land*
- *It Feels Like Cheating (Because It Is)*

### Standalone Tweets

**Contrarian:**
> I deleted all my E2E tests. My test suite got faster, more reliable, and caught more bugs. The testing pyramid is upside down. `[DEV]` `[FOUNDER]`

**Data Nerd:**
> Tool-first tests: 50ms avg, 0 flakes. Browser tests: 12s avg, 15% flake rate. Same business logic. We benchmarked it. `[DEV]`

**Growth Hacker:**
> Your E2E test suite is burning CI minutes and catching nothing. MCP tools let you test business logic at unit-test speed. Stop paying for flaky tests. `[DEV]` `[FOUNDER]`

**Developer Advocate:**
> Expose your business logic as typed MCP tools. Now your "E2E tests" run in 50ms with zero browser dependencies. Here's the pattern. `[DEV]`

**Storyteller:**
> I told my team "I deleted the E2E tests" and they looked at me like I'd committed a crime. Then I showed them the MCP test results. `[DEV]`

### Thread Openers

**Data Nerd:**
> We benchmarked tool-first testing vs browser testing on the same codebase. The results weren't even close. (thread) `[DEV]`
>
> **Thread structure:** 1) Setup: same business logic, two approaches 2) Speed comparison 3) Reliability comparison 4) Cost comparison 5) The pattern 6) Link to benchmark

**Contrarian:**
> The testing pyramid was invented before AI could write code. It's time to flip it. Here's why. (thread) `[DEV]` `[AI]`
>
> **Thread structure:** 1) Why the pyramid exists 2) What changed (MCP tools) 3) The inverted pyramid 4) Real numbers 5) How to migrate

### Poll Ideas

> What's the flake rate of your E2E test suite?
> - < 5% (blessed)
> - 5-15% (painful)
> - 15-30% (numb)
> - We turned them off
> `[DEV]`

### Hot Take

> Unpopular opinion: if your test requires a browser to run, it's testing the browser, not your business logic. `[DEV]`

---

## Category 3: MCP & Platform

**Posts:**
- *MCP Explained: The Universal Adapter for AI Tools*
- *Introducing spike.land — The MCP-First AI Platform*
- *Introducing the spike.land App Store: Vibe Code, Publish, Earn*
- *Embed spike.land MCP Tools in Your Existing Project in 5 Minutes*
- *The Universal Interface Wasn't GraphQL*
- *The Architecture of Scale: How I Made My MCP Tools Agent-Writable*

### Standalone Tweets

**Growth Hacker:**
> spike.land launched with 80+ MCP tools, a free tier, and API proxy credits. The AI tool marketplace nobody asked for but everyone needs. `[DEV]` `[FOUNDER]` `[AI]`

**Developer Advocate:**
> You don't need to rebuild on spike.land to use it. Embed any MCP tool in your existing project in 5 minutes. CORS is already handled. `[DEV]`

**Contrarian:**
> In 2017 I told two brilliant engineers that GraphQL was the universal interface. Nine years later, the actual universal interface is a chat message with tool calls. `[DEV]` `[AI]` `[FOUNDER]`

**Storyteller:**
> Google released Nano Banana 2 and my image tools became obsolete overnight. So I rebuilt my MCP tool builder so agents could compose, test, and deploy tools without touching framework code. `[DEV]` `[AI]`

**Community Builder:**
> What would you build if you had 80+ AI tools available as a single API call? Seriously asking — we have the tools, show us your craziest idea. `[DEV]` `[AI]` `[FOUNDER]`

**Data Nerd:**
> 80+ MCP tools. One registry. Zero vendor lock-in. Every tool is typed with Zod, tested with Vitest, and deployable to Cloudflare Workers. `[DEV]` `[AI]`

### Thread Openers

**Developer Advocate:**
> MCP is more than tool calling. It's a presentation layer for how AI understands tools, data, and workflows. Here's the full picture. (thread) `[DEV]` `[AI]`
>
> **Thread structure:** 1) What MCP actually is 2) Tools vs Resources vs Prompts 3) How spike-cli implements it 4) Real example 5) Why this matters for your AI app 6) Link

**Growth Hacker:**
> We built an app store where every app is a bundle of composable MCP tools. Here's why that changes the economics of AI development. (thread) `[DEV]` `[FOUNDER]` `[AI]`
>
> **Thread structure:** 1) The problem: tool fragmentation 2) The solution: composable MCP bundles 3) Discovery + install + embed 4) The monetization path 5) Get started free

**Contrarian:**
> The universal interface wasn't REST. It wasn't GraphQL. It wasn't gRPC. It's chat. Here's the 9-year journey that convinced me. (thread) `[DEV]` `[AI]` `[FOUNDER]`
>
> **Thread structure:** 1) 2017: "DynamoDB + GraphQL = done" 2) What went wrong 3) Why chat is different 4) MCP as the protocol layer 5) What this means for your API

### Poll Ideas

> How many MCP tools does your AI agent use?
> - 0 (what's MCP?)
> - 1-5
> - 6-20
> - 20+ (we're all in)
> `[DEV]` `[AI]`

> The universal interface for AI is:
> - REST APIs
> - GraphQL
> - MCP tool calls
> - Natural language
> `[DEV]` `[AI]`

### Quote-Tweet Bait

> Everyone's building AI wrappers around APIs. We built an API wrapper around AI tools. The difference matters more than you think. `[DEV]` `[AI]` `[FOUNDER]`

---

## Category 4: AI Dev Workflow

**Posts:**
- *How to Automate Your Dev Team: AI Agents That Ship Production Code*
- *You Cannot Automate Chaos: The Complete Guide to AI-Powered Dev Pipelines*
- *Godspeed Development: 100 App Ideas Powered by Spike Land MCPs*

### Standalone Tweets

**Growth Hacker:**
> 100 full-stack app ideas you can build today using MCP tools. Not "someday." Today. With working code. `[DEV]` `[FOUNDER]` `[AI]`

**Contrarian:**
> You cannot automate chaos. If your CI pipeline is broken, AI agents won't fix it — they'll just fail faster. Fix the pipeline first. `[DEV]` `[AI]`

**Developer Advocate:**
> A beginner-friendly guide to replacing manual bottlenecks with autonomous AI workflows. Claude Code + Jules + CI/CD = features without writing code. `[DEV]` `[AI]`

**Storyteller:**
> I automated my dev team. Not by firing anyone — by giving AI agents the same CI pipeline, the same test suite, and the same review process. They shipped their first PR in 20 minutes. `[DEV]` `[AI]` `[FOUNDER]`

**Data Nerd:**
> Our AI-powered dev pipeline: Issue to merged PR in under 30 minutes. Zero human code review needed for routine changes. Here's the exact workflow. `[DEV]` `[AI]`

### Thread Openers

**Developer Advocate:**
> Here's the exact pipeline we use to go from GitHub issue to merged PR with AI agents. No magic, just good CI/CD. (thread) `[DEV]` `[AI]`
>
> **Thread structure:** 1) Prerequisites (tests, CI, linting) 2) Issue → agent assignment 3) Agent writes code 4) CI validates 5) Auto-merge criteria 6) When human review kicks in

**Community Builder:**
> We listed 100 app ideas you can build with MCP tools. Which ones would you actually use? Reply with your top 3. `[DEV]` `[AI]`

### Poll Ideas

> What's stopping you from using AI agents in your dev pipeline?
> - No test coverage
> - Don't trust the output
> - CI/CD isn't ready
> - Already using them
> `[DEV]` `[AI]`

### Hot Take

> Unpopular opinion: your CI pipeline is more important than your choice of AI model. A great model with a broken pipeline ships nothing. `[DEV]` `[AI]`

---

## Category 5: Architecture Deep Dives

**Posts:**
- *defineBlock(): How I Built a Full-Stack Database Abstraction on Cloudflare Workers*
- *Why We Gave Bugs an ELO Rating*
- *Where Does Your Code Actually Belong? Take the Quiz.*
- *The Grandmother Neuron Fallacy: Why AI Tool Chains Break*
- *One Site, Many Faces: How We Built 16 Versions of spike.land*

### Standalone Tweets

**Contrarian:**
> I tried SpacetimeDB, wrote a blog post about it, then deleted it two days later. But the syntax stuck. So I rebuilt the patterns on Cloudflare Workers. `[DEV]`

**Data Nerd:**
> We gave bugs an ELO rating. High-ELO bugs are hard to reproduce, affect critical paths, and earn reporters reputation. Low-ELO bugs get auto-triaged. `[DEV]` `[PM]`

**Storyteller:**
> A reorganization script sorted 990 TypeScript files while I couldn't sleep. The next morning I wrote a quiz: can you beat the algorithm at deciding where code belongs? `[DEV]`

**Developer Advocate:**
> Deterministic tools become brittle inside LLM tool chains. The Grandmother Neuron Fallacy explains why — and how to design the model boundary clearly. `[DEV]` `[AI]`

**Growth Hacker:**
> Same URL, 16 different experiences. Persona-based personalization isn't just for content — it's how we A/B test our entire platform. `[DEV]` `[FOUNDER]` `[PM]`

**Community Builder:**
> We built a quiz: paste your TypeScript code and find out where it belongs in a monorepo. Can you beat the sorting algorithm? `[DEV]`

### Thread Openers

**Developer Advocate:**
> Why deterministic tools break inside LLM tool chains — The Grandmother Neuron Fallacy. (thread) `[DEV]` `[AI]`
>
> **Thread structure:** 1) The fallacy explained 2) Why LLMs treat tools differently than you expect 3) The model boundary problem 4) Design patterns that work 5) Link

**Data Nerd:**
> We built a bug tracker with chess-inspired ELO ratings. Here's why reputation-gated bug reports are the best anti-abuse pattern we've found. (thread) `[DEV]` `[PM]`
>
> **Thread structure:** 1) The problem: spam bug reports 2) ELO for bugs explained 3) Reporter reputation gating 4) Per-service feedback tools 5) Results

### Poll Ideas

> Where does authentication middleware belong in a monorepo?
> - core-logic/
> - edge/
> - api/
> - db/
> `[DEV]`

### Quote-Tweet Bait

> The next time someone says "just write a wrapper," ask them about the Grandmother Neuron Fallacy. Deterministic code inside probabilistic chains breaks in ways wrappers can't fix. `[DEV]` `[AI]`

---

## Category 6: Product & Business

**Posts:**
- *How spike.land Uses AI and A/B Testing to Find Bugs Before You Do*
- *Getting Started with spike.land: From Signup to Your First AI Tool Call*
- *OpenAI-Compatible Endpoint: How It Works and How to Try It Locally*
- *We Migrate Next.js Apps Without Guesswork*

### Standalone Tweets

**Growth Hacker:**
> From signup to your first AI tool call in under 15 minutes. Free tier. No credit card. 80+ tools ready to go. `[DEV]` `[AI]` `[FOUNDER]`

**Developer Advocate:**
> spike.land's OpenAI-compatible endpoint isn't a thin passthrough. It resolves agents, injects MCP context, and you can test the whole flow locally. `[DEV]` `[AI]`

**Contrarian:**
> Most Next.js migrations fail because teams try to rewrite the app before they understand the architecture. We extract the structure first. Then we automate. `[DEV]` `[FOUNDER]`

**Data Nerd:**
> Our A/B testing engine caught 3 unstable app behaviors before users reported them. Variant testing isn't just for conversion — it's a quality loop. `[DEV]` `[PM]`

**Community Builder:**
> Have you ever tried migrating a Next.js app to something else? What was the hardest part? `[DEV]`

### Thread Openers

**Growth Hacker:**
> We built a Next.js migration service. Not a blog post — an actual MCP-powered pipeline that extracts your architecture, automates the mechanical work, and delivers a working app. (thread) `[DEV]` `[FOUNDER]`
>
> **Thread structure:** 1) Why migrations fail 2) The extraction-first approach 3) What we automate 4) What stays manual 5) Results and timeline 6) Link

### Hot Take

> Unpopular opinion: A/B testing for bug detection is more valuable than A/B testing for conversion. If your variants crash differently, you have a quality problem, not a UX problem. `[DEV]` `[PM]`

---

## Category 7: Migration & Framework

**Posts:**
- *Next.js vs TanStack Start: Why Next.js Became Tech Debt for Me*
- *Appendix: Anticipated Pushback on the Next.js Migration Post*
- *We Migrate Next.js Apps Without Guesswork*

### Standalone Tweets

**Contrarian:**
> Next.js became tech debt for me. Expensive build minutes, slow deployments, flaky pipelines. I moved to TanStack Start and my deploy time dropped to seconds. `[DEV]` `[FOUNDER]`

**Storyteller:**
> I loved Next.js for three years. Then my build minutes bill arrived. Then my deploy failed for the fourth time that week. Here's the honest story of why I left. `[DEV]`

**Growth Hacker:**
> If your framework's build time is measured in minutes, you're paying a tax on every iteration. Vite + TanStack Start: builds in seconds. `[DEV]` `[FOUNDER]`

**Developer Advocate:**
> Before you @ me about leaving Next.js: I wrote an entire appendix addressing every pushback. Build config, lock-in, the solo-dev framing — all of it. `[DEV]`

**Data Nerd:**
> Next.js build: 4+ minutes. TanStack Start build: 12 seconds. Same app. Same features. The framework tax is real. `[DEV]`

### Thread Openers

**Storyteller:**
> Why Next.js stopped feeling like leverage — an honest post-mortem from a solo open-source developer. (thread) `[DEV]` `[FOUNDER]`
>
> **Thread structure:** 1) What I loved about Next.js 2) When it started hurting 3) Build times, deploy times, CI costs 4) The migration to TanStack Start 5) What I'd tell past-me 6) The appendix for skeptics

### Poll Ideas

> What's your biggest pain point with Next.js?
> - Build times
> - Deploy complexity
> - Vercel lock-in
> - It's fine actually
> `[DEV]`

### Quote-Tweet Bait

> "Just use Next.js" is the new "just use jQuery." It works until it doesn't, and by then you've built your entire pipeline around it. `[DEV]` `[FOUNDER]`

---

## Category 8: Philosophy & Personal

**Posts:**
- *A Chemist Walked Into a Codebase*
- *What I Learned From My Worst Pull Request*
- *The Vibe Coding Paradox: Why Your AI Gets Dumber the More You Let It Wing It*
- *Think Slowly, Ship Fast*
- *The Predictor Already Moved*
- *The PRD Filter: Your Old Chats Are Already PRDs*
- *Why spike-chat Stays Sharp While Transcript-First AI Chats Go Soft*
- *What I Would Ship in Claude Code*

### Standalone Tweets

**Storyteller:**
> A chemist walked into a codebase. No punchline — that's my actual background. The deeper story is why formalized business logic beats vibe coding every time. `[DEV]` `[FOUNDER]`

**Contrarian:**
> Your AI gets dumber the more you let it wing it. We built a system that learns from its own mistakes. The fix came from physics, not prompt engineering. `[DEV]` `[AI]`

**Growth Hacker:**
> Your old AI chat transcripts are already PRDs. A PRD filter turns transcript sludge into a compact execution artifact. That changes what one developer can ship. `[DEV]` `[AI]` `[FOUNDER]`

**Developer Advocate:**
> Think slowly, ship fast. Heavy specs at the top, disposable UI in the middle, bulletproof business logic at the bottom. The Hourglass Model. `[DEV]` `[FOUNDER]`

**Storyteller:**
> My worst pull request taught me more than my best ones. I misused AI tools, broke the build, and embarrassed myself. Then I built a framework to prevent it from ever happening again. `[DEV]`

**Community Builder:**
> What's the worst PR you've ever submitted? No judgment — we all have one. Mine led to the BAZDMEG Method. `[DEV]`

**Data Nerd:**
> We built an AI that generates React apps from URLs. It worked 40% of the time. Then we taught it to learn from its own failures. Success rate: now 85%+. `[DEV]` `[AI]`

**Contrarian:**
> Most AI chats solve context management by throwing more transcript at the model. spike-chat does the opposite: split prompts, scored memory, staged execution. Less is more. `[DEV]` `[AI]`

### Thread Openers

**Storyteller:**
> I was a chemist before I was a developer. That background taught me something most CS grads miss: formalize your hypothesis before you run the experiment. In code, that means PRDs before prompts. (thread) `[DEV]` `[FOUNDER]`
>
> **Thread structure:** 1) Chemistry → code pipeline 2) The hypothesis analogy 3) Why "vibe coding" fails 4) The BAZDMEG Method 5) What one developer can ship with structure

**Contrarian:**
> Code is disposable. Tests are disposable. PRDs are the only artifact that matters in AI-assisted development. Here's why. (thread) `[DEV]` `[AI]` `[FOUNDER]`
>
> **Thread structure:** 1) The old model: code is precious 2) The new model: specs are precious 3) How AI changes the cost equation 4) The Hourglass Model 5) Real examples from spike.land

**Developer Advocate:**
> Here's what I'd ship next in Claude Code — and more importantly, what I'd avoid. (thread) `[DEV]` `[AI]`
>
> **Thread structure:** 1) What Claude Code gets right 2) Context management gaps 3) What should ship next 4) What's dangerous about open composite runtimes 5) The MCP angle

### Poll Ideas

> What matters most in AI-assisted development?
> - Better models
> - Better prompts
> - Better specs/PRDs
> - Better CI/CD
> `[DEV]` `[AI]`

> Your old AI chat transcripts are:
> - Deleted
> - Bookmarked and forgotten
> - Searched occasionally
> - Converted to PRDs
> `[DEV]` `[AI]`

### Hot Take

> Unpopular opinion: the CLAUDE.md file in your repo is more important than your choice of AI model. Context engineering > model selection. `[DEV]` `[AI]`

---

## Bonus: Cross-Category Bangers

These work standalone regardless of which post they link to.

**Growth Hacker:**
> One developer. 80+ MCP tools. 25 packages. Zero employees. The solo founder stack is real and it runs on Cloudflare Workers. `[FOUNDER]` `[AI]`

**Contrarian:**
> "Move fast and break things" is advice for teams with QA departments. Solo devs need the opposite: think slowly, ship fast, break nothing. `[DEV]` `[FOUNDER]`

**Storyteller:**
> Two years before I arrived, something with my project's name was already waiting in the same city. The countdown ends March 27, 2026. `[FOUNDER]`

**Community Builder:**
> Building in public as a solo founder. AMA about running 25 packages, 80+ MCP tools, and an AI platform on Cloudflare Workers with zero funding. `[FOUNDER]` `[DEV]`

**Data Nerd:**
> 25 packages. 990 files reorganized. 80+ MCP tools. 16 site variants. 32 blog posts. 1 developer. All on Cloudflare's free tier + $5/mo. `[FOUNDER]` `[DEV]`

**Developer Advocate:**
> Every tool on spike.land follows the same pattern: SDK + Zod schema + Vitest tests. That's it. No framework magic. No lock-in. Just typed functions. `[DEV]` `[AI]`

---

## Scheduling Notes

### High-Priority Posts (launch with these)
1. "Your Claude agent is wasting 70% of its context window" — high shareability
2. "I deleted all my E2E tests" — controversy drives engagement
3. "The universal interface wasn't GraphQL" — resonates with experienced devs
4. "Next.js became tech debt" — framework debate = guaranteed engagement
5. "One developer. 80+ MCP tools. Zero employees." — founder story

### Engagement Strategy
- **Monday/Wednesday:** Educational threads (Developer Advocate, Data Nerd)
- **Tuesday/Thursday:** Hot takes and contrarian views
- **Friday:** Community questions and polls
- **Weekend:** Personal stories and philosophy posts

### Tagging Legend
| Tag | Audience |
|-----|----------|
| `[DEV]` | Software developers, engineers |
| `[FOUNDER]` | Solo founders, indie hackers, startup builders |
| `[PM]` | Product managers, team leads |
| `[AI]` | AI/ML practitioners, AI-curious developers |

---

## Verification Checklist

- [x] All standalone tweets < 280 characters
- [x] Thread openers marked with "(thread)" and include suggested structure
- [x] Every blog post represented in at least one category
- [x] All hooks tagged with audience: `[DEV]` `[FOUNDER]` `[PM]` `[AI]`
- [x] Mix of formats: standalone, threads, polls, hot takes, quote-tweet bait
- [x] All 6 expert personas contribute across categories
- [x] Ready to copy-paste and schedule
