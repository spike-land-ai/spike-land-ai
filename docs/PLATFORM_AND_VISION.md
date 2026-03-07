# spike.land — Platform & Vision Overview

> A vibe coding platform. Edge-native. MCP-first. Built for agents.

---

## Platform Overview

spike.land is a vibe coding platform — a live, collaborative coding environment where every action is agent-accessible, every component is composable, and the entire infrastructure runs at the edge with zero traditional servers.

---

### Edge-Native Architecture

The platform runs on 8 Cloudflare Workers distributed across 300+ edge locations worldwide. There is no origin server. There is no VPC. There is no database server to patch.

```
                        ┌─────────────────────────────────────┐
                        │           Global Edge Network        │
                        │  (Cloudflare — 300+ PoPs worldwide)  │
                        └──────────────────┬──────────────────┘
                                           │
          ┌────────────────────────────────┼────────────────────────────────┐
          │                               │                                │
   ┌──────▼──────┐                ┌───────▼──────┐                ┌───────▼──────┐
   │  spike-edge  │                │  spike-land  │                │   mcp-auth   │
   │  (Hono API)  │                │   -mcp       │                │ (Better Auth)│
   │              │                │  80+ tools   │                │  OAuth + D1  │
   └──────┬───────┘                └──────┬───────┘                └──────────────┘
          │                               │
          │          ┌────────────────────┼────────────────────┐
          │          │                    │                    │
   ┌──────▼──────┐  ┌▼─────────────┐  ┌──▼───────────┐  ┌────▼──────────┐
   │  transpile  │  │spike-land    │  │     code     │  │  spike-review  │
   │  (esbuild   │  │  -backend    │  │  (Monaco +   │  │  (AI code      │
   │   at edge)  │  │ Durable Obj. │  │   live edit) │  │   review bot)  │
   └─────────────┘  └──────┬───────┘  └──────────────┘  └───────────────┘
                            │
              ┌─────────────┼─────────────┐
              │             │             │
           ┌──▼──┐       ┌──▼──┐      ┌───▼──┐
           │  D1  │       │  R2  │      │  KV  │
           │ 17tb │       │Blobs │      │Cache │
           └─────┘       └─────┘      └──────┘
```

The result: sub-50ms cold start worldwide, no capacity planning, no idle compute cost. Monthly infrastructure spend is approximately $5 — compared to $200+ for an equivalent AWS deployment with ECS, RDS, and ElastiCache.

---

### MCP-First Design

MCP (Model Context Protocol) is not a feature. It is the primary API.

The web UI is a client of the same 80+ tools that any agent can call. Every action a user takes in the browser — creating a block, running a transpile, reviewing code — maps directly to an MCP tool call. This means the platform is natively automatable: an AI agent and a human user are first-class equals.

The gateway exposes 5 meta-tools by default. The remaining capabilities are discoverable on demand — a progressive disclosure pattern that keeps token budgets low and tool surfaces clean. A tool marketplace is planned with a 70/30 revenue share, so third-party developers can publish MCP tools into the registry and earn against usage.

---

### Composable Block System

Data access is handled through `block-sdk`, a `defineBlock()` DSL that wraps storage behind a single `StorageAdapter` interface with three runtime targets: D1 (edge SQLite via Drizzle ORM, 17 tables), IndexedDB (browser persistence), and in-memory (testing). Switching runtimes requires no application code changes. Blocks compose — a block can depend on another block, forming a typed dependency graph that is resolved at startup.

---

### Quality Gate System (BAZDMEG)

Code does not reach main without passing 6 automated gates: unit test presence, TypeScript strict compliance, PR description quality, security pattern checks, change size limits, and workspace scope compliance. Before a single line is written, a planning interview with MCQ verification ensures the implementation approach is sound. Three checkpoints — pre-code, post-code, and pre-PR — enforce discipline at the process level, not just the tooling level.

---

### The Cost Advantage

Edge-native is not just an architectural preference. It is a business position. The platform serves global users with consistent latency, zero server management overhead, and an infrastructure bill that rounds to zero at early scale. As usage grows, Cloudflare's pricing model scales sub-linearly compared to reserved-instance AWS architectures — leaving budget for product instead of operations.

| Metric | AWS (Before) | Cloudflare (After) |
|---|---|---|
| Monthly cost | $200+ | ~$5 |
| Cold start | 500ms+ | <50ms |
| Servers to manage | 12+ | 0 |
| Deploy command | Docker build + ECR + ECS | `wrangler deploy` |

---

## Vision Overview

### The Thesis: MCP Changes the Unit of Software

The Model Context Protocol is not a chatbot feature. It is a new unit of software composition — one where the same artifact that defines your API also trains your agent, documents your feature, and validates your business logic. When you build MCP-first, you stop writing code for humans and start writing code for a world where humans and agents collaborate on equal terms.

spike.land was built on this premise from the ground up. Not retrofitted. Not "AI-enhanced." The MCP server is the primary API. The web UI is one client of many. That inversion is the entire bet.

---

### Agents as Citizens, Not Bolt-Ons

Most platforms treat AI agents as an add-on layer bolted onto a human-facing product. Every feature gets built for the UI first, and an API endpoint is wired up afterward — if at all. Agents get the leftovers.

spike.land inverts this. Every UI action has an MCP tool equivalent. Tool descriptions are written as marketing copy for agents because agents read documentation the same way junior developers do: literally. Errors always include a recovery suggestion. Batch operations that would be impractical in a UI are available exclusively to agents because that is where they generate asymmetric value.

This is not a UX philosophy. It is an architecture decision. Agents are first-class users of the platform. They get the same access, the same affordances, and in some cases better tools than a human sitting at a browser.

---

### Three Value Streams from One Artifact

The most underappreciated structural advantage of MCP-first development is what it does to your test surface. When you define a tool — with typed inputs, documented behavior, and explicit error contracts — you have simultaneously produced three things:

1. A unit-testable contract for your business logic
2. An interface any agent can call without browser automation
3. Living documentation that never drifts from the implementation

User stories become MCP tools. MCP tools become unit tests. The E2E test suite shrinks to thin visual smoke tests. The testing pyramid stops being inverted. You write the contract once and earn from it three ways. This is not a side effect of the architecture — it is the architecture.

---

### 16 Personas as Proof of Platform Thinking

The platform currently serves 16 distinct personalized experiences from a single URL. Four binary questions — about how a user builds, ships, collaborates, and deploys — produce 16 personas. Each persona gets its own landing page, its own poll questions, its own app recommendations. A single cookie drives the entire system server-side.

The transparency is deliberate. Users can switch personas and see exactly how the system has categorized them. This is not dark-pattern personalization. It is a demonstration of what edge-native, agent-readable platform logic looks like when it runs at the infrastructure layer rather than the application layer.

Sixteen personas from one codebase. No separate deployments. No database per variant. That is what platform thinking at the edge produces.

---

### Where This Is Going

The current 80+ MCP tools are a foundation, not a ceiling. The roadmap reaches 455+ tools accessible via CLI, web chat, WhatsApp, and Telegram — because the agent that helps you ship code should be reachable wherever you are working.

The business model follows the architecture. MCP API access becomes a paid product tier. A tool marketplace with a 70/30 revenue share lets third-party developers distribute agent-callable tools to the entire user base. Managed deployments — one command, `spike deploy`, no Kubernetes, no YAML sprawl — make the platform the path of least resistance for any developer who wants to ship fast and let agents handle the rest.

---

### The Cost Structure That Makes This Real

The full platform migration from Next.js on AWS to Cloudflare Workers happened over a weekend. Twenty-nine packages. Eighty-plus MCP tools. Zero AWS services remaining. Monthly infrastructure cost dropped from over $200 to approximately $5.

This is not a cost optimization story. It is a proof point about what the right abstraction layer buys you. When your compute runs at the edge, your storage is D1, and your agent interface is the same code that powers your web UI, the marginal cost of scale approaches zero. That cost structure funds the marketplace, funds the multi-channel access layer, and funds the time needed to build the moat that no competitor currently has: MCP-native architecture, managed vibe-code deployments, and Stripe-first billing from a UK Ltd with SEIS/EIS tax advantages for early investors.

The platform exists because the tools that agents need and the tools that developers need are converging. spike.land is being built at that convergence point, from the inside out.

---

## The BAZDMEG Method: Quality Gates for Agent-Driven Development

When AI writes the code, the engineering discipline has to live somewhere else. It cannot live in the model — models do not have skin in the game. It has to live in the process. That is the core premise of the BAZDMEG method: requirements are the product, code is the output, and quality gates are what stand between a fast agent and a broken system.

### Why Gates Are Non-Negotiable

An agent that can ship code in seconds can also ship wrong code in seconds. Speed without constraint is just accelerated failure. The six BAZDMEG gates — unit test presence, TypeScript strict compliance, PR description quality, security pattern checks, change size limits, and workspace scope compliance — are not bureaucratic friction. They are the minimum surface area of trust. Each gate answers a different failure mode: the absent test catches logic drift, strict TypeScript catches assumption leakage, PR description quality catches context loss, and workspace scope compliance prevents agents from touching what they were never meant to touch.

### The Hourglass Testing Model

Traditional projects spend most test effort on E2E suites that are slow, brittle, and expensive to maintain. BAZDMEG inverts this. Seventy percent of testing effort goes to MCP tool tests — the business logic layer. These are fast, deterministic, and directly contractual. Twenty percent goes to E2E specs that verify wiring only. Ten percent goes to UI components, covering accessibility and layout. The shape is an hourglass, not a pyramid, because MCP tools are where spike.land's actual logic lives. If the tool contracts hold, the system holds.

### The Planning Interview as Pre-Flight

Before any implementation begins, the BAZDMEG workflow runs a structured planning interview across six concepts: file awareness, test strategy, edge cases, dependency chain, failure modes, and verification. This is not documentation theater. A failing score or internal contradiction in the answers blocks implementation outright. The interview externalizes the reasoning that would otherwise stay inside the agent's context window and evaporate. It creates a durable record of intent that the PR description can then reference.

### Why This Makes the Platform Trustworthy

Autonomous agents operating on spike.land are not running on hope. They operate inside a scaffolding that gates every change, validates every assumption, and requires a legible explanation of every decision. The bazdmeg MCP server enforces this automatically: lint, typecheck, tests, gate checks, commit, and push run as a single orchestrated workflow. No step is optional. The result is a platform where agent output is verifiable, auditable, and reversible — which is the only basis on which you can responsibly give agents real autonomy.

| Effort | Share | Focus |
|---|---|---|
| Planning | 30% | Understanding the problem, verifying requirements |
| Testing | 50% | MCP tool tests, E2E wiring, regression coverage |
| Quality | 20% | Edge cases, maintainability, polish |
| Coding | ~0% | AI writes code; humans verify correctness |

---

## Why This Is the Perfect Platform for Agents

Most platforms tolerate agents. They expose a REST API, document it poorly, and expect agents to figure out the rest. spike.land was designed differently — not because agents were an afterthought, but because the constraints that make platforms good for agents (structured interfaces, predictable errors, composable primitives) are the same constraints that make platforms good for humans.

### Agents Can Find What They Need

The hardest part of building reliable agent systems is not getting the agent to call a tool correctly — it is getting the agent to know the tool exists. spike.land solves this with progressive disclosure: five gateway-meta tools that surface 80+ capabilities on demand. An agent calls `search_tools` or `enable_category` and receives exactly what it needs to proceed, nothing more. Tool descriptions are written as behavioral primers, not API docs. They shape what the agent tries next before the agent has to guess.

This is discoverability as architecture. The catalog is not a README the agent might read once; it is a live interface the agent queries at runtime.

### Structure All the Way Down

Agents are bad at ambiguity. They perform best when inputs are validated, outputs are typed, and errors carry enough information to self-correct. spike.land makes this the default, not the exception.

Every MCP tool takes Zod-validated inputs and returns structured JSON with an error code, a human-readable message, a suggested next action, and a retryable flag. The philosophy embedded in the design is: even if the agent made the mistake, what could the platform do to prevent the spiral? That question produces a fundamentally different error surface than logging a stack trace and moving on.

Data access follows the same principle. `defineBlock()` exposes schema, business logic, and MCP tools as a single composable unit. Agents interact with typed procedures. The StorageAdapter runs identically on D1 at the edge, IndexedDB in the browser, and in-memory during tests. Agents never touch raw SQL; the abstraction holds across every environment.

### MCP Tools Are the Test Contract

The most underrated architectural decision on spike.land is that the MCP tool interface and the test interface are the same interface. When you write an MCP tool, you are simultaneously defining the agent's entry point, the feature's documentation, and the unit test contract. A test that calls `create_app` with a malformed payload is also verifying exactly what an agent will experience when it makes the same mistake.

This collapses the gap between "does the feature work" and "can an agent use the feature reliably." Quality gates in the BAZDMEG workspace run against the same surface. The Bayesian bugbook tracks which tool calls produce recurring failures. Planning interviews verify understanding before code is written. Quality assurance and agent reliability become the same problem.

### Economics That Match Agent Usage Patterns

Agent workloads are bursty. They spike during active runs and go quiet between them. Pay-per-request edge infrastructure is the correct model for this pattern, and spike.land runs on Cloudflare Workers at roughly $5 per month versus $200 or more on equivalent AWS infrastructure. Low global latency means agents operating across time zones or parallel runs do not accumulate coordination overhead. The platform scales to zero between tasks and to many concurrent workers during them, without configuration changes or capacity planning.

The result is a platform where agents are first-class citizens not because the docs say so, but because the architecture cannot be used any other way.

---

*spike.land — Cloudflare edge. MCP-first. 80+ tools. 29 packages. 8 Workers. $5/month. Zero servers.*

*Built by Zoltan Erdos in Brighton, UK. SPIKE LAND LTD (Company #16906682).*
