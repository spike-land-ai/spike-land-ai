/**
 * Documentation Hub Types
 *
 * Interfaces for all manifest entries generated at build-time
 * from MCP tools, API routes, pages, schemas, and markdown docs.
 */

export interface DocsTool {
  name: string;
  description: string;
  category: string;
  tier: "free" | "workspace";
  parameters: DocsToolParam[];
}

export interface DocsToolParam {
  name: string;
  type: string;
  required: boolean;
  description: string;
}

export interface DocsApiEndpoint {
  path: string;
  methods: string[];
  description: string;
  domain: string;
  auth: boolean;
}

export interface DocsPage {
  path: string;
  title: string;
  description: string;
  section: string;
}

export interface DocsGuide {
  slug: string;
  title: string;
  excerpt: string;
  category: string;
  filePath: string;
}

export interface DocsSearchEntry {
  id: string;
  type: "tool" | "api" | "page" | "guide";
  title: string;
  description: string;
  category: string;
  href: string;
}

export interface DocsCategory {
  name: string;
  description: string;
  tier: string;
  toolCount: number;
  tools: string[];
}

export interface DocsManifests {
  tools: DocsTool[];
  categories: DocsCategory[];
  api: DocsApiEndpoint[];
  pages: DocsPage[];
  guides: DocsGuide[];
  searchIndex: DocsSearchEntry[];
}
