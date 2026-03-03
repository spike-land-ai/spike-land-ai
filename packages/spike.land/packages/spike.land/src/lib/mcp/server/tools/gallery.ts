import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import { AlbumPrivacy, type EnhancementTier, JobStatus } from "@prisma/client";
import { safeToolCall, textResult } from "./tool-helpers";

const SUPER_ADMIN_EMAIL = process.env.SPIKE_LAND_SUPER_ADMIN_EMAIL
  || "zolika84@gmail.com";

const GalleryShowcaseSchema = z.object({
  view: z.enum(["featured", "albums"]).describe(
    "View mode: 'featured' returns featured gallery items, 'albums' returns before/after pairs from public albums.",
  ),
  active_only: z.boolean().optional().default(true).describe(
    "For 'featured' view: filter active items only. Default: true.",
  ),
  limit: z.number().optional().default(12).describe(
    "Max items to return. Default: 12.",
  ),
});

const GalleryPublicSchema = z.object({
  page: z.number().optional().default(1),
  limit: z.number().max(100).optional().default(20),
  tags: z.array(z.string()).optional().default([]),
  tier: z.string().optional(),
});

export function registerGalleryTools(
  registry: ToolRegistry,
  userId: string,
): void {
  registry.register({
    name: "gallery_showcase",
    description:
      "Returns gallery showcase content: 'featured' for landing page items or 'albums' for before/after pairs from public albums.",
    category: "gallery",
    tier: "free",
    inputSchema: GalleryShowcaseSchema.shape,
    handler: async (
      { view, active_only, limit }: z.infer<typeof GalleryShowcaseSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("gallery_showcase", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        if (view === "featured") {
          const items = await prisma.featuredGalleryItem.findMany({
            where: active_only ? { isActive: true } : {},
            select: {
              id: true,
              title: true,
              description: true,
              category: true,
              originalUrl: true,
              enhancedUrl: true,
              width: true,
              height: true,
              sortOrder: true,
            },
            orderBy: [{ sortOrder: "asc" }, { createdAt: "desc" }],
          });
          return textResult(JSON.stringify({ view: "featured", items }));
        }

        // view === "albums"
        const superAdmin = await prisma.user.findFirst({
          where: { email: SUPER_ADMIN_EMAIL },
          select: { id: true },
        });

        if (!superAdmin) {
          throw new Error("Super admin user not found");
        }

        const albums = await prisma.album.findMany({
          where: {
            userId: superAdmin.id,
            privacy: AlbumPrivacy.PUBLIC,
          },
          include: {
            albumImages: {
              include: {
                image: {
                  include: {
                    enhancementJobs: {
                      where: { status: JobStatus.COMPLETED },
                      orderBy: { createdAt: "desc" },
                      take: 1,
                    },
                  },
                },
              },
              orderBy: { sortOrder: "asc" },
            },
          },
          orderBy: { createdAt: "desc" },
        });

        const items = [];
        for (const album of albums) {
          for (const albumImage of album.albumImages) {
            const { image } = albumImage;
            const latestJob = image.enhancementJobs[0];

            if (
              !latestJob || !latestJob.enhancedUrl
              || !latestJob.enhancedWidth || !latestJob.enhancedHeight
            ) {
              continue;
            }

            items.push({
              id: image.id,
              title: image.name,
              originalUrl: image.originalUrl,
              enhancedUrl: latestJob.enhancedUrl,
              width: latestJob.enhancedWidth,
              height: latestJob.enhancedHeight,
              albumName: album.name,
              tier: latestJob.tier,
            });

            if (items.length >= limit) break;
          }
          if (items.length >= limit) break;
        }

        return textResult(JSON.stringify({ view: "albums", items }));
      }, { userId, input: { view, active_only, limit } }),
  });

  registry.register({
    name: "gallery_public",
    description: "Returns public gallery items with pagination and filters",
    category: "gallery",
    tier: "free",
    inputSchema: GalleryPublicSchema.shape,
    handler: async (
      { page, limit, tags, tier }: z.infer<typeof GalleryPublicSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("gallery_public", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const where = {
          isPublic: true,
          ...(tags.length > 0 && { tags: { hasSome: tags } }),
          ...(tier && {
            enhancementJobs: {
              some: {
                tier: tier as EnhancementTier,
                status: JobStatus.COMPLETED,
              },
            },
          }),
        };

        const [images, total] = await Promise.all([
          prisma.enhancedImage.findMany({
            where,
            include: {
              enhancementJobs: {
                where: { status: JobStatus.COMPLETED },
                orderBy: { createdAt: "desc" },
                take: 1,
              },
              user: {
                select: { name: true, image: true },
              },
            },
            orderBy: { createdAt: "desc" },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.enhancedImage.count({ where }),
        ]);

        return textResult(JSON.stringify({
          items: images,
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
        }));
      }, { userId, input: { page, limit, tags, tier } }),
  });
}
