/**
 * Build-Time Documentation Data Generator
 *
 * Scans source code artifacts (MCP tools, API routes, pages, markdown)
 * and produces JSON manifests for the /docs route. Run as part of prebuild.
 *
 * Usage: tsx src/lib/docs/generate-docs-data.ts
 */

import fs from "node:fs";
import path from "node:path";
import { logger } from "@/lib/logger";

import type {
  DocsApiEndpoint,
  DocsCategory,
  DocsGuide,
  DocsPage,
  DocsSearchEntry,
  DocsTool,
  DocsToolParam,
} from "./types";

const ROOT = path.resolve(__dirname, "../../..");
const OUT_DIR = path.join(ROOT, "src/lib/docs/generated");

// --- MCP Tools Scanner ---

const CATEGORY_DESCRIPTIONS: Record<string, string> = {
  "gateway-meta": "Discovery tools for searching and activating other tools",
  image: "AI image generation, modification, and job management",
  codespace: "Live React application development on testing.spike.land",
  jules: "Async coding agent for background development tasks",
  gateway: "GitHub Projects and Bolt orchestration",
  vault: "Encrypted secret storage for agent integrations",
  tools: "Dynamic tool registration and management",
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
  dev: "Local dev workflow: server logs, git/CI status, file guard, agent notifications",
  bazdmeg: "BAZDMEG methodology FAQ management",
  "skill-store": "Skill Store: browse, install, and manage agent skills and extensions",
  workspaces: "Workspace management: create, list, update, and favorite workspaces",
  agents: "Agent lifecycle: list, get, queue, and message management",
  settings: "User settings: API key management (list, create, revoke)",
  credits: "AI credit balance: check remaining credits, limits, and usage",
  billing: "Billing: Stripe checkout sessions and subscription management",
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
  orchestration:
    "Cloud-native code orchestration: context packing, sandboxed execution, task decomposition",
  "mcp-registry": "MCP server discovery: search, evaluate, and auto-configure MCP servers",
};

interface ParsedTool {
  name: string;
  description: string;
  category: string;
  tier: "free" | "workspace";
  params: DocsToolParam[];
}

function scanMcpTools(): { tools: DocsTool[]; categories: DocsCategory[] } {
  const toolsDir = path.join(ROOT, "src/lib/mcp/server/tools");
  const files = fs
    .readdirSync(toolsDir)
    .filter(
      (f) =>
        f.endsWith(".ts") &&
        !f.endsWith(".test.ts") &&
        f !== "tool-helpers.ts" &&
        f !== "tool-factory.ts",
    );

  const allTools: ParsedTool[] = [];

  for (const file of files) {
    const content = fs.readFileSync(path.join(toolsDir, file), "utf-8");
    const registerBlocks = content.matchAll(
      /registry\.register\(\{[\s\S]*?name:\s*["']([^"']+)["'][\s\S]*?description:\s*["']([^"']+)["'][\s\S]*?category:\s*["']([^"']+)["'][\s\S]*?tier:\s*["'](free|workspace)["'][\s\S]*?\}\)/g,
    );

    for (const match of registerBlocks) {
      const [, name, description, category, tier] = match;
      if (!name || !description || !category || !tier) continue;

      const params = extractParamsFromFile(content, name);

      allTools.push({
        name,
        description,
        category,
        tier: tier as "free" | "workspace",
        params,
      });
    }
  }

  // Build categories
  const catMap = new Map<string, { tools: string[]; tier: string }>();
  for (const tool of allTools) {
    let cat = catMap.get(tool.category);
    if (!cat) {
      cat = { tools: [], tier: tool.tier };
      catMap.set(tool.category, cat);
    }
    cat.tools.push(tool.name);
  }

  const categories: DocsCategory[] = Array.from(catMap.entries()).map(([name, data]) => ({
    name,
    description: CATEGORY_DESCRIPTIONS[name] || `${name} tools`,
    tier: data.tier,
    toolCount: data.tools.length,
    tools: data.tools,
  }));

  const tools: DocsTool[] = allTools.map((t) => ({
    name: t.name,
    description: t.description,
    category: t.category,
    tier: t.tier,
    parameters: t.params,
  }));

  return { tools, categories };
}

function extractParamsFromFile(content: string, toolName: string): DocsToolParam[] {
  // Find the registry.register call for this tool
  const toolBlockRegex = new RegExp(
    `registry\\.register\\(\\{[\\s\\S]*?name:\\s*["']${escapeRegex(
      toolName,
    )}["'][\\s\\S]*?inputSchema:\\s*([\\s\\S]*?)(?:,\\s*handler|\\}\\))`,
    "m",
  );
  const toolMatch = content.match(toolBlockRegex);
  if (!toolMatch?.[1]) return [];

  const rawSchema = toolMatch[1].trim();
  let fieldsContent = "";

  if (rawSchema.startsWith("{")) {
    // In-line schema object
    fieldsContent = rawSchema;
  } else {
    // Variable reference, possibly with .shape
    const baseName = rawSchema.replace(/\.shape$/, "");
    const schemaDefRegex = new RegExp(
      `(?:const|let|var)\\s+${escapeRegex(baseName)}\\s*=\\s*z\\.object\\(\\{([\\s\\S]*?)\\}\\)`,
      "m",
    );
    const schemaDef = content.match(schemaDefRegex);
    if (schemaDef?.[1]) {
      fieldsContent = schemaDef[1];
    }
  }

  if (!fieldsContent) return [];

  const params: DocsToolParam[] = [];
  // Match fields like `name: z.string().optional().describe("...")`
  const fieldRegex = /(\w+):\s*z\.(\w+)\(([^)]*)\)([\s\S]*?)(?=,\s*\w+:\s*z|\s*\}\s*$)/g;
  let fieldMatch;
  while ((fieldMatch = fieldRegex.exec(fieldsContent)) !== null) {
    const [, fieldName, baseType, , chain] = fieldMatch;
    if (!fieldName || !baseType) continue;

    const descMatch = chain?.match(/\.describe\(["']([^"']+)["']\)/);
    const isOptional = chain?.includes(".optional()") ?? false;

    params.push({
      name: fieldName,
      type: baseType as DocsToolParam["type"],
      required: !isOptional,
      description: descMatch?.[1] || "",
    });
  }

  return params;
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

// --- API Routes Scanner ---

function scanApiRoutes(): DocsApiEndpoint[] {
  const apiDir = path.join(ROOT, "src/app/api");
  const endpoints: DocsApiEndpoint[] = [];

  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name === "route.ts") {
        const relPath = path.relative(apiDir, dir);
        const apiPath = "/api/" + relPath.replace(/\\/g, "/");
        const content = fs.readFileSync(fullPath, "utf-8");

        const methods: string[] = [];
        for (const method of ["GET", "POST", "PUT", "PATCH", "DELETE"]) {
          if (content.match(new RegExp(`export\\s+(?:async\\s+)?function\\s+${method}\\b`))) {
            methods.push(method);
          }
        }

        // Extract description from JSDoc or first comment
        const jsdocMatch = content.match(/\/\*\*\s*\n\s*\*\s*(.+)/);
        const description = jsdocMatch?.[1]?.trim() || `${apiPath} endpoint`;

        // Determine domain from path
        const segments = relPath.split(path.sep);
        const domain = segments[0] || "general";

        // Check if auth is required
        const auth =
          content.includes("getServerSession") ||
          content.includes("requireAuth") ||
          content.includes("auth()");

        if (methods.length > 0) {
          endpoints.push({ path: apiPath, methods, description, domain, auth });
        }
      }
    }
  }

  walkDir(apiDir);
  return endpoints.sort((a, b) => a.path.localeCompare(b.path));
}

// --- Pages Scanner ---

function scanPages(): DocsPage[] {
  const appDir = path.join(ROOT, "src/app");
  const pages: DocsPage[] = [];

  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory() && !entry.name.startsWith("api")) {
        walkDir(fullPath);
      } else if (entry.name === "page.tsx") {
        const relPath = path.relative(appDir, dir);
        const routePath = "/" + relPath.replace(/\\/g, "/").replace(/^\.$/, "");

        // Skip dynamic routes — they contain [param] segments and can't be linked directly
        if (routePath.includes("[")) continue;

        const content = fs.readFileSync(fullPath, "utf-8");

        // Extract metadata
        const titleMatch = content.match(/title:\s*["']([^"']+)["']/);
        const descMatch = content.match(/description:\s*\n?\s*["']([^"']+)["']/);

        // Determine section
        const segments = relPath.split(path.sep);
        const section = segments[0] || "home";

        pages.push({
          path: routePath || "/",
          title: titleMatch?.[1] || routePath || "Home",
          description: descMatch?.[1] || "",
          section,
        });
      }
    }
  }

  walkDir(appDir);
  return pages.sort((a, b) => a.path.localeCompare(b.path));
}

// --- Markdown Docs Scanner ---

function scanMarkdownDocs(): DocsGuide[] {
  const docsDir = path.join(ROOT, "docs");
  const guides: DocsGuide[] = [];

  function walkDir(dir: string): void {
    const entries = fs.readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        walkDir(fullPath);
      } else if (entry.name.endsWith(".md")) {
        const content = fs.readFileSync(fullPath, "utf-8");
        const relPath = path.relative(docsDir, fullPath);
        const slug = relPath.replace(/\.md$/, "").replace(/\\/g, "/");

        // Extract title from first heading
        const titleMatch = content.match(/^#\s+(.+)/m);
        const title = titleMatch?.[1] || entry.name.replace(/\.md$/, "");

        // Extract excerpt from first paragraph after heading
        const paragraphs = content.split(/\n\n/).filter((p) => !p.startsWith("#") && p.trim());
        const excerpt = (paragraphs[0] || "").replace(/\n/g, " ").slice(0, 200).trim();

        // Category from directory
        const dirSegments = path.dirname(relPath).split(path.sep);
        const category = dirSegments[0] === "." ? "general" : dirSegments[0] || "general";

        guides.push({ slug, title, excerpt, category, filePath: relPath });
      }
    }
  }

  walkDir(docsDir);
  return guides.sort((a, b) => a.slug.localeCompare(b.slug));
}

// --- Search Index Builder ---

function buildSearchIndex(
  tools: DocsTool[],
  api: DocsApiEndpoint[],
  pages: DocsPage[],
  guides: DocsGuide[],
): DocsSearchEntry[] {
  const entries: DocsSearchEntry[] = [];

  for (const tool of tools) {
    entries.push({
      id: `tool-${tool.name}`,
      type: "tool",
      title: tool.name.replace(/_/g, " "),
      description: tool.description,
      category: tool.category,
      href: `/docs/tools/${tool.category}/${tool.name}`,
    });
  }

  for (const endpoint of api) {
    entries.push({
      id: `api-${endpoint.path}`,
      type: "api",
      title: `${endpoint.methods.join(", ")} ${endpoint.path}`,
      description: endpoint.description,
      category: endpoint.domain,
      href: `/docs/api${endpoint.path
        .replace(/^\/api/, "")
        .replace(/\[/g, "%5B")
        .replace(/\]/g, "%5D")}`,
    });
  }

  for (const page of pages) {
    entries.push({
      id: `page-${page.path}`,
      type: "page",
      title: page.title,
      description: page.description,
      category: page.section,
      href: page.path,
    });
  }

  for (const guide of guides) {
    entries.push({
      id: `guide-${guide.slug}`,
      type: "guide",
      title: guide.title,
      description: guide.excerpt,
      category: guide.category,
      href: `/docs/guides/${guide.slug}`,
    });
  }

  return entries;
}

// --- Main ---

function main(): void {
  logger.info("Generating documentation data...");

  fs.mkdirSync(OUT_DIR, { recursive: true });

  const { tools, categories } = scanMcpTools();
  logger.info(`  Found ${tools.length} MCP tools in ${categories.length} categories`);

  const api = scanApiRoutes();
  logger.info(`  Found ${api.length} API endpoints`);

  const pages = scanPages();
  logger.info(`  Found ${pages.length} pages`);

  const guides = scanMarkdownDocs();
  logger.info(`  Found ${guides.length} markdown docs`);

  const searchIndex = buildSearchIndex(tools, api, pages, guides);
  logger.info(`  Built search index with ${searchIndex.length} entries`);

  const write = (name: string, data: unknown) => {
    const filePath = path.join(OUT_DIR, name);
    fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
    logger.info(`  Wrote ${filePath}`);
  };

  write("tools-manifest.json", { tools, categories });
  write("api-manifest.json", api);
  write("pages-manifest.json", pages);
  write("markdown-manifest.json", guides);
  write("search-index.json", searchIndex);

  logger.info("Documentation data generation complete!");
}

main();
