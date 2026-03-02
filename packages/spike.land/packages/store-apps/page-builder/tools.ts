/**
 * Page Builder — Standalone Tool Definitions
 *
 * Dynamic page lifecycle (create, read, update, delete, publish, clone),
 * block CRUD, AI-powered page generation, page review, templates & SEO.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Prisma } from "@/generated/prisma";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { safeToolCall, textResult } from "../shared/tool-helpers";

/* ── Sanitization ─────────────────────────────────────────────────────── */

function sanitizeCss(css: string): string {
  const normalized = css.replace(/\\([0-9a-fA-F]{1,6})\s?/g, (_, hex: string) =>
    String.fromCodePoint(parseInt(hex, 16)),
  );
  return normalized
    .replace(/expression\s*\(/gi, "/* blocked */")
    .replace(/javascript\s*:/gi, "/* blocked */")
    .replace(/@import\b[^;]*/gi, "/* blocked */")
    .replace(/url\s*\(/gi, "/* blocked */")
    .replace(/<\/style/gi, "/* blocked */");
}

/* ── Enums & Constants ────────────────────────────────────────────────── */

const PageLayoutEnum = z.enum([
  "LANDING",
  "FEATURE",
  "STORE",
  "DASHBOARD",
  "ARTICLE",
  "GALLERY",
  "CUSTOM",
]);

const PageStatusEnum = z.enum(["DRAFT", "PUBLISHED", "ARCHIVED"]);

const BLOCK_TYPES = [
  "HERO",
  "FEATURE_GRID",
  "FEATURE_LIST",
  "CTA",
  "TESTIMONIALS",
  "PRICING",
  "STATS",
  "GALLERY",
  "FAQ",
  "FOOTER",
  "COMPARISON_TABLE",
  "APP_GRID",
  "MARKDOWN",
  "CUSTOM_REACT",
] as const;

const PAGE_LAYOUTS = [
  "LANDING",
  "FEATURE",
  "STORE",
  "DASHBOARD",
  "ARTICLE",
  "GALLERY",
  "CUSTOM",
] as const;

const THEME_STYLES = ["modern", "minimal", "bold", "playful"] as const;

/* ── Page Schemas ─────────────────────────────────────────────────────── */

const CreatePageSchema = z.object({
  slug: z.string().min(1).describe("URL slug for the page."),
  title: z.string().min(1).describe("Page title."),
  description: z.string().optional().describe("Page description."),
  layout: PageLayoutEnum.optional().default("LANDING").describe("Page layout type."),
  themeData: z.record(z.string(), z.unknown()).optional().describe("Theme configuration data."),
  tags: z.array(z.string()).optional().describe("Tags for categorisation."),
  customCss: z.string().optional().describe("Custom CSS for the page."),
});

const GetPageSchema = z.object({
  slug: z.string().optional().describe("Page slug to look up."),
  pageId: z.string().optional().describe("Page ID to look up."),
});

const ListPagesSchema = z.object({
  status: PageStatusEnum.optional().describe("Filter by page status."),
  layout: PageLayoutEnum.optional().describe("Filter by page layout."),
  search: z.string().optional().describe("Search title and description."),
  page: z.number().int().min(1).optional().default(1).describe("Page number (default 1)."),
  pageSize: z
    .number()
    .int()
    .min(1)
    .max(100)
    .optional()
    .default(20)
    .describe("Results per page (default 20)."),
});

const UpdatePageSchema = z.object({
  pageId: z.string().describe("ID of the page to update."),
  title: z.string().min(1).optional().describe("New title."),
  description: z.string().optional().describe("New description."),
  layout: PageLayoutEnum.optional().describe("New layout."),
  themeData: z.record(z.string(), z.unknown()).optional().describe("New theme data."),
  tags: z.array(z.string()).optional().describe("New tags."),
  customCss: z.string().optional().describe("New custom CSS."),
  seoTitle: z.string().optional().describe("SEO title override."),
  seoDescription: z.string().optional().describe("SEO description override."),
  ogImageUrl: z.string().url().optional().describe("Open Graph image URL."),
});

const DeletePageSchema = z.object({ pageId: z.string().describe("ID of the page to archive.") });
const PublishPageSchema = z.object({ pageId: z.string().describe("ID of the page to publish.") });
const ClonePageSchema = z.object({
  pageId: z.string().describe("ID of the source page to clone."),
  newSlug: z.string().min(1).describe("URL slug for the cloned page."),
});

/* ── Block Schemas ─────────────────────────────────────────────────────── */

const AddBlockSchema = z.object({
  pageId: z.string().min(1).describe("ID of the DynamicPage to add the block to."),
  blockType: z.enum(BLOCK_TYPES).describe("Type of block to add."),
  content: z
    .record(z.string(), z.unknown())
    .describe("Block content (validated against the block type schema)."),
  variant: z.string().optional().describe("Optional visual variant for the block."),
  sortOrder: z
    .number()
    .int()
    .optional()
    .describe("Position in the page. Auto-assigned if omitted."),
  isVisible: z
    .boolean()
    .optional()
    .default(true)
    .describe("Whether the block is visible on the page."),
});

const UpdateBlockSchema = z.object({
  blockId: z.string().min(1).describe("ID of the PageBlock to update."),
  content: z.record(z.string(), z.unknown()).optional().describe("Updated block content."),
  variant: z.string().optional().describe("Updated visual variant."),
  isVisible: z.boolean().optional().describe("Updated visibility."),
});

const DeleteBlockSchema = z.object({
  blockId: z.string().min(1).describe("ID of the PageBlock to delete."),
});

const ReorderBlocksSchema = z.object({
  pageId: z.string().min(1).describe("ID of the DynamicPage."),
  blockIds: z
    .array(z.string().min(1))
    .min(1)
    .describe("Ordered array of block IDs defining the new sort order."),
});

const ListBlockTypesSchema = z.object({});

const GetBlockSchema = z.object({
  blockId: z.string().min(1).describe("ID of the PageBlock to retrieve."),
});

/* ── AI Schemas ────────────────────────────────────────────────────────── */

const GeneratePageSchema = z.object({
  prompt: z.string().min(1).describe("Description of the page to generate."),
  slug: z
    .string()
    .min(1)
    .optional()
    .describe("URL slug for the page (auto-generated from prompt if omitted)."),
  layout: z.enum(PAGE_LAYOUTS).optional().describe("Page layout type. Defaults to LANDING."),
});

const EnhanceBlockSchema = z.object({
  blockId: z.string().min(1).describe("ID of the PageBlock to enhance."),
  instruction: z.string().min(1).describe("How to improve the block content."),
});

const SuggestLayoutSchema = z.object({
  useCase: z.string().min(1).describe("Description of what the page is for."),
});

const GenerateThemeSchema = z.object({
  brandDescription: z.string().min(1).describe("Description of the brand identity."),
  primaryColor: z
    .string()
    .optional()
    .describe("Primary brand color in hex format (e.g. '#3B82F6')."),
  style: z.enum(THEME_STYLES).optional().describe("Visual style preset. Defaults to 'modern'."),
});

const PopulateStoreSchema = z.object({
  pageSlug: z.string().min(1).describe("Slug of the target page to populate with app entries."),
});

/* ── Review Schema ─────────────────────────────────────────────────────── */

const PageReviewSchema = z.object({
  route: z.string().describe("Page route/slug to review, e.g. /blog or /store"),
  reviewType: z
    .enum(["accessibility", "content", "performance", "general"])
    .optional()
    .describe("Type of review to perform"),
});

/* ── Template Schemas ──────────────────────────────────────────────────── */

const TemplateCategoryEnum = z.enum(["landing", "portfolio", "blog", "marketing", "blank"]);
const ListTemplatesSchema = z.object({
  category: TemplateCategoryEnum.optional().describe("Filter templates by category."),
});
const ApplyTemplateSchema = z.object({
  page_id: z.string().min(1).describe("ID of the page to apply the template to."),
  template_id: z.string().min(1).describe("ID of the template to apply."),
});
const GetSeoSchema = z.object({
  page_id: z.string().min(1).describe("ID of the page to analyse."),
});
const SetSeoSchema = z.object({
  page_id: z.string().min(1).describe("ID of the page to update."),
  title: z.string().max(60).optional().describe("SEO title (max 60 characters)."),
  description: z
    .string()
    .max(160)
    .optional()
    .describe("SEO meta description (max 160 characters)."),
  keywords: z.array(z.string()).optional().describe("List of SEO keywords."),
  og_image: z.string().url().optional().describe("Open Graph image URL."),
});

/* ── AI Helpers ────────────────────────────────────────────────────────── */

function generateSlugFromPrompt(prompt: string): string {
  return prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

function extractKeywords(prompt: string): string[] {
  const words = prompt
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, "")
    .split(/\s+/)
    .filter((w) => w.length > 3);
  return [...new Set(words)].slice(0, 5);
}

function shiftHexColor(hex: string, amount: number): string {
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  const r = Math.min(255, Math.max(0, ((num >> 16) & 0xff) + amount));
  const g = Math.min(255, Math.max(0, ((num >> 8) & 0xff) + amount));
  const b = Math.min(255, Math.max(0, (num & 0xff) + amount));
  return `#${((r << 16) | (g << 8) | b).toString(16).padStart(6, "0")}`;
}

/* ── Review Helpers ────────────────────────────────────────────────────── */

interface DynamicPageRecord {
  id: string;
  slug: string;
  title: string;
  description: string | null;
  status: string;
  layout: string;
  seoTitle: string | null;
  seoDescription: string | null;
  tags: string[];
  customCss: string | null;
  viewCount: number;
  createdAt: Date;
  updatedAt: Date;
  blocks: Array<{ type: string; content: unknown }>;
}

function extractBlockContent(blocks: Array<{ type: string; content: unknown }>): string {
  return blocks
    .map((b) => {
      if (typeof b.content === "string") return b.content;
      if (b.content && typeof b.content === "object") return JSON.stringify(b.content);
      return "";
    })
    .join(" ");
}

function estimateWordCount(text: string): number {
  if (!text) return 0;
  return text
    .replace(/<[^>]*>/g, " ")
    .split(/\s+/)
    .filter(Boolean).length;
}

function buildGeneralReview(page: DynamicPageRecord): string {
  const content = extractBlockContent(page.blocks);
  const wordCount = estimateWordCount(content);
  const isPublished = page.status === "PUBLISHED";
  return [
    `## General Review: /${page.slug}`,
    "",
    `| Field | Value |`,
    `| --- | --- |`,
    `| **Exists in DB** | Yes |`,
    `| **Title** | ${page.title} |`,
    `| **Description** | ${page.description || "(none)"} |`,
    `| **Status** | ${page.status} |`,
    `| **Layout** | ${page.layout} |`,
    `| **Published** | ${isPublished ? "Yes" : "No"} |`,
    `| **Views** | ${page.viewCount} |`,
    `| **Tags** | ${page.tags.length > 0 ? page.tags.join(", ") : "(none)"} |`,
    `| **Blocks** | ${page.blocks.length} |`,
    `| **Last Updated** | ${page.updatedAt.toISOString()} |`,
    `| **Word Count (est.)** | ${wordCount} |`,
  ].join("\n");
}

function buildContentReview(page: DynamicPageRecord): string {
  const titleLen = page.title.length;
  const descLen = page.description?.length ?? 0;
  const seoTitleLen = page.seoTitle?.length ?? 0;
  const seoDescLen = page.seoDescription?.length ?? 0;
  const content = extractBlockContent(page.blocks);
  const wordCount = estimateWordCount(content);
  const titleStatus =
    titleLen < 50
      ? `Short (${titleLen} chars) -- ideal is 50-60 chars`
      : titleLen <= 60
        ? `Good (${titleLen} chars)`
        : `Long (${titleLen} chars) -- ideal is 50-60 chars`;
  const descStatus =
    descLen === 0
      ? "Missing -- add a description"
      : descLen < 150
        ? `Short (${descLen} chars) -- ideal is 150-160 chars`
        : descLen <= 160
          ? `Good (${descLen} chars)`
          : `Long (${descLen} chars) -- ideal is 150-160 chars`;
  return [
    `## Content Review: /${page.slug}`,
    "",
    `### Title Analysis`,
    `- ${titleStatus}`,
    seoTitleLen > 0 ? `- SEO title: ${seoTitleLen} chars` : "- SEO title: not set",
    "",
    `### Description Analysis`,
    `- ${descStatus}`,
    seoDescLen > 0 ? `- SEO description: ${seoDescLen} chars` : "- SEO description: not set",
    "",
    `### Content Structure`,
    `- Word count (est.): ${wordCount}`,
    `- Block count: ${page.blocks.length}`,
    `- Block types: ${[...new Set(page.blocks.map((b) => b.type))].join(", ") || "(none)"}`,
  ].join("\n");
}

function buildAccessibilityReview(page: DynamicPageRecord): string {
  const content = extractBlockContent(page.blocks);
  const imgTags = content.match(/<img[^>]*>/gi) ?? [];
  const imgsWithAlt = imgTags.filter((tag) => /alt\s*=\s*"[^"]+"/i.test(tag));
  const imgsMissingAlt = imgTags.length - imgsWithAlt.length;
  return [
    `## Accessibility Review: /${page.slug}`,
    "",
    `### Alt Text`,
    `- Images found: ${imgTags.length}`,
    imgTags.length > 0 ? `- Images with alt text: ${imgsWithAlt.length}` : "",
    imgsMissingAlt > 0
      ? "- **Suggestion:** Add descriptive alt text to all images"
      : imgTags.length > 0
        ? "- All images have alt text"
        : "",
    "",
    `### Semantic HTML Suggestions`,
    `- Ensure interactive elements have focus indicators`,
    `- Use landmark roles (nav, main, aside) for page regions`,
    `- Provide skip-to-content links for keyboard navigation`,
    page.customCss ? "- Custom CSS detected -- verify it doesn't break screen reader access" : "",
  ]
    .filter(Boolean)
    .join("\n");
}

function buildPerformanceReview(page: DynamicPageRecord): string {
  const content = extractBlockContent(page.blocks);
  const contentSizeBytes = new TextEncoder().encode(content).length;
  const contentSizeKB = (contentSizeBytes / 1024).toFixed(1);
  const imgTags = content.match(/<img[^>]*>/gi) ?? [];
  const suggestions: string[] = [];
  if (contentSizeBytes > 100_000) {
    suggestions.push("- Content exceeds 100KB -- consider lazy loading or pagination");
  }
  if (imgTags.length > 10) {
    suggestions.push("- Many images detected -- use lazy loading for off-screen images");
  }
  if (page.blocks.length > 20) {
    suggestions.push("- Many blocks -- consider paginating or lazy-loading below-fold content");
  }
  if (suggestions.length === 0) suggestions.push("- No major performance concerns detected");
  return [
    `## Performance Review: /${page.slug}`,
    "",
    `### Content Size`,
    `- Estimated content size: ${contentSizeKB} KB`,
    `- Block count: ${page.blocks.length}`,
    `- Image count: ${imgTags.length}`,
    "",
    `### Optimization Suggestions`,
    ...suggestions,
  ].join("\n");
}

function buildStaticRouteAnalysis(route: string): string {
  const knownPrefixes = [
    "/blog",
    "/store",
    "/apps",
    "/admin",
    "/settings",
    "/gallery",
    "/orbit",
    "/career",
    "/clean",
    "/my-apps",
    "/api",
  ];
  const matchedPrefix = knownPrefixes.find(
    (prefix) => route === prefix || route.startsWith(prefix + "/"),
  );
  return [
    `## Route Analysis: ${route}`,
    "",
    `This route was not found as a dynamic page in the database.`,
    `It may be a **static/built-in route** served by the Next.js App Router.`,
    "",
    matchedPrefix
      ? `- Matched known prefix: \`${matchedPrefix}\``
      : `- No known route prefix matched`,
    `- Route segments: ${route.split("/").filter(Boolean).length}`,
    `- To review this page, check the corresponding source files under \`src/app${route}\``,
  ].join("\n");
}

/* ── Template Catalogue ────────────────────────────────────────────────── */

interface PageTemplate {
  id: string;
  name: string;
  category: "landing" | "portfolio" | "blog" | "marketing" | "blank";
  description: string;
  thumbnail: string;
  layout: string;
  defaultBlocks: string[];
}

const TEMPLATES: PageTemplate[] = [
  {
    id: "tpl-landing-hero",
    name: "Hero Landing",
    category: "landing",
    description: "Full-width hero with CTA button and feature grid below.",
    thumbnail: "/thumbnails/templates/landing-hero.png",
    layout: "LANDING",
    defaultBlocks: ["HERO", "FEATURES", "CTA"],
  },
  {
    id: "tpl-landing-minimal",
    name: "Minimal Landing",
    category: "landing",
    description: "Clean, text-focused landing page with a single conversion goal.",
    thumbnail: "/thumbnails/templates/landing-minimal.png",
    layout: "LANDING",
    defaultBlocks: ["HERO", "CTA"],
  },
  {
    id: "tpl-portfolio-grid",
    name: "Portfolio Grid",
    category: "portfolio",
    description: "Masonry image grid with project detail overlays.",
    thumbnail: "/thumbnails/templates/portfolio-grid.png",
    layout: "GALLERY",
    defaultBlocks: ["GALLERY", "BIO", "CONTACT"],
  },
  {
    id: "tpl-portfolio-case-study",
    name: "Case Study",
    category: "portfolio",
    description: "Long-form case study layout with sections for problem, solution, and results.",
    thumbnail: "/thumbnails/templates/portfolio-case-study.png",
    layout: "ARTICLE",
    defaultBlocks: ["HERO", "RICH_TEXT", "GALLERY", "CTA"],
  },
  {
    id: "tpl-blog-list",
    name: "Blog Index",
    category: "blog",
    description: "Paginated article listing with sidebar and category filters.",
    thumbnail: "/thumbnails/templates/blog-list.png",
    layout: "ARTICLE",
    defaultBlocks: ["ARTICLE_LIST", "SIDEBAR"],
  },
  {
    id: "tpl-blog-post",
    name: "Blog Post",
    category: "blog",
    description: "Readable single-post layout with table of contents and author bio.",
    thumbnail: "/thumbnails/templates/blog-post.png",
    layout: "ARTICLE",
    defaultBlocks: ["HERO", "RICH_TEXT", "AUTHOR_BIO", "RELATED_POSTS"],
  },
  {
    id: "tpl-marketing-product",
    name: "Product Page",
    category: "marketing",
    description: "E-commerce-style product spotlight with pricing table and testimonials.",
    thumbnail: "/thumbnails/templates/marketing-product.png",
    layout: "STORE",
    defaultBlocks: ["HERO", "FEATURES", "PRICING", "TESTIMONIALS", "CTA"],
  },
  {
    id: "tpl-marketing-event",
    name: "Event Landing",
    category: "marketing",
    description: "Time-sensitive event page with countdown, speakers, and registration form.",
    thumbnail: "/thumbnails/templates/marketing-event.png",
    layout: "LANDING",
    defaultBlocks: ["HERO", "COUNTDOWN", "SPEAKERS", "SCHEDULE", "CTA"],
  },
  {
    id: "tpl-blank",
    name: "Blank Canvas",
    category: "blank",
    description: "Start from scratch with no pre-built blocks.",
    thumbnail: "/thumbnails/templates/blank.png",
    layout: "CUSTOM",
    defaultBlocks: [],
  },
];

/* ── SEO Helpers ────────────────────────────────────────────────────────── */

interface SeoAnalysis {
  score: number;
  titleStatus: string;
  descriptionStatus: string;
  keywordCount: number;
  ogImagePresent: boolean;
  recommendations: string[];
}

function analyseSeo(page: {
  title: string;
  seoTitle: string | null;
  seoDescription: string | null;
  ogImageUrl: string | null;
  description: string | null;
}): SeoAnalysis {
  const recommendations: string[] = [];
  let score = 100;
  const effectiveTitle = page.seoTitle ?? page.title;
  const titleLen = effectiveTitle.length;
  let titleStatus: string;
  if (titleLen === 0) {
    titleStatus = "MISSING (critical)";
    score -= 30;
    recommendations.push("Add an SEO title. Aim for 50-60 characters.");
  } else if (titleLen < 30) {
    titleStatus = `TOO_SHORT (${titleLen} chars — aim for 50-60)`;
    score -= 10;
    recommendations.push("Lengthen the SEO title to 50-60 characters for better click-through.");
  } else if (titleLen > 60) {
    titleStatus = `TOO_LONG (${titleLen} chars — truncated in SERPs)`;
    score -= 10;
    recommendations.push("Shorten the SEO title to 60 characters to avoid truncation.");
  } else titleStatus = `GOOD (${titleLen} chars)`;

  const effectiveDesc = page.seoDescription ?? page.description ?? "";
  const descLen = effectiveDesc.length;
  let descriptionStatus: string;
  if (descLen === 0) {
    descriptionStatus = "MISSING (recommended)";
    score -= 20;
    recommendations.push("Add a meta description (120-160 characters) to improve SERP snippets.");
  } else if (descLen < 70) {
    descriptionStatus = `TOO_SHORT (${descLen} chars — aim for 120-160)`;
    score -= 10;
    recommendations.push("Expand the meta description to 120-160 characters.");
  } else if (descLen > 160) {
    descriptionStatus = `TOO_LONG (${descLen} chars — truncated in SERPs)`;
    score -= 5;
    recommendations.push("Trim the meta description to 160 characters.");
  } else descriptionStatus = `GOOD (${descLen} chars)`;

  const ogImagePresent = Boolean(page.ogImageUrl);
  if (!ogImagePresent) {
    score -= 15;
    recommendations.push(
      "Add an Open Graph image (1200x630px recommended) for rich social previews.",
    );
  }
  const keywordCount = 0;
  if (keywordCount === 0) {
    recommendations.push(
      "Consider using `pages_set_seo` to add keywords that reflect the page topic.",
    );
    score -= 5;
  }
  return {
    score: Math.max(0, score),
    titleStatus,
    descriptionStatus,
    keywordCount,
    ogImagePresent,
    recommendations,
  };
}

/* ── Tool Definitions ─────────────────────────────────────────────────── */

export const pageBuilderTools: StandaloneToolDefinition[] = [
  // ── pages_create ──
  {
    name: "pages_create",
    description: "Create a new dynamic page with a unique slug.",
    category: "pages",
    tier: "free",
    inputSchema: CreatePageSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const {
        slug,
        title,
        description,
        layout = "LANDING",
        themeData,
        tags,
        customCss,
      } = input as z.infer<typeof CreatePageSchema>;
      return safeToolCall("pages_create", async () => {
        const { isReservedSlug } = await import("@/lib/dynamic-pages/block-schemas");
        if (isReservedSlug(slug)) {
          return textResult("**Error: VALIDATION_ERROR**\nSlug is reserved.\n**Retryable:** false");
        }
        const prisma = (await import("@/lib/prisma")).default;
        const existing = await prisma.dynamicPage.findUnique({
          where: { slug },
          select: { id: true },
        });
        if (existing) {
          return textResult(
            "**Error: CONFLICT**\nA page with this slug already exists.\n**Retryable:** false",
          );
        }
        const page = await prisma.dynamicPage.create({
          data: {
            slug,
            title,
            description: description ?? null,
            layout,
            status: "DRAFT",
            ...(themeData ? { themeData: themeData as Prisma.InputJsonValue } : {}),
            tags: tags ?? [],
            customCss: customCss ? sanitizeCss(customCss) : null,
            userId: ctx.userId,
          },
          select: {
            id: true,
            slug: true,
            title: true,
            layout: true,
            status: true,
            createdAt: true,
          },
        });
        return textResult(
          `**Page Created**\n\n**ID:** ${page.id}\n**Slug:** ${page.slug}\n**Title:** ${page.title}\n**Layout:** ${page.layout}\n**Status:** ${page.status}\n**Created:** ${page.createdAt.toISOString()}`,
        );
      });
    },
  },
  // ── pages_get ──
  {
    name: "pages_get",
    description: "Get a dynamic page by slug or ID, including its blocks.",
    category: "pages",
    tier: "free",
    inputSchema: GetPageSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { slug, pageId } = input as z.infer<typeof GetPageSchema>;
      return safeToolCall("pages_get", async () => {
        if (!slug && !pageId) {
          return textResult(
            "**Error: VALIDATION_ERROR**\nProvide either slug or pageId.\n**Retryable:** false",
          );
        }
        const prisma = (await import("@/lib/prisma")).default;
        const where = pageId ? { id: pageId } : { slug: slug as string };
        const page = await prisma.dynamicPage.findUnique({
          where,
          include: { blocks: { orderBy: { sortOrder: "asc" as const } } },
        });
        if (!page) return textResult("**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false");
        return textResult(
          `**${page.title}**\n\n**ID:** ${page.id}\n**Slug:** ${page.slug}\n**Layout:** ${page.layout}\n**Status:** ${page.status}\n` +
            `**Description:** ${page.description ?? "(none)"}\n**Tags:** ${
              (page.tags ?? []).length > 0 ? (page.tags ?? []).join(", ") : "(none)"
            }\n` +
            `**View Count:** ${page.viewCount}\n**Published:** ${
              page.publishedAt?.toISOString() ?? "(not published)"
            }\n` +
            `**Created:** ${page.createdAt.toISOString()}\n**Updated:** ${page.updatedAt.toISOString()}\n**Blocks:** ${page.blocks.length}\n\n` +
            (page.blocks.length > 0
              ? page.blocks
                  .map(
                    (b) =>
                      `  - [${b.sortOrder}] ${b.blockType}${b.variant ? ` (${b.variant})` : ""}${
                        b.isVisible ? "" : " [hidden]"
                      }`,
                  )
                  .join("\n")
              : "  (no blocks)"),
        );
      });
    },
  },
  // ── pages_list ──
  {
    name: "pages_list",
    description: "List dynamic pages with optional status, layout, and search filters.",
    category: "pages",
    tier: "free",
    inputSchema: ListPagesSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const {
        status,
        layout,
        search,
        page = 1,
        pageSize = 20,
      } = input as z.infer<typeof ListPagesSchema>;
      return safeToolCall("pages_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const where: Prisma.DynamicPageWhereInput = { userId: ctx.userId };
        if (status) where.status = status;
        if (layout) where.layout = layout;
        if (search) {
          where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            {
              description: { contains: search, mode: "insensitive" },
            },
          ];
        }
        const [pages, total] = await Promise.all([
          prisma.dynamicPage.findMany({
            where,
            select: {
              id: true,
              slug: true,
              title: true,
              layout: true,
              status: true,
              viewCount: true,
              publishedAt: true,
              updatedAt: true,
            },
            orderBy: { updatedAt: "desc" },
            skip: (page - 1) * pageSize,
            take: pageSize,
          }),
          prisma.dynamicPage.count({ where }),
        ]);
        if (pages.length === 0) return textResult("No pages found matching the given filters.");
        let text = `**Pages (${pages.length} of ${total}):**\n\n`;
        for (const p of pages) {
          text += `- **${p.title}** (${p.slug})\n  ID: ${p.id} | Layout: ${p.layout} | Status: ${p.status}\n  Views: ${p.viewCount} | Updated: ${p.updatedAt.toISOString()}${
            p.publishedAt ? ` | Published: ${p.publishedAt.toISOString()}` : ""
          }\n\n`;
        }
        text += `Page ${page} of ${Math.ceil(total / pageSize)} (${total} total)`;
        return textResult(text);
      });
    },
  },
  // ── pages_update ──
  {
    name: "pages_update",
    description: "Update a dynamic page's metadata and create a version snapshot.",
    category: "pages",
    tier: "free",
    inputSchema: UpdatePageSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const {
        pageId,
        title,
        description,
        layout,
        themeData,
        tags,
        customCss,
        seoTitle,
        seoDescription,
        ogImageUrl,
      } = input as z.infer<typeof UpdatePageSchema>;
      return safeToolCall("pages_update", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const current = await prisma.dynamicPage.findUnique({ where: { id: pageId } });
        if (!current) {
          return textResult("**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false");
        }
        const latestVersion = await prisma.pageVersion.findFirst({
          where: { pageId },
          orderBy: { version: "desc" },
          select: { version: true },
        });
        const nextVersion = (latestVersion?.version ?? 0) + 1;
        await prisma.pageVersion.create({
          data: {
            pageId,
            version: nextVersion,
            snapshot: {
              title: current.title,
              description: current.description,
              layout: current.layout,
              themeData: current.themeData,
              tags: current.tags,
              customCss: current.customCss,
              seoTitle: current.seoTitle,
              seoDescription: current.seoDescription,
              ogImageUrl: current.ogImageUrl,
            } as Prisma.InputJsonValue,
            changedBy: ctx.userId,
          },
        });
        const updateData: Prisma.DynamicPageUpdateInput = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (layout !== undefined) updateData.layout = layout;
        if (themeData !== undefined) updateData.themeData = themeData as Prisma.InputJsonValue;
        if (tags !== undefined) updateData.tags = tags;
        if (customCss !== undefined) updateData.customCss = sanitizeCss(customCss);
        if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
        if (seoDescription !== undefined) updateData.seoDescription = seoDescription;
        if (ogImageUrl !== undefined) updateData.ogImageUrl = ogImageUrl;
        const updated = await prisma.dynamicPage.update({
          where: { id: pageId },
          data: updateData,
          select: {
            id: true,
            slug: true,
            title: true,
            layout: true,
            status: true,
            updatedAt: true,
          },
        });
        return textResult(
          `**Page Updated (v${nextVersion} snapshot saved)**\n\n**ID:** ${updated.id}\n**Slug:** ${updated.slug}\n**Title:** ${updated.title}\n**Layout:** ${updated.layout}\n**Status:** ${updated.status}\n**Updated:** ${updated.updatedAt.toISOString()}`,
        );
      });
    },
  },
  // ── pages_delete ──
  {
    name: "pages_delete",
    description: "Soft-delete a dynamic page by setting its status to ARCHIVED.",
    category: "pages",
    tier: "free",
    inputSchema: DeletePageSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { pageId } = input as z.infer<typeof DeletePageSchema>;
      return safeToolCall("pages_delete", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const page = await prisma.dynamicPage.findUnique({
          where: { id: pageId },
          select: { id: true, slug: true, title: true },
        });
        if (!page) return textResult("**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false");
        await prisma.dynamicPage.update({ where: { id: pageId }, data: { status: "ARCHIVED" } });
        return textResult(
          `**Page Archived**\n\n**ID:** ${page.id}\n**Slug:** ${page.slug}\n**Title:** ${page.title}\nStatus set to ARCHIVED.`,
        );
      });
    },
  },
  // ── pages_publish ──
  {
    name: "pages_publish",
    description: "Publish a dynamic page, making it publicly accessible at /p/{slug}.",
    category: "pages",
    tier: "free",
    inputSchema: PublishPageSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { pageId } = input as z.infer<typeof PublishPageSchema>;
      return safeToolCall("pages_publish", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const page = await prisma.dynamicPage.findUnique({
          where: { id: pageId },
          select: { id: true, slug: true, title: true, status: true },
        });
        if (!page) return textResult("**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false");
        const updated = await prisma.dynamicPage.update({
          where: { id: pageId },
          data: { status: "PUBLISHED", publishedAt: new Date() },
          select: { id: true, slug: true, title: true, status: true, publishedAt: true },
        });
        return textResult(
          `**Page Published**\n\n**ID:** ${updated.id}\n**Title:** ${updated.title}\n**Status:** ${updated.status}\n**Published:** ${updated.publishedAt?.toISOString()}\n**URL:** /p/${updated.slug}`,
        );
      });
    },
  },
  // ── pages_clone ──
  {
    name: "pages_clone",
    description: "Clone an existing page and all its blocks to a new slug.",
    category: "pages",
    tier: "free",
    inputSchema: ClonePageSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { pageId, newSlug } = input as z.infer<typeof ClonePageSchema>;
      return safeToolCall("pages_clone", async () => {
        const { isReservedSlug } = await import("@/lib/dynamic-pages/block-schemas");
        if (isReservedSlug(newSlug)) {
          return textResult("**Error: VALIDATION_ERROR**\nSlug is reserved.\n**Retryable:** false");
        }
        const prisma = (await import("@/lib/prisma")).default;
        const existingSlug = await prisma.dynamicPage.findUnique({
          where: { slug: newSlug },
          select: { id: true },
        });
        if (existingSlug) {
          return textResult(
            "**Error: CONFLICT**\nA page with this slug already exists.\n**Retryable:** false",
          );
        }
        const source = await prisma.dynamicPage.findUnique({
          where: { id: pageId },
          include: { blocks: { orderBy: { sortOrder: "asc" as const } } },
        });
        if (!source) {
          return textResult("**Error: NOT_FOUND**\nSource page not found.\n**Retryable:** false");
        }
        const cloned = await prisma.dynamicPage.create({
          data: {
            slug: newSlug,
            title: source.title,
            description: source.description,
            layout: source.layout,
            status: "DRAFT",
            ...(source.themeData ? { themeData: source.themeData as Prisma.InputJsonValue } : {}),
            tags: source.tags,
            ...(source.customCss ? { customCss: sanitizeCss(source.customCss) } : {}),
            seoTitle: source.seoTitle,
            seoDescription: source.seoDescription,
            ogImageUrl: source.ogImageUrl,
            userId: ctx.userId,
            blocks: {
              create: source.blocks.map((block) => ({
                blockType: block.blockType,
                variant: block.variant,
                content: block.content as Prisma.InputJsonValue,
                sortOrder: block.sortOrder,
                isVisible: block.isVisible,
              })),
            },
          },
          select: {
            id: true,
            slug: true,
            title: true,
            layout: true,
            status: true,
            createdAt: true,
          },
        });
        const blockCount = source.blocks.length;
        return textResult(
          `**Page Cloned**\n\n**Source ID:** ${source.id}\n**New ID:** ${cloned.id}\n**Slug:** ${cloned.slug}\n**Title:** ${cloned.title}\n**Layout:** ${cloned.layout}\n**Status:** ${cloned.status}\n**Blocks Copied:** ${blockCount}\n**Created:** ${cloned.createdAt.toISOString()}`,
        );
      });
    },
  },
  // ── blocks_add ──
  {
    name: "blocks_add",
    description:
      "Add a new block to a dynamic page. Content is validated against the block type schema.",
    category: "blocks",
    tier: "free",
    inputSchema: AddBlockSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { pageId, blockType, content, variant, sortOrder, isVisible } = input as z.infer<
        typeof AddBlockSchema
      >;
      return safeToolCall("blocks_add", async () => {
        const { validateBlockContent } = await import("@/lib/dynamic-pages/block-schemas");
        const validation = validateBlockContent(blockType, content);
        if (!validation.success) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nInvalid content for block type ${blockType}: ${validation.error}\n**Retryable:** false`,
          );
        }
        const prisma = (await import("@/lib/prisma")).default;
        let resolvedSortOrder = sortOrder;
        if (resolvedSortOrder === undefined) {
          const maxBlock = await prisma.pageBlock.findFirst({
            where: { pageId },
            orderBy: { sortOrder: "desc" },
            select: { sortOrder: true },
          });
          resolvedSortOrder = maxBlock ? maxBlock.sortOrder + 1 : 0;
        }
        const block = await prisma.pageBlock.create({
          data: {
            pageId,
            blockType,
            content: validation.data as Prisma.InputJsonValue,
            variant: variant ?? null,
            sortOrder: resolvedSortOrder,
            isVisible: isVisible ?? true,
          },
        });
        return textResult(
          `**Block Created**\n\n**ID:** ${block.id}\n**Page ID:** ${block.pageId}\n**Type:** ${block.blockType}\n**Variant:** ${
            block.variant ?? "none"
          }\n**Sort Order:** ${block.sortOrder}\n**Visible:** ${
            block.isVisible ? "Yes" : "No"
          }\n**Created:** ${block.createdAt.toISOString()}`,
        );
      });
    },
  },
  // ── blocks_update ──
  {
    name: "blocks_update",
    description:
      "Update an existing page block. If content is provided, it is validated against the block's type schema.",
    category: "blocks",
    tier: "free",
    inputSchema: UpdateBlockSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { blockId, content, variant, isVisible } = input as z.infer<typeof UpdateBlockSchema>;
      return safeToolCall("blocks_update", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const existing = await prisma.pageBlock.findUnique({ where: { id: blockId } });
        if (!existing) {
          return textResult(
            `**Error: NOT_FOUND**\nBlock with ID "${blockId}" not found.\n**Retryable:** false`,
          );
        }
        if (content !== undefined) {
          const { validateBlockContent } = await import("@/lib/dynamic-pages/block-schemas");
          const validation = validateBlockContent(existing.blockType, content);
          if (!validation.success) {
            return textResult(
              `**Error: VALIDATION_ERROR**\nInvalid content for block type ${existing.blockType}: ${validation.error}\n**Retryable:** false`,
            );
          }
        }
        const updateData: Prisma.PageBlockUpdateInput = {};
        if (content !== undefined) updateData.content = content as Prisma.InputJsonValue;
        if (variant !== undefined) updateData.variant = variant;
        if (isVisible !== undefined) updateData.isVisible = isVisible;
        const updated = await prisma.pageBlock.update({ where: { id: blockId }, data: updateData });
        return textResult(
          `**Block Updated**\n\n**ID:** ${updated.id}\n**Page ID:** ${updated.pageId}\n**Type:** ${updated.blockType}\n**Variant:** ${
            updated.variant ?? "none"
          }\n**Sort Order:** ${updated.sortOrder}\n**Visible:** ${
            updated.isVisible ? "Yes" : "No"
          }\n**Updated:** ${updated.updatedAt.toISOString()}`,
        );
      });
    },
  },
  // ── blocks_delete ──
  {
    name: "blocks_delete",
    description: "Delete a page block by ID.",
    category: "blocks",
    tier: "free",
    inputSchema: DeleteBlockSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { blockId } = input as z.infer<typeof DeleteBlockSchema>;
      return safeToolCall("blocks_delete", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        await prisma.pageBlock.delete({ where: { id: blockId } });
        return textResult(`**Block Deleted**\n\nBlock "${blockId}" has been permanently removed.`);
      });
    },
  },
  // ── blocks_reorder ──
  {
    name: "blocks_reorder",
    description: "Reorder blocks on a page by providing an ordered array of block IDs.",
    category: "blocks",
    tier: "free",
    inputSchema: ReorderBlocksSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { pageId, blockIds } = input as z.infer<typeof ReorderBlocksSchema>;
      return safeToolCall("blocks_reorder", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        await prisma.$transaction(
          blockIds.map((id, index) =>
            prisma.pageBlock.update({ where: { id }, data: { sortOrder: index } }),
          ),
        );
        return textResult(
          `**Blocks Reordered**\n\n**Page ID:** ${pageId}\n**New Order:**\n${blockIds
            .map((id, i) => `  ${i}: ${id}`)
            .join("\n")}`,
        );
      });
    },
  },
  // ── blocks_list_types ──
  {
    name: "blocks_list_types",
    description: "List all available block types with descriptions.",
    category: "blocks",
    tier: "free",
    inputSchema: ListBlockTypesSchema.shape,
    handler: async (_input: never, _ctx: ServerContext): Promise<CallToolResult> =>
      safeToolCall("blocks_list_types", async () => {
        const { getBlockTypeDescriptions } = await import("@/lib/dynamic-pages/block-schemas");
        const descriptions = getBlockTypeDescriptions();
        let text = "**Available Block Types:**\n\n";
        for (const [type, desc] of Object.entries(descriptions)) text += `- **${type}**: ${desc}\n`;
        return textResult(text);
      }),
  },
  // ── blocks_get ──
  {
    name: "blocks_get",
    description: "Get a page block by ID with full details.",
    category: "blocks",
    tier: "free",
    inputSchema: GetBlockSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { blockId } = input as z.infer<typeof GetBlockSchema>;
      return safeToolCall("blocks_get", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const block = await prisma.pageBlock.findUnique({ where: { id: blockId } });
        if (!block) {
          return textResult(
            `**Error: NOT_FOUND**\nBlock with ID "${blockId}" not found.\n**Retryable:** false`,
          );
        }
        return textResult(
          `**Block Details**\n\n**ID:** ${block.id}\n**Page ID:** ${block.pageId}\n**Type:** ${block.blockType}\n**Variant:** ${
            block.variant ?? "none"
          }\n**Sort Order:** ${block.sortOrder}\n**Visible:** ${
            block.isVisible ? "Yes" : "No"
          }\n**Created:** ${block.createdAt.toISOString()}\n**Updated:** ${block.updatedAt.toISOString()}\n\n**Content:**\n\`\`\`json\n${JSON.stringify(
            block.content,
            null,
            2,
          )}\n\`\`\``,
        );
      });
    },
  },
  // ── page_ai_generate ──
  {
    name: "page_ai_generate",
    description:
      "Generate a new dynamic page with structured blocks from a text prompt. Creates a DRAFT page with HERO, FEATURE_GRID, and CTA blocks.",
    category: "page-ai",
    tier: "workspace",
    inputSchema: GeneratePageSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { prompt, slug, layout } = input as z.infer<typeof GeneratePageSchema>;
      return safeToolCall("page_ai_generate", async () => {
        const { isReservedSlug } = await import("@/lib/dynamic-pages/block-schemas");
        const baseSlug = slug || generateSlugFromPrompt(prompt);
        if (!baseSlug) {
          return textResult(
            "**Error: VALIDATION_ERROR**\nCould not generate a valid slug from the prompt. Please provide a slug explicitly.\n**Retryable:** false",
          );
        }
        if (isReservedSlug(baseSlug)) {
          return textResult(
            `**Error: VALIDATION_ERROR**\nSlug "${baseSlug}" is reserved and cannot be used.\n**Retryable:** false`,
          );
        }
        const prisma = (await import("@/lib/prisma")).default;
        const existing = await prisma.dynamicPage.findUnique({
          where: { slug: baseSlug },
          select: { id: true },
        });
        if (existing) {
          return textResult(
            `**Error: CONFLICT**\nA page with slug "${baseSlug}" already exists.\n**Retryable:** false`,
          );
        }
        const keywords = extractKeywords(prompt);
        const titleText = prompt.charAt(0).toUpperCase() + prompt.slice(1);
        const heroContent = {
          headline: titleText,
          subheadline: `Discover everything about ${
            keywords.slice(0, 3).join(", ") || "this topic"
          }`,
          ctaText: "Get Started",
          ctaUrl: "#features",
          alignment: "center" as const,
        };
        const featureItems = keywords.slice(0, 3).map((keyword, i) => ({
          title: keyword.charAt(0).toUpperCase() + keyword.slice(1),
          description: `Learn more about ${keyword} and how it can help you.`,
          icon: ["Sparkles", "Zap", "Shield"][i] ?? "Star",
        }));
        while (featureItems.length < 3) {
          const idx = featureItems.length;
          featureItems.push({
            title: `Feature ${idx + 1}`,
            description: `A key feature of ${titleText.toLowerCase()}.`,
            icon: ["Sparkles", "Zap", "Shield"][idx] ?? "Star",
          });
        }
        const featureGridContent = {
          sectionTitle: "Key Features",
          features: featureItems,
          columns: 3,
        };
        const ctaContent = {
          headline: "Ready to get started?",
          description: `Start building with ${keywords[0] || "this"} today.`,
          buttons: [
            { text: "Get Started", url: "/signup", variant: "primary" as const },
            {
              text: "Learn More",
              url: "#features",
              variant: "outline" as const,
            },
          ],
          variant: "centered" as const,
        };
        const page = await prisma.dynamicPage.create({
          data: {
            slug: baseSlug,
            title: titleText,
            description: prompt,
            layout: layout ?? "LANDING",
            status: "DRAFT",
            userId: ctx.userId,
            blocks: {
              create: [
                {
                  blockType: "HERO",
                  content: heroContent as unknown as Prisma.InputJsonValue,
                  sortOrder: 0,
                  isVisible: true,
                },
                {
                  blockType: "FEATURE_GRID",
                  content: featureGridContent as unknown as Prisma.InputJsonValue,
                  sortOrder: 1,
                  isVisible: true,
                },
                {
                  blockType: "CTA",
                  content: ctaContent as unknown as Prisma.InputJsonValue,
                  sortOrder: 2,
                  isVisible: true,
                },
              ],
            },
          },
          include: { blocks: { select: { id: true, blockType: true, sortOrder: true } } },
        });
        let text = `**Page Generated**\n\n**Title:** ${page.title}\n**Slug:** ${page.slug}\n**Layout:** ${page.layout}\n**Status:** ${page.status}\n**Blocks (${page.blocks.length}):**\n`;
        for (const block of page.blocks) {
          text += `  - ${block.blockType} (ID: ${block.id}, order: ${block.sortOrder})\n`;
        }
        text += `\nPage ID: ${page.id}`;
        return textResult(text);
      });
    },
  },
  // ── page_ai_enhance_block ──
  {
    name: "page_ai_enhance_block",
    description:
      "Review a block and receive enhancement guidance. Returns current block content alongside the instruction for manual refinement.",
    category: "page-ai",
    tier: "workspace",
    inputSchema: EnhanceBlockSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { blockId, instruction } = input as z.infer<typeof EnhanceBlockSchema>;
      return safeToolCall("page_ai_enhance_block", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const block = await prisma.pageBlock.findUnique({ where: { id: blockId } });
        if (!block) {
          return textResult(
            `**Error: NOT_FOUND**\nBlock with ID "${blockId}" not found.\n**Retryable:** false`,
          );
        }
        return textResult(
          `**Block Enhancement Review**\n\n**Block ID:** ${block.id}\n**Type:** ${block.blockType}\n**Instruction:** ${instruction}\n\n**Current Content:**\n\`\`\`json\n${JSON.stringify(
            block.content,
            null,
            2,
          )}\n\`\`\`\n\n**Note:** This is a placeholder for future AI integration. To apply the enhancement, use the \`blocks_update\` tool with modified content based on the instruction above.`,
        );
      });
    },
  },
  // ── page_ai_suggest_layout ──
  {
    name: "page_ai_suggest_layout",
    description:
      "Suggest a page layout and recommended block types based on a use-case description. Advisory only.",
    category: "page-ai",
    tier: "free",
    inputSchema: SuggestLayoutSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { useCase } = input as z.infer<typeof SuggestLayoutSchema>;
      return safeToolCall("page_ai_suggest_layout", async () => {
        const lc = useCase.toLowerCase();
        interface LayoutSuggestion {
          layout: string;
          blocks: string[];
          rationale: string;
        }
        let suggestion: LayoutSuggestion;
        if (lc.includes("landing") || lc.includes("product")) {
          suggestion = {
            layout: "LANDING",
            blocks: ["HERO", "FEATURE_GRID", "TESTIMONIALS", "PRICING", "CTA", "FOOTER"],
            rationale:
              "Landing/product pages benefit from a strong hero, feature showcase, social proof, and clear pricing.",
          };
        } else if (lc.includes("store") || lc.includes("marketplace")) {
          suggestion = {
            layout: "STORE",
            blocks: ["HERO", "APP_GRID", "CTA", "FOOTER"],
            rationale: "Store pages focus on browsable app/product grids with category filtering.",
          };
        } else if (lc.includes("article") || lc.includes("blog")) {
          suggestion = {
            layout: "ARTICLE",
            blocks: ["HERO", "MARKDOWN", "CTA", "FOOTER"],
            rationale:
              "Article pages prioritize readable content with a clear hero and call-to-action.",
          };
        } else if (lc.includes("portfolio") || lc.includes("gallery")) {
          suggestion = {
            layout: "GALLERY",
            blocks: ["HERO", "GALLERY", "TESTIMONIALS", "CTA", "FOOTER"],
            rationale:
              "Portfolio/gallery pages showcase visual work with testimonials for credibility.",
          };
        } else if (lc.includes("comparison") || lc.includes("versus")) {
          suggestion = {
            layout: "FEATURE",
            blocks: ["HERO", "COMPARISON_TABLE", "PRICING", "CTA", "FOOTER"],
            rationale:
              "Comparison pages need structured tables and pricing to help decision-making.",
          };
        } else {
          suggestion = {
            layout: "LANDING",
            blocks: ["HERO", "FEATURE_GRID", "CTA", "FOOTER"],
            rationale: "A versatile landing layout works well for general-purpose pages.",
          };
        }
        let text = `**Layout Suggestion**\n\n**Use Case:** ${useCase}\n**Recommended Layout:** ${suggestion.layout}\n**Rationale:** ${suggestion.rationale}\n\n**Recommended Blocks (${suggestion.blocks.length}):**\n`;
        for (const block of suggestion.blocks) text += `  - ${block}\n`;
        text += `\nTo create a page with this layout, use \`page_ai_generate\` with the \`layout\` parameter set to "${suggestion.layout}".`;
        return textResult(text);
      });
    },
  },
  // ── page_ai_generate_theme ──
  {
    name: "page_ai_generate_theme",
    description:
      "Generate a LandingTheme-compatible JSON theme from a brand description. Deterministic color and style generation based on inputs.",
    category: "page-ai",
    tier: "workspace",
    inputSchema: GenerateThemeSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { brandDescription, primaryColor, style } = input as z.infer<
        typeof GenerateThemeSchema
      >;
      return safeToolCall("page_ai_generate_theme", async () => {
        const resolvedStyle = style ?? "modern";
        const primary = primaryColor ?? "#3B82F6";
        const secondary = shiftHexColor(primary, -40);
        const accent = shiftHexColor(primary, 60);
        const background = shiftHexColor(primary, 200);
        const foreground = shiftHexColor(primary, -180);
        interface StyleSettings {
          fontWeight: string;
          borderRadius: string;
          spacing: string;
          headingStyle: string;
        }
        const styleSettings: Record<string, StyleSettings> = {
          modern: {
            fontWeight: "500",
            borderRadius: "0.5rem",
            spacing: "1.5rem",
            headingStyle: "clean",
          },
          minimal: {
            fontWeight: "400",
            borderRadius: "0.25rem",
            spacing: "2rem",
            headingStyle: "light",
          },
          bold: {
            fontWeight: "700",
            borderRadius: "0.75rem",
            spacing: "1.25rem",
            headingStyle: "heavy",
          },
          playful: {
            fontWeight: "500",
            borderRadius: "1rem",
            spacing: "1.75rem",
            headingStyle: "rounded",
          },
        };
        const settings = styleSettings[resolvedStyle] ?? styleSettings.modern;
        const nameWords = brandDescription
          .split(/\s+/)
          .slice(0, 3)
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
        const themeName = `${nameWords.join(" ")} Theme`;
        const theme = {
          name: themeName,
          style: resolvedStyle,
          colors: {
            primary,
            secondary,
            accent,
            background,
            foreground,
            muted: shiftHexColor(primary, 150),
            border: shiftHexColor(primary, 120),
          },
          typography: {
            fontWeight: settings?.fontWeight ?? "500",
            headingStyle: settings?.headingStyle ?? "clean",
          },
          layout: {
            borderRadius: settings?.borderRadius ?? "0.5rem",
            spacing: settings?.spacing ?? "1.5rem",
          },
        };
        return textResult(
          `**Generated Theme**\n\n**Name:** ${theme.name}\n**Style:** ${theme.style}\n**Brand:** ${brandDescription}\n\n**Theme JSON:**\n\`\`\`json\n${JSON.stringify(
            theme,
            null,
            2,
          )}\n\`\`\`\n\nTo apply this theme, update the page's \`themeData\` field with the JSON above.`,
        );
      });
    },
  },
  // ── page_ai_populate_store ──
  {
    name: "page_ai_populate_store",
    description: "Populate a page with a sample APP_GRID block containing categorized app entries.",
    category: "page-ai",
    tier: "workspace",
    inputSchema: PopulateStoreSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { pageSlug } = input as z.infer<typeof PopulateStoreSchema>;
      return safeToolCall("page_ai_populate_store", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const page = await prisma.dynamicPage.findUnique({
          where: { slug: pageSlug },
          select: { id: true, title: true },
        });
        if (!page) {
          return textResult(
            `**Error: NOT_FOUND**\nPage with slug "${pageSlug}" not found.\n**Retryable:** false`,
          );
        }
        const categories = [
          "Image & Creative",
          "Development",
          "Communication",
          "Analytics",
          "AI & Automation",
        ];
        const sampleApps = [
          {
            name: "PixelForge",
            tagline: "AI-powered image generation and editing",
            icon: "Image",
            category: "Image & Creative",
            mcpTools: ["image_generate", "image_enhance"],
            features: ["Text-to-image", "Style transfer", "Batch processing"],
          },
          {
            name: "BrandKit",
            tagline: "Create consistent brand assets",
            icon: "Palette",
            category: "Image & Creative",
            mcpTools: ["image_generate"],
            features: ["Logo generator", "Color palettes", "Typography"],
          },
          {
            name: "CodePilot",
            tagline: "AI code review and suggestions",
            icon: "Code",
            category: "Development",
            mcpTools: ["codespace_create", "codespace_deploy"],
            features: ["Code review", "Auto-fix", "Performance hints"],
          },
          {
            name: "DeployBot",
            tagline: "One-click deployment automation",
            icon: "Rocket",
            category: "Development",
            mcpTools: ["codespace_deploy"],
            features: ["CI/CD pipelines", "Rollback", "Monitoring"],
          },
          {
            name: "TestRunner",
            tagline: "Automated testing suite",
            icon: "FlaskConical",
            category: "Development",
            mcpTools: ["codespace_create"],
            features: ["Unit tests", "Integration tests", "Coverage reports"],
          },
          {
            name: "TeamSync",
            tagline: "Real-time team collaboration",
            icon: "MessageSquare",
            category: "Communication",
            mcpTools: ["chat_send"],
            features: ["Group chat", "File sharing", "Video calls"],
          },
          {
            name: "NotifyHub",
            tagline: "Multi-channel notification center",
            icon: "Bell",
            category: "Communication",
            mcpTools: ["chat_send"],
            features: ["Email", "SMS", "Push notifications"],
          },
          {
            name: "InsightDash",
            tagline: "Real-time analytics dashboard",
            icon: "BarChart3",
            category: "Analytics",
            mcpTools: ["reports_generate"],
            features: ["Custom dashboards", "Data export", "Alerts"],
          },
          {
            name: "TrendWatch",
            tagline: "Market trend analysis",
            icon: "TrendingUp",
            category: "Analytics",
            mcpTools: ["reports_generate"],
            features: ["Trend detection", "Forecasting", "Competitor analysis"],
          },
          {
            name: "AutoFlow",
            tagline: "Visual workflow automation",
            icon: "Workflow",
            category: "AI & Automation",
            mcpTools: ["jules_queue_task"],
            features: ["Drag-and-drop builder", "Triggers", "Integrations"],
          },
          {
            name: "SmartAgent",
            tagline: "Autonomous AI task execution",
            icon: "Bot",
            category: "AI & Automation",
            mcpTools: ["jules_queue_task", "chat_send"],
            features: ["Task queue", "Background processing", "Status tracking"],
          },
          {
            name: "DataPipe",
            tagline: "Automated data transformation",
            icon: "ArrowRightLeft",
            category: "AI & Automation",
            mcpTools: ["jules_queue_task"],
            features: ["ETL pipelines", "Data cleaning", "Scheduling"],
          },
        ];
        const appGridContent = { sectionTitle: "App Store", apps: sampleApps, categories };
        const maxBlock = await prisma.pageBlock.findFirst({
          where: { pageId: page.id },
          orderBy: { sortOrder: "desc" },
          select: { sortOrder: true },
        });
        const nextSortOrder = maxBlock ? maxBlock.sortOrder + 1 : 0;
        const block = await prisma.pageBlock.create({
          data: {
            pageId: page.id,
            blockType: "APP_GRID",
            content: appGridContent as unknown as Prisma.InputJsonValue,
            sortOrder: nextSortOrder,
            isVisible: true,
          },
        });
        return textResult(
          `**Store Populated**\n\n**Page:** ${page.title} (${pageSlug})\n**Block ID:** ${block.id}\n**Block Type:** APP_GRID\n**Sort Order:** ${block.sortOrder}\n**Categories (${categories.length}):** ${categories.join(
            ", ",
          )}\n**Apps Added:** ${sampleApps.length}\n\nApps per category:\n${categories
            .map((cat) => {
              const count = sampleApps.filter((a) => a.category === cat).length;
              return `  - ${cat}: ${count} apps`;
            })
            .join("\n")}`,
        );
      });
    },
  },
  // ── page_review ──
  {
    name: "page_review",
    description: "Review a page's metadata, status, and content quality for the given route",
    category: "page-review",
    tier: "free",
    inputSchema: PageReviewSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { route, reviewType } = input as z.infer<typeof PageReviewSchema>;
      return safeToolCall("page_review", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const slug = route.replace(/^\//, "");
        const page = await prisma.dynamicPage.findFirst({
          where: { slug },
          include: {
            blocks: { select: { blockType: true, content: true }, orderBy: { sortOrder: "asc" } },
          },
        });
        if (!page) return textResult(buildStaticRouteAnalysis(route));
        const record: DynamicPageRecord = {
          id: page.id,
          slug: page.slug,
          title: page.title,
          description: page.description,
          status: page.status,
          layout: page.layout,
          seoTitle: page.seoTitle,
          seoDescription: page.seoDescription,
          tags: page.tags,
          customCss: page.customCss,
          viewCount: page.viewCount,
          createdAt: page.createdAt,
          updatedAt: page.updatedAt,
          blocks: page.blocks.map((b: { blockType: string; content: unknown }) => ({
            type: b.blockType,
            content: b.content,
          })),
        };
        const type = reviewType ?? "general";
        switch (type) {
          case "content":
            return textResult(buildContentReview(record));
          case "accessibility":
            return textResult(buildAccessibilityReview(record));
          case "performance":
            return textResult(buildPerformanceReview(record));
          case "general":
          default:
            return textResult(buildGeneralReview(record));
        }
      });
    },
  },
  // ── pages_list_templates ──
  {
    name: "pages_list_templates",
    description: "List available page templates. Optionally filter by category.",
    category: "page-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ListTemplatesSchema.shape,
    handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
      const { category } = input as z.infer<typeof ListTemplatesSchema>;
      return safeToolCall("pages_list_templates", async () => {
        const results = category ? TEMPLATES.filter((t) => t.category === category) : TEMPLATES;
        if (results.length === 0) {
          return textResult(`No templates found for category "${category}".`);
        }
        const header = category
          ? `**Page Templates — ${category} (${results.length})**\n\n`
          : `**All Page Templates (${results.length})**\n\n`;
        const lines = results.map(
          (t) =>
            `### ${t.name}\n- **ID:** ${t.id}\n- **Category:** ${t.category}\n- **Layout:** ${t.layout}\n- **Blocks:** ${
              t.defaultBlocks.length > 0 ? t.defaultBlocks.join(", ") : "(none)"
            }\n- **Description:** ${t.description}\n- **Thumbnail:** ${t.thumbnail}`,
        );
        return textResult(header + lines.join("\n\n"));
      });
    },
  },
  // ── pages_apply_template ──
  {
    name: "pages_apply_template",
    description: "Apply a template to a page. Records the template choice on the page record.",
    category: "page-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ApplyTemplateSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { page_id, template_id } = input as z.infer<typeof ApplyTemplateSchema>;
      return safeToolCall("pages_apply_template", async () => {
        const template = TEMPLATES.find((t) => t.id === template_id);
        if (!template) {
          return textResult(
            `**Error: NOT_FOUND**\nTemplate "${template_id}" does not exist. Use \`pages_list_templates\` to browse available templates.\n**Retryable:** false`,
          );
        }
        const prisma = (await import("@/lib/prisma")).default;
        const page = await prisma.dynamicPage.findUnique({
          where: { id: page_id },
          select: { id: true, title: true, slug: true, userId: true },
        });
        if (!page) return textResult("**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false");
        if (page.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not own this page.\n**Retryable:** false",
          );
        }
        await prisma.dynamicPage.update({
          where: { id: page_id },
          data: {
            layout: template.layout as
              | "LANDING"
              | "FEATURE"
              | "STORE"
              | "DASHBOARD"
              | "ARTICLE"
              | "GALLERY"
              | "CUSTOM",
          },
        });
        return textResult(
          `**Template Applied**\n\n**Page:** ${page.title} (${page.slug})\n**Page ID:** ${page.id}\n**Template:** ${template.name}\n**Template ID:** ${template.id}\n**Category:** ${template.category}\n**Layout set to:** ${template.layout}\n**Suggested blocks:** ${
            template.defaultBlocks.length > 0 ? template.defaultBlocks.join(", ") : "(none)"
          }\n\nUse the blocks tools to add the suggested blocks to your page.`,
        );
      });
    },
  },
  // ── pages_get_seo ──
  {
    name: "pages_get_seo",
    description:
      "Analyse the SEO health of a page. Returns a score (0-100) and actionable recommendations.",
    category: "page-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GetSeoSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { page_id } = input as z.infer<typeof GetSeoSchema>;
      return safeToolCall("pages_get_seo", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const page = await prisma.dynamicPage.findUnique({
          where: { id: page_id },
          select: {
            id: true,
            title: true,
            slug: true,
            userId: true,
            seoTitle: true,
            seoDescription: true,
            ogImageUrl: true,
            description: true,
          },
        });
        if (!page) return textResult("**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false");
        if (page.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not own this page.\n**Retryable:** false",
          );
        }
        const analysis = analyseSeo(page);
        const scoreLabel =
          analysis.score >= 80 ? "GOOD" : analysis.score >= 50 ? "NEEDS_WORK" : "POOR";
        const recsText =
          analysis.recommendations.length > 0
            ? analysis.recommendations.map((r) => `  - ${r}`).join("\n")
            : "  - No issues found.";
        return textResult(
          `**SEO Analysis — ${page.title}**\n\n**Page ID:** ${page.id}\n**Slug:** ${page.slug}\n**SEO Score:** ${analysis.score}/100 (${scoreLabel})\n\n**Title:** ${analysis.titleStatus}\n  Current: "${
            page.seoTitle ?? page.title
          }"\n\n**Description:** ${analysis.descriptionStatus}\n  Current: "${
            page.seoDescription ?? page.description ?? "(none)"
          }"\n\n**Open Graph Image:** ${
            analysis.ogImagePresent ? page.ogImageUrl : "NOT SET"
          }\n\n**Recommendations:**\n${recsText}\n\nUse \`pages_set_seo\` to update SEO metadata.`,
        );
      });
    },
  },
  // ── pages_set_seo ──
  {
    name: "pages_set_seo",
    description:
      "Set SEO metadata for a page: title, description, keywords, and Open Graph image URL.",
    category: "page-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: SetSeoSchema.shape,
    handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
      const { page_id, title, description, keywords, og_image } = input as z.infer<
        typeof SetSeoSchema
      >;
      return safeToolCall("pages_set_seo", async () => {
        if (
          title === undefined &&
          description === undefined &&
          keywords === undefined &&
          og_image === undefined
        ) {
          return textResult(
            "**No changes specified.** Provide at least one SEO field to update (title, description, keywords, og_image).",
          );
        }
        const prisma = (await import("@/lib/prisma")).default;
        const page = await prisma.dynamicPage.findUnique({
          where: { id: page_id },
          select: { id: true, title: true, slug: true, userId: true },
        });
        if (!page) return textResult("**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false");
        if (page.userId !== ctx.userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not own this page.\n**Retryable:** false",
          );
        }
        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.seoTitle = title;
        if (description !== undefined) updateData.seoDescription = description;
        if (og_image !== undefined) updateData.ogImageUrl = og_image;
        if (keywords !== undefined) updateData.tags = keywords;
        await prisma.dynamicPage.update({ where: { id: page_id }, data: updateData });
        const updated: string[] = [];
        if (title !== undefined) updated.push(`**SEO Title:** ${title}`);
        if (description !== undefined) updated.push(`**SEO Description:** ${description}`);
        if (keywords !== undefined) updated.push(`**Keywords:** ${keywords.join(", ")}`);
        if (og_image !== undefined) updated.push(`**OG Image:** ${og_image}`);
        return textResult(
          `**SEO Metadata Updated**\n\n**Page:** ${page.title} (${page.slug})\n**Page ID:** ${page.id}\n\n**Changes Applied:**\n${updated
            .map((u) => `  ${u}`)
            .join("\n")}\n\nRun \`pages_get_seo\` to review the updated SEO score.`,
        );
      });
    },
  },
];
