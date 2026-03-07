# Marketing Personas — Spike Land Platform

> **Last Updated**: March 2026
> **Product**: Spike Land — MCP-first AI development platform on Cloudflare edge
> **Primary Channels**: GitHub, npm, Hacker News, LinkedIn, Twitter/X, Discord
> **Personas**: 16 (Year 1), scaling to 32 (Year 2) and 64 (Year 3)
> **Related**: [BUSINESS_PLAN.md](./BUSINESS_PLAN.md) Section 5

---

## Strategic Context

Spike Land is a managed MCP registry and AI development platform. The core
audience is developers and AI agent builders who discover the platform through
npm (`spike-cli`), GitHub, MCP registry listings, and developer communities.

This document defines 16 target personas across 4 segments. Each persona
includes demographics, pain points, activation triggers, platform tools used,
pricing tier, unit economics, messaging, and content strategy.

**Year 1 priority**: Focus acquisition on the 4 highest-LTV personas (D3, D1,
D4, D2) and the 4 lowest-CAC personas (A1, A4, C4, A2). The remaining 8
personas receive baseline measurement only.

---

## Segment A: Builders (Developer-First)

Developers who discover spike.land through npm, GitHub, MCP registries, or
developer communities. They evaluate tools by API quality, developer experience,
and extensibility. This is the primary early-adoption segment.

---

### A1: AI Agent Developer

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 25-40 |
| Gender | 75% Male |
| Income | £50-120k |
| Location | Global (Remote-first) |
| Platforms | GitHub, npm, Discord, Hacker News, Twitter/X |

**Professional Profile**

- Builds AI agents using MCP; works with Claude, GPT, or custom agent frameworks
- Comfortable with CLIs, APIs, and the MCP protocol
- Evaluates tools by developer experience, documentation, and composability
- Discovers tools through npm weekly downloads, GitHub trending, and MCP
  registries
- Active in AI/ML Discord servers and open-source communities

**Pain Points**

- Fragmented MCP servers — must build, host, and authenticate each one
  separately
- Connection management overhead when running multiple MCP servers
- No managed registry that handles auth, rate limiting, and billing
- Vendor lock-in with proprietary APIs and breaking changes

**Activation Trigger**

Adding spike.land as an MCP server to Claude Code in one terminal command:

```
claude mcp add spike-land --transport http https://spike.land/mcp
```

**Platform Tools Used**

spike-cli, MCP API, code editor, image studio, chess engine, QA studio

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | FREE → API PRO ($49/mo) |
| CAC | £10-30 |
| LTV | £588-1,764 |
| LTV:CAC | 19.6-58.8x |
| Payback | < 1 month |

**Messaging**

- **Hero**: "80+ MCP tools. One `claude mcp add`. Done."
- **Pain amplification**: "Stop building auth, rate limiting, and billing for
  every MCP server."
- **Differentiator**: "The only managed MCP registry — hosted, metered, billed."

**Ad Copy Variations**

- "Your AI agent can now use 80+ tools. One line to connect."
- "Building an AI agent? Skip the plumbing. `npx spike --help`"
- "80+ MCP tools for developers. Open source CLI. Managed registry."
- "The MCP registry that runs the tools — not just lists them."

**Content Strategy**

- Show HN: "spike.land — 80+ MCP tools in Claude with one line"
- Tutorial: "Build a Claude-powered agent with spike-cli in 10 minutes"
- GitHub README with quickstart, tool catalog, and asciinema recording
- Blog: "Why managed MCP is the future of AI agent infrastructure"

---

### A2: Indie Hacker / Solo Founder

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 22-38 |
| Gender | 65% Male |
| Income | £20-80k (variable, bootstrapped) |
| Location | Global (Remote-first) |
| Platforms | Twitter/X, Indie Hackers, Product Hunt, Hacker News |

**Professional Profile**

- Solo SaaS builder; ships fast, budget-conscious
- Earns revenue through micro-SaaS, info products, or consulting
- Values tools that reduce time-to-launch
- Active early adopter, shares tool discoveries on Twitter/X

**Pain Points**

- Too many tools to stitch together for deployment + AI + monitoring
- Limited engineering time — needs maximum leverage from each tool
- Budget-sensitive — cannot justify $100+/mo tooling on unvalidated ideas
- No integrated "build and deploy" workflow for AI-powered apps

**Activation Trigger**

Seeing a "build and deploy an app in 5 minutes" tutorial using spike-cli or vibe
coding

**Platform Tools Used**

Vibe coding, managed deployments, image studio, QA automation, templates

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | PRO ($29/mo) |
| CAC | £30-60 |
| LTV | £348-1,044 |
| LTV:CAC | 5.8-17.4x |
| Payback | 1-2 months |

**Messaging**

- **Hero**: "Build, deploy, and manage your SaaS with one platform."
- **Pain amplification**: "Stop paying for 8 tools. Start shipping."
- **Differentiator**: "AI-first deployment with 80+ tools at $29/mo."

**Ad Copy Variations**

- "I replaced 5 SaaS tools with one platform. Here's how."
- "Solo founder? Build your entire stack with spike-cli."
- "From idea to deployed app in 5 minutes. No team needed."
- "The $29/mo platform that replaced my $200/mo tool stack."

**Content Strategy**

- Product Hunt launch: "Spike Land — Build and deploy apps with AI"
- Twitter/X thread: "How I ship SaaS products with spike-cli (tool breakdown)"
- Blog: "The solo founder's stack in 2026"
- YouTube: "Build a SaaS MVP in 30 minutes with vibe coding"

---

### A3: DevOps / Platform Engineer

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 28-45 |
| Gender | 80% Male |
| Income | £55-110k |
| Location | UK/US/EU |
| Platforms | GitHub, LinkedIn, DevOps Slack, conferences |

**Professional Profile**

- Evaluates and manages team developer tools
- Needs audit logs, permissions, SSO, and compliance features
- Responsible for developer productivity and tool standardisation
- Reports on tool ROI and security posture to leadership

**Pain Points**

- Tool sprawl across engineering teams — no audit trail for AI tool usage
- Permission management and access control for shared AI resources
- Compliance requirements (SOC2, GDPR) for AI tool adoption
- Manual onboarding for each new team member across multiple tools

**Activation Trigger**

Team member recommends spike-cli; evaluates for org-wide rollout based on admin
features and security posture

**Platform Tools Used**

Admin tools, audit logs, team workspaces, API access, QA studio, deployment
management

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | BUSINESS ($99/mo) |
| CAC | £100-200 |
| LTV | £1,188-3,564 |
| LTV:CAC | 5.9-17.8x |
| Payback | 1-2 months |

**Messaging**

- **Hero**: "One platform, full audit trail, every AI tool your team needs."
- **Pain amplification**: "Your team uses 6 AI tools. You have visibility into
  zero of them."
- **Differentiator**: "Managed MCP with team permissions, audit logs, and SSO."

**Content Strategy**

- LinkedIn post: "How we standardised AI tool access for 20 engineers"
- Blog: "The DevOps case for managed MCP registries"
- Webinar: "AI tool governance for engineering teams"

---

### A4: Open-Source MCP Tool Author

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 22-40 |
| Gender | 80% Male |
| Income | £30-100k |
| Location | Global |
| Platforms | GitHub, npm, MCP registries (Smithery, Glama, LobeHub) |

**Professional Profile**

- Maintains one or more open-source MCP tools
- Frustrated by inability to monetise without building billing infrastructure
- Values developer-friendly platforms that handle ops burden
- Active in the MCP ecosystem and open-source communities

**Pain Points**

- No monetisation path for open-source MCP tools
- Must build and maintain hosting, auth, rate limiting, and billing to charge
- Limited analytics on tool usage and adoption
- Competing with free alternatives makes it hard to justify paid tiers

**Activation Trigger**

Cold outreach from founder offering 70/30 marketplace revenue share with
featured listing

**Platform Tools Used**

Marketplace publisher dashboard, tool submission workflow, analytics, revenue
reporting

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | Marketplace Publisher (70/30 rev share) |
| CAC | £0-20 |
| LTV | £240-1,200 |
| LTV:CAC | 12.0-60.0x |
| Payback | < 1 month |

**Messaging**

- **Hero**: "Monetise your MCP tools. We handle billing, auth, and hosting."
- **Pain amplification**: "You built a great tool. You shouldn't have to build
  Stripe integration too."
- **Differentiator**: "70% revenue share. Featured listing. Zero ops."

**Content Strategy**

- Direct email: "Your [tool_name] + spike.land marketplace"
- Blog: "How to monetise your open-source MCP tool in 15 minutes"
- GitHub issue/discussion on popular MCP tool repos

---

## Segment B: Operators (Business-First)

Business users and team leads who need AI-powered tools to solve operational
problems. They evaluate platforms on ROI, team features, and support quality
rather than API documentation.

---

### B1: Startup CTO

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 28-45 |
| Gender | 70% Male |
| Income | £60-130k |
| Location | UK/US/EU startup hubs |
| Platforms | LinkedIn, Hacker News, CTO Slack communities, conferences |

**Professional Profile**

- Technical leader at 5-30 person startup
- Wears multiple hats: architecture, hiring, code review, QA
- Budget-conscious but willing to pay for productivity gains
- Evaluates tools by team impact, not personal preference

**Pain Points**

- Engineering bandwidth bottleneck — too few engineers, too many features to
  build
- Manual code review consuming senior engineer time
- QA and testing is the first thing cut when deadlines approach
- No integrated tool for code review + QA + deployment in a single pipeline

**Activation Trigger**

Seeing spike-cli automate code review and QA in a CI pipeline, saving 10+
engineering hours per week

**Platform Tools Used**

Code review tools, QA studio, deployment automation, team workspaces, API access

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | BUSINESS ($99/mo) |
| CAC | £80-180 |
| LTV | £1,188-3,564 |
| LTV:CAC | 6.6-19.8x |
| Payback | 1-2 months |

**Messaging**

- **Hero**: "Give your team 10 hours back every week."
- **Pain amplification**: "Your 3-person eng team doesn't have time for code
  review AND QA AND shipping."
- **Differentiator**: "AI-powered code review + QA + deployment in one platform."

**Content Strategy**

- Case study: "How a 5-person startup automated code review with spike-cli"
- LinkedIn: "The startup CTO's AI tool stack for 2026"
- Webinar: "Scaling engineering quality without scaling the team"

---

### B2: Non-Technical SMB Owner

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 30-55 |
| Gender | 50/50 |
| Income | £30-80k |
| Location | UK (primarily) |
| Platforms | Google search, Facebook groups, LinkedIn, word of mouth |

**Professional Profile**

- Runs a small business (1-10 employees)
- Cannot code and finds hiring developers expensive and risky
- Needs a web presence, custom tools, or internal apps
- Evaluates solutions by outcome ("build me an app"), not technology

**Pain Points**

- Cannot build software without hiring expensive developers
- Agencies charge £5,000-50,000 for simple web apps
- Existing no-code tools are limiting and lock data in
- Needs professional image creation without design skills

**Activation Trigger**

Discovering the App Builder service (£1,997 one-time) or seeing vibe coding
create a working app from a description

**Platform Tools Used**

App Builder service, image studio, dashboard, templates, basic reporting

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | PRO ($29/mo) + App Builder (£1,997 one-time) |
| CAC | £60-120 |
| LTV | £348-2,345 |
| LTV:CAC | 5.8-19.5x |
| Payback | Immediate (App Builder) / 2-4 months (subscription) |

**Messaging**

- **Hero**: "Get a custom app for your business. No coding required."
- **Pain amplification**: "Agencies charge £10,000+. We charge £1,997."
- **Differentiator**: "AI-built, professionally deployed, with ongoing platform
  access."

**Content Strategy**

- Google Ads: "Custom business app — £1,997, no coding"
- Facebook group posts: testimonial from SMB owner
- Blog: "How a bakery got a custom ordering app for under £2,000"

---

### B3: QA / Testing Lead

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 28-42 |
| Gender | 60% Male |
| Income | £45-85k |
| Location | UK/US/EU |
| Platforms | LinkedIn, QA communities, testing conferences, dev blogs |

**Professional Profile**

- Responsible for test coverage, accessibility compliance, and browser testing
- Reports on quality metrics to engineering leadership
- Under pressure to increase coverage without increasing headcount
- Evaluates automation tools by coverage breadth and setup effort

**Pain Points**

- Manual testing is the bottleneck before every release
- WCAG accessibility compliance requires specialist knowledge and time
- Cross-browser testing is tedious and error-prone
- Existing automation tools require significant setup and maintenance

**Activation Trigger**

Discovering QA Studio's automated WCAG audits and browser test generation from
natural language descriptions

**Platform Tools Used**

QA Studio (browser automation, WCAG audits, test runner), coverage reporting,
CI integration

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | BUSINESS ($99/mo) |
| CAC | £80-150 |
| LTV | £1,188-2,376 |
| LTV:CAC | 7.9-15.8x |
| Payback | 1-2 months |

**Messaging**

- **Hero**: "Automated accessibility audits and browser testing in one tool."
- **Pain amplification**: "WCAG compliance takes 40 hours per release. Automate
  it."
- **Differentiator**: "Natural language test descriptions → automated browser
  tests."

**Content Strategy**

- Blog: "Automating WCAG audits with MCP tools"
- Conference talk: "AI-powered QA for small teams"
- LinkedIn: "We cut QA time by 60% with automated browser testing"

---

### B4: Data-Driven Marketing Manager

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 26-42 |
| Gender | 55% Female |
| Income | £35-65k |
| Location | UK/US |
| Platforms | LinkedIn, marketing Slack communities, Google search |

**Professional Profile**

- Solo or small marketing team at a 10-50 person company
- Needs analytics dashboards, campaign images, and content at scale
- Reports on ROI to leadership; needs data-driven justification
- Juggles social media, content, email, and analytics across multiple tools

**Pain Points**

- Analytics scattered across 5+ platform dashboards
- Manual image creation for campaigns (Canva, Photoshop, Figma)
- No AI-powered content pipeline for blog posts, social media, newsletters
- Reporting overhead — hours spent compiling monthly reports

**Activation Trigger**

Seeing the image studio + analytics dashboard combination automate campaign
image creation and reporting

**Platform Tools Used**

Image studio, analytics MCP tools, content generation, dashboard, reporting

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | PRO ($29/mo) → BUSINESS ($99/mo) |
| CAC | £60-150 |
| LTV | £348-2,376 |
| LTV:CAC | 5.8-15.8x |
| Payback | 1-3 months |

**Messaging**

- **Hero**: "Campaign images, analytics, and content in one AI platform."
- **Pain amplification**: "You spend 60% of your time on busywork. Stop."
- **Differentiator**: "AI image generation + analytics + content — not just
  scheduling."

**Content Strategy**

- LinkedIn: "How I automated campaign image creation with AI"
- Blog: "The marketing manager's AI tool stack for 2026"
- Webinar: "AI-powered marketing for small teams"

---

## Segment C: Creators (Content-First)

Individuals who use the platform for content creation, education, or creative
projects. Lower ARPU but high virality — each creator produces content that
drives organic awareness for the platform.

---

### C1: Technical Blogger

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 24-40 |
| Gender | 65% Male |
| Income | £30-70k |
| Location | Global |
| Platforms | Dev.to, Hashnode, Medium, Twitter/X, personal blogs |

**Professional Profile**

- Writes developer tutorials and technical deep-dives
- Monetises through sponsorships, consulting leads, or employer branding
- Needs interactive code embeds and high-quality illustrations
- Publishes 2-4 posts per month

**Pain Points**

- Manual screenshot creation for code examples
- No interactive code embeds that readers can edit and run
- Image editing tools (Figma, Canva) are overkill for blog illustrations
- Code formatting and syntax highlighting inconsistencies across platforms

**Activation Trigger**

Discovering embeddable code sandboxes and image studio for blog illustrations

**Platform Tools Used**

Code editor embeds, image studio, blog tools, sandbox environments

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | PRO ($29/mo) |
| CAC | £30-60 |
| LTV | £348-696 |
| LTV:CAC | 5.8-11.6x |
| Payback | 1-2 months |

**Messaging**

- **Hero**: "Interactive code embeds + AI illustrations for your blog."
- **Differentiator**: "Your readers can edit and run the code in your blog post."

**Content Strategy**

- Dev.to: "How I add interactive code sandboxes to my blog posts"
- Twitter/X: Thread showing before/after blog post quality
- Partnership: Featured on Hashnode's tool recommendations

---

### C2: Educator / Course Creator

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 28-50 |
| Gender | 55% Male |
| Income | £35-80k |
| Location | Global |
| Platforms | Udemy, YouTube, LinkedIn Learning, education conferences |

**Professional Profile**

- Creates coding courses or teaches programming at institutions
- Needs interactive sandboxes where students can practice
- Values tools that reduce grading and feedback overhead
- Publishes courses on 1-3 platforms

**Pain Points**

- No scalable interactive coding environment for students
- Manual grading of coding assignments
- Engagement tracking across course modules is limited
- Per-seat licensing for educational tools is expensive

**Activation Trigger**

Seeing LearnIt quizzes + code sandboxes integrated for student use, with
progress tracking

**Platform Tools Used**

LearnIt tools, code sandboxes, badges, student workspaces, progress tracking

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | PRO ($29/mo) |
| CAC | £40-80 |
| LTV | £348-1,044 |
| LTV:CAC | 4.4-13.1x |
| Payback | 1-3 months |

**Messaging**

- **Hero**: "Interactive coding courses with built-in quizzes and sandboxes."
- **Differentiator**: "Students write and run code inside your course. No setup."

**Content Strategy**

- YouTube: "How I built an interactive coding course with spike.land"
- Education conference: Demo of LearnIt + sandbox integration
- Partnership: Bootcamp pilot programme

---

### C3: Visual Designer

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 22-38 |
| Gender | 55% Female |
| Income | £25-60k |
| Location | Global |
| Platforms | Dribbble, Behance, Instagram, Twitter/X, design communities |

**Professional Profile**

- Creates visual content for clients, personal brand, or products
- Needs AI-powered image generation, enhancement, and export pipelines
- Evaluates tools by output quality and workflow efficiency
- Budget-sensitive — prefers tools under £50/month

**Pain Points**

- Expensive design tools (Adobe CC £50+/mo, Figma £15+/mo)
- No integrated AI pipeline: generate → enhance → export
- Manual image processing for different formats and sizes
- Switching between 3+ tools for a single image workflow

**Activation Trigger**

Discovering the image studio pipeline: AI generation → enhancement → album
organisation → export

**Platform Tools Used**

Image studio (generate, enhance, album, export), templates, batch processing

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | PRO ($29/mo) + credit overages |
| CAC | £40-80 |
| LTV | £348-870 |
| LTV:CAC | 4.4-10.9x |
| Payback | 1-2 months |

**Messaging**

- **Hero**: "Generate, enhance, and export images in one AI pipeline."
- **Differentiator**: "Complete image workflow at $29/mo — not $50+/mo."

**Content Strategy**

- Instagram: Before/after image enhancement showcase
- Dribbble: "Made with spike.land" project showcase
- Blog: "My AI image workflow: from prompt to final export"

---

### C4: Chess / Game Enthusiast

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 18-50 |
| Gender | 70% Male |
| Income | £15-60k |
| Location | Global |
| Platforms | Chess forums, Reddit (r/chess), Discord, YouTube |

**Professional Profile**

- Plays chess recreationally or competitively online
- Interested in ELO ratings, game analysis, and tournament play
- Active in online chess communities
- May be a developer who discovers chess tools while exploring the platform

**Pain Points**

- Limited AI-powered game analysis on existing platforms
- No MCP-native chess experience (play via Claude or agent)
- Existing platforms (Chess.com, Lichess) don't integrate with AI assistants
- Want unique chess experience combining AI analysis with play

**Activation Trigger**

Discovering the Chess Arena with AI opponents, ELO system, time controls, and
game replay — playable through Claude or spike-cli

**Platform Tools Used**

Chess Arena (21 MCP tools), ELO ratings, time controls, game replay, profile

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | FREE → PRO ($29/mo) |
| CAC | £5-20 |
| LTV | £87-348 |
| LTV:CAC | 4.4-17.4x |
| Payback | 1-2 months |

**Messaging**

- **Hero**: "Play chess with AI — via Claude, your terminal, or the web."
- **Differentiator**: "The only chess engine you can play through MCP."

**Content Strategy**

- Reddit: "I built a chess engine you can play through Claude" (r/chess,
  r/AnthropicAI)
- YouTube: "Playing chess through Claude Code — MCP Chess Arena"
- Discord: Chess community engagement, weekly tournaments

---

## Segment D: Scalers (Agency/Team)

Teams and organisations deploying the platform across multiple clients or
projects. Highest ARPU and longest retention, but highest CAC and longest sales
cycle.

---

### D1: AI Consultancy / Agency

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 30-50 (principals) |
| Gender | 65% Male |
| Income | £60-150k |
| Location | UK/US/EU |
| Platforms | LinkedIn, industry events, client referrals, partnerships |

**Professional Profile**

- 5-50 person agency building AI solutions for enterprise clients
- Manages multiple client projects simultaneously
- Needs workspace isolation, per-client billing, and team management
- Evaluates platforms on scalability, API quality, and support SLA

**Pain Points**

- Per-client tool setup is repetitive and time-consuming
- Billing complexity across multiple clients and tool providers
- No workspace isolation — client data mixing is a compliance risk
- Need white-label or co-branded reporting for client deliverables

**Activation Trigger**

Seeing multi-workspace management with per-client isolation, API SCALE access,
and consolidated billing

**Platform Tools Used**

Multi-workspace, API SCALE, client deployments, team management, audit logs,
reporting

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | BUSINESS ($99/mo) + API SCALE ($149/mo) |
| CAC | £150-300 |
| LTV | £5,940-17,820 |
| LTV:CAC | 19.8-59.4x |
| Payback | 1-2 months |

**Messaging**

- **Hero**: "One platform for all your AI client projects. Isolated. Metered.
  Billed."
- **Differentiator**: "Multi-workspace with per-client API access and billing."

**Content Strategy**

- LinkedIn: Direct outreach to AI agency principals
- Case study: "How an AI agency manages 15 clients on one platform"
- Partnership: Referral programme with revenue share

---

### D2: Freelance Developer (Multi-Client)

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 25-40 |
| Gender | 70% Male |
| Income | £30-80k (variable, freelance) |
| Location | Global (Remote) |
| Platforms | LinkedIn, Upwork, freelancer communities, word of mouth |

**Professional Profile**

- Manages 3-8 client projects simultaneously
- Solo operator or small 2-3 person team
- Charges clients for tool costs as part of project fees
- Values tools that scale linearly with client count

**Pain Points**

- Context-switching between client codebases and tool configurations
- Tool costs scale linearly with clients — eats into margins
- Client reporting is manual and time-consuming
- Need separate workspaces to prevent data mixing

**Activation Trigger**

Discovering multi-workspace pricing that scales with client count, and the
ability to pass tool costs through to clients

**Platform Tools Used**

Multiple workspaces, code editor, deployments, client reporting, spike-cli

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | PRO x3-5 workspaces ($87-145/mo) |
| CAC | £40-80 |
| LTV | £1,044-4,350 |
| LTV:CAC | 13.1-54.4x |
| Payback | 1-2 months |

**Messaging**

- **Hero**: "Manage 8 clients like you're managing 2."
- **Differentiator**: "Multi-workspace management built for freelancers."

**Ad Copy Variations**

- "I 3x'd my client roster without hiring anyone."
- "Freelancers: Stop trading hours for money."
- "Your clients think you have a team. It's just you + Spike."

**Content Strategy**

- LinkedIn: "How I onboard new clients in 15 minutes with spike-cli"
- Blog: "The freelance developer's guide to managing 8 clients"
- Community: Freelancer Slack/Discord engagement

---

### D3: Enterprise Innovation Lead

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 35-55 |
| Gender | 60% Male |
| Income | £80-150k |
| Location | UK/US/EU enterprise centres |
| Platforms | Gartner, Forrester, enterprise sales, LinkedIn, CTO summits |

**Professional Profile**

- Evaluates AI platforms for enterprise-wide adoption
- Needs SSO, RBAC, SLA, audit logs, and dedicated support
- Reports to CTO/CIO; must justify vendor selection to procurement
- Long sales cycle (3-6 months) with multiple stakeholders

**Pain Points**

- Security requirements (SSO, audit trail) that most AI tools don't meet
- Vendor risk assessment for AI tool providers
- Compliance requirements (SOC2, GDPR, ISO 27001)
- Integration with existing enterprise tools (Jira, Slack, CI/CD)

**Activation Trigger**

Enterprise features (SSO, RBAC, SLA, dedicated support) becoming available,
combined with a successful pilot by an internal team

**Platform Tools Used**

Full platform with enterprise security, custom integrations, SLA, dedicated
support

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | ENTERPRISE (£500+/mo, custom pricing) |
| CAC | £500-2,000 |
| LTV | £12,000-36,000 |
| LTV:CAC | 6.0-18.0x |
| Payback | 2-4 months |

**Messaging**

- **Hero**: "Enterprise AI platform with SSO, audit logs, and SLA."
- **Differentiator**: "MCP-native AI tools with enterprise-grade security."

**Content Strategy**

- Direct sales: Custom demo and pilot programme
- White paper: "Enterprise AI tool governance with managed MCP"
- Conference: CTO summit presentations and booth

---

### D4: Education Institution / Bootcamp

**Demographics**

| Attribute | Value |
|-----------|-------|
| Age | 35-55 (programme directors) |
| Gender | 50/50 |
| Income | Institution budget |
| Location | UK/US/EU |
| Platforms | Education conferences, partnership outreach, LinkedIn |

**Professional Profile**

- Coding bootcamp or university CS programme director
- Manages 50-500 students per cohort
- Needs scalable coding sandbox, progress tracking, and grading tools
- Evaluates by per-student cost, setup effort, and student experience

**Pain Points**

- No scalable interactive coding environment for entire cohorts
- Per-seat licensing for IDE tools is prohibitively expensive
- Manual grading and progress tracking across large student groups
- Students need sandboxed environments that prevent interference

**Activation Trigger**

Volume pricing for student workspaces with LearnIt integration and progress
tracking dashboard

**Platform Tools Used**

Student workspaces, LearnIt quizzes, code sandboxes, badges, progress tracking,
admin dashboard

**Unit Economics**

| Metric | Value |
|--------|-------|
| Target Tier | BUSINESS ($99/mo) → ENTERPRISE (volume pricing) |
| CAC | £200-500 |
| LTV | £3,564-11,880 |
| LTV:CAC | 7.1-23.8x |
| Payback | 2-5 months |

**Messaging**

- **Hero**: "Interactive coding sandboxes for your entire cohort. Volume
  pricing."
- **Differentiator**: "50 students, one dashboard. Quizzes, sandboxes, progress
  tracking."

**Content Strategy**

- Education conference: Demo of student sandbox + progress tracking
- Partnership: Pilot programme with 2-3 bootcamps
- Case study: "How a coding bootcamp deployed 200 student sandboxes"

---

## Platform Targeting Summary

| Persona | Primary Channel | Secondary Channel | Acquisition Method |
|---------|-----------------|-------------------|--------------------|
| A1: AI Agent Dev | GitHub / npm | Hacker News, Discord | PLG (spike-cli) |
| A2: Indie Hacker | Twitter/X | Product Hunt, HN | Content, community |
| A3: DevOps Engineer | LinkedIn | GitHub, Slack | Content, events |
| A4: OSS MCP Author | GitHub | npm registries | Direct outreach |
| B1: Startup CTO | LinkedIn | Hacker News, Slack | Content, events |
| B2: Non-Tech SMB | Google Search | Facebook groups | Google Ads, referrals |
| B3: QA Lead | LinkedIn | QA communities | Content, conferences |
| B4: Marketing Mgr | LinkedIn | Google Search | Content, Google Ads |
| C1: Tech Blogger | Dev.to / Hashnode | Twitter/X | Content, community |
| C2: Educator | YouTube | Education conf. | Partnerships |
| C3: Visual Designer | Dribbble / Instagram | Twitter/X | Community, social |
| C4: Chess Enthusiast | Reddit | Discord, YouTube | Organic, viral |
| D1: AI Agency | LinkedIn | Industry events | Direct sales |
| D2: Freelance Dev | LinkedIn | Upwork, communities | Content, referrals |
| D3: Enterprise Lead | Direct sales | Gartner, conferences | Enterprise sales |
| D4: Education Inst. | Conferences | LinkedIn | Partnerships |

---

## Budget Allocation by Persona (Y1)

| Persona | Budget % | Expected CAC | LTV (mid) | LTV:CAC |
|---------|---------|-------------|-----------|---------|
| A1: AI Agent Dev | 12% | £20 | £1,176 | 58.8x |
| A2: Indie Hacker | 8% | £45 | £696 | 15.5x |
| A3: DevOps Engineer | 6% | £150 | £2,376 | 15.8x |
| A4: OSS MCP Author | 3% | £10 | £720 | 72.0x |
| B1: Startup CTO | 8% | £130 | £2,376 | 18.3x |
| B2: Non-Tech SMB | 7% | £90 | £1,347 | 15.0x |
| B3: QA Lead | 5% | £115 | £1,782 | 15.5x |
| B4: Marketing Mgr | 5% | £105 | £1,362 | 13.0x |
| C1: Tech Blogger | 4% | £45 | £522 | 11.6x |
| C2: Educator | 4% | £60 | £696 | 11.6x |
| C3: Visual Designer | 3% | £60 | £609 | 10.2x |
| C4: Chess Enthusiast | 2% | £13 | £218 | 16.8x |
| D1: AI Agency | 10% | £225 | £11,880 | 52.8x |
| D2: Freelance Dev | 5% | £60 | £2,697 | 44.9x |
| D3: Enterprise Lead | 12% | £1,250 | £24,000 | 19.2x |
| D4: Education Inst. | 6% | £350 | £7,722 | 22.1x |

---

## Persona Scaling Strategy

### Year 1: 16 Personas — Establish Baselines

Operate with these 16 personas. Track monthly: signups, activation rate,
free-to-paid conversion, churn, and LTV:CAC per persona. Kill or merge bottom
2 per quarter.

### Year 2: 32 Personas — Behavioural Splitting

Split each Y1 persona into 2 sub-personas based on observed data. Splitting
dimensions: industry vertical, company size, use-case depth, geography.

**Gating**: Minimum 10 users, statistically significant difference (p < 0.05) in
activation/ARPU/churn vs parent persona. If a persona cannot justify a split, it
remains consolidated.

### Year 3: 64 Personas — Geographic & Vertical Deepening

Split again via geographic expansion, vertical specialisation, and usage pattern
segmentation. Same gating criteria as Year 2.

See [BUSINESS_PLAN.md](./BUSINESS_PLAN.md) Section 8 for full scaling
methodology.

---

## Competitive Positioning

| Competitor | Positioning vs. Spike Land | MCP Registry? | CLI Access? |
|------------|---------------------------|---------------|-------------|
| **Vercel** | Deployment only, no MCP tools | No | Yes |
| **Cursor** | AI editor only, no deployment or registry | No | No |
| **Replit** | Cloud IDE, no managed MCP, no marketplace | No | No |
| **Smithery** | MCP directory only — lists tools, doesn't host them | Directory | No |
| **Glama** | MCP directory only — no hosting, billing, or auth | Directory | No |
| **spike.land** | **Managed MCP registry + deployment + marketplace** | **80+ hosted** | **spike-cli** |

**Single-sentence positioning**: "The only MCP registry where 80+ tools work in
Claude, in your terminal, and soon in WhatsApp — without stitching anything
together."

---

## Success Metrics by Segment

| Metric | Builders (A) | Operators (B) | Creators (C) | Scalers (D) |
|--------|-------------|---------------|--------------|-------------|
| Trial-to-Paid Conversion | 10-15% | 20-30% | 8-12% | 30-40% |
| Month 1 Churn | < 12% | < 8% | < 15% | < 5% |
| 6-Month Retention | 60-70% | 70-80% | 55-65% | 80-90% |
| NPS Score | 50-60 | 45-55 | 40-50 | 55-65 |
| Activation Rate (24h) | 50-60% | 40-50% | 35-45% | 55-65% |

---

*Document Version: 2.0 (complete rewrite — expanded from 4 to 16 personas)*
*Last Updated: March 2026*
*Next Review: When paying customers exceed 50, or June 2026*
*Owner: Founder / first growth hire*
