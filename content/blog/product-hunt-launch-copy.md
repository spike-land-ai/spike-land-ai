# Product Hunt Launch Copy — spike.land
## Campaign: The Micronation Investigation

---

## 1. TAGLINE (under 60 chars)

**533 AI tools. One platform. Found a sovereign nation.**

*Alternates:*
- `533 AI tools. 18 agents. 1 sovereign nation found.`
- `The MCP platform that investigated its own namesake`
- `533 AI tools — including one that found a micronation`

---

## 2. DESCRIPTION (under 260 chars)

spike.land is an MCP platform with 533+ AI tools running on Cloudflare Workers. Our business plan analyzer confused us with a Brighton micronation (pop: 1, area: 10.2 sqm). So we deployed 18 parallel agents to find its Prince. They did. In minutes.

*Character count: 257*

---

## 3. FIRST COMMENT — Founder Story (300-500 words)

---

I was watching Veritasium's Newcomb's Paradox video at 11pm on a Tuesday.

My AI business plan analyzer — built on spike.land's own agent orchestration — was running in the background. It was supposed to be analyzing our pitch deck for investor readiness. Standard stuff.

Then it flagged something strange. The report had a section titled "Sovereign Risk."

Not market risk. Not technical risk. Sovereign. Risk.

The model had found gov.spikeland.net — the official government website of the Principality of Spikeland. A sovereign micronation. In Brighton. Population: 1. Area: 10.2 square meters. Founded sometime between 2009 and now. Apparently its Prince had declared it independent and put a government website online, and our AI thought we might be the same company.

We are both based in Brighton. We are both called spike.land. My first reaction was mild existential dread.

My second reaction was: let's run agents on this.

I spun up 18 parallel agents using spike.land's tool orchestration. Each one had a specific job:

- WHOIS and DNS records for spikeland.net and gov.spikeland.net
- TLS certificate history via crt.sh
- Wayback Machine archive crawl (earliest capture: 2014)
- LinkedIn and Twitter/X profile search
- Companies House lookup for any Spikeland-registered entity
- Cloudflare infrastructure fingerprinting
- Tailwind CSS pattern matching from rendered HTML
- Domain registrar and expiry date

Eighteen agents. Parallel execution. Results back in under four minutes.

What they found: the Principality of Spikeland was registered to Blackspike Ltd. Its founder — Prince or otherwise — appears to be Felix Corke, a web developer in Brighton. The site runs on Cloudflare. The CSS structure matches Tailwind.

Same city. Same stack. Different constitutional status.

The domain expires March 27. Sixteen days from when I wrote this. I do not know if that is a diplomatic incident or a coincidence.

Here is why I am telling you this instead of a normal launch post: the investigation IS the demo.

spike.land ships 533 AI tools — image generation, browser automation, code execution, chess, QA workflows, and more — but the thing that makes it different is the orchestration layer. You can spin up 18 specialized agents and coordinate them against a shared objective in the time it takes to finish a coffee.

That is what we built. That is what found Prince Felix.

The platform is live. The tools are real. And somewhere in Brighton, a sovereign nation with 10.2 square meters of territory may or may not know we exist.

You can connect in one command:

```
claude mcp add spike-land --transport http https://spike.land/mcp
```

Happy to answer questions — about the platform, the architecture, or the geopolitical implications of two spike.lands sharing a postcode.

-- Zoltan, Brighton, UK

---

## 4. MAKER COMMENT — Responding to "How does it work?"

---

Great question. The short version: MCP (Model Context Protocol) is a standard that lets AI clients discover and call typed tools without custom integration code. spike.land is a hosted registry of 533 tools that all speak MCP.

When you run `claude mcp add spike-land --transport http https://spike.land/mcp`, your AI client gets a full catalog of available tools — their names, typed input schemas, and descriptions. The model reads those descriptions and figures out how to compose them.

The micronation investigation used this directly. Each of the 18 agents had access to specific tool subsets: DNS tools, certificate transparency tools, web archive tools, company registry tools. The orchestration layer — built on the same platform — assigned each agent its scope and merged the results.

Under the hood: everything runs on Cloudflare Workers (zero cold starts, edge-native). Tools are isolated Worker environments. The registry is Cloudflare D1 (SQLite at the edge). Auth is handled by Better Auth with Drizzle ORM. There are no servers to provision.

Tool contracts follow a consistent pattern: Zod input schema, narrative-first response, structured JSON output. That last part matters — narrative responses give the model context, not just data. The difference between a tool that returns `{ status: "expired" }` and one that says "The domain registration for spikeland.net expires in 16 days (March 27). The registrar is Cloudflare. No auto-renew record found." is what makes agent reasoning actually work.

For the full architecture, the docs are at spike.land/docs. For tool authoring, it is the same pattern we use internally — publish an MCP-compatible endpoint, submit to the registry, and you are in the marketplace with a 70/30 revenue share.

---

## 5. GALLERY IMAGE CAPTIONS

---

**Image 1: The Sovereign Risk Report**

Caption: "The moment our own AI flagged sovereign risk in our pitch deck. gov.spikeland.net — a 10.2 sqm micronation in Brighton — shares our name, our city, and apparently our diplomatic exposure. This screenshot is what started the investigation."

Visual to create: Screenshot or mockup of the AI-generated due diligence report with the "Sovereign Risk" section highlighted. The report header should show "spike.land / SPIKE LAND LTD" and the flagged item should clearly reference gov.spikeland.net. Dark theme, clinical document aesthetic.

---

**Image 2: 18 Agents in Parallel**

Caption: "18 specialist agents. WHOIS, DNS, certificate transparency, Wayback Machine, Companies House, social media, stack fingerprinting. Four minutes from launch to a named person, a registered company, and a domain expiry date. This is what spike.land's orchestration looks like at work."

Visual to create: A visual grid or timeline showing the 18 agent tasks running in parallel, each labeled with its function (DNS, WHOIS, crt.sh, Companies House, etc.), converging into a single output at the right side. Execution times shown per agent. Use the platform's dark blue/neon aesthetic from the existing hero imagery.

---

**Image 3: The Platform — 533 Tools, One Connection**

Caption: "533 production-ready AI tools behind one MCP endpoint. Chess, image generation, browser automation, QA workflows, code execution, and the agent orchestration that found a micronation. One command to connect. Runs on Cloudflare Workers globally."

Visual to create: The spike.land tool registry interface showing tool category cards (Image Studio, Chess Arena, QA Studio, Codespace, Utilities, Agent Orchestration) with the single CLI connection command overlaid. Include the tool count (533+) prominently. Should feel like a control panel — the same aesthetic referenced in the launch blog's hero image prompt.

---

## SEO AND DISTRIBUTION METADATA

**Primary keywords**: MCP platform, AI tools, Cloudflare Workers, model context protocol, AI agent orchestration

**Long-tail**: MCP tool registry, hosted MCP server, AI agent tools API, Cloudflare Workers AI tools

**Email subject line variants (for newsletter promotion)**:

1. "We found a sovereign nation. Our AI did it in 4 minutes."
2. "18 agents. 1 micronation. Here's how spike.land works."
3. "Our AI flagged sovereign risk in our own pitch deck"
4. "Brighton has two spike.lands. We sent agents to investigate the other one."
5. "The investigation that became our best product demo"

**Twitter/X thread hook**:

Our AI business plan analyzer flagged "sovereign risk" in our pitch deck.

It found gov.spikeland.net — a micronation in Brighton. Population 1. Area 10.2 sqm.

Same name. Same city.

So we deployed 18 parallel agents to find its Prince.

Here's what they found. [thread]

**LinkedIn post hook**:

I was watching a Veritasium video when our AI flagged something unexpected: a sovereign micronation with the same name as our company, in the same city.

Same name. Same city. Different constitutional status.

We could have ignored it. Instead, we ran 18 parallel agents on the problem — WHOIS, DNS, certificate history, Companies House, Wayback Machine, social profiles, stack fingerprinting.

Four minutes later, we had a name, a registered company, and a domain expiry date.

That investigation is now our best product demo. Here's why.

[link to Product Hunt or blog]

---

## CONTENT DISTRIBUTION PLAN

**Day of launch (Product Hunt goes live at 00:01 PST)**:

- Post founder comment immediately at launch (do not wait)
- Twitter/X thread: publish at 08:00 GMT (London morning, US west coast evening prime)
- LinkedIn post: publish at 09:00 GMT
- Reply to every comment on Product Hunt within the first 4 hours — velocity in the first window determines ranking
- Share in relevant Slack/Discord communities: AI builders, MCP developers, Cloudflare Workers community

**Day 2-3 (sustain)**:

- Write the full blog post version of the investigation story (publish to spike.land/blog)
- Reach out to Veritasium's team — there is a genuine story angle here (Newcomb's Paradox video + AI investigation)
- Submit the blog post to Hacker News as a Show HN
- Share the technical breakdown of the 18-agent architecture in the MCP Discord

**Week 2 (compound)**:

- Follow up with anyone who commented asking technical questions — convert to newsletter subscribers
- Publish the "how the 18 agents actually worked" technical post
- Email newsletter to existing list with subject line variant 1 or 3

---

*File: /Users/z/Developer/spike-land-ai/content/blog/product-hunt-launch-copy.md*
