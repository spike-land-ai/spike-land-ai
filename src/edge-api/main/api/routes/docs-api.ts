import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";

interface DocEntry {
  slug: string;
  title: string;
  category: string;
  description: string;
  /** Path relative to repo root (docs/ directory) */
  filePath: string;
}

// Static manifest of available docs — maps to files in docs/ directory
const DOCS_MANIFEST: DocEntry[] = [
  {
    slug: "getting-started",
    title: "Getting Started",
    category: "Guides",
    description: "Connect your MCP client to spike.land in minutes",
    filePath: "docs/guides/QUICK_START.md",
  },
  {
    slug: "mcp-overview",
    title: "MCP Overview",
    category: "MCP",
    description: "Introduction to Model Context Protocol",
    filePath: "docs/mcp/DEVELOPMENT_INDEX.md",
  },
  {
    slug: "mcp-tools",
    title: "MCP Tools Reference",
    category: "MCP",
    description: "Complete reference for all 80+ MCP tools",
    filePath: "docs/mcp/TOOL_GUIDELINES.md",
  },
  {
    slug: "api-reference",
    title: "API Reference",
    category: "API",
    description: "REST API documentation for spike.land edge services",
    filePath: "docs/api/API_REFERENCE.md",
  },
  {
    slug: "authentication",
    title: "Authentication",
    category: "API",
    description: "OAuth, session management, and API key authentication",
    filePath: "docs/develop/TOKEN_SYSTEM.md",
  },
  {
    slug: "architecture",
    title: "Architecture Overview",
    category: "Architecture",
    description: "System architecture and deployment topology",
    filePath: "docs/develop/EDGE_STACK.md",
  },
  {
    slug: "security",
    title: "Security Model",
    category: "Security",
    description: "Security practices, CSP, CORS, and data protection",
    filePath: "docs/security/SECURITY_INDEX.md",
  },
  {
    slug: "deployment",
    title: "Deployment Guide",
    category: "Guides",
    description: "Deploy your tools to spike.land",
    filePath: "docs/develop/CF_WORKERS_DEV.md",
  },
  {
    slug: "webhooks",
    title: "Webhooks",
    category: "API",
    description: "Set up and manage webhook integrations",
    filePath: "docs/api/INTEGRATION_GUIDE.md",
  },
  {
    slug: "rate-limits",
    title: "Rate Limits",
    category: "API",
    description: "Understanding rate limits and quotas",
    filePath: "docs/api/API_REFERENCE.md",
  },
  {
    slug: "compass-prd",
    title: "COMPASS — Universal Bureaucracy Navigator",
    category: "Products",
    description:
      "PRD for COMPASS: bureaucratic literacy as a universal human right. Navigating services for 4B people across 193 countries.",
    filePath: "docs/compass-prd.md",
  },
];

const CATEGORIES = [...new Set(DOCS_MANIFEST.map((d) => d.category))];

const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/spike-land-ai/spike-land-ai/main";

const docsApi = new Hono<{ Bindings: Env }>();

// List all docs grouped by category
docsApi.get("/api/docs", (c) => {
  const grouped = CATEGORIES.map((category) => ({
    category,
    docs: DOCS_MANIFEST.filter((d) => d.category === category).map(
      ({ filePath: _fp, ...rest }) => rest,
    ),
  }));

  c.header("Cache-Control", "public, max-age=14400, stale-while-revalidate=86400");
  return c.json({ categories: grouped, total: DOCS_MANIFEST.length });
});

// Get individual doc
docsApi.get("/api/docs/:slug", async (c) => {
  const slug = c.req.param("slug");
  const entry = DOCS_MANIFEST.find((d) => d.slug === slug);

  if (!entry) {
    return c.json({ error: "Document not found" }, 404);
  }

  let content: string;
  try {
    const res = await fetch(`${GITHUB_RAW_BASE}/${entry.filePath}`, {
      headers: { "User-Agent": "spike-edge/1.0" },
      cf: { cacheTtl: 3600, cacheEverything: true },
    });
    if (res.ok) {
      content = await res.text();
    } else {
      content = `# ${entry.title}\n\n${entry.description}\n\n---\n\nThis documentation page is coming soon. Check our [GitHub docs](https://github.com/spike-land-ai/spike-land-ai/tree/main/docs) for the latest content.`;
    }
  } catch {
    content = `# ${entry.title}\n\n${entry.description}\n\n---\n\nThis documentation page is coming soon. Check our [GitHub docs](https://github.com/spike-land-ai/spike-land-ai/tree/main/docs) for the latest content.`;
  }

  const { filePath, ...publicEntry } = entry;
  c.header("Cache-Control", "public, max-age=14400, stale-while-revalidate=86400");
  return c.json({ ...publicEntry, content, sourcePath: filePath });
});

export { docsApi };
