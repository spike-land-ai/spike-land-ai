import { Hono } from "hono";
import type { Env } from "../core-logic/env";
import type { AuthVariables } from "./middleware";
import { generateAppMdx } from "../core-logic/tools/store/mdx-templates";
import type { AppToolDef } from "../core-logic/tools/store/mdx-templates";

interface McpAppRow {
  slug: unknown;
  name: unknown;
  description: unknown;
  emoji: unknown;
  category: unknown;
  tags: unknown;
  tagline: unknown;
  pricing: unknown;
  is_featured: unknown;
  is_new: unknown;
  tool_count: unknown;
  sort_order: unknown;
  status?: unknown;
  tools?: unknown;
  graph?: unknown;
  markdown?: unknown;
}

export const publicAppsRoute = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

publicAppsRoute.get("/", async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT slug, name, description, emoji, category, tags, tagline, pricing, is_featured, is_new, tool_count, sort_order
     FROM mcp_apps
     WHERE status = 'live'
     ORDER BY sort_order ASC`,
  ).all();

  const apps = (result.results ?? []).map((rawRow) => {
    const row = rawRow as unknown as McpAppRow;
    let tags = [];

    try {
      tags = JSON.parse(String(row.tags ?? "[]"));
    } catch (e) {
      console.error(`Failed to parse 'tags' for app ${String(row.slug ?? "<unknown>")}`, e);
    }

    return {
      slug: row.slug,
      name: row.name,
      description: row.description,
      emoji: row.emoji,
      category: row.category,
      tags,
      tagline: row.tagline,
      pricing: row.pricing,
      is_featured: Boolean(row.is_featured),
      is_new: Boolean(row.is_new),
      tool_count: row.tool_count,
      sort_order: row.sort_order,
    };
  });

  c.header("Cache-Control", "public, max-age=14400, stale-while-revalidate=86400");
  return c.json({ apps });
});

publicAppsRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const rawRow = await c.env.DB.prepare(
    `SELECT slug, name, description, emoji, category, tags, tagline, pricing, is_featured, is_new, status, tools, graph, markdown, tool_count, sort_order
     FROM mcp_apps
     WHERE slug = ?`,
  )
    .bind(slug)
    .first();

  if (!rawRow) {
    return c.json({ error: "App not found" }, 404);
  }

  const row = rawRow as unknown as McpAppRow;
  let tools = [];
  let graph = {};
  let tags = [];

  try {
    tools = JSON.parse(row.tools as string);
  } catch (e) {
    console.error(`Failed to parse 'tools' for app ${slug}`, e);
  }
  try {
    tags = JSON.parse(row.tags as string);
  } catch (e) {
    console.error(`Failed to parse 'tags' for app ${slug}`, e);
  }
  try {
    graph = JSON.parse(row.graph as string);
  } catch (e) {
    console.error(`Failed to parse 'graph' for app ${slug}`, e);
  }

  const app = {
    slug: row.slug,
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    category: row.category,
    tags,
    tagline: row.tagline,
    pricing: row.pricing,
    is_featured: Boolean(row.is_featured),
    is_new: Boolean(row.is_new),
    status: row.status,
    tools,
    graph,
    markdown: row.markdown,
    tool_count: row.tool_count,
    sort_order: row.sort_order,
  };

  c.header("Cache-Control", "public, max-age=14400, stale-while-revalidate=86400");
  return c.json(app);
});

/**
 * GET /apps/:slug/mdx
 *
 * Returns the MDX content for an app as plain text. If the app has stored
 * markdown in the database, that is returned directly. Otherwise, MDX is
 * generated on-the-fly from the app metadata and its registered tools.
 */
publicAppsRoute.get("/:slug/mdx", async (c) => {
  const slug = c.req.param("slug");

  const rawRow = await c.env.DB.prepare(
    `SELECT slug, name, description, emoji, category, tags, tagline, pricing, tools, markdown
     FROM mcp_apps
     WHERE slug = ?`,
  )
    .bind(slug)
    .first();

  if (!rawRow) {
    return c.text(`# ${slug}\n\nApp not found.`, 404);
  }

  const row = rawRow as unknown as McpAppRow;

  // If stored markdown exists, return it directly
  if (row.markdown && typeof row.markdown === "string" && row.markdown.trim().length > 0) {
    c.header("Content-Type", "text/plain; charset=utf-8");
    c.header("Cache-Control", "public, max-age=14400, stale-while-revalidate=86400");
    return c.text(row.markdown as string);
  }

  // Generate MDX on-the-fly from app metadata + tools list
  let toolNames: string[] = [];
  try {
    toolNames = JSON.parse(row.tools as string) as string[];
  } catch {
    // ignore parse error — tools defaults to empty array
  }

  let tags: string[] = [];
  try {
    tags = JSON.parse(row.tags as string) as string[];
  } catch {
    // ignore parse error
  }

  // Fetch tool metadata for any tool names we have
  let toolDefs: AppToolDef[] = [];
  if (toolNames.length > 0) {
    try {
      const placeholders = toolNames.map(() => "?").join(", ");
      const toolRows = await c.env.DB.prepare(
        `SELECT name, description, category FROM registered_tools WHERE name IN (${placeholders}) LIMIT 50`,
      )
        .bind(...toolNames)
        .all();

      toolDefs = (toolRows.results ?? []).map((r) => {
        const tr = r as { name: unknown; description: unknown; category: unknown };
        const def: AppToolDef = { name: String(tr.name ?? "") };
        if (tr.description) def.description = String(tr.description);
        if (tr.category) def.category = String(tr.category);
        return def;
      });
    } catch {
      // Fall back to bare tool names if DB query fails
      toolDefs = toolNames.map((name) => ({ name }));
    }
  }

  const mdxContext: Parameters<typeof generateAppMdx>[0] = {
    slug: String(row.slug ?? slug),
    name: String(row.name ?? slug),
    description: String(row.description ?? ""),
    emoji: String(row.emoji ?? "🔧"),
    category: String(row.category ?? ""),
    tags,
    tools: toolDefs,
  };
  if (row.tagline) mdxContext.tagline = String(row.tagline);
  if (row.pricing) mdxContext.pricing = String(row.pricing);

  const mdx = generateAppMdx(mdxContext);

  c.header("Content-Type", "text/plain; charset=utf-8");
  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=14400");
  return c.text(mdx);
});
