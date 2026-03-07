import { Hono } from "hono";
import type { Env } from "../core-logic/env";
import type { AuthVariables } from "./middleware";

export const publicAppsRoute = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

publicAppsRoute.get("/", async (c) => {
  const result = await c.env.DB.prepare(
    `SELECT slug, name, description, emoji, tool_count, sort_order 
     FROM mcp_apps 
     WHERE status = 'live' 
     ORDER BY sort_order ASC`
  ).all();

  const apps = result.results ?? [];

  const response = c.json({ apps });
  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return response;
});

publicAppsRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const row = await c.env.DB.prepare(
    `SELECT slug, name, description, emoji, status, tools, graph, markdown, tool_count, sort_order 
     FROM mcp_apps 
     WHERE slug = ?`
  ).bind(slug).first();

  if (!row) {
    return c.json({ error: "App not found" }, 404);
  }

  let tools = [];
  let graph = {};
  
  try { tools = JSON.parse(row.tools as string); } catch (e) { console.error(`Failed to parse 'tools' for app ${slug}`, e); }
  try { graph = JSON.parse(row.graph as string); } catch (e) { console.error(`Failed to parse 'graph' for app ${slug}`, e); }

  const app = {
    slug: row.slug,
    name: row.name,
    description: row.description,
    emoji: row.emoji,
    status: row.status,
    tools,
    graph,
    markdown: row.markdown,
    tool_count: row.tool_count,
    sort_order: row.sort_order,
  };

  const response = c.json(app);
  c.header("Cache-Control", "public, max-age=3600, stale-while-revalidate=86400");
  return response;
});
