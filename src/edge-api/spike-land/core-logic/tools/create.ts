/**
 * /create App Generator MCP Tools (CF Workers)
 *
 * Search, classify, and manage AI-generated React apps from the /create feature.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool } from "../../lazy-imports/procedures-index.ts";
import { apiRequest, SPIKE_LAND_BASE_URL, textResult } from "../lib/tool-helpers";
import type { DrizzleDB } from "../../db/db/db-index.ts";

const CATEGORY_RULES = [
  {
    category: "game",
    template: "game",
    keywords: ["game", "arcade", "puzzle", "platformer", "tetris", "chess", "multiplayer"],
  },
  {
    category: "dashboard",
    template: "dashboard",
    keywords: ["dashboard", "analytics", "admin", "crm", "report", "metrics", "kanban"],
  },
  {
    category: "website",
    template: "landing-page",
    keywords: ["landing", "marketing", "website", "site", "portfolio", "blog", "docs"],
  },
  {
    category: "ai-agents",
    template: "agent-workspace",
    keywords: ["agent", "assistant", "chatbot", "copilot", "automation", "workflow"],
  },
  {
    category: "productivity",
    template: "task-app",
    keywords: ["task", "todo", "calendar", "notes", "tracker", "planner"],
  },
  {
    category: "developer",
    template: "developer-tool",
    keywords: ["code", "api", "developer", "editor", "json", "sql", "terminal"],
  },
  {
    category: "commerce",
    template: "storefront",
    keywords: ["shop", "store", "ecommerce", "checkout", "catalog", "cart"],
  },
] as const;

const STOP_WORDS = new Set([
  "a",
  "an",
  "app",
  "build",
  "create",
  "for",
  "make",
  "me",
  "please",
  "the",
  "to",
  "with",
]);

const DEFAULT_SESSION_MARKERS = [
  "404 - for now.",
  "But you can edit even this page",
  "Write your code here!",
  "const App = () =>",
] as const;

export interface CreateClassificationResult {
  status: "heuristic";
  slug: string;
  category: string;
  template: string;
  reason: string;
}

export interface CreateSessionSnapshot {
  code?: string;
  html?: string;
  css?: string;
  transpiled?: string;
}

export interface CreateHealthAssessment {
  healthy: boolean;
  score: number;
  reason: string;
}

function normalizeIdeaWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, " ")
    .split(/\s+/)
    .map((word) => word.trim())
    .filter((word) => word.length > 0 && !STOP_WORDS.has(word));
}

export function classifyIdeaLocally(text: string): CreateClassificationResult {
  const words = normalizeIdeaWords(text);
  const fallbackSlug = words.slice(0, 5).join("-") || "new-app";

  const rankedRule =
    CATEGORY_RULES.map((rule) => ({
      ...rule,
      score: rule.keywords.filter((keyword) => words.includes(keyword)).length,
    }))
      .sort((left, right) => right.score - left.score)
      .find((rule) => rule.score > 0) || null;

  if (!rankedRule) {
    return {
      status: "heuristic",
      slug: fallbackSlug,
      category: "app",
      template: "blank-react",
      reason: "No strong keyword match. Start from a blank React app and refine the shape in-editor.",
    };
  }

  const matchedKeywords = rankedRule.keywords.filter((keyword) => words.includes(keyword));

  return {
    status: "heuristic",
    slug: fallbackSlug,
    category: rankedRule.category,
    template: rankedRule.template,
    reason: `Matched ${matchedKeywords.join(", ")}. Suggested template: ${rankedRule.template}.`,
  };
}

function hasDefaultMarker(value: string): boolean {
  return DEFAULT_SESSION_MARKERS.some((marker) => value.includes(marker));
}

export function assessCreateSessionHealth(session: CreateSessionSnapshot): CreateHealthAssessment {
  const code = session.code?.trim() || "";
  const html = session.html?.trim() || "";
  const css = session.css?.trim() || "";
  const transpiled = session.transpiled?.trim() || "";

  let score = 0;
  const signals: string[] = [];

  if (code.length >= 120 && !hasDefaultMarker(code)) {
    score += 2;
    signals.push("non-default source");
  } else if (code.length >= 60 && !hasDefaultMarker(code)) {
    score += 1;
    signals.push("edited source");
  }

  if (html.length >= 40 && html !== "<div></div>") {
    score += 1;
    signals.push("rendered HTML");
  }

  if (css.length >= 20) {
    score += 1;
    signals.push("generated CSS");
  }

  if (transpiled.length >= 120 && !hasDefaultMarker(transpiled)) {
    score += 1;
    signals.push("fresh transpile");
  }

  return {
    healthy: score >= 3,
    score,
    reason:
      signals.length > 0
        ? `Detected ${signals.join(", ")}.`
        : "Session still looks like the default scaffold or an empty render.",
  };
}

async function fetchCodespaceSession(codespaceId: string): Promise<CreateSessionSnapshot> {
  const response = await fetch(
    `${SPIKE_LAND_BASE_URL}/live/${encodeURIComponent(codespaceId)}/session.json`,
  );
  if (!response.ok) {
    throw new Error(`Live session lookup failed: ${response.status}`);
  }
  return response.json() as Promise<CreateSessionSnapshot>;
}

export function registerCreateTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "create_search_apps",
        "Search published /create apps by title, description, or slug. " +
          "Results are ordered by popularity.",
        {
          query: z
            .string()
            .min(1)
            .describe("Search query to match against app title, description, or slug."),
          limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
        },
      )
      .meta({ category: "create", tier: "free" })
      .handler(async ({ input }) => {
        const { query, limit = 10 } = input;
        const params = new URLSearchParams();
        params.set("q", query);
        params.set("limit", String(limit));

        try {
          const apps = await apiRequest<
            Array<{
              slug: string;
              title: string;
              description: string;
              codespaceUrl: string;
              viewCount: number;
            }>
          >(`/api/create/search?${params.toString()}`);

          if (!Array.isArray(apps) || apps.length === 0) {
            return textResult(`No apps found matching "${query}".`);
          }

          let text = `**Found ${apps.length} app(s) matching "${query}":**\n\n`;
          for (const app of apps) {
            text += `- **${app.title}** (\`${app.slug}\`)\n`;
            text += `  ${app.description.slice(0, 150)}\n`;
            text += `  Views: ${app.viewCount} | URL: ${app.codespaceUrl}\n\n`;
          }

          return textResult(text);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(
            `**Error searching apps:** ${msg}\n\n` +
              `You can browse apps directly at ${SPIKE_LAND_BASE_URL}/create`,
          );
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool("create_get_app", "Get full details for a specific /create app by its slug.", {
        slug: z.string().min(1).describe("Unique slug of the created app."),
      })
      .meta({ category: "create", tier: "free" })
      .handler(async ({ input }) => {
        const { slug } = input;

        try {
          const app = await apiRequest<{
            slug: string;
            title: string;
            description: string;
            status: string;
            codespaceId: string;
            codespaceUrl: string;
            viewCount: number;
            generatedAt: string;
            promptUsed: string;
            outgoingLinks: string[];
            generatedBy?: { id: string; name: string | null };
          }>(`/api/create/${encodeURIComponent(slug)}`);

          let text = `**${app.title}**\n\n`;
          text += `**Slug:** ${app.slug}\n`;
          text += `**Status:** ${app.status}\n`;
          text += `**Description:** ${app.description}\n`;
          text += `**Codespace ID:** ${app.codespaceId}\n`;
          text += `**Codespace URL:** ${app.codespaceUrl}\n`;
          text += `**Views:** ${app.viewCount}\n`;
          text += `**Generated:** ${app.generatedAt}\n`;
          if (app.generatedBy) {
            text += `**Generated By:** ${app.generatedBy.name || app.generatedBy.id}\n`;
          }
          text += `**Prompt Used:** ${app.promptUsed.slice(0, 500)}\n`;
          if (app.outgoingLinks && app.outgoingLinks.length > 0) {
            text += `**Links:** ${app.outgoingLinks.join(", ")}\n`;
          }

          return textResult(text);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(
            `**Error: NOT_FOUND**\nNo app found with slug "${slug}".\nDetail: ${msg}\n**Retryable:** false`,
          );
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "create_classify_idea",
        "Use this for the public /create flow — classifies your idea, returns category + template suggestion, not a live app. " +
          "Classify an app idea into a URL slug and category using local worker heuristics.",
        {
          text: z.string().min(1).max(2000).describe("App idea text to classify."),
        },
      )
      .meta({ category: "create", tier: "free" })
      .handler(async ({ input }) => {
        const result = classifyIdeaLocally(input.text);

        let output = `**Classification Result**\n\n`;
        output += `**Status:** ${result.status}\n`;
        output += `**Slug:** ${result.slug}\n`;
        output += `**Category:** ${result.category}\n`;
        output += `**Template:** ${result.template}\n`;
        output += `**Reason:** ${result.reason}\n`;

        return textResult(output);
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "create_check_health",
        "Check if a codespace is healthy (has real, non-default content).",
        {
          codespace_id: z.string().min(1).describe("Codespace ID to check health for."),
        },
      )
      .meta({ category: "create", tier: "free" })
      .handler(async ({ input }) => {
        try {
          const session = await fetchCodespaceSession(input.codespace_id);
          const result = assessCreateSessionHealth(session);

          return textResult(
            `**Codespace Health Check**\n\n` +
              `**ID:** ${input.codespace_id}\n` +
              `**Healthy:** ${result.healthy}\n` +
              `**Score:** ${result.score}\n` +
              `**Reason:** ${result.reason}`,
          );
        } catch (error) {
          try {
            const fallback = await apiRequest<{ healthy: boolean }>(
              `/api/create/health/${encodeURIComponent(input.codespace_id)}`,
            );

            return textResult(
              `**Codespace Health Check**\n\n` +
                `**ID:** ${input.codespace_id}\n` +
                `**Healthy:** ${fallback.healthy}\n` +
                `**Source:** legacy create health endpoint`,
            );
          } catch (fallbackError) {
            const msg = fallbackError instanceof Error ? fallbackError.message : "Unknown error";
            return textResult(`**Health check unavailable:** ${msg}`);
          }
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool("create_list_top_apps", "List the most popular published /create apps by view count.", {
        limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
      })
      .meta({ category: "create", tier: "free" })
      .handler(async ({ input }) => {
        const { limit = 10 } = input;
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("sort", "popular");

        try {
          const apps = await apiRequest<
            Array<{
              slug: string;
              title: string;
              description: string;
              codespaceUrl: string;
              viewCount: number;
            }>
          >(`/api/create/list?${params.toString()}`);

          if (!Array.isArray(apps) || apps.length === 0) {
            return textResult("No healthy published apps found.");
          }

          let text = `**Top ${apps.length} App(s) by Views:**\n\n`;
          for (const app of apps) {
            text += `- **${app.title}** (\`${app.slug}\`) -- ${app.viewCount} views\n`;
            text += `  ${app.description.slice(0, 120)}\n`;
            text += `  URL: ${app.codespaceUrl}\n\n`;
          }

          return textResult(text);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(
            `**Error listing top apps:** ${msg}\n\n` +
              `Browse apps at ${SPIKE_LAND_BASE_URL}/create`,
          );
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool("create_list_recent_apps", "List the most recently generated published /create apps.", {
        limit: z.number().int().min(1).max(50).optional().describe("Max results (default 10)."),
      })
      .meta({ category: "create", tier: "free" })
      .handler(async ({ input }) => {
        const { limit = 10 } = input;
        const params = new URLSearchParams();
        params.set("limit", String(limit));
        params.set("sort", "recent");

        try {
          const apps = await apiRequest<
            Array<{
              slug: string;
              title: string;
              description: string;
              codespaceUrl: string;
              viewCount: number;
              generatedAt: string;
            }>
          >(`/api/create/list?${params.toString()}`);

          if (!Array.isArray(apps) || apps.length === 0) {
            return textResult("No healthy recent apps found.");
          }

          let text = `**${apps.length} Most Recent App(s):**\n\n`;
          for (const app of apps) {
            text += `- **${app.title}** (\`${app.slug}\`)\n`;
            text += `  ${app.description.slice(0, 120)}\n`;
            text += `  Generated: ${app.generatedAt} | Views: ${app.viewCount}\n`;
            text += `  URL: ${app.codespaceUrl}\n\n`;
          }

          return textResult(text);
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(
            `**Error listing recent apps:** ${msg}\n\n` +
              `Browse apps at ${SPIKE_LAND_BASE_URL}/create`,
          );
        }
      }),
  );

  registry.registerBuilt(
    t
      .tool("create_get_app_status", "Quick status check for a /create app.", {
        slug: z.string().min(1).describe("Unique slug of the created app."),
      })
      .meta({ category: "create", tier: "free" })
      .handler(async ({ input }) => {
        const { slug } = input;

        try {
          const app = await apiRequest<{
            slug: string;
            title: string;
            status: string;
            codespaceUrl: string;
          }>(`/api/create/${encodeURIComponent(slug)}/status`);

          return textResult(
            `**App Status**\n\n` +
              `**Title:** ${app.title}\n` +
              `**Slug:** ${app.slug}\n` +
              `**Status:** ${app.status}\n` +
              `**URL:** ${app.codespaceUrl}`,
          );
        } catch (error) {
          const msg = error instanceof Error ? error.message : "Unknown error";
          return textResult(
            `**Error: NOT_FOUND**\nNo app found with slug "${slug}".\nDetail: ${msg}\n**Retryable:** false`,
          );
        }
      }),
  );
}
