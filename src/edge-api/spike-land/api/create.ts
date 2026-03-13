/**
 * /api/create/* HTTP routes
 *
 * Provides the generate, search, list, and status endpoints consumed by the
 * platform-frontend /create flow.
 */

import { Hono } from "hono";
import { z } from "zod";
import { classifyIdeaLocally } from "../core-logic/tools/create";
import type { Env } from "../core-logic/env";
import type { AuthVariables } from "./middleware";

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

const GenerateBodySchema = z.object({
  prompt: z.string().min(1).max(2000),
  template: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const EDGE_BASE = "https://edge.spike.land";
const SPIKE_BASE = "https://spike.land";

function buildPreviewUrl(codespaceId: string): string {
  return `${EDGE_BASE}/live/${encodeURIComponent(codespaceId)}/index.html`;
}

function buildEditorUrl(codespaceId: string, prompt: string): string {
  const params = new URLSearchParams({ codeSpace: codespaceId, prompt });
  return `${SPIKE_BASE}/vibe-code?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Route
// ---------------------------------------------------------------------------

export const createRoute = new Hono<{ Bindings: Env; Variables: AuthVariables }>();

/**
 * POST /api/create/generate
 *
 * Classifies the prompt, derives a stable slug/template via local heuristics,
 * and returns a GeneratedApp payload. The vibe-code editor handles the actual
 * code generation lazily when the user opens the editor URL.
 *
 * A real AI-powered generation pipeline would be wired here; for now the
 * endpoint provides the slug/template/URL envelope so the frontend can
 * immediately show a live preview URL and "Open in Editor" CTA.
 */
createRoute.post("/generate", async (c) => {
  let body: unknown;
  try {
    body = await c.req.json();
  } catch {
    return c.json({ error: "Invalid JSON body" }, 400);
  }

  const parsed = GenerateBodySchema.safeParse(body);
  if (!parsed.success) {
    return c.json({ error: "Validation failed", issues: parsed.error.issues }, 422);
  }

  const { prompt, template } = parsed.data;
  const classification = classifyIdeaLocally(prompt);

  // Prefer an explicit template from the client; fall back to heuristic
  const resolvedTemplate = template ?? classification.template;
  const slug = classification.slug;
  const codespaceId = slug;

  const response = {
    slug,
    title: toDisplayName(slug),
    description: prompt.slice(0, 200),
    codespaceId,
    previewUrl: buildPreviewUrl(codespaceId),
    editorUrl: buildEditorUrl(codespaceId, prompt),
    template: resolvedTemplate,
    category: classification.category,
    generatedAt: new Date().toISOString(),
    promptUsed: prompt,
    classificationReason: classification.reason,
  };

  return c.json(response, 201);
});

/**
 * GET /api/create/search?q=...&limit=...
 *
 * Searches published /create apps by title, description, or slug.
 */
createRoute.get("/search", async (c) => {
  const query = c.req.query("q") ?? "";
  const limit = Math.min(Number(c.req.query("limit") ?? "10"), 50);

  if (!query.trim()) {
    return c.json({ apps: [] });
  }

  const pattern = `%${query.toLowerCase()}%`;
  const result = await c.env.DB.prepare(
    `SELECT slug, title, description, codespace_url, view_count
     FROM create_apps
     WHERE status = 'published'
       AND (LOWER(title) LIKE ? OR LOWER(description) LIKE ? OR LOWER(slug) LIKE ?)
     ORDER BY view_count DESC
     LIMIT ?`,
  )
    .bind(pattern, pattern, pattern, limit)
    .all()
    .catch(() => ({ results: [] }));

  return c.json({ apps: result.results ?? [] });
});

/**
 * GET /api/create/list?sort=popular|recent&limit=...
 */
createRoute.get("/list", async (c) => {
  const sort = c.req.query("sort") === "recent" ? "recent" : "popular";
  const limit = Math.min(Number(c.req.query("limit") ?? "10"), 50);

  const orderBy = sort === "recent" ? "generated_at DESC" : "view_count DESC";

  const result = await c.env.DB.prepare(
    `SELECT slug, title, description, codespace_url, view_count, generated_at
     FROM create_apps
     WHERE status = 'published'
     ORDER BY ${orderBy}
     LIMIT ?`,
  )
    .bind(limit)
    .all()
    .catch(() => ({ results: [] }));

  return c.json({ apps: result.results ?? [] });
});

/**
 * GET /api/create/:slug
 */
createRoute.get("/:slug", async (c) => {
  const slug = c.req.param("slug");

  const row = await c.env.DB.prepare(
    `SELECT slug, title, description, status, codespace_id, codespace_url,
            view_count, generated_at, prompt_used, outgoing_links,
            generated_by_id, generated_by_name
     FROM create_apps
     WHERE slug = ?`,
  )
    .bind(slug)
    .first()
    .catch(() => null);

  if (!row) {
    return c.json({ error: "NOT_FOUND", slug }, 404);
  }

  return c.json(row);
});

/**
 * GET /api/create/:slug/status
 */
createRoute.get("/:slug/status", async (c) => {
  const slug = c.req.param("slug");

  const row = await c.env.DB.prepare(
    `SELECT slug, title, status, codespace_url FROM create_apps WHERE slug = ?`,
  )
    .bind(slug)
    .first()
    .catch(() => null);

  if (!row) {
    return c.json({ error: "NOT_FOUND", slug }, 404);
  }

  return c.json(row);
});

/**
 * GET /api/create/health/:codespaceId
 */
createRoute.get("/health/:codespaceId", async (c) => {
  const codespaceId = c.req.param("codespaceId");

  try {
    const sessionUrl = `${EDGE_BASE}/live/${encodeURIComponent(codespaceId)}/session.json`;
    const res = await fetch(sessionUrl, { signal: AbortSignal.timeout(4000) });

    if (!res.ok) {
      return c.json({ codespaceId, healthy: false, reason: `Session HTTP ${res.status}` });
    }

    const session = (await res.json()) as {
      code?: string;
      html?: string;
    };
    const hasCode = typeof session.code === "string" && session.code.length > 60;
    const healthy = hasCode;

    return c.json({ codespaceId, healthy, reason: healthy ? "Has code" : "Default scaffold" });
  } catch {
    return c.json({ codespaceId, healthy: false, reason: "Session unreachable" });
  }
});

// ---------------------------------------------------------------------------
// Internal helper
// ---------------------------------------------------------------------------

function toDisplayName(slug: string): string {
  return slug
    .split("-")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
