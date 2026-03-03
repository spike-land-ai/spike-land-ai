/**
 * Page Review MCP Tools
 *
 * Review a page's metadata, status, and content quality for a given route/slug.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PageReviewSchema = z.object({
  route: z.string().describe("Page route/slug to review, e.g. /blog or /store"),
  reviewType: z
    .enum(["accessibility", "content", "performance", "general"])
    .optional()
    .describe("Type of review to perform"),
});

// ─── Types ────────────────────────────────────────────────────────────────────

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
  blocks: Array<{ type: string; content: unknown; }>;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractBlockContent(
  blocks: Array<{ type: string; content: unknown; }>,
): string {
  return blocks
    .map(b => {
      if (typeof b.content === "string") return b.content;
      if (b.content && typeof b.content === "object") {
        return JSON.stringify(b.content);
      }
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

  const lines = [
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
  ];
  return lines.join("\n");
}

function buildContentReview(page: DynamicPageRecord): string {
  const titleLen = page.title.length;
  const descLen = page.description?.length ?? 0;
  const seoTitleLen = page.seoTitle?.length ?? 0;
  const seoDescLen = page.seoDescription?.length ?? 0;
  const content = extractBlockContent(page.blocks);
  const wordCount = estimateWordCount(content);

  const titleStatus = titleLen < 50
    ? `Short (${titleLen} chars) -- ideal is 50-60 chars`
    : titleLen <= 60
    ? `Good (${titleLen} chars)`
    : `Long (${titleLen} chars) -- ideal is 50-60 chars`;

  const descStatus = descLen === 0
    ? "Missing -- add a description"
    : descLen < 150
    ? `Short (${descLen} chars) -- ideal is 150-160 chars`
    : descLen <= 160
    ? `Good (${descLen} chars)`
    : `Long (${descLen} chars) -- ideal is 150-160 chars`;

  const lines = [
    `## Content Review: /${page.slug}`,
    "",
    `### Title Analysis`,
    `- ${titleStatus}`,
    seoTitleLen > 0
      ? `- SEO title: ${seoTitleLen} chars`
      : "- SEO title: not set",
    "",
    `### Description Analysis`,
    `- ${descStatus}`,
    seoDescLen > 0
      ? `- SEO description: ${seoDescLen} chars`
      : "- SEO description: not set",
    "",
    `### Content Structure`,
    `- Word count (est.): ${wordCount}`,
    `- Block count: ${page.blocks.length}`,
    `- Block types: ${[...new Set(page.blocks.map(b => b.type))].join(", ") || "(none)"}`,
  ];

  return lines.join("\n");
}

function buildAccessibilityReview(page: DynamicPageRecord): string {
  const content = extractBlockContent(page.blocks);
  const imgTags = content.match(/<img[^>]*>/gi) ?? [];
  const imgsWithAlt = imgTags.filter(tag => /alt\s*=\s*"[^"]+"/i.test(tag));
  const imgsMissingAlt = imgTags.length - imgsWithAlt.length;

  const lines = [
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
    page.customCss
      ? "- Custom CSS detected -- verify it doesn't break screen reader access"
      : "",
  ].filter(Boolean);
  return lines.join("\n");
}

function buildPerformanceReview(page: DynamicPageRecord): string {
  const content = extractBlockContent(page.blocks);
  const contentSizeBytes = new TextEncoder().encode(content).length;
  const contentSizeKB = (contentSizeBytes / 1024).toFixed(1);
  const imgTags = content.match(/<img[^>]*>/gi) ?? [];

  const suggestions: string[] = [];
  if (contentSizeBytes > 100_000) {
    suggestions.push(
      "- Content exceeds 100KB -- consider lazy loading or pagination",
    );
  }
  if (imgTags.length > 10) {
    suggestions.push(
      "- Many images detected -- use lazy loading for off-screen images",
    );
  }
  if (page.blocks.length > 20) {
    suggestions.push(
      "- Many blocks -- consider paginating or lazy-loading below-fold content",
    );
  }
  if (suggestions.length === 0) {
    suggestions.push("- No major performance concerns detected");
  }

  const lines = [
    `## Performance Review: /${page.slug}`,
    "",
    `### Content Size`,
    `- Estimated content size: ${contentSizeKB} KB`,
    `- Block count: ${page.blocks.length}`,
    `- Image count: ${imgTags.length}`,
    "",
    `### Optimization Suggestions`,
    ...suggestions,
  ];
  return lines.join("\n");
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
    prefix => route === prefix || route.startsWith(prefix + "/"),
  );

  const lines = [
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
  ];
  return lines.join("\n");
}

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerPageReviewTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "page_review",
    description: "Review a page's metadata, status, and content quality for the given route",
    category: "page-review",
    tier: "free",
    inputSchema: PageReviewSchema.shape,
    handler: async ({
      route,
      reviewType,
    }: z.infer<typeof PageReviewSchema>): Promise<CallToolResult> =>
      safeToolCall("page_review", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        // Strip leading slash for slug lookup
        const slug = route.replace(/^\//, "");

        const page = await prisma.dynamicPage.findFirst({
          where: { slug },
          include: {
            blocks: {
              select: { blockType: true, content: true },
              orderBy: { sortOrder: "asc" },
            },
          },
        });

        if (!page) {
          return textResult(buildStaticRouteAnalysis(route));
        }

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
          blocks: page.blocks.map((
            b: { blockType: string; content: unknown; },
          ) => ({
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
      }),
  });
}
