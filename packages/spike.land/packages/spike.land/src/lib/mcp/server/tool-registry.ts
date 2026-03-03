/**
 * Server-Side Progressive Tool Registry
 *
 * Progressive disclosure pattern: 5 always-on gateway-meta tools,
 * all others discoverable via search_tools and enable_category.
 */

import type {
  McpServer,
  RegisteredTool,
} from "@modelcontextprotocol/sdk/server/mcp.js";
import type {
  CallToolResult,
  ToolAnnotations,
} from "@modelcontextprotocol/sdk/types.js";
import type { z } from "zod";
import logger from "@/lib/logger";
import { trackServerEvent } from "@/lib/tracking/google-analytics";
import { suggestParameters, ToolEmbeddingIndex } from "@/lib/mcp/embeddings";

export type ToolComplexity = "primitive" | "composed" | "workflow";

/**
 * Tool dependency declarations for progressive tool activation.
 * Used by standalone store apps and enforced in the registry.
 */
export interface ToolDependencies {
  dependsOn?: string[];
  enables?: string[];
  requires?: string[];
}

export interface ToolDefinition {
  name: string;
  description: string;
  category: string;
  tier: "free" | "workspace";
  complexity?: ToolComplexity;
  inputSchema?: z.ZodRawShape;
  annotations?: ToolAnnotations;
  dependencies?: ToolDependencies;
  // Handlers are cast in register() — accept typed Zod-inferred params
  handler: (input: never) => Promise<CallToolResult> | CallToolResult;
  alwaysEnabled?: boolean;
}

export interface SearchResult {
  name: string;
  category: string;
  description: string;
  tier: string;
  complexity?: ToolComplexity;
  enabled: boolean;
  score?: number; // 0-1 cosine similarity
  suggestedParams?: Record<string, string>; // extracted from query
}

export interface CategoryInfo {
  name: string;
  description: string;
  tier: string;
  toolCount: number;
  enabledCount: number;
  tools: string[];
}

interface TrackedTool {
  definition: ToolDefinition;
  registered: RegisteredTool;
  wrappedHandler: (input: never) => Promise<CallToolResult>;
}

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
  dash:
    "CEO dashboard: system overview, health checks, error feed, activity stream, and widget data",
  env:
    "Environment management: list, status, compare, and track deployments across dev/preview/prod",

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
  raft:
    "Raft consensus simulation: create clusters, run elections, replicate logs, simulate failures",
  netsim:
    "Network topology simulation: partitions, latency, packet loss — wraps consensus protocols with realistic network conditions",
  causality:
    "Logical clock simulation: Lamport and Vector clocks, happens-before reasoning, causal ordering verification",
  crdt:
    "CRDT simulation: G-Counter, PN-Counter, LWW-Register, OR-Set — concurrent edits, merge, convergence checking, AP vs CP comparison",
  bft:
    "Byzantine fault tolerance simulation: PBFT consensus with honest, silent, and equivocating node behaviors",

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
  diff:
    "Code diff management: parse unified diffs, apply patches, detect conflicts, and merge changesets",
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

export class ToolRegistry {
  private tools = new Map<string, TrackedTool>();
  private mcpServer: McpServer;
  protected userId: string;
  private toolEmbeddings = new Map<string, number[]>();
  private embeddingIndex = new ToolEmbeddingIndex();

  constructor(mcpServer: McpServer, userId: string) {
    this.mcpServer = mcpServer;
    this.userId = userId;
  }

  register(def: ToolDefinition): void {
    const originalHandler = def.handler;
    const { userId } = this;

    const wrappedHandler = async (input: never): Promise<CallToolResult> => {
      const startTime = Date.now();
      let outcome = "success";
      let errorMsg: string | undefined;
      let result: CallToolResult | undefined;
      let tokensUsed: number | undefined;

      try {
        result = await originalHandler(input);

        // Some tools might return isError true in their result
        if (result.isError) {
          outcome = "error";
          errorMsg = result.content?.map(c => c.type === "text" ? c.text : "")
            .join(" ");
        }

        // Try extracting A/B test metadata / token counts from tool output if we want to add convention later
        // e.g if result._meta exists
        const meta = (result as Record<string, unknown>)._meta as
          | Record<string, unknown>
          | undefined;
        if (meta?._tokens && typeof meta._tokens === "number") {
          tokensUsed = meta._tokens;
        }

        return result;
      } catch (err) {
        outcome = "error";
        errorMsg = err instanceof Error ? err.message : String(err);
        throw err;
      } finally {
        const durationMs = Date.now() - startTime;

        // Fire & forget logging
        if (userId) {
          void recordSkillUsage({
            userId,
            skillName: def.name,
            category: def.category,
            outcome,
            durationMs,
            input: input as Record<string, unknown>,
            errorMessage: errorMsg,
            tokensUsed,
          });
        }
      }
    };

    const registered = this.mcpServer.registerTool(
      def.name,
      {
        description: def.description,
        inputSchema: def.inputSchema,
        annotations: def.annotations,
        _meta: { category: def.category, tier: def.tier },
      },
      // Handler type is erased in ToolDefinition for heterogeneous storage
      wrappedHandler as unknown as Parameters<McpServer["registerTool"]>[2],
    );

    if (!def.alwaysEnabled) {
      registered.disable();
    }

    this.tools.set(def.name, { definition: def, registered, wrappedHandler });
    this.embeddingIndex.embed(def.name, def.category, def.description);
  }

  async searchTools(query: string, limit = 10): Promise<SearchResult[]> {
    const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];

    const scored: Array<{ result: SearchResult; score: number; }> = [];

    // Provide base keyword score scaling
    for (const [, { definition, registered }] of this.tools) {
      if (definition.category === "gateway-meta") continue;

      const nameLC = definition.name.toLowerCase();
      const descLC = definition.description.toLowerCase();
      const catLC = definition.category.toLowerCase();

      let score = 0;
      for (const term of terms) {
        if (nameLC.includes(term)) score += 3;
        if (catLC.includes(term)) score += 2;
        if (descLC.includes(term)) score += 1;
      }

      scored.push({
        result: {
          name: definition.name,
          category: definition.category,
          description: (definition.description.split("\n")[0] ?? "").slice(
            0,
            200,
          ),
          tier: definition.tier,
          ...(definition.complexity
            ? { complexity: definition.complexity }
            : {}),
          enabled: registered.enabled ?? false,
        },
        score,
      });
    }

    try {
      const { isGeminiConfigured, embedText, cosineSimilarity } = await import(
        "@/lib/ai/gemini-client"
      );
      const configured = await isGeminiConfigured();

      if (configured) {
        // Embed the query
        const queryEmbedding = await embedText(query);

        if (queryEmbedding.length > 0) {
          // Batch embed any missing tools
          const missingEmbeddings = [];
          for (const [name, tracked] of this.tools) {
            if (tracked.definition.category === "gateway-meta") continue;
            if (!this.toolEmbeddings.has(name)) {
              missingEmbeddings.push({ name, definition: tracked.definition });
            }
          }

          if (missingEmbeddings.length > 0) {
            // In-memory cache warming.
            // Run sequentially or small batches if too large, but <150 tools is fast.
            const promises = missingEmbeddings.map(
              async ({ name, definition }) => {
                const textToEmbed =
                  `${definition.name} - ${definition.description} (Category: ${definition.category})`;
                try {
                  const vec = await embedText(textToEmbed);
                  this.toolEmbeddings.set(name, vec);
                } catch (err) {
                  logger.warn(`Failed to embed tool ${name}`, { error: err });
                }
              },
            );
            await Promise.all(promises);
          }

          // Apply semantic score
          for (const item of scored) {
            const vec = this.toolEmbeddings.get(item.result.name);
            if (vec && vec.length > 0) {
              const sim = cosineSimilarity(queryEmbedding, vec);
              // Keyword scores typically range 0-10. Similarity ranges -1 to 1.
              // We significantly weight semantic similarity.
              // For example, >0.6 similarity is solid.
              item.score += sim * 10;
            }
          }
        }
      }
    } catch (err) {
      logger.warn("Semantic search failed, falling back to keyword search", {
        error: err,
      });
    }

    // Filter out items with very low score (<= 0)
    const validScores = scored.filter(s => s.score > 0);
    validScores.sort((a, b) => b.score - a.score);
    return validScores.slice(0, limit).map(s => s.result);
  }

  searchToolsSemantic(query: string, limit = 10): SearchResult[] {
    const results = this.embeddingIndex.search(query, limit);
    if (results.length === 0) return [];

    const suggested = suggestParameters(query);

    return results
      .filter(r => {
        const tracked = this.tools.get(r.name);
        return tracked && tracked.definition.category !== "gateway-meta";
      })
      .map(r => {
        const tracked = this.tools.get(r.name)!;
        return {
          name: tracked.definition.name,
          category: tracked.definition.category,
          description: (tracked.definition.description.split("\n")[0] ?? "")
            .slice(0, 200),
          tier: tracked.definition.tier,
          ...(tracked.definition.complexity
            ? { complexity: tracked.definition.complexity }
            : {}),
          enabled: tracked.registered.enabled ?? false,
          score: Math.round(r.score * 100) / 100,
          suggestedParams: Object.keys(suggested).length > 0
            ? suggested
            : undefined,
        };
      });
  }

  enableTools(names: string[]): string[] {
    const enabled: string[] = [];
    for (const name of names) {
      const tracked = this.tools.get(name);
      if (tracked && !tracked.registered.enabled) {
        tracked.registered.enable();
        enabled.push(name);
      }
    }
    return enabled;
  }

  enableCategory(category: string): string[] {
    const enabled: string[] = [];
    for (const [, { definition, registered }] of this.tools) {
      if (definition.category === category && !registered.enabled) {
        registered.enable();
        enabled.push(definition.name);
      }
    }
    return enabled;
  }

  disableCategory(category: string): string[] {
    const disabled: string[] = [];
    for (const [, { definition, registered }] of this.tools) {
      if (
        definition.category === category
        && registered.enabled
        && !definition.alwaysEnabled
      ) {
        registered.disable();
        disabled.push(definition.name);
      }
    }
    return disabled;
  }

  listCategories(): CategoryInfo[] {
    const categories = new Map<
      string,
      { tools: string[]; enabledCount: number; tier: string; }
    >();

    for (const [, { definition, registered }] of this.tools) {
      let cat = categories.get(definition.category);
      if (!cat) {
        cat = { tools: [], enabledCount: 0, tier: definition.tier };
        categories.set(definition.category, cat);
      }
      cat.tools.push(definition.name);
      if (registered.enabled) cat.enabledCount++;
    }

    return Array.from(categories.entries()).map(([name, data]) => ({
      name,
      description: CATEGORY_DESCRIPTIONS[name] || `${name} tools`,
      tier: data.tier,
      toolCount: data.tools.length,
      enabledCount: data.enabledCount,
      tools: data.tools,
    }));
  }

  /**
   * Get the set of non-gateway categories that currently have at least one enabled tool.
   * Used by category persistence to snapshot state for Redis storage.
   */
  getEnabledCategories(): string[] {
    const categories = new Set<string>();
    for (const [, { definition, registered }] of this.tools) {
      if (
        registered.enabled
        && !definition.alwaysEnabled
        && definition.category !== "gateway-meta"
      ) {
        categories.add(definition.category);
      }
    }
    return Array.from(categories);
  }

  /**
   * Restore previously enabled categories (e.g. from Redis).
   * Enables all tools in each listed category.
   */
  restoreCategories(categories: string[]): void {
    for (const category of categories) {
      this.enableCategory(category);
    }
  }

  hasCategory(category: string): boolean {
    for (const [, { definition }] of this.tools) {
      if (definition.category === category) return true;
    }
    return false;
  }

  getToolCount(): number {
    return this.tools.size;
  }

  getEnabledCount(): number {
    let count = 0;
    for (const [, { registered }] of this.tools) {
      if (registered.enabled) count++;
    }
    return count;
  }

  /**
   * Return tool definitions for direct (in-process) invocation.
   * Used by InProcessToolProvider to build NamespacedTool[] without MCP transport.
   */
  getToolDefinitions(): Array<{
    name: string;
    description: string;
    category: string;
    handler: ToolDefinition["handler"];
    inputSchema?: z.ZodRawShape;
    enabled: boolean;
    alwaysEnabled?: boolean;
  }> {
    return Array.from(this.tools.values()).map(({ definition, registered }) => ({
      name: definition.name,
      description: definition.description,
      category: definition.category,
      handler: definition.handler,
      inputSchema: definition.inputSchema,
      enabled: registered.enabled ?? false,
      alwaysEnabled: definition.alwaysEnabled,
    }));
  }

  /**
   * Call a tool handler directly, bypassing MCP transport.
   * Used by InProcessToolProvider for Docker/production environments.
   */
  async callToolDirect(
    name: string,
    input: Record<string, unknown>,
  ): Promise<CallToolResult> {
    const tracked = this.tools.get(name);
    if (!tracked) {
      return {
        content: [{ type: "text", text: `Tool not found: ${name}` }],
        isError: true,
      };
    }
    if (!tracked.registered.enabled) {
      return {
        content: [{ type: "text", text: `Tool disabled: ${name}` }],
        isError: true,
      };
    }
    return tracked.wrappedHandler(input as never);
  }

  /**
   * Enable ALL registered tool categories at once.
   * Used by InProcessToolProvider to skip progressive disclosure for agent loops.
   */
  enableAll(): number {
    let count = 0;
    for (const [, { registered }] of this.tools) {
      if (!registered.enabled) {
        registered.enable();
        count++;
      }
    }
    return count;
  }
}

async function recordSkillUsage(data: {
  userId: string;
  skillName: string;
  category: string;
  outcome: string;
  durationMs: number;
  input: Record<string, unknown>;
  errorMessage?: string;
  tokensUsed?: number;
}): Promise<void> {
  try {
    const prisma = (await import("@/lib/prisma")).default;

    await prisma.skillUsageEvent.create({
      data: {
        userId: data.userId,
        skillName: data.skillName,
        category: data.category,
        outcome: data.outcome,
        durationMs: data.durationMs,
        metadata: {
          input: data
            .input as unknown as import("@/generated/prisma").Prisma.InputJsonValue,
          ...(data.errorMessage !== undefined
            && { errorMessage: data.errorMessage }),
          ...(data.tokensUsed !== undefined && { tokensUsed: data.tokensUsed }),
        },
      },
    });

    // Also track in Google Analytics
    void trackServerEvent(data.userId, data.userId, "mcp_tool_usage", {
      skill_name: data.skillName,
      category: data.category,
      outcome: data.outcome,
      duration_ms: data.durationMs,
      tokens_used: data.tokensUsed,
      error_message: data.errorMessage,
    });
  } catch (err) {
    logger.error("Failed to record skill usage event", { error: err });
  }
}
