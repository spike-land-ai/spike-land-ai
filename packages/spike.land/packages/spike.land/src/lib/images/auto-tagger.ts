import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

export function extractTagsFromAnalysis(analysisJson: unknown): string[] {
  if (!analysisJson || typeof analysisJson !== "object") {
    return [];
  }

  const analysis = analysisJson as Record<string, unknown>;
  const tags = new Set<string>();

  // Extract from specific fields
  if (Array.isArray(analysis.objects)) {
    analysis.objects.forEach((obj: unknown) => {
      if (typeof obj === "string") tags.add(obj.toLowerCase().trim());
    });
  }

  if (Array.isArray(analysis.colors)) {
    analysis.colors.forEach((color: unknown) => {
      if (typeof color === "string") tags.add(color.toLowerCase().trim());
    });
  }

  if (typeof analysis.style === "string") {
    tags.add(analysis.style.toLowerCase().trim());
  }

  if (typeof analysis.mood === "string") {
    tags.add(analysis.mood.toLowerCase().trim());
  }

  if (Array.isArray(analysis.visualElements)) {
    analysis.visualElements.forEach((el: unknown) => {
      if (typeof el === "string") tags.add(el.toLowerCase().trim());
    });
  }

  // Filter out empty strings and limit to top 15
  return Array.from(tags).filter(t => t.length > 0).slice(0, 15);
}

export async function applyAutoTags(imageId: string): Promise<void> {
  try {
    // Fetch latest completed job with analysis for this image
    const job = await prisma.imageEnhancementJob.findFirst({
      where: {
        imageId,
        analysisResult: { not: Prisma.DbNull },
      },
      orderBy: { createdAt: "desc" },
      select: { analysisResult: true },
    });

    if (!job || !job.analysisResult) {
      return;
    }

    const tags = extractTagsFromAnalysis(job.analysisResult);

    if (tags.length > 0) {
      await prisma.enhancedImage.update({
        where: { id: imageId },
        data: { tags },
      });
      logger.info(
        `[AutoTagger] Applied ${tags.length} tags to image ${imageId}`,
      );
    }
  } catch (error) {
    logger.error(`[AutoTagger] Failed to apply tags for image ${imageId}`, {
      error,
    });
  }
}
