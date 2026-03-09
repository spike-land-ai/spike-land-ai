import { useQuery } from "@tanstack/react-query";
import { apiUrl, mcpUrl } from "../../core-logic/api";

export interface McpAppSummary {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  category: string;
  tags: string[];
  tagline: string;
  pricing: string;
  is_featured: boolean;
  is_new: boolean;
  tool_count: number;
  sort_order: number;
}

interface ToolEntry {
  name: string;
  description?: string;
  category?: string;
}

interface PublicAppSummary {
  slug: string;
  name: string;
  description: string;
  emoji: string;
  category?: string;
  tags?: string[];
  tagline?: string;
  pricing?: string;
  is_featured?: boolean;
  is_new?: boolean;
  tool_count: number;
  sort_order: number;
}

interface PublicAppsResponse {
  apps?: PublicAppSummary[];
}

interface StoreToolsResponse {
  categories?: Array<{ tools?: ToolEntry[] }>;
  featured?: ToolEntry[];
  tools?: ToolEntry[];
}

export interface AppCategoryGroup {
  category: string;
  apps: McpAppSummary[];
}

const APP_CATEGORY_ORDER = [
  "Identity & Access",
  "Browser Automation",
  "Code & Developer Tools",
  "Agents & Collaboration",
  "Docs & Knowledge",
  "Analytics & Insights",
  "Commerce & Billing",
  "Media & Creative",
  "Games & Simulation",
  "Infrastructure & Ops",
  "Integrations & APIs",
  "General Utility",
] as const;

const APP_CATEGORY_RULES = [
  {
    label: "Identity & Access",
    keywords: [
      "auth",
      "identity",
      "permission",
      "profile",
      "organization",
      "workspace access",
      "byok",
    ],
  },
  {
    label: "Browser Automation",
    keywords: ["qa studio", "browser", "playwright", "web automation", "screenshot", "crawl"],
  },
  {
    label: "Code & Developer Tools",
    keywords: [
      "code",
      "developer",
      "build",
      "review",
      "diff",
      "bugbook",
      "esbuild",
      "transpile",
      "debug",
      "monaco",
    ],
  },
  {
    label: "Agents & Collaboration",
    keywords: ["agent", "chat", "message", "swarm", "inbox", "collaboration", "teammate"],
  },
  {
    label: "Docs & Knowledge",
    keywords: ["learn", "verify", "doc", "docs", "knowledge", "mdx", "markdown", "runbook"],
  },
  {
    label: "Analytics & Insights",
    keywords: ["analytics", "google ads", "google analytics", "metrics", "reporting", "insight"],
  },
  {
    label: "Commerce & Billing",
    keywords: ["billing", "payment", "stripe", "marketplace", "store", "commerce"],
  },
  {
    label: "Media & Creative",
    keywords: ["image", "video", "audio", "creative", "studio", "remotion"],
  },
  {
    label: "Games & Simulation",
    keywords: ["game", "games", "chess", "simulation", "arena"],
  },
  {
    label: "Infrastructure & Ops",
    keywords: ["docker", "orchestration", "sandbox", "terminal", "infra", "ops", "deploy"],
  },
  {
    label: "Integrations & APIs",
    keywords: ["openclaw", "gateway", "integration", "api", "registry", "bridge"],
  },
] as const;

export interface McpAppDetail extends McpAppSummary {
  status: string;
  tools: string[];
  graph: Record<string, unknown>;
  markdown: string;
}

interface PublicAppDetail extends Omit<McpAppDetail, "category"> {
  category?: string;
}

function humanizeAppSlug(slug: string): string {
  return slug.replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function normalizeCategorySignal(value: string): string {
  return value
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/[^a-z0-9\s]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function inferAppCategory(signals: Array<string | undefined>): string {
  const normalizedSignals = signals
    .filter((signal): signal is string => typeof signal === "string" && signal.trim().length > 0)
    .map(normalizeCategorySignal)
    .filter(Boolean);
  const haystack = normalizedSignals.join(" ").trim();
  const tokens = new Set(haystack.split(" ").filter(Boolean));

  for (const rule of APP_CATEGORY_RULES) {
    const matches = rule.keywords.some((keyword) => {
      const normalizedKeyword = normalizeCategorySignal(keyword);
      if (!normalizedKeyword) return false;
      return normalizedKeyword.includes(" ")
        ? haystack.includes(normalizedKeyword)
        : tokens.has(normalizedKeyword);
    });

    if (matches) {
      return rule.label;
    }
  }

  return "General Utility";
}

function categorySortKey(category: string): number {
  const index = APP_CATEGORY_ORDER.indexOf(category as (typeof APP_CATEGORY_ORDER)[number]);
  return index === -1 ? APP_CATEGORY_ORDER.length : index;
}

function normalizeAppSummary(app: PublicAppSummary): McpAppSummary {
  return {
    ...app,
    category: inferAppCategory([app.category, app.slug, app.name, app.description]),
    tags: app.tags ?? [],
    tagline: app.tagline ?? "",
    pricing: app.pricing ?? "free",
    is_featured: app.is_featured ?? false,
    is_new: app.is_new ?? false,
  };
}

export function appSlugFromToolName(toolName: string): string {
  const separatorIndex = toolName.indexOf("_");
  return separatorIndex > 0 ? toolName.slice(0, separatorIndex) : toolName;
}

function collectStoreTools(data: StoreToolsResponse): ToolEntry[] {
  const allTools: ToolEntry[] = [];

  if (data.categories) {
    for (const category of data.categories) {
      if (category.tools) {
        allTools.push(...category.tools);
      }
    }
  } else if (data.featured) {
    allTools.push(...data.featured);
  } else if (data.tools) {
    allTools.push(...data.tools);
  }

  return allTools;
}

function buildFallbackAppsFromTools(data: StoreToolsResponse): McpAppSummary[] {
  const grouped = new Map<
    string,
    {
      slug: string;
      name: string;
      description: string;
      emoji: string;
      category: string;
      tags: string[];
      tagline: string;
      pricing: string;
      is_featured: boolean;
      is_new: boolean;
      tool_count: number;
      sort_order: number;
      categorySignals: string[];
    }
  >();

  for (const [index, tool] of collectStoreTools(data).entries()) {
    const slug = appSlugFromToolName(tool.name);
    const existing = grouped.get(slug);

    if (existing) {
      existing.tool_count += 1;
      if (!existing.description && tool.description) {
        existing.description = tool.description;
      }
      if (tool.category) {
        existing.categorySignals.push(tool.category);
      }
      existing.category = inferAppCategory([
        existing.category,
        existing.slug,
        existing.name,
        existing.description,
        ...existing.categorySignals,
      ]);
      continue;
    }

    grouped.set(slug, {
      slug,
      name: humanizeAppSlug(slug),
      description: tool.description || `${humanizeAppSlug(slug)} MCP app`,
      emoji: "🔧",
      category: inferAppCategory([slug, tool.name, tool.description, tool.category]),
      tags: tool.category ? [tool.category] : [],
      tagline: tool.description || `${humanizeAppSlug(slug)} MCP app`,
      pricing: "free",
      is_featured: index < 6,
      is_new: false,
      tool_count: 1,
      sort_order: index,
      categorySignals: tool.category ? [tool.category] : [],
    });
  }

  return Array.from(grouped.values())
    .map(({ categorySignals: _categorySignals, ...app }) => normalizeAppSummary(app))
    .sort((left, right) => left.sort_order - right.sort_order);
}

async function fetchPublicApps(): Promise<McpAppSummary[]> {
  const response = await fetch(mcpUrl("/apps"));
  if (!response.ok) {
    throw new Error("Failed to fetch public apps");
  }

  const data = (await response.json()) as PublicAppsResponse;
  return (data.apps ?? []).map(normalizeAppSummary);
}

async function fetchStoreTools(): Promise<StoreToolsResponse> {
  const response = await fetch(apiUrl("/store/tools"));
  if (!response.ok) {
    throw new Error("Failed to fetch tools");
  }

  return (await response.json()) as StoreToolsResponse;
}

export function useApps() {
  return useQuery({
    queryKey: ["mcp-apps"],
    queryFn: async (): Promise<McpAppSummary[]> => {
      try {
        const apps = await fetchPublicApps();
        if (apps.length > 0) {
          return apps;
        }
      } catch {
        // Fall back to inferred app grouping when the public apps endpoint is unavailable.
      }

      return buildFallbackAppsFromTools(await fetchStoreTools());
    },
  });
}

export function groupAppsByCategory(apps: McpAppSummary[]): AppCategoryGroup[] {
  const grouped = new Map<string, McpAppSummary[]>();

  for (const app of apps) {
    const category = app.category || "General Utility";
    const bucket = grouped.get(category);

    if (bucket) {
      bucket.push(app);
      continue;
    }

    grouped.set(category, [app]);
  }

  return Array.from(grouped.entries())
    .map(([category, categoryApps]) => ({
      category,
      apps: categoryApps.sort(
        (left, right) => left.sort_order - right.sort_order || left.name.localeCompare(right.name),
      ),
    }))
    .sort(
      (left, right) =>
        categorySortKey(left.category) - categorySortKey(right.category) ||
        left.category.localeCompare(right.category),
    );
}

export function useApp(slug: string) {
  return useQuery({
    queryKey: ["mcp-app", slug],
    queryFn: async (): Promise<McpAppDetail> => {
      try {
        const response = await fetch(mcpUrl(`/apps/${encodeURIComponent(slug)}`));
        if (response.ok) {
          const app = (await response.json()) as PublicAppDetail;
          return {
            ...app,
            category: inferAppCategory([app.category, app.slug, app.name, app.description, ...app.tools]),
          };
        }
      } catch {
        // Fall through to inferred app reconstruction from the tool registry.
      }

      const data = await fetchStoreTools();
      const matchingTools = collectStoreTools(data).filter(
        (tool) => appSlugFromToolName(tool.name) === slug,
      );

      if (matchingTools.length === 0) {
        throw new Error("App not found");
      }

      return {
        slug,
        name: humanizeAppSlug(slug),
        description: matchingTools[0]?.description || `${humanizeAppSlug(slug)} MCP app`,
        emoji: "🔧",
        category: inferAppCategory([
          slug,
          matchingTools[0]?.description,
          ...matchingTools.map((tool) => tool.name),
          ...matchingTools.map((tool) => tool.category),
        ]),
        tags: matchingTools
          .map((tool) => tool.category)
          .filter((category): category is string => typeof category === "string"),
        tagline: matchingTools[0]?.description || `${humanizeAppSlug(slug)} MCP app`,
        pricing: "free",
        is_featured: false,
        is_new: false,
        tool_count: matchingTools.length,
        sort_order: 0,
        status: "live",
        tools: matchingTools.map((tool) => tool.name),
        graph: {},
        markdown: `# ${humanizeAppSlug(slug)}\n\nBuilt from ${matchingTools.length} tool${
          matchingTools.length === 1 ? "" : "s"
        }:\n\n${matchingTools.map((tool) => `- \`${tool.name}\` — ${tool.description || ""}`).join("\n")}`,
      };
    },
    enabled: !!slug,
  });
}
