import { Hono } from "hono";
import {
  extractHeroMedia,
  findImagePrompt,
} from "../../../../core/block-website/core-logic/blog-source.js";
import { hashImagePrompt } from "../../../../core/block-website/core-logic/blog-image-policy.js";
import type { Env } from "../../core-logic/env.js";
import { getClientId, sendGA4Events } from "../../lazy-imports/ga4.js";
import { safeCtx, withEdgeCache } from "../lib/edge-cache.js";
import { buildBlogAnalyticsEvents } from "./blog-audience.js";

const blog = new Hono<{ Bindings: Env }>();
const GITHUB_RAW_BASE = "https://raw.githubusercontent.com/spike-land-ai/spike-land-ai/main";
const BLOG_SLUG_RE = /^[a-z0-9-]+$/i;

interface BlogPostRow {
  slug: string;
  title: string;
  description: string;
  primer: string;
  date: string;
  author: string;
  category: string;
  tags: string;
  featured: number;
  draft: number;
  unlisted: number;
  hero_image: string | null;
  hero_prompt?: string | null;
  content: string;
  created_at: number;
  updated_at: number;
}

interface ToolTextPart {
  type: string;
  text?: string;
}

interface ToolCallResult {
  content?: ToolTextPart[];
  isError?: boolean;
}

interface ToolApiResponse {
  result?: ToolCallResult;
}

function stripQuotes(value: string): string {
  return value.replace(/^['"]|['"]$/g, "");
}

function getFrontmatterValue(frontmatter: string, key: string): string | null {
  const match = frontmatter.match(new RegExp(`^${key}:\\s*(.+)$`, "m"));
  return match?.[1]?.trim() ?? null;
}

function parseTagsValue(raw: string | null): string[] {
  if (!raw?.startsWith("[") || !raw.endsWith("]")) return [];

  const inner = raw.slice(1, -1).trim();
  if (!inner) return [];

  return inner
    .split(",")
    .map((tag) => stripQuotes(tag.trim()))
    .filter(Boolean);
}

function sourceToRow(rawContent: string, requestedSlug: string): BlogPostRow | null {
  const match = rawContent.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match?.[1]) return null;

  const frontmatter = match[1];
  const title = stripQuotes(getFrontmatterValue(frontmatter, "title") ?? "");
  if (!title) return null;

  const frontmatterHeroImage = stripQuotes(getFrontmatterValue(frontmatter, "heroImage") ?? "");
  const frontmatterHeroPrompt = stripQuotes(getFrontmatterValue(frontmatter, "heroPrompt") ?? "");
  const { heroImage, heroPrompt, body } = extractHeroMedia(
    rawContent.slice(match[0].length),
    frontmatterHeroImage || null,
    frontmatterHeroPrompt || null,
  );

  return {
    slug: stripQuotes(getFrontmatterValue(frontmatter, "slug") ?? requestedSlug),
    title,
    description: stripQuotes(getFrontmatterValue(frontmatter, "description") ?? ""),
    primer: stripQuotes(getFrontmatterValue(frontmatter, "primer") ?? ""),
    date: stripQuotes(getFrontmatterValue(frontmatter, "date") ?? ""),
    author: stripQuotes(getFrontmatterValue(frontmatter, "author") ?? ""),
    category: stripQuotes(getFrontmatterValue(frontmatter, "category") ?? ""),
    tags: JSON.stringify(parseTagsValue(getFrontmatterValue(frontmatter, "tags"))),
    featured: getFrontmatterValue(frontmatter, "featured") === "true" ? 1 : 0,
    draft: getFrontmatterValue(frontmatter, "draft") === "true" ? 1 : 0,
    unlisted: getFrontmatterValue(frontmatter, "unlisted") === "true" ? 1 : 0,
    hero_image: heroImage,
    hero_prompt: heroPrompt,
    content: body,
    created_at: 0,
    updated_at: 0,
  };
}

async function fetchBlogPostSource(slug: string): Promise<BlogPostRow | null> {
  if (!BLOG_SLUG_RE.test(slug)) return null;

  try {
    const response = await fetch(`${GITHUB_RAW_BASE}/content/blog/${slug}.mdx`, {
      headers: { "User-Agent": "spike-edge/1.0" },
      cf: { cacheTtl: 300, cacheEverything: true },
    });

    if (!response.ok) return null;

    return sourceToRow(await response.text(), slug);
  } catch {
    return null;
  }
}

function rowToPost(row: BlogPostRow, includeContent = false) {
  let tags: unknown = [];
  try {
    tags = JSON.parse(row.tags);
  } catch {
    /* default to empty */
  }

  const heroPrompt =
    normalizePrompt(row.hero_prompt) ??
    (row.hero_image ? inferPromptFromRow(row, row.hero_image) : null) ??
    (row.hero_image ? buildFallbackHeroPrompt(row) : null);

  const post: Record<string, unknown> = {
    slug: row.slug,
    title: row.title,
    description: row.description,
    primer: row.primer,
    date: row.date,
    author: row.author,
    category: row.category,
    tags,
    featured: Boolean(row.featured),
    draft: Boolean(row.draft),
    unlisted: Boolean(row.unlisted),
    heroImage: row.hero_image,
    heroPrompt,
  };
  if (includeContent) {
    post.content = row.content;
  }
  return post;
}

function buildFallbackHeroPrompt(row: Pick<BlogPostRow, "title" | "description">): string | null {
  const fragments = [normalizePrompt(row.title), normalizePrompt(row.description)].filter(
    (value): value is string => Boolean(value),
  );
  if (!fragments.length) return null;

  return `${fragments.join(". ")}. Cinematic developer blog hero artwork.`;
}

async function recoverRowHeroPrompt(row: BlogPostRow): Promise<BlogPostRow> {
  if (normalizePrompt(row.hero_prompt) || !row.hero_image) {
    return row;
  }

  const inlinePrompt = inferPromptFromRow(row, row.hero_image);
  if (inlinePrompt) {
    row.hero_prompt = inlinePrompt;
    return row;
  }

  const sourceRow = await fetchBlogPostSource(row.slug);
  const sourcePrompt =
    normalizePrompt(sourceRow?.hero_prompt) ??
    (sourceRow?.hero_image ? inferPromptFromRow(sourceRow, sourceRow.hero_image) : null);
  if (sourcePrompt) {
    row.hero_prompt = sourcePrompt;
  }

  return row;
}

interface AnalyticsBlogPost {
  slug: string;
  title: string;
  category: string;
  tags: string[];
}

function toAnalyticsBlogPost(post: unknown): AnalyticsBlogPost | null {
  if (!post || typeof post !== "object") return null;

  const record = post as Record<string, unknown>;
  const slug = typeof record.slug === "string" ? record.slug : "";
  const title = typeof record.title === "string" ? record.title : "";
  const category = typeof record.category === "string" ? record.category : "";
  const tags = Array.isArray(record.tags)
    ? record.tags.filter((tag): tag is string => typeof tag === "string")
    : [];

  if (!slug || !title) return null;

  return { slug, title, category, tags };
}

function isLocalDev(c: { env: { ENVIRONMENT?: string } }): boolean {
  return c.env.ENVIRONMENT === "development" || c.env.ENVIRONMENT === "local";
}

// /api/blog/posts is a common alias — redirect before :slug catches "posts"
blog.get("/api/blog/posts", (c) => c.redirect("/api/blog", 301));

blog.get("/api/blog", async (c) => {
  const showDrafts = isLocalDev(c);
  const visibilityFilter = showDrafts ? " WHERE unlisted = 0" : " WHERE draft = 0 AND unlisted = 0";

  let cached: Response | null = null;
  try {
    cached = await withEdgeCache(
      c.req.raw,
      safeCtx(c),
      async () => {
        const result = await c.env.DB.prepare(
          `SELECT * FROM blog_posts${visibilityFilter} ORDER BY date DESC`,
        ).all<BlogPostRow>();

        if (!result.results?.length) return null;

        const rows = await Promise.all(result.results.map((row) => recoverRowHeroPrompt(row)));
        const posts = rows.map((row) => rowToPost(row));
        return new Response(JSON.stringify(posts), {
          headers: { "Content-Type": "application/json" },
        });
      },
      { ttl: showDrafts ? 0 : 300, swr: showDrafts ? 0 : 300 },
    );
  } catch {
    // Cache API unavailable — fall back to direct D1
    const result = await c.env.DB.prepare(
      `SELECT * FROM blog_posts${visibilityFilter} ORDER BY date DESC`,
    ).all<BlogPostRow>();

    if (result.results?.length) {
      const rows = await Promise.all(result.results.map((row) => recoverRowHeroPrompt(row)));
      const posts = rows.map((row) => rowToPost(row));
      cached = new Response(JSON.stringify(posts), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!cached) return c.json({ error: "Blog index not found" }, 404);

  try {
    c.executionCtx.waitUntil(
      getClientId(c.req.raw).then((clientId) =>
        sendGA4Events(c.env, clientId, [
          {
            name: "blog_index",
            params: { page_path: "/api/blog" },
          },
        ]),
      ),
    );
  } catch {
    /* no ExecutionContext in some environments */
  }

  return cached;
});

blog.get("/api/blog/:slug", async (c) => {
  // Normalise: strip accidental .mdx suffix so old links still resolve
  const slug = c.req.param("slug").replace(/\.mdx$/i, "");
  const showDrafts = isLocalDev(c);

  let cached: Response | null = null;
  try {
    cached = await withEdgeCache(
      c.req.raw,
      safeCtx(c),
      async () => {
        const row = await getBlogPostRow(c.env.DB, slug);

        if (!row) return null;

        return new Response(JSON.stringify(rowToPost(row, true)), {
          headers: { "Content-Type": "application/json" },
        });
      },
      { ttl: showDrafts ? 0 : 300, swr: showDrafts ? 0 : 300 },
    );
  } catch {
    // Cache API unavailable — fall back to direct D1
    const row = await getBlogPostRow(c.env.DB, slug);

    if (row) {
      cached = new Response(JSON.stringify(rowToPost(row, true)), {
        headers: { "Content-Type": "application/json" },
      });
    }
  }

  if (!cached) return c.json({ error: "Post not found" }, 404);

  const analyticsPost = await cached
    .clone()
    .json<unknown>()
    .then((post) => toAnalyticsBlogPost(post))
    .catch((): AnalyticsBlogPost | null => null);

  try {
    c.executionCtx.waitUntil(
      getClientId(c.req.raw).then((clientId) => {
        const { events, signal } = analyticsPost
          ? buildBlogAnalyticsEvents(analyticsPost)
          : {
              events: [
                {
                  name: "blog_view",
                  params: { page_path: `/api/blog/${slug}`, slug },
                },
              ],
              signal: null,
            };
        const ga4Promise = sendGA4Events(c.env, clientId, events);

        const dbPromise = c.env.DB.prepare(
          "INSERT INTO analytics_events (source, event_type, metadata, client_id) VALUES (?, ?, ?, ?)",
        )
          .bind(
            "platform-frontend",
            "blog_view",
            JSON.stringify({
              slug,
              audienceSignal: signal,
            }),
            clientId,
          )
          .run();

        return Promise.all([ga4Promise, dbPromise]);
      }),
    );
  } catch {
    /* no ExecutionContext in some environments */
  }

  return cached;
});

// Serve blog images from R2 (supports both /api/blog-images/... and /blog/slug/file.ext paths)
const IMAGE_EXTS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg", "avif"]);

const CONTENT_TYPES: Record<string, string> = {
  png: "image/png",
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  gif: "image/gif",
  webp: "image/webp",
  svg: "image/svg+xml",
  avif: "image/avif",
};

const IMAGE_STUDIO_URL = "https://image-studio-mcp.spike.land/api/tool";
const IMAGE_STUDIO_GENERATE_TOOL = "img_generate";
const IMAGE_STUDIO_JOB_STATUS_TOOL = "img_job_status";
const HERO_GENERATION_POLL_ATTEMPTS = 15;
const HERO_GENERATION_POLL_DELAY_MS = 1_000;

function buildImageResponse(
  object: R2ObjectBody,
  contentType: string,
  cacheControl: string,
): Response {
  return new Response(object.body, {
    headers: {
      "Content-Type": object.httpMetadata?.contentType || contentType,
      "Cache-Control": cacheControl,
    },
  });
}

function normalizePrompt(value: string | null | undefined): string | null {
  const trimmed = value?.trim() ?? "";
  return trimmed ? trimmed : null;
}

function inferPromptFromRow(row: BlogPostRow | null | undefined, imagePath: string): string | null {
  if (!row) return null;

  const directPrompt = normalizePrompt(row.hero_prompt);
  if (directPrompt) return directPrompt;

  return findImagePrompt(row.content, imagePath);
}

function inferHeroOutputFormat(ext: string): "png" | "jpeg" | "webp" {
  if (ext === "jpg" || ext === "jpeg") return "jpeg";
  if (ext === "webp") return "webp";
  return "png";
}

function shouldAllowProdImageFallback(hostname: string): boolean {
  return (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "local.spike.land" ||
    hostname === "dev.spike.land"
  );
}

async function callImageStudioTool<T>(name: string, args: Record<string, unknown>): Promise<T> {
  const response = await fetch(IMAGE_STUDIO_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      name,
      arguments: args,
    }),
  });

  if (!response.ok) {
    throw new Error(`Image Studio returned ${response.status}`);
  }

  const payload = (await response.json()) as ToolApiResponse;
  const text = payload.result?.content
    ?.map((item) => (typeof item.text === "string" ? item.text : ""))
    .join("\n")
    .trim();

  if (payload.result?.isError) {
    throw new Error(text || "Image Studio returned an error");
  }

  if (!text) {
    throw new Error("Image Studio returned an empty payload");
  }

  return JSON.parse(text) as T;
}

async function generateHeroImageAsset(
  prompt: string,
  outputFormat: "png" | "jpeg" | "webp",
): Promise<{ body: ArrayBuffer; contentType: string }> {
  const fullPrompt = [
    prompt,
    "Cinematic wide developer blog hero artwork.",
    "No typography, no captions, no logos, no watermarks, no border, no UI chrome.",
  ].join(" ");

  const job = await callImageStudioTool<{ jobId?: string }>(IMAGE_STUDIO_GENERATE_TOOL, {
    prompt: fullPrompt,
    aspect_ratio: "21:9",
    tier: "TIER_1K",
    resolution: "1K",
    model_preference: "latest",
    output_format: outputFormat,
    num_images: 1,
  });

  if (!job.jobId) {
    throw new Error("Generation job id missing");
  }

  let outputUrl: string | null = null;
  for (let attempt = 0; attempt < HERO_GENERATION_POLL_ATTEMPTS; attempt++) {
    const status = await callImageStudioTool<{
      outputUrl?: string;
      status?: string;
      error?: string;
    }>(IMAGE_STUDIO_JOB_STATUS_TOOL, {
      job_id: job.jobId,
      job_type: "generation",
    });

    if (status.outputUrl) {
      outputUrl = status.outputUrl;
      break;
    }

    if (status.status === "FAILED") {
      throw new Error(status.error || "Hero image generation failed");
    }

    await new Promise((resolve) => setTimeout(resolve, HERO_GENERATION_POLL_DELAY_MS));
  }

  if (!outputUrl) {
    throw new Error("Hero image generation did not finish in time");
  }

  const assetResponse = await fetch(outputUrl);
  if (!assetResponse.ok) {
    throw new Error(`Generated hero fetch failed with ${assetResponse.status}`);
  }

  return {
    body: await assetResponse.arrayBuffer(),
    contentType:
      assetResponse.headers.get("Content-Type") || CONTENT_TYPES[outputFormat] || "image/png",
  };
}

async function resolveHeroPrompt(
  db: D1Database,
  slug: string,
  filename: string,
  requestedPrompt?: string | null,
): Promise<{ prompt: string; promptHash: string } | null> {
  const explicitPrompt = normalizePrompt(requestedPrompt);
  if (explicitPrompt) {
    return {
      prompt: explicitPrompt,
      promptHash: hashImagePrompt(explicitPrompt),
    };
  }

  const requestedPath = `/blog/${slug}/${filename}`;
  const row = await getBlogPostRow(db, slug);
  if (!row || row.hero_image !== requestedPath) {
    return null;
  }

  let prompt = inferPromptFromRow(row, requestedPath);

  if (!prompt) {
    const sourceRow = await fetchBlogPostSource(slug);
    if (sourceRow?.hero_image === requestedPath) {
      prompt = inferPromptFromRow(sourceRow, requestedPath);
    }
  }

  if (!prompt) return null;

  return {
    prompt,
    promptHash: hashImagePrompt(prompt),
  };
}

async function serveBlogImage(
  spaAssets: R2Bucket,
  db: D1Database,
  slug: string,
  filename: string,
  requestedPrompt?: string | null,
  versionToken?: string | null,
  allowProdFallback = false,
): Promise<Response | null> {
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";
  const key = `blog-images/${slug}/${filename}`;
  const contentType = CONTENT_TYPES[ext] || "application/octet-stream";
  const heroPrompt = await resolveHeroPrompt(db, slug, filename, requestedPrompt);
  const versionedCache = versionToken
    ? "public, max-age=31536000, immutable"
    : "public, max-age=3600";

  const obj = await spaAssets.get(key);
  if (heroPrompt) {
    if (obj?.customMetadata?.promptHash === heroPrompt.promptHash) {
      return buildImageResponse(obj, contentType, versionedCache);
    }

    try {
      const generated = await generateHeroImageAsset(heroPrompt.prompt, inferHeroOutputFormat(ext));
      const bodyForCache = generated.body.slice(0);

      await spaAssets.put(key, bodyForCache, {
        httpMetadata: { contentType: generated.contentType },
        customMetadata: {
          promptHash: heroPrompt.promptHash,
          source: "prompt-driven-hero",
        },
      });

      return new Response(generated.body, {
        headers: {
          "Content-Type": generated.contentType,
          "Cache-Control": versionedCache,
        },
      });
    } catch {
      if (obj) {
        return buildImageResponse(obj, contentType, "public, max-age=3600");
      }
    }
  }

  if (obj) {
    return buildImageResponse(obj, contentType, "public, max-age=31536000, immutable");
  }

  // Fallback to production only for local dev where the local R2 bucket is empty.
  if (!allowProdFallback) {
    return null;
  }

  const prodUrl = new URL(`https://spike.land/api/blog-images/${slug}/${filename}`);
  if (requestedPrompt) {
    prodUrl.searchParams.set("prompt", requestedPrompt);
  }
  if (versionToken) {
    prodUrl.searchParams.set("v", versionToken);
  }

  const upstream = await fetch(prodUrl);
  if (upstream.ok) {
    return new Response(upstream.body, {
      headers: {
        "Content-Type": upstream.headers.get("Content-Type") || "application/octet-stream",
        "Cache-Control": "public, max-age=3600",
      },
    });
  }

  return null;
}

blog.get("/api/blog-images/:slug/:filename", async (c) => {
  const { slug, filename } = c.req.param();
  const hostname = new URL(c.req.url).hostname;
  const resp = await serveBlogImage(
    c.env.SPA_ASSETS,
    c.env.DB,
    slug,
    filename,
    c.req.query("prompt"),
    c.req.query("v"),
    shouldAllowProdImageFallback(hostname),
  );
  return resp ?? c.notFound();
});

// Backward-compatible: serve /blog/{slug}/{filename} for inline MDX images
blog.get("/blog/:slug/:filename", async (c, next) => {
  const { slug, filename } = c.req.param();
  const ext = filename.split(".").pop()?.toLowerCase() ?? "";

  if (!IMAGE_EXTS.has(ext)) return next();

  const hostname = new URL(c.req.url).hostname;
  const resp = await serveBlogImage(
    c.env.SPA_ASSETS,
    c.env.DB,
    slug,
    filename,
    c.req.query("prompt"),
    c.req.query("v"),
    shouldAllowProdImageFallback(hostname),
  );
  return resp ?? next();
});

/** Fetch a single blog post row from D1 (no caching, for SSR injection). */
async function getBlogPostRow(db: D1Database, slug: string): Promise<BlogPostRow | null> {
  const normalizedSlug = slug.replace(/\.mdx$/i, "");

  try {
    const row = await db
      .prepare("SELECT * FROM blog_posts WHERE slug = ?")
      .bind(normalizedSlug)
      .first<BlogPostRow>();

    if (row) {
      return recoverRowHeroPrompt(row);
    }
  } catch {
    // Fall through to the canonical MDX source when D1 is unavailable or stale.
  }

  return fetchBlogPostSource(normalizedSlug);
}

// RSS 2.0 feed endpoint
blog.get("/blog/rss", async (c) => {
  let response: Response | null = null;

  const buildRssXml = (posts: BlogPostRow[]): string => {
    const items = posts.map((post) => {
      const pubDate = new Date(post.date).toUTCString();
      const link = `https://spike.land/blog/${post.slug}`;
      return [
        "    <item>",
        `      <title><![CDATA[${post.title}]]></title>`,
        `      <link>${link}</link>`,
        `      <description><![CDATA[${post.description}]]></description>`,
        `      <pubDate>${pubDate}</pubDate>`,
        `      <author><![CDATA[${post.author}]]></author>`,
        `      <guid isPermaLink="true">${link}</guid>`,
        `      <category><![CDATA[${post.category}]]></category>`,
        "    </item>",
      ].join("\n");
    });

    return [
      '<?xml version="1.0" encoding="UTF-8"?>',
      '<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom">',
      "  <channel>",
      "    <title>spike.land Blog</title>",
      "    <link>https://spike.land/blog</link>",
      "    <description>Articles, tutorials, and engineering insights from the spike.land team about AI, MCP, and edge computing.</description>",
      "    <language>en</language>",
      '    <atom:link href="https://spike.land/blog/rss" rel="self" type="application/rss+xml" />',
      ...items,
      "  </channel>",
      "</rss>",
    ].join("\n");
  };

  try {
    response = await withEdgeCache(
      c.req.raw,
      safeCtx(c),
      async () => {
        const result = await c.env.DB.prepare(
          "SELECT * FROM blog_posts WHERE draft = 0 AND unlisted = 0 ORDER BY date DESC LIMIT 50",
        ).all<BlogPostRow>();

        const posts = result.results ?? [];
        const xml = buildRssXml(posts);

        return new Response(xml, {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
        });
      },
      { ttl: 3600, swr: 86400 },
    );
  } catch {
    try {
      const result = await c.env.DB.prepare(
        "SELECT * FROM blog_posts WHERE draft = 0 AND unlisted = 0 ORDER BY date DESC LIMIT 50",
      ).all<BlogPostRow>();

      const posts = result.results ?? [];
      const xml = buildRssXml(posts);

      response = new Response(xml, {
        headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
      });
    } catch {
      // D1 unavailable
    }
  }

  if (!response) {
    const xml = buildRssXml([]);
    return c.body(xml, 200, { "Content-Type": "application/rss+xml; charset=utf-8" });
  }

  return response;
});

export { blog, rowToPost, getBlogPostRow };
export type { BlogPostRow };
