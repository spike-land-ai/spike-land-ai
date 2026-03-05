import { Hono } from "hono";
import type { Env } from "../env.js";

interface DocEntry {
  slug: string;
  title: string;
  category: string;
  description: string;
}

// Static manifest of available docs — maps to files in docs/ directory
const DOCS_MANIFEST: DocEntry[] = [
  { slug: "getting-started", title: "Getting Started", category: "Guides", description: "Quick start guide for spike.land" },
  { slug: "mcp-overview", title: "MCP Overview", category: "MCP", description: "Introduction to Model Context Protocol" },
  { slug: "mcp-tools", title: "MCP Tools Reference", category: "MCP", description: "Complete reference for all 80+ MCP tools" },
  { slug: "api-reference", title: "API Reference", category: "API", description: "REST API documentation for spike.land edge services" },
  { slug: "authentication", title: "Authentication", category: "API", description: "OAuth, session management, and API key authentication" },
  { slug: "architecture", title: "Architecture Overview", category: "Architecture", description: "System architecture and deployment topology" },
  { slug: "security", title: "Security Model", category: "Security", description: "Security practices, CSP, CORS, and data protection" },
  { slug: "deployment", title: "Deployment Guide", category: "Guides", description: "Deploy your tools to spike.land" },
  { slug: "webhooks", title: "Webhooks", category: "API", description: "Set up and manage webhook integrations" },
  { slug: "rate-limits", title: "Rate Limits", category: "API", description: "Understanding rate limits and quotas" },
];

const CATEGORIES = [...new Set(DOCS_MANIFEST.map(d => d.category))];

const docsApi = new Hono<{ Bindings: Env }>();

// List all docs grouped by category
docsApi.get("/api/docs", (c) => {
  const grouped = CATEGORIES.map(category => ({
    category,
    docs: DOCS_MANIFEST.filter(d => d.category === category),
  }));

  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return c.json({ categories: grouped, total: DOCS_MANIFEST.length });
});

// Get individual doc
docsApi.get("/api/docs/:slug", (c) => {
  const slug = c.req.param("slug");
  const entry = DOCS_MANIFEST.find(d => d.slug === slug);

  if (!entry) {
    return c.json({ error: "Document not found" }, 404);
  }

  // For MVP, return the manifest entry with placeholder content
  // In future, this will fetch markdown from R2 or D1
  const content = `# ${entry.title}\n\n${entry.description}\n\n---\n\nThis documentation page is coming soon. Check our [GitHub docs](https://github.com/spike-land-ai/spike-land-ai/tree/main/docs) for the latest content.`;

  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return c.json({ ...entry, content });
});

export { docsApi };
