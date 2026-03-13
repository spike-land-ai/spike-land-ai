export interface DocEntry {
  slug: string;
  title: string;
  category: string;
  description: string;
  /** Path relative to repo root (docs/ directory). */
  filePath: string;
}

export const DOCS_MANIFEST: DocEntry[] = [
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
    filePath: "docs/api/API_VERSIONING.md",
  },
  {
    slug: "compass-prd",
    title: "COMPASS - Universal Bureaucracy Navigator",
    category: "Products",
    description:
      "PRD for COMPASS: bureaucratic literacy as a universal human right. Navigating services for 4B people across 193 countries.",
    filePath: "docs/compass-prd.md",
  },
  {
    slug: "openai-compatible-endpoint",
    title: "OpenAI-Compatible Endpoint Guide",
    category: "Blog",
    description:
      "How spike.land OpenAI-compatible endpoint works with local agent pipeline, spike-agent-v1, provider resolution, and local testing",
    filePath: "content/blog/openai-compatible-endpoint-local-playground.mdx",
  },
  {
    slug: "app-store-vision",
    title: "The spike.land App Store",
    category: "Blog",
    description:
      "spike.land vision as an open AI app store built on MCP runtime with composable tools, discovery, and install flows",
    filePath: "content/blog/spike-land-app-store.mdx",
  },
  {
    slug: "mcp-explained",
    title: "MCP Explained: Universal Adapter for AI Tools",
    category: "Blog",
    description:
      "What MCP is and how it works as a universal adapter for AI tools, with examples and integration patterns",
    filePath: "content/blog/mcp-explained-universal-adapter-for-ai-tools.mdx",
  },
];

export const DOC_CATEGORIES = [...new Set(DOCS_MANIFEST.map((entry) => entry.category))];
