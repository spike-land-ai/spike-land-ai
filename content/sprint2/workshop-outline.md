# MCP Workshop for Dev Teams — 2-Hour Outline

**Format:** Hands-on, in-person or remote
**Audience:** Software engineers and engineering leads (0–10 years experience)
**Prerequisites:** Laptop with Node.js installed, terminal access
**Price:** £497/seat or £1,997/team (up to 8)
**Booking:** spike.land/workshop

---

## Overview

This workshop is practical. By the end of two hours, every participant will have:
- Connected a real MCP tool to a local AI agent
- Built a multi-tool agent workflow that does something useful
- Understood the architecture decisions that matter for production

No slides-only sections. Every concept is introduced with a working example.

---

## Part 1 — What Is MCP and Why Does It Matter (30 min)

### 1.1 The Problem MCP Solves (10 min)

**Core question:** Why do AI agents fail in production?

Walk through the reliability gap:
- LLMs can generate plausible-looking code, commands, and API calls
- Without real tool execution, agents can't verify outcomes
- The hallucination problem isn't about wrong facts — it's about agents not knowing if they succeeded

**Live demo:** Show an agent without MCP attempting a multi-step task. Show where it fails.

### 1.2 How MCP Works (10 min)

**Architecture walkthrough:**
- MCP server: exposes tools with JSON Schema definitions
- MCP client: the agent runtime that discovers and calls tools
- Tool call lifecycle: request → schema validation → execution → structured response → agent continuation

**Key properties:**
- Tools are typed (the agent knows what inputs are valid before calling)
- Responses are structured (the agent gets machine-readable results, not prose)
- Servers are composable (one agent can use tools from multiple servers)

**Reference:** Anthropic's MCP specification + the spike.land implementation with 80+ tools

### 1.3 The Ecosystem Right Now (10 min)

- Who has adopted MCP: Anthropic, Google, and growing list of tooling vendors
- Where it sits relative to function calling, tool use, and agent frameworks
- What spike.land built and why (80+ tools across code review, browser automation, image studio, data pipelines)

**Q&A:** 5 minutes for questions before moving to hands-on

---

## Part 2 — Hands-On: Connect Your First MCP Tool (30 min)

### 2.1 Setup (5 min)

Participants connect to the spike.land MCP registry. Pre-configured environment available for those who hit setup issues.

```bash
npx @spike-land-ai/spike-cli connect
```

Verify connection, list available tools, inspect a tool schema.

### 2.2 Your First Tool Call (10 min)

Exercise: Use the `hackernews_search` tool to find relevant posts on a topic of your choice.

Walk through:
- Tool discovery (what tools exist, what they do)
- Schema inspection (what inputs are required/optional)
- Making the call and reading the structured response
- Handling errors (what happens when a call fails)

### 2.3 Chaining Two Tools (15 min)

Exercise: Build a simple two-tool workflow.

**Example chain:**
1. `hackernews_search` — find posts about a topic
2. `browser_extract` — pull the full content of one result

Participants implement this themselves with the facilitator available for help.

**Discussion:** What would break if you did this without MCP? (fragile web scraping, unreliable prompting for extraction)

---

## Part 3 — Building an App with AI Agents + MCP Tools (30 min)

### 3.1 Introduce the Build Challenge (5 min)

Participants will build a small tool that:
- Takes a GitHub repository URL as input
- Retrieves recent activity
- Generates a one-page summary report

This mirrors what Gian Pierre did — using real tools to do real work, not generating placeholder output.

Tools used: `github_activity`, `code_review`, `generate_report` (or equivalent available tools)

### 3.2 Build Session (20 min)

Participants build in pairs. Facilitator circulates and unblocks.

Common issues to watch for:
- Schema mismatches (fixing in real time is a learning moment)
- Rate limiting / auth issues
- Agent loop getting stuck (how to add explicit termination conditions)

### 3.3 Demo and Debrief (5 min)

Two or three participants share their implementations. What worked, what didn't, what surprised them.

**Key takeaway to reinforce:** The value isn't in any individual tool — it's in the reliability of the loop. When tool calls have real schemas and real responses, agents can course-correct.

---

## Part 4 — Architecture for Production + Q&A (30 min)

### 4.1 What Changes in Production (15 min)

**Topics:**

**Authentication and permissions**
- MCP servers should expose only what the agent needs
- Per-user tool scoping vs. per-environment scoping
- How spike.land handles this with Better Auth + Cloudflare Workers

**Latency**
- Tool call latency compounds in agent loops (n tools = n round trips)
- Why edge deployment matters (lower RTT = tighter loops)
- Caching strategies for deterministic tool calls

**Observability**
- Logging tool calls as first-class events
- Tracing agent decision paths
- Alerting on tool failure rates

**Versioning and stability**
- Tool schemas should be versioned
- Breaking changes in tool responses break agent behavior
- How spike.land handles tool versioning (stability levels: experimental, stable, deprecated)

**Error handling**
- Agents need explicit error response schemas, not just HTTP status codes
- Design tools to fail loudly and specifically
- Retry logic belongs in the agent runtime, not the tool

### 4.2 Architecture Patterns (10 min)

**Pattern 1: Single server, multiple tools**
Good for: internal tooling, team-specific workflows
Tradeoffs: operational simplicity vs. coupling

**Pattern 2: Registry-based discovery (what spike.land runs)**
Good for: large tool surfaces, multi-team environments
Tradeoffs: discovery overhead vs. composability

**Pattern 3: Federated MCP (multiple servers, agent selects)**
Good for: security boundaries, multi-tenant systems
Tradeoffs: complexity vs. isolation

### 4.3 Q&A (5 min)

Open questions. Common topics that come up:
- "How does this compare to LangChain / LlamaIndex / [framework]?"
- "Can we self-host the MCP registry?"
- "What's the story with MCP and OpenAI?"
- "How do we roll this out to a team that's skeptical of AI tooling?"

---

## Post-Workshop Resources

- spike.land/workshop — booking and upcoming dates
- spike.land MCP tool catalog — full list of 80+ available tools
- Full story of what Gian Pierre built: https://spike.land/blog/a-chemist-walked-into-a-codebase
- Enterprise pilot enquiries: spike.land/enterprise

---

## Facilitator Notes

- Keep demo environments pre-warmed before the session — cold starts waste time
- Have a backup demo for Part 2 if participants hit auth issues (record a 5-minute walkthrough in advance)
- Part 3 is the highest-value section — protect that 20 minutes of build time
- The Q&A in Part 4 often runs long; be prepared to take questions async
- Best room setup: participants at individual machines, facilitator on a large display
- Ideal cohort size: 4–8 (above 8, add a second facilitator)
