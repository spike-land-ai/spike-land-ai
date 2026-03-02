// Auto-generated MCP tool registry — reads from build-time tools-manifest.json
// so the /mcp page always reflects the latest tools without manual updates.

import toolsManifest from "@/lib/docs/generated/tools-manifest.json";
import { ToolEmbeddingIndex } from "@/lib/mcp/embeddings";

export interface McpToolParam {
  name: string;
  type: "string" | "number" | "boolean" | "enum";
  description: string;
  required: boolean;
  default?: unknown;
  enumValues?: string[];
  placeholder?: string;
}

export interface McpToolDef {
  name: string;
  displayName: string;
  description: string;
  category: string;
  tier: "free" | "workspace";
  params: McpToolParam[];
  responseType: "json" | "image" | "text";
  alwaysEnabled?: boolean;
  keywords?: string[];
  example?: Record<string, unknown>;
}

export interface McpCategory {
  id: string;
  name: string;
  description: string;
  icon: string; // lucide icon name
  color: "blue" | "green" | "orange" | "fuchsia" | "purple" | "pink" | "layers";
  toolCount: number;
  tier: "free" | "workspace";
}

// ── 3-Level Taxonomy ────────────────────────────────────────────────

export interface McpSubcategory {
  id: string;
  name: string;
  icon: string;
  categoryIds: string[];
  categories: McpCategory[];
  toolCount: number;
}

export interface McpSuperCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: McpCategory["color"];
  subcategories: McpSubcategory[];
  toolCount: number;
}

interface TaxonomySubDef {
  name: string;
  icon: string;
  categoryIds: string[];
}

interface TaxonomySuperDef {
  name: string;
  description: string;
  icon: string;
  color: McpCategory["color"];
  subcategories: TaxonomySubDef[];
}

const TAXONOMY: Record<string, TaxonomySuperDef> = {
  "platform-core": {
    name: "Platform Core",
    description: "Discovery, authentication, security, and infrastructure",
    icon: "Layers",
    color: "blue",
    subcategories: [
      {
        name: "Discovery & Config",
        icon: "Compass",
        categoryIds: ["gateway-meta", "mcp-registry", "capabilities", "settings"],
      },
      {
        name: "Auth & Security",
        icon: "Shield",
        categoryIds: ["auth", "vault", "permissions", "policy"],
      },
      {
        name: "Infrastructure",
        icon: "Server",
        categoryIds: ["env", "storage", "workspaces", "bootstrap"],
      },
    ],
  },
  development: {
    name: "Development",
    description: "Code editing, orchestration, and DevOps tooling",
    icon: "Code2",
    color: "green",
    subcategories: [
      {
        name: "Code Editing",
        icon: "FileCode",
        categoryIds: ["codespace", "filesystem"],
      },
      {
        name: "Orchestration",
        icon: "Network",
        categoryIds: ["orchestration", "orchestrator", "gateway"],
      },
      {
        name: "DevOps & CI",
        icon: "Terminal",
        categoryIds: ["dev", "errors", "jules", "github-admin"],
      },
    ],
  },
  "ai-creative": {
    name: "AI & Creative",
    description: "AI generation, image processing, audio, and knowledge",
    icon: "Sparkles",
    color: "fuchsia",
    subcategories: [
      {
        name: "AI Generation",
        icon: "Bot",
        categoryIds: ["chat", "relay", "arena", "page-ai", "creative"],
      },
      {
        name: "Image Processing",
        icon: "ImagePlus",
        categoryIds: ["image", "batch-enhance", "enhancement-jobs", "pipelines"],
      },
      { name: "Audio & Speech", icon: "Music", categoryIds: ["audio", "tts"] },
      {
        name: "Knowledge",
        icon: "BookOpen",
        categoryIds: ["learnit", "brand-brain", "scout"],
      },
    ],
  },
  "content-media": {
    name: "Content & Media",
    description: "Pages, apps, blog, and media library management",
    icon: "FileText",
    color: "blue",
    subcategories: [
      {
        name: "Pages & Blocks",
        icon: "LayoutGrid",
        categoryIds: ["pages", "blocks", "blog"],
      },
      { name: "Apps", icon: "AppWindow", categoryIds: ["apps", "create"] },
      {
        name: "Media Library",
        icon: "Image",
        categoryIds: ["gallery", "album-management", "album-images", "assets"],
      },
    ],
  },
  "marketing-growth": {
    name: "Marketing & Growth",
    description: "Social publishing, email, analytics, and crisis management",
    icon: "TrendingUp",
    color: "orange",
    subcategories: [
      {
        name: "Social Publishing",
        icon: "Share2",
        categoryIds: ["social-accounts", "calendar", "inbox"],
      },
      {
        name: "Communication",
        icon: "Mail",
        categoryIds: ["email", "newsletter", "notifications"],
      },
      {
        name: "Analytics",
        icon: "BarChart3",
        categoryIds: ["tracking", "ab-testing", "boost", "pulse", "reports"],
      },
      {
        name: "Crisis & Policy",
        icon: "AlertTriangle",
        categoryIds: ["crisis"],
      },
    ],
  },
  "commerce-admin": {
    name: "Commerce & Admin",
    description: "Billing, credits, administration, and marketplace",
    icon: "CreditCard",
    color: "green",
    subcategories: [
      { name: "Billing", icon: "Wallet", categoryIds: ["billing", "credits"] },
      {
        name: "Administration",
        icon: "Shield",
        categoryIds: ["admin", "audit", "dash"],
      },
      {
        name: "Marketplace",
        icon: "Store",
        categoryIds: ["merch", "skill-store", "career", "share", "white-label"],
      },
    ],
  },
  "first-party-apps": {
    name: "First-Party Apps",
    description: "Chess Arena, CleanSweep, and state machine tools",
    icon: "Gamepad2",
    color: "purple",
    subcategories: [
      {
        name: "Chess Arena",
        icon: "Crown",
        categoryIds: ["chess-challenge", "chess-game", "chess-player", "chess-replay"],
      },
      {
        name: "CleanSweep",
        icon: "Sparkle",
        categoryIds: [
          "clean-tasks",
          "clean-streaks",
          "clean-scanner",
          "clean-verify",
          "clean-photo",
          "clean-motivate",
          "clean-reminders",
        ],
      },
      {
        name: "State Machines",
        icon: "GitBranch",
        categoryIds: ["state-machine"],
      },
    ],
  },
  "agents-automation": {
    name: "Agents & Automation",
    description: "Agent management, workflows, and utility tools",
    icon: "Users",
    color: "purple",
    subcategories: [
      {
        name: "Agent Management",
        icon: "Bot",
        categoryIds: ["agents", "swarm"],
      },
      {
        name: "Workflows",
        icon: "Workflow",
        categoryIds: ["workflows", "tools", "jobs", "bazdmeg"],
      },
      {
        name: "Utilities",
        icon: "Wrench",
        categoryIds: ["reminders", "boxes", "allocator", "agency"],
      },
    ],
  },
};

// ── Category display metadata ───────────────────────────────────────
// Maps category id → display name, icon, and color for the UI.

type CategoryColor = McpCategory["color"];

const CATEGORY_META: Record<string, { displayName: string; icon: string; color: CategoryColor }> = {
  "gateway-meta": { displayName: "Discovery", icon: "Compass", color: "blue" },
  image: { displayName: "Image AI", icon: "ImagePlus", color: "fuchsia" },
  codespace: { displayName: "Codespace", icon: "Code2", color: "green" },
  jules: { displayName: "Jules", icon: "Bot", color: "purple" },
  gateway: { displayName: "Gateway", icon: "Network", color: "orange" },
  admin: { displayName: "Admin", icon: "Shield", color: "orange" },
  agents: { displayName: "Agents", icon: "Users", color: "purple" },
  "album-images": {
    displayName: "Album Images",
    icon: "ImagePlus",
    color: "fuchsia",
  },
  "album-management": { displayName: "Albums", icon: "Palette", color: "pink" },
  apps: { displayName: "Apps", icon: "AppWindow", color: "green" },
  arena: { displayName: "Arena", icon: "Sparkles", color: "purple" },
  audio: { displayName: "Audio", icon: "Music", color: "pink" },
  auth: { displayName: "Auth", icon: "Shield", color: "blue" },
  "batch-enhance": {
    displayName: "Batch Enhance",
    icon: "Zap",
    color: "fuchsia",
  },
  billing: { displayName: "Billing", icon: "CreditCard", color: "green" },
  blog: { displayName: "Blog", icon: "FileText", color: "blue" },
  bootstrap: { displayName: "Bootstrap", icon: "Rocket", color: "orange" },
  capabilities: { displayName: "Capabilities", icon: "Shield", color: "blue" },
  career: { displayName: "Career", icon: "Briefcase", color: "green" },
  chat: { displayName: "Chat", icon: "MessageSquare", color: "blue" },
  create: { displayName: "Create", icon: "PlusCircle", color: "green" },
  credits: { displayName: "Credits", icon: "Coins", color: "orange" },
  dev: { displayName: "Dev Tools", icon: "Terminal", color: "green" },
  "enhancement-jobs": {
    displayName: "Enhancements",
    icon: "Sparkles",
    color: "fuchsia",
  },
  learnit: { displayName: "Learn It", icon: "BookOpen", color: "blue" },
  "mcp-registry": {
    displayName: "MCP Registry",
    icon: "Search",
    color: "blue",
  },
  newsletter: { displayName: "Newsletter", icon: "Send", color: "blue" },
  orchestration: {
    displayName: "Orchestration",
    icon: "Network",
    color: "purple",
  },
  pipelines: { displayName: "Pipelines", icon: "GitBranch", color: "orange" },
  reports: { displayName: "Reports", icon: "FileText", color: "blue" },
  settings: { displayName: "Settings", icon: "Settings", color: "layers" },
  "skill-store": { displayName: "Skill Store", icon: "Store", color: "green" },
  tools: { displayName: "Tools", icon: "Wrench", color: "layers" },
  tts: { displayName: "Text to Speech", icon: "Volume2", color: "pink" },
  vault: { displayName: "Vault", icon: "Lock", color: "orange" },
  workspaces: { displayName: "Workspaces", icon: "FolderOpen", color: "green" },
  bazdmeg: { displayName: "BAZDMEG", icon: "FileText", color: "purple" },
};

// Tools whose response renders as an image in the playground
const IMAGE_TOOLS = new Set(["generate_image", "modify_image", "codespace_screenshot"]);

// ── Derive display name from snake_case tool name ───────────────────
function toDisplayName(name: string): string {
  return name
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ── Build categories from manifest ──────────────────────────────────
export const MCP_CATEGORIES: McpCategory[] = toolsManifest.categories.map(
  (cat: { name: string; description: string; toolCount: number; tier: string }) => {
    const meta = CATEGORY_META[cat.name];
    return {
      id: cat.name,
      name: meta?.displayName ?? toDisplayName(cat.name),
      description: cat.description,
      icon: meta?.icon ?? "Wrench",
      color: meta?.color ?? "layers",
      toolCount: cat.toolCount,
      tier: cat.tier as "free" | "workspace",
    };
  },
);

// ── Build tools from manifest ───────────────────────────────────────
export const MCP_TOOLS: McpToolDef[] = toolsManifest.tools.map(
  (tool: {
    name: string;
    description: string;
    category: string;
    tier: string;
    parameters: Array<{ name: string; type: string; description: string; required: boolean }>;
  }) => ({
    name: tool.name,
    displayName: toDisplayName(tool.name),
    description: tool.description,
    category: tool.category,
    tier: tool.tier as "free" | "workspace",
    ...(tool.category === "gateway-meta" ? { alwaysEnabled: true as const } : {}),
    responseType: IMAGE_TOOLS.has(tool.name) ? ("image" as const) : ("json" as const),
    params: tool.parameters.map((p) => ({
      name: p.name,
      type: p.type as McpToolParam["type"],
      description: p.description,
      required: p.required,
    })),
  }),
);

// ── Keywords & example payloads for top tools ───────────────────────
const TOOL_EXTRAS: Record<string, { keywords?: string[]; example?: Record<string, unknown> }> = {
  search_tools: {
    keywords: ["find", "discover", "lookup", "browse"],
    example: { query: "image" },
  },
  generate_image: {
    keywords: ["picture", "photo", "art", "dalle", "create image"],
    example: { prompt: "A stunning sunset over the ocean, photorealistic" },
  },
  get_ai_response: {
    keywords: ["ask", "chat", "llm", "answer", "gpt", "claude"],
    example: { prompt: "What is the MCP protocol?" },
  },
  list_tools: {
    keywords: ["tools", "available", "catalog", "all"],
    example: {},
  },
  create_codespace: {
    keywords: ["code", "sandbox", "editor", "playground"],
    example: { template: "react-ts" },
  },
  get_platform_info: {
    keywords: ["info", "status", "version", "about"],
    example: {},
  },
  modify_image: {
    keywords: ["edit image", "transform", "filter", "resize"],
    example: { prompt: "Make the sky more dramatic" },
  },
  codespace_screenshot: {
    keywords: ["capture", "snapshot", "preview"],
    example: {},
  },
  get_chess_game: {
    keywords: ["chess", "match", "board", "game state"],
    example: { gameId: "latest" },
  },
  create_chess_challenge: {
    keywords: ["chess", "challenge", "play", "opponent"],
    example: { opponent: "AI" },
  },
  get_analytics: {
    keywords: ["stats", "metrics", "data", "tracking"],
    example: {},
  },
  send_email: {
    keywords: ["mail", "notify", "outreach", "message"],
    example: { to: "user@example.com", subject: "Hello" },
  },
  create_blog_post: {
    keywords: ["write", "article", "publish", "content"],
    example: { title: "My First Post" },
  },
  get_gallery: {
    keywords: ["images", "media", "photos", "albums"],
    example: {},
  },
  text_to_speech: {
    keywords: ["tts", "voice", "audio", "speak", "read aloud"],
    example: { text: "Hello, world!" },
  },
  create_page: {
    keywords: ["webpage", "landing", "site", "layout"],
    example: { title: "New Page" },
  },
  get_settings: {
    keywords: ["config", "preferences", "options", "setup"],
    example: {},
  },
  manage_billing: {
    keywords: ["payment", "subscription", "plan", "invoice"],
    example: {},
  },
  get_workspace: { keywords: ["project", "team", "space", "org"], example: {} },
  orchestrate: {
    keywords: ["workflow", "pipeline", "automate", "chain"],
    example: {},
  },
};

// Apply keywords & examples to tools
for (const tool of MCP_TOOLS) {
  const extras = TOOL_EXTRAS[tool.name];
  if (extras) {
    if (extras.keywords) tool.keywords = extras.keywords;
    if (extras.example) tool.example = extras.example;
  }
}

// ── Category lookup map ─────────────────────────────────────────────
const categoryMap = new Map(MCP_CATEGORIES.map((c) => [c.id, c]));

// ── Build 3-level hierarchy ─────────────────────────────────────────
export const MCP_SUPER_CATEGORIES: McpSuperCategory[] = Object.entries(TAXONOMY)
  .map(([superId, superDef]) => {
    const subcategories: McpSubcategory[] = superDef.subcategories
      .map((subDef) => {
        const categories = subDef.categoryIds
          .map((id) => categoryMap.get(id))
          .filter((c): c is McpCategory => c !== undefined && c.toolCount > 0);
        const toolCount = categories.reduce((sum, c) => sum + c.toolCount, 0);

        return {
          id: subDef.categoryIds.join("-"),
          name: subDef.name,
          icon: subDef.icon,
          categoryIds: subDef.categoryIds,
          categories,
          toolCount,
        };
      })
      .filter((sub) => sub.toolCount > 0);

    const toolCount = subcategories.reduce((sum, s) => sum + s.toolCount, 0);

    return {
      id: superId,
      name: superDef.name,
      description: superDef.description,
      icon: superDef.icon,
      color: superDef.color,
      subcategories,
      toolCount,
    };
  })
  .filter((s) => s.toolCount > 0);

// ── Reverse lookup: category ID → super category ────────────────────
const categoryToSuper = new Map<string, string>();
const categoryToSub = new Map<string, string>();
for (const sup of MCP_SUPER_CATEGORIES) {
  for (const sub of sup.subcategories) {
    for (const cat of sub.categories) {
      categoryToSuper.set(cat.id, sup.id);
      categoryToSub.set(cat.id, sub.id);
    }
  }
}

// ── Helpers (same API as before) ────────────────────────────────────
export function getToolsByCategory(category: string): McpToolDef[] {
  return MCP_TOOLS.filter((t) => t.category === category);
}

export function getCategoryById(id: string): McpCategory | undefined {
  return MCP_CATEGORIES.find((c) => c.id === id);
}

export function getActiveCategories(): McpCategory[] {
  return MCP_CATEGORIES.filter((c) => c.toolCount > 0);
}

export function getAllCategories(): McpCategory[] {
  return MCP_CATEGORIES;
}

// ── 3-level helpers ─────────────────────────────────────────────────
export function getSuperCategories(): McpSuperCategory[] {
  return MCP_SUPER_CATEGORIES;
}

export function getSuperCategoryById(id: string): McpSuperCategory | undefined {
  return MCP_SUPER_CATEGORIES.find((s) => s.id === id);
}

export function getSuperCategoryForCategory(categoryId: string): string | undefined {
  return categoryToSuper.get(categoryId);
}

export function getSubcategoryForCategory(categoryId: string): string | undefined {
  return categoryToSub.get(categoryId);
}

export function findSuperBySlug(slug: string): McpSuperCategory | undefined {
  const q = slug.toLowerCase();
  return MCP_SUPER_CATEGORIES.find(
    (s) =>
      s.id === q ||
      s.name
        .toLowerCase()
        .replace(/\s+&\s+/g, "-")
        .replace(/\s+/g, "-") === q ||
      s.name.toLowerCase() === q,
  );
}

export function findSubBySlug(slug: string): McpSubcategory | undefined {
  const q = slug.toLowerCase();
  for (const sup of MCP_SUPER_CATEGORIES) {
    const found = sup.subcategories.find(
      (s) =>
        s.name.toLowerCase() === q ||
        s.name
          .toLowerCase()
          .replace(/\s+&\s+/g, "-")
          .replace(/\s+/g, "-") === q,
    );
    if (found) return found;
  }
  return undefined;
}

// ── Semantic search index ────────────────────────────────────────────
export interface ToolSearchResult {
  tool: McpToolDef;
  score: number;
}

const toolSearchIndex = new ToolEmbeddingIndex();
for (const tool of MCP_TOOLS) {
  toolSearchIndex.embed(tool.name, tool.category, tool.description);
}

export function searchToolsSemantic(query: string, limit = 20): ToolSearchResult[] {
  const results = toolSearchIndex.search(query, limit, 0.02);
  const toolMap = new Map(MCP_TOOLS.map((t) => [t.name, t]));

  return results
    .map((r) => {
      const tool = toolMap.get(r.name);
      if (!tool) return null;
      return { tool, score: r.score };
    })
    .filter((r): r is ToolSearchResult => r !== null);
}

export const TOTAL_TOOL_COUNT = MCP_TOOLS.length;
export const TOTAL_CATEGORY_COUNT = MCP_CATEGORIES.length;
export const GATEWAY_TOOL_COUNT = MCP_TOOLS.filter((t) => t.alwaysEnabled).length;
export const ACTIVE_CATEGORY_COUNT = MCP_CATEGORIES.filter((c) => c.toolCount > 0).length;
export const SUPER_CATEGORY_COUNT = MCP_SUPER_CATEGORIES.length;
