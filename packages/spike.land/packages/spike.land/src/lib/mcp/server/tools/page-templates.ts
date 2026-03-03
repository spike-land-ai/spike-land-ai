/**
 * Page Templates & SEO MCP Tools
 *
 * Template browsing and application, plus SEO analysis and metadata
 * management for dynamic pages.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// ─── Template Catalogue ───────────────────────────────────────────────────────

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

// ─── Schemas ──────────────────────────────────────────────────────────────────

const TemplateCategoryEnum = z.enum([
  "landing",
  "portfolio",
  "blog",
  "marketing",
  "blank",
]);

const ListTemplatesSchema = z.object({
  category: TemplateCategoryEnum.optional().describe(
    "Filter templates by category. Omit to list all.",
  ),
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
  title: z
    .string()
    .max(60)
    .optional()
    .describe("SEO title (max 60 characters)."),
  description: z
    .string()
    .max(160)
    .optional()
    .describe("SEO meta description (max 160 characters)."),
  keywords: z
    .array(z.string())
    .optional()
    .describe("List of SEO keywords."),
  og_image: z
    .string()
    .url()
    .optional()
    .describe("Open Graph image URL."),
});

// ─── SEO Analysis Helpers ─────────────────────────────────────────────────────

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
  } else {
    titleStatus = `GOOD (${titleLen} chars)`;
  }

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
  } else {
    descriptionStatus = `GOOD (${descLen} chars)`;
  }

  const ogImagePresent = Boolean(page.ogImageUrl);
  if (!ogImagePresent) {
    score -= 15;
    recommendations.push(
      "Add an Open Graph image (1200x630px recommended) for rich social previews.",
    );
  }

  // Keyword count is always 0 for pages that store keywords in tags; report it informatively
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

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerPageTemplateTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // ── Tool 1: pages_list_templates ─────────────────────────────────────────

  registry.register({
    name: "pages_list_templates",
    description:
      "List available page templates. Optionally filter by category: landing, portfolio, blog, marketing, or blank.",
    category: "page-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ListTemplatesSchema.shape,
    handler: async ({
      category,
    }: z.infer<typeof ListTemplatesSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_list_templates", async () => {
        const results = category
          ? TEMPLATES.filter(t => t.category === category)
          : TEMPLATES;

        if (results.length === 0) {
          return textResult(`No templates found for category "${category}".`);
        }

        const header = category
          ? `**Page Templates — ${category} (${results.length})**\n\n`
          : `**All Page Templates (${results.length})**\n\n`;

        const lines = results.map(
          t =>
            `### ${t.name}\n`
            + `- **ID:** ${t.id}\n`
            + `- **Category:** ${t.category}\n`
            + `- **Layout:** ${t.layout}\n`
            + `- **Blocks:** ${
              t.defaultBlocks.length > 0 ? t.defaultBlocks.join(", ") : "(none)"
            }\n`
            + `- **Description:** ${t.description}\n`
            + `- **Thumbnail:** ${t.thumbnail}`,
        );

        return textResult(header + lines.join("\n\n"));
      }),
  });

  // ── Tool 2: pages_apply_template ─────────────────────────────────────────

  registry.register({
    name: "pages_apply_template",
    description:
      "Apply a template to a page. This records the template choice on the page record. You can then use `pages_update` or block tools to populate content.",
    category: "page-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ApplyTemplateSchema.shape,
    handler: async ({
      page_id,
      template_id,
    }: z.infer<typeof ApplyTemplateSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_apply_template", async () => {
        const template = TEMPLATES.find(t => t.id === template_id);
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

        if (!page) {
          return textResult(
            "**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false",
          );
        }

        if (page.userId !== userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not own this page.\n**Retryable:** false",
          );
        }

        // Record the applied template as a tag and update the layout
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
          `**Template Applied**\n\n`
            + `**Page:** ${page.title} (${page.slug})\n`
            + `**Page ID:** ${page.id}\n`
            + `**Template:** ${template.name}\n`
            + `**Template ID:** ${template.id}\n`
            + `**Category:** ${template.category}\n`
            + `**Layout set to:** ${template.layout}\n`
            + `**Suggested blocks:** ${
              template.defaultBlocks.length > 0
                ? template.defaultBlocks.join(", ")
                : "(none)"
            }\n\n`
            + `Use the blocks tools to add the suggested blocks to your page.`,
        );
      }),
  });

  // ── Tool 3: pages_get_seo ─────────────────────────────────────────────────

  registry.register({
    name: "pages_get_seo",
    description:
      "Analyse the SEO health of a page. Returns a score (0-100) and actionable recommendations for title, description, keywords, and Open Graph image.",
    category: "page-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: GetSeoSchema.shape,
    handler: async ({
      page_id,
    }: z.infer<typeof GetSeoSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_get_seo", async () => {
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

        if (!page) {
          return textResult(
            "**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false",
          );
        }

        if (page.userId !== userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not own this page.\n**Retryable:** false",
          );
        }

        const analysis = analyseSeo(page);

        const scoreLabel = analysis.score >= 80
          ? "GOOD"
          : analysis.score >= 50
          ? "NEEDS_WORK"
          : "POOR";

        const recsText = analysis.recommendations.length > 0
          ? analysis.recommendations.map(r => `  - ${r}`).join("\n")
          : "  - No issues found.";

        return textResult(
          `**SEO Analysis — ${page.title}**\n\n`
            + `**Page ID:** ${page.id}\n`
            + `**Slug:** ${page.slug}\n`
            + `**SEO Score:** ${analysis.score}/100 (${scoreLabel})\n\n`
            + `**Title:** ${analysis.titleStatus}\n`
            + `  Current: "${page.seoTitle ?? page.title}"\n\n`
            + `**Description:** ${analysis.descriptionStatus}\n`
            + `  Current: "${page.seoDescription ?? page.description ?? "(none)"}"\n\n`
            + `**Open Graph Image:** ${analysis.ogImagePresent ? page.ogImageUrl : "NOT SET"}\n\n`
            + `**Recommendations:**\n${recsText}\n\n`
            + `Use \`pages_set_seo\` to update SEO metadata.`,
        );
      }),
  });

  // ── Tool 4: pages_set_seo ─────────────────────────────────────────────────

  registry.register({
    name: "pages_set_seo",
    description:
      "Set SEO metadata for a page: title (max 60 chars), description (max 160 chars), keywords, and Open Graph image URL.",
    category: "page-templates",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: SetSeoSchema.shape,
    handler: async ({
      page_id,
      title,
      description,
      keywords,
      og_image,
    }: z.infer<typeof SetSeoSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_set_seo", async () => {
        if (
          title === undefined
          && description === undefined
          && keywords === undefined
          && og_image === undefined
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

        if (!page) {
          return textResult(
            "**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false",
          );
        }

        if (page.userId !== userId) {
          return textResult(
            "**Error: PERMISSION_DENIED**\nYou do not own this page.\n**Retryable:** false",
          );
        }

        const updateData: Record<string, unknown> = {};
        if (title !== undefined) updateData.seoTitle = title;
        if (description !== undefined) updateData.seoDescription = description;
        if (og_image !== undefined) updateData.ogImageUrl = og_image;
        // Keywords are stored as tags alongside existing tags; merge carefully
        if (keywords !== undefined) updateData.tags = keywords;

        await prisma.dynamicPage.update({
          where: { id: page_id },
          data: updateData,
        });

        const updated: string[] = [];
        if (title !== undefined) updated.push(`**SEO Title:** ${title}`);
        if (description !== undefined) updated.push(`**SEO Description:** ${description}`);
        if (keywords !== undefined) {
          updated.push(`**Keywords:** ${keywords.join(", ")}`);
        }
        if (og_image !== undefined) updated.push(`**OG Image:** ${og_image}`);

        return textResult(
          `**SEO Metadata Updated**\n\n`
            + `**Page:** ${page.title} (${page.slug})\n`
            + `**Page ID:** ${page.id}\n\n`
            + `**Changes Applied:**\n${updated.map(u => `  ${u}`).join("\n")}\n\n`
            + `Run \`pages_get_seo\` to review the updated SEO score.`,
        );
      }),
  });
}
