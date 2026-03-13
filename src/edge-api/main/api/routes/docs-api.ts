import { Hono } from "hono";
import type { Env } from "../../core-logic/env.js";
import { DOCS_MANIFEST, DOC_CATEGORIES as CATEGORIES } from "../../core-logic/docs-catalog.js";
import {
  acceptsMarkdown,
  markdownResponse,
} from "../../../common/core-logic/content-negotiation.js";

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

  // Content negotiation: return raw markdown for agents
  if (acceptsMarkdown(c)) {
    try {
      const res = await fetch(`${GITHUB_RAW_BASE}/${entry.filePath}`, {
        headers: { "User-Agent": "spike-edge/1.0" },
        cf: { cacheTtl: 3600, cacheEverything: true },
      });
      if (res.ok) {
        return markdownResponse(await res.text(), "public, max-age=14400");
      }
    } catch {
      // Fall through to 404
    }
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
