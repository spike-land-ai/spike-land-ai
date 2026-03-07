import matter from "gray-matter";

export interface McpApp {
  slug: string;
  name: string;
  description: string;
  emoji: string;
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
    statements.push(
      `INSERT OR REPLACE INTO mcp_apps (slug, name, description, emoji, status, tools, graph, markdown, tool_count, sort_order, created_at, updated_at)
VALUES ('${escapeSQL(app.slug)}', '${escapeSQL(app.name)}', '${escapeSQL(app.description)}', '${escapeSQL(app.emoji)}', '${escapeSQL(app.status)}', '${escapeSQL(JSON.stringify(app.tools))}', '${escapeSQL(JSON.stringify(app.graph))}', '${escapeSQL(app.markdown)}', ${app.tool_count}, ${app.sort_order}, unixepoch(), unixepoch());`
    );
  }

  return statements.join("\n\n");
}
