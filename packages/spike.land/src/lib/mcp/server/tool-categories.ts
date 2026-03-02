/**
 * Category Descriptions
 *
 * Human-readable descriptions for each tool category.
 * Used by the registry's listCategories() method and
 * the gateway-meta search_tools tool for progressive disclosure.
 */

export const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  // Gateway meta (always-on)
  "gateway-meta": "Discovery tools for searching and activating other tools",

  // Core platform
  storage: "File and object storage management for user uploads and assets",
  gallery: "Featured image gallery and before/after album showcase with tiers and privacy control",
  boxes: "EC2 box provisioning and lifecycle management with start, stop, and restart actions",
  jobs: "Asynchronous job lifecycle management, status tracking, and batch operations",
  reminders: "Reminders and follow-ups for workspace connections and recurring tasks",
  share: "Image sharing via unique tokens with expiration and access control",
  permissions: "Permission request approval and access control management for users",
  policy:
    "Content policy rules, severity configuration, and violation checking across social platforms",
  "white-label": "Workspace branding customization with logo, colors, and domain configuration",
  image: "AI image generation, modification, and job management",
  codespace: "Live React application development on testing.spike.land",
  filesystem:
    "Claude Code-style filesystem operations: read, write, edit, glob, grep on codespace files",
  vault: "Encrypted secret storage for agent integrations",
  tools: "Dynamic tool registration and management",
  marketplace:
    "Tool marketplace for community-published tools with discovery, installation, and token earnings",
  bootstrap: "One-session workspace setup: create workspace, store secrets, deploy apps",
  apps: "Full My-Apps lifecycle: create, chat, iterate, manage versions, and batch operations",
  arena: "AI Prompt Arena: submit prompts, review code, compete on ELO leaderboard",
  "album-images":
    "Album image management: add, remove, reorder, list, and move images between albums",
  "album-management":
    "Album CRUD: create, list, get, update, delete albums with privacy and sharing controls",
  "batch-enhance":
    "Batch image enhancement: enhance multiple images, preview costs, and track batch progress",
  "enhancement-jobs": "Enhancement job lifecycle: start, cancel with refund, status, and history",
  create:
    "Public /create app generator: search apps, classify ideas, check status, and manage created apps",
  learnit:
    "AI wiki knowledge base: search topics, explore relationships, and navigate the topic graph",
  admin: "Admin dashboard: manage agents, emails, gallery, jobs, and photo moderation",
  auth: "Authentication: session validation, route access checks, and user profiles",
  "skill-store": "Skill Store: browse, install, and manage agent skills and extensions",
  store:
    "App store: rate apps, manage wishlists, recommendations, personalized picks, and store stats",
  "store-install":
    "App installs: install, uninstall, check status, list installed apps with Redis-backed counts",
  "store-search":
    "App discovery: full-text search, browse by category, featured apps, new arrivals, app details",
  "store-skills":
    "Skills marketplace: browse, inspect, and install agent skills from the published catalog",
  workspaces: "Workspace management: create, list, update, and favorite workspaces",
  agents: "Agent lifecycle: list, get, queue, and message management",
  settings: "User settings: API key management (list, create, revoke)",
  credits: "AI credit balance: check remaining credits, limits, and usage",
  billing: "Billing: Stripe checkout sessions and subscription management",
  "direct-message": "Private messaging: send, list, and manage direct messages between users",
  "agent-inbox":
    "MCP chat bridge: poll for user messages, read context, respond to app and site chats as an external agent",
  pipeline:
    "CI/CD pipeline tools: run tests, build, type-check, lint, deploy preview, and execute named sequences",
  pipelines: "Enhancement pipelines: create, fork, update, and manage image processing pipelines",
  blog: "Blog content: list and read published blog posts",
  career:
    "Career advice: skills assessment, occupation search, salary data, and job listings via ESCO and Adzuna",
  reports: "System reports: generate aggregated platform reports",
  audio: "Audio mixer: upload tracks and manage audio projects",
  chat: "AI chat: send messages and get AI responses",
  newsletter: "Newsletter: email subscription management",
  tts: "Text-to-speech: convert text to audio using ElevenLabs",
  capabilities:
    "Agent permission management: check capabilities, request permissions, track approvals",
  "ai-gateway": "AI API Gateway: provider-agnostic chat, model discovery, and provider management",
  "mcp-registry":
    "MCP server discovery: search, evaluate, and auto-configure MCP servers from Smithery, Official Registry, and Glama",
  "state-machine":
    "State machine creation, simulation, visualization, and export with full statechart support",

  // BAZDMEG
  bazdmeg: "BAZDMEG methodology FAQ management",

  // Reactive tool graphs
  reactions:
    "Reactive tool graphs: event-driven tool composition — create reactions that auto-trigger tools on success/error",

  // Orchestration
  orchestration:
    "Cloud-native code orchestration: context packing, sandboxed execution, task decomposition, verification, and decision tracking",
  orchestrator: "Execution plan creation, subtask dispatching, status tracking, and result merging",

  // Swarm & dashboard
  swarm: "AI agent swarm management: list, spawn, stop, redirect, broadcast, and monitor agents",
  dash: "CEO dashboard: system overview, health checks, error feed, activity stream, and widget data",
  env: "Environment management: list, status, compare, and track deployments across dev/preview/prod",

  // MCP Observability
  "mcp-observability":
    "MCP observability: per-tool metrics (latency percentiles, error rates), system health, user analytics, and cost attribution",

  // Conditional
  jules: "Async coding agent for background development tasks",
  gateway: "GitHub Projects and Bolt orchestration",

  // Error log bridge
  errors: "Error tracking: issues, details, and stats from ErrorLog database",
  "github-admin": "GitHub project management: roadmap, issues summary, and PR status",
  vercel: "Vercel deployments: list, details, and analytics",

  // Orbit core (Tier 1)
  "social-accounts":
    "Social media account management, multi-platform posting, and post metrics tracking",
  pulse: "Account health monitoring, anomaly detection, and metrics analysis for social accounts",
  inbox: "Unified inbox for social media messages, comments, mentions, and DMs across platforms",
  relay:
    "AI-powered response draft generation, approval workflows, and relay metrics for social conversations",
  allocator:
    "Budget allocation recommendations and ad spend optimization across advertising platforms",
  "brand-brain":
    "Brand profile management, content scoring, policy enforcement, and content rewriting",
  scout: "Competitor tracking, benchmarking analysis, and topic monitoring for market intelligence",

  // Orbit growth (Tier 2)
  calendar: "Social post scheduling, calendar management, and optimal posting time detection",
  boost: "Engagement opportunity detection, boost recommendations, and ROI prediction for posts",
  creative:
    "Creative set management, variant generation, fatigue detection, and performance tracking",
  "ab-testing":
    "Social post A/B testing with variant analysis, statistical significance checking, and winner declaration",
  "store-ab":
    "Store app A/B testing: deploy apps to codespaces, create variants, track metrics, and declare winners",
  crisis:
    "Crisis detection, response management, automation pausing, and timeline tracking for social media",
  merch: "Merchandise product listing, cart management, checkout, orders, and shipment tracking",

  // Platform infrastructure (Tier 3)
  tracking:
    "Visitor session tracking, attribution analysis, user journey mapping, and event querying",
  workflows: "Workflow creation, execution, status tracking, and log retrieval for automation",
  assets:
    "Digital asset management including upload, search, organization, tagging, and folder structure",
  email: "Email sending, delivery tracking, and newsletter subscription management",
  agency: "Agency workspace setup, persona generation, and white-label configuration for resellers",
  audit: "Audit log querying, record export, and AI decision trail inspection for compliance",
  notifications: "Push notification delivery and notification preference management",

  // Dynamic pages
  pages: "Dynamic page management: create, update, publish, and manage content pages",
  blocks: "Page block management: add, update, reorder, and manage content blocks within pages",
  "page-ai": "AI-powered page generation: auto-generate pages, enhance blocks, and create themes",
  "page-review":
    "Page metadata review, content quality assessment, and accessibility/performance checking",

  // AVL Profile
  "avl-profile":
    "AVL profile tree: user profiling via binary questions, personalized app store filtering, collision resolution",

  // Chess Arena
  "chess-game":
    "Chess Arena game lifecycle: create, join, move, resign, draw, and manage chess games",
  "chess-player": "Chess Arena player profiles: create, update, stats, and online lobby",
  "chess-challenge":
    "Chess Arena challenges: send, accept, decline, cancel, and list player challenges",
  "chess-replay":
    "Chess Arena replay and leaderboard: review completed games and view ELO rankings",

  // Distributed Systems Simulators
  raft: "Raft consensus simulation: create clusters, run elections, replicate logs, simulate failures",
  netsim:
    "Network topology simulation: partitions, latency, packet loss — wraps consensus protocols with realistic network conditions",
  causality:
    "Logical clock simulation: Lamport and Vector clocks, happens-before reasoning, causal ordering verification",
  crdt: "CRDT simulation: G-Counter, PN-Counter, LWW-Register, OR-Set — concurrent edits, merge, convergence checking, AP vs CP comparison",
  bft: "Byzantine fault tolerance simulation: PBFT consensus with honest, silent, and equivocating node behaviors",

  // CleanSweep
  "clean-photo":
    "CleanSweep photo validation: EXIF freshness check, screenshot detection, metadata extraction",
  "clean-scanner":
    "CleanSweep room scanning: AI-powered mess analysis and task generation from photos",
  "clean-tasks":
    "CleanSweep task management: session lifecycle, task queue, skip/complete/requeue operations",
  "clean-streaks":
    "CleanSweep streaks: consecutive day tracking, points, levels, and all-time stats",
  "clean-reminders": "CleanSweep reminders: scheduled cleaning notification management",
  "clean-verify":
    "CleanSweep verification: AI-powered task completion checking and before/after comparison",
  "clean-motivate": "CleanSweep motivation: achievements, encouragement messages, and celebrations",

  // Distributed Planner/Coder
  session:
    "Distributed coding sessions: create, track, assign roles, manage lifecycle, events, and metrics",
  codegen:
    "Zero-shot code generation: build prompts from context bundles, dispatch to AI, and store results",
  diff: "Code diff management: parse unified diffs, apply patches, detect conflicts, and merge changesets",
  review: "Automated code review: convention checks, complexity analysis, and AI-powered reviews",
  testgen:
    "Test generation: create unit tests and suites from specs and source code using patterns",
  architect:
    "Architecture analysis: requirement decomposition, component design, and file-level task planning",
  security:
    "Security and performance scanning: vulnerability detection, secret discovery, and performance auditing",
  retro:
    "Retrospective analysis: post-session review, pattern extraction, and knowledge management",

  // esbuild
  esbuild:
    "esbuild-wasm code tools: transpile TSX/JSX/TS/JS, bundle codespaces, validate syntax, and parse errors",

  // Tabletop Simulator
  tabletop: "Tabletop game room creation, dice rolling, piece movement, and session management",

  // New tool modules (batch-registered)
  "audio-effects":
    "Audio effects processing including reverb, delay, EQ, normalization, and waveform export",
  "avl-social": "Social leaderboard and uniqueness rankings for the beUniq profiling system",
  "blog-management":
    "Blog post lifecycle management including drafts, publishing, scheduling, and analytics",
  "brand-campaigns":
    "Campaign lifecycle management with A/B copy generation for marketing campaigns",
  "calendar-analytics":
    "Analytics, content suggestions, bulk scheduling, and per-post performance for social calendar",
  "career-growth": "Resume building, job matching, learning paths, and interview preparation tools",
  "chess-tournament":
    "Tournament creation, joining, standings, brackets, and chess puzzle fetching",
  "clean-rooms": "Room definition, cleaning history, statistics, and recurring clean scheduling",
  "codespace-templates":
    "Project template browsing, creation, and dependency management for codebase templates",
  "mcp-analytics":
    "MCP platform analytics, documentation generation, and health monitoring for tool usage",
  "page-templates": "Landing page template browsing, application, and SEO metadata management",
  "qa-performance":
    "Performance auditing, visual regression testing, API testing, and test plan generation",
  "review-pr":
    "PR code review with diff fetching, fix suggestions, convention checking, and security scanning",
  "sm-templates":
    "State machine template library with code generation and event simulation capabilities",
  "swarm-monitoring":
    "AI agent swarm monitoring including performance metrics, costs, and health status",
  "tabletop-state":
    "Game state persistence, chat messaging, and custom asset uploading for tabletop simulator",

  // Dev-only (localhost)
  dev: "Local dev workflow: server logs, git/CI status, file guard, agent notifications",
  "qa-studio":
    "Browser automation and test execution with screenshots, accessibility audits, and network analysis",
};
