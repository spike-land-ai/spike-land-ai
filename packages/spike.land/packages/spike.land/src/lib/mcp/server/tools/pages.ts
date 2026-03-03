/**
 * Pages MCP Tools
 *
 * Full lifecycle management for dynamic pages: create, read, update,
 * delete, publish, clone.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { Prisma } from "@/generated/prisma";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

// ─── Sanitization ─────────────────────────────────────────────────────────────

/**
 * Strips dangerous CSS patterns that could enable XSS or data exfiltration:
 * - url() can load external resources or trigger JavaScript
 * - expression() is an IE-specific JS execution vector
 * - @import can load external stylesheets with malicious content
 * - javascript: protocol in CSS values
 * - </style> tag to prevent breaking out of style context
 */
export function sanitizeCss(css: string): string {
  // Normalize CSS escape sequences (\HH hex) before regex checks to prevent bypass
  const normalized = css.replace(
    /\\([0-9a-fA-F]{1,6})\s?/g,
    (_, hex) => String.fromCodePoint(parseInt(hex, 16)),
  );
  return normalized
    .replace(/expression\s*\(/gi, "/* blocked */")
    .replace(/javascript\s*:/gi, "/* blocked */")
    .replace(/@import\b[^;]*/gi, "/* blocked */")
    .replace(/url\s*\(/gi, "/* blocked */")
    .replace(/<\/style/gi, "/* blocked */");
}

// ─── Schemas ──────────────────────────────────────────────────────────────────

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

const CreatePageSchema = z.object({
  slug: z.string().min(1).describe("URL slug for the page."),
  title: z.string().min(1).describe("Page title."),
  description: z.string().optional().describe("Page description."),
  layout: PageLayoutEnum.optional().default("LANDING").describe(
    "Page layout type.",
  ),
  themeData: z.record(z.string(), z.unknown()).optional().describe(
    "Theme configuration data.",
  ),
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
  page: z.number().int().min(1).optional().default(1).describe(
    "Page number (default 1).",
  ),
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
  themeData: z.record(z.string(), z.unknown()).optional().describe(
    "New theme data.",
  ),
  tags: z.array(z.string()).optional().describe("New tags."),
  customCss: z.string().optional().describe("New custom CSS."),
  seoTitle: z.string().optional().describe("SEO title override."),
  seoDescription: z.string().optional().describe("SEO description override."),
  ogImageUrl: z.string().url().optional().describe("Open Graph image URL."),
});

const DeletePageSchema = z.object({
  pageId: z.string().describe("ID of the page to archive."),
});

const PublishPageSchema = z.object({
  pageId: z.string().describe("ID of the page to publish."),
});

const ClonePageSchema = z.object({
  pageId: z.string().describe("ID of the source page to clone."),
  newSlug: z.string().min(1).describe("URL slug for the cloned page."),
});

// ─── Registration ─────────────────────────────────────────────────────────────

export function registerPagesTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // ── Tool 1: pages_create ──────────────────────────────────────────────────

  registry.register({
    name: "pages_create",
    description: "Create a new dynamic page with a unique slug.",
    category: "pages",
    tier: "free",
    inputSchema: CreatePageSchema.shape,
    handler: async ({
      slug,
      title,
      description,
      layout = "LANDING",
      themeData,
      tags,
      customCss,
    }: z.infer<typeof CreatePageSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_create", async () => {
        const { isReservedSlug } = await import(
          "@/lib/dynamic-pages/block-schemas"
        );

        if (isReservedSlug(slug)) {
          return textResult(
            "**Error: VALIDATION_ERROR**\nSlug is reserved.\n**Retryable:** false",
          );
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
            themeData: themeData
              ? (themeData as Prisma.InputJsonValue)
              : undefined,
            tags: tags ?? [],
            customCss: customCss ? sanitizeCss(customCss) : null,
            userId,
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
          `**Page Created**\n\n`
            + `**ID:** ${page.id}\n`
            + `**Slug:** ${page.slug}\n`
            + `**Title:** ${page.title}\n`
            + `**Layout:** ${page.layout}\n`
            + `**Status:** ${page.status}\n`
            + `**Created:** ${page.createdAt.toISOString()}`,
        );
      }),
  });

  // ── Tool 2: pages_get ─────────────────────────────────────────────────────

  registry.register({
    name: "pages_get",
    description: "Get a dynamic page by slug or ID, including its blocks.",
    category: "pages",
    tier: "free",
    inputSchema: GetPageSchema.shape,
    handler: async ({
      slug,
      pageId,
    }: z.infer<typeof GetPageSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_get", async () => {
        if (!slug && !pageId) {
          return textResult(
            "**Error: VALIDATION_ERROR**\nProvide either slug or pageId.\n**Retryable:** false",
          );
        }

        const prisma = (await import("@/lib/prisma")).default;

        const where = pageId ? { id: pageId } : { slug: slug as string };
        const page = await prisma.dynamicPage.findUnique({
          where,
          include: {
            blocks: {
              orderBy: { sortOrder: "asc" as const },
            },
          },
        });

        if (!page) {
          return textResult(
            "**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false",
          );
        }

        return textResult(
          `**${page.title}**\n\n`
            + `**ID:** ${page.id}\n`
            + `**Slug:** ${page.slug}\n`
            + `**Layout:** ${page.layout}\n`
            + `**Status:** ${page.status}\n`
            + `**Description:** ${page.description ?? "(none)"}\n`
            + `**Tags:** ${
              (page.tags ?? []).length > 0
                ? (page.tags ?? []).join(", ")
                : "(none)"
            }\n`
            + `**View Count:** ${page.viewCount}\n`
            + `**Published:** ${page.publishedAt?.toISOString() ?? "(not published)"}\n`
            + `**Created:** ${page.createdAt.toISOString()}\n`
            + `**Updated:** ${page.updatedAt.toISOString()}\n`
            + `**Blocks:** ${page.blocks.length}\n\n`
            + (page.blocks.length > 0
              ? page.blocks
                .map(
                  b =>
                    `  - [${b.sortOrder}] ${b.blockType}${b.variant ? ` (${b.variant})` : ""}${
                      b.isVisible ? "" : " [hidden]"
                    }`,
                )
                .join("\n")
              : "  (no blocks)"),
        );
      }),
  });

  // ── Tool 3: pages_list ────────────────────────────────────────────────────

  registry.register({
    name: "pages_list",
    description: "List dynamic pages with optional status, layout, and search filters.",
    category: "pages",
    tier: "free",
    inputSchema: ListPagesSchema.shape,
    handler: async ({
      status,
      layout,
      search,
      page = 1,
      pageSize = 20,
    }: z.infer<typeof ListPagesSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const where: Prisma.DynamicPageWhereInput = { userId };
        if (status) where.status = status;
        if (layout) where.layout = layout;
        if (search) {
          where.OR = [
            { title: { contains: search, mode: "insensitive" } },
            { description: { contains: search, mode: "insensitive" } },
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

        if (pages.length === 0) {
          return textResult("No pages found matching the given filters.");
        }

        let text = `**Pages (${pages.length} of ${total}):**\n\n`;
        for (const p of pages) {
          text += `- **${p.title}** (${p.slug})\n`
            + `  ID: ${p.id} | Layout: ${p.layout} | Status: ${p.status}\n`
            + `  Views: ${p.viewCount} | Updated: ${p.updatedAt.toISOString()}`
            + (p.publishedAt
              ? ` | Published: ${p.publishedAt.toISOString()}`
              : "")
            + "\n\n";
        }

        const totalPages = Math.ceil(total / pageSize);
        text += `Page ${page} of ${totalPages} (${total} total)`;

        return textResult(text);
      }),
  });

  // ── Tool 4: pages_update ──────────────────────────────────────────────────

  registry.register({
    name: "pages_update",
    description: "Update a dynamic page's metadata and create a version snapshot.",
    category: "pages",
    tier: "free",
    inputSchema: UpdatePageSchema.shape,
    handler: async ({
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
    }: z.infer<typeof UpdatePageSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_update", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const current = await prisma.dynamicPage.findUnique({
          where: { id: pageId },
        });
        if (!current) {
          return textResult(
            "**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false",
          );
        }

        // Create a version snapshot before updating
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
            changedBy: userId,
          },
        });

        // Build update payload
        const updateData: Prisma.DynamicPageUpdateInput = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) {
          updateData.description = description;
        }
        if (layout !== undefined) updateData.layout = layout;
        if (themeData !== undefined) {
          updateData.themeData = themeData as Prisma.InputJsonValue;
        }
        if (tags !== undefined) updateData.tags = tags;
        if (customCss !== undefined) {
          updateData.customCss = sanitizeCss(customCss);
        }
        if (seoTitle !== undefined) updateData.seoTitle = seoTitle;
        if (seoDescription !== undefined) {
          updateData.seoDescription = seoDescription;
        }
        if (ogImageUrl !== undefined) {
          updateData.ogImageUrl = ogImageUrl;
        }

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
          `**Page Updated (v${nextVersion} snapshot saved)**\n\n`
            + `**ID:** ${updated.id}\n`
            + `**Slug:** ${updated.slug}\n`
            + `**Title:** ${updated.title}\n`
            + `**Layout:** ${updated.layout}\n`
            + `**Status:** ${updated.status}\n`
            + `**Updated:** ${updated.updatedAt.toISOString()}`,
        );
      }),
  });

  // ── Tool 5: pages_delete ──────────────────────────────────────────────────

  registry.register({
    name: "pages_delete",
    description: "Soft-delete a dynamic page by setting its status to ARCHIVED.",
    category: "pages",
    tier: "free",
    inputSchema: DeletePageSchema.shape,
    handler: async ({
      pageId,
    }: z.infer<typeof DeletePageSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_delete", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const page = await prisma.dynamicPage.findUnique({
          where: { id: pageId },
          select: { id: true, slug: true, title: true },
        });
        if (!page) {
          return textResult(
            "**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false",
          );
        }

        await prisma.dynamicPage.update({
          where: { id: pageId },
          data: { status: "ARCHIVED" },
        });

        return textResult(
          `**Page Archived**\n\n`
            + `**ID:** ${page.id}\n`
            + `**Slug:** ${page.slug}\n`
            + `**Title:** ${page.title}\n`
            + `Status set to ARCHIVED.`,
        );
      }),
  });

  // ── Tool 6: pages_publish ─────────────────────────────────────────────────

  registry.register({
    name: "pages_publish",
    description: "Publish a dynamic page, making it publicly accessible at /p/{slug}.",
    category: "pages",
    tier: "free",
    inputSchema: PublishPageSchema.shape,
    handler: async ({
      pageId,
    }: z.infer<typeof PublishPageSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_publish", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const page = await prisma.dynamicPage.findUnique({
          where: { id: pageId },
          select: { id: true, slug: true, title: true, status: true },
        });
        if (!page) {
          return textResult(
            "**Error: NOT_FOUND**\nPage not found.\n**Retryable:** false",
          );
        }

        const updated = await prisma.dynamicPage.update({
          where: { id: pageId },
          data: {
            status: "PUBLISHED",
            publishedAt: new Date(),
          },
          select: {
            id: true,
            slug: true,
            title: true,
            status: true,
            publishedAt: true,
          },
        });

        return textResult(
          `**Page Published**\n\n`
            + `**ID:** ${updated.id}\n`
            + `**Title:** ${updated.title}\n`
            + `**Status:** ${updated.status}\n`
            + `**Published:** ${updated.publishedAt?.toISOString()}\n`
            + `**URL:** /p/${updated.slug}`,
        );
      }),
  });

  // ── Tool 7: pages_clone ───────────────────────────────────────────────────

  registry.register({
    name: "pages_clone",
    description: "Clone an existing page and all its blocks to a new slug.",
    category: "pages",
    tier: "free",
    inputSchema: ClonePageSchema.shape,
    handler: async ({
      pageId,
      newSlug,
    }: z.infer<typeof ClonePageSchema>): Promise<CallToolResult> =>
      safeToolCall("pages_clone", async () => {
        const { isReservedSlug } = await import(
          "@/lib/dynamic-pages/block-schemas"
        );

        if (isReservedSlug(newSlug)) {
          return textResult(
            "**Error: VALIDATION_ERROR**\nSlug is reserved.\n**Retryable:** false",
          );
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
          include: {
            blocks: {
              orderBy: { sortOrder: "asc" as const },
            },
          },
        });
        if (!source) {
          return textResult(
            "**Error: NOT_FOUND**\nSource page not found.\n**Retryable:** false",
          );
        }

        const cloned = await prisma.dynamicPage.create({
          data: {
            slug: newSlug,
            title: source.title,
            description: source.description,
            layout: source.layout,
            status: "DRAFT",
            themeData: source.themeData
              ? (source.themeData as Prisma.InputJsonValue)
              : undefined,
            tags: source.tags,
            customCss: source.customCss ? sanitizeCss(source.customCss) : undefined,
            seoTitle: source.seoTitle,
            seoDescription: source.seoDescription,
            ogImageUrl: source.ogImageUrl,
            userId,
            blocks: {
              create: source.blocks.map(block => ({
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
            _count: { select: { blocks: true } },
          },
        });

        return textResult(
          `**Page Cloned**\n\n`
            + `**Source ID:** ${source.id}\n`
            + `**New ID:** ${cloned.id}\n`
            + `**Slug:** ${cloned.slug}\n`
            + `**Title:** ${cloned.title}\n`
            + `**Layout:** ${cloned.layout}\n`
            + `**Status:** ${cloned.status}\n`
            + `**Blocks Copied:** ${cloned._count.blocks}\n`
            + `**Created:** ${cloned.createdAt.toISOString()}`,
        );
      }),
  });
}
