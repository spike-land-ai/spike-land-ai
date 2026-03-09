import matter from "gray-matter";

export interface McpApp {
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
  status: string;
  tools: string[];
  graph: Record<string, unknown>;
  markdown: string;
  tool_count: number;
  sort_order: number;
}

export function escapeSQL(str: string): string {
  return str.replace(/'/g, "''");
}

export function parseMdContent(rawContent: string, filename: string): McpApp | null {
  const { data, content } = matter(rawContent);

  const slug = data.slug || filename.replace(".md", "");
  const name = data.name || slug;
  const description = data.description || "";
  const emoji = data.emoji || "";
  const category = data.category || "";
  const tags = Array.isArray(data.tags)
    ? data.tags.filter((value): value is string => typeof value === "string")
    : [];
  const tagline = data.tagline || "";
  const pricing = data.pricing || "free";
  const is_featured = Boolean(data.is_featured);
  const is_new = Boolean(data.is_new);
  const status = data.status || "draft";
  const tools = data.tools || [];
  const graph = data.graph || {};
  const sort_order = data.sort_order || 0;
  const body = content.trim();

  return {
    slug,
    name,
    description,
    emoji,
    category,
    tags,
    tagline,
    pricing,
    is_featured,
    is_new,
    status,
    tools,
    graph,
    markdown: body,
    tool_count: tools.length,
    sort_order,
  };
}

export function generateSQL(apps: McpApp[]): string {
  const statements: string[] = [];

  for (const app of apps) {
    const safeToolCount = parseInt(String(app.tool_count), 10) || 0;
    const safeSortOrder = parseInt(String(app.sort_order), 10) || 0;
    const safeFeatured = app.is_featured ? 1 : 0;
    const safeNew = app.is_new ? 1 : 0;

    statements.push(
      `INSERT OR REPLACE INTO mcp_apps (slug, name, description, emoji, status, tools, graph, markdown, tool_count, sort_order, category, tags, tagline, pricing, is_featured, is_new, created_at, updated_at)
VALUES ('${escapeSQL(app.slug)}', '${escapeSQL(app.name)}', '${escapeSQL(app.description)}', '${escapeSQL(app.emoji)}', '${escapeSQL(app.status)}', '${escapeSQL(JSON.stringify(app.tools))}', '${escapeSQL(JSON.stringify(app.graph))}', '${escapeSQL(app.markdown)}', ${safeToolCount}, ${safeSortOrder}, '${escapeSQL(app.category)}', '${escapeSQL(JSON.stringify(app.tags))}', '${escapeSQL(app.tagline)}', '${escapeSQL(app.pricing)}', ${safeFeatured}, ${safeNew}, unixepoch(), unixepoch());`,
    );
  }

  return statements.join("\n\n");
}
