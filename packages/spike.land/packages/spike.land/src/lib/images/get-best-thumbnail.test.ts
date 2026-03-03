import { describe, expect, it } from "vitest";

import type { ImageEnhancementJob } from "@prisma/client";

import { getBestEnhancement, getBestThumbnail } from "./get-best-thumbnail";

import type { ImageWithJobs } from "./get-best-thumbnail";

function makeJob(
  tier: "FREE" | "TIER_1K" | "TIER_2K" | "TIER_4K",
  status: string,
  enhancedUrl: string | null = `https://cdn.example.com/${tier}.jpg`,
): ImageEnhancementJob {
  return {
    id: `job-${tier}`,
    tier,
    status,
    enhancedUrl,
    imageId: "img-1",
    createdAt: new Date(),
    updatedAt: new Date(),
    startedAt: null,
    completedAt: null,
    failedAt: null,
    error: null,
    originalUrl: "https://cdn.example.com/original.jpg",
    creditsUsed: 0,
    processingTimeMs: null,
    model: null,
    metadata: null,
  } as unknown as ImageEnhancementJob;
}

function makeImage(
  jobs: ReturnType<typeof makeJob>[],
): ImageWithJobs {
  return {
    id: "img-1",
    originalUrl: "https://cdn.example.com/original.jpg",
    enhancementJobs: jobs,
    userId: "user-1",
    albumId: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    filename: "photo.jpg",
    mimeType: "image/jpeg",
    sizeBytes: 1024,
    width: 800,
    height: 600,
    r2Key: "r2/photo.jpg",
    thumbnailUrl: null,
    metadata: null,
    sortOrder: 0,
  } as unknown as ImageWithJobs;
}

describe("getBestEnhancement", () => {
  it("returns null for empty jobs", () => {
    expect(getBestEnhancement([])).toBeNull();
  });

  it("returns null when no COMPLETED jobs", () => {
    const jobs = [
      makeJob("TIER_4K", "PROCESSING"),
      makeJob("TIER_2K", "FAILED"),
    ];
    expect(getBestEnhancement(jobs)).toBeNull();
  });

  it("returns highest tier completed job", () => {
    const jobs = [
      makeJob("FREE", "COMPLETED"),
      makeJob("TIER_2K", "COMPLETED"),
      makeJob("TIER_1K", "COMPLETED"),
    ];
    const best = getBestEnhancement(jobs);
    expect(best?.tier).toBe("TIER_2K");
  });

  it("prefers TIER_4K over all others", () => {
    const jobs = [
      makeJob("TIER_4K", "COMPLETED"),
      makeJob("TIER_2K", "COMPLETED"),
      makeJob("TIER_1K", "COMPLETED"),
      makeJob("FREE", "COMPLETED"),
    ];
    const best = getBestEnhancement(jobs);
    expect(best?.tier).toBe("TIER_4K");
  });

  it("ignores completed jobs with null enhancedUrl", () => {
    const jobs = [
      makeJob("TIER_4K", "COMPLETED", null),
      makeJob("TIER_1K", "COMPLETED"),
    ];
    const best = getBestEnhancement(jobs);
    expect(best?.tier).toBe("TIER_1K");
  });
});

describe("getBestThumbnail", () => {
  it("returns original when preferEnhanced is false", () => {
    const image = makeImage([makeJob("TIER_4K", "COMPLETED")]);
    expect(getBestThumbnail(image, false)).toBe(image.originalUrl);
  });

  it("returns enhanced URL when preferEnhanced is true", () => {
    const image = makeImage([makeJob("TIER_2K", "COMPLETED")]);
    expect(getBestThumbnail(image, true)).toBe(
      "https://cdn.example.com/TIER_2K.jpg",
    );
  });

  it("falls back to original when no enhancements available", () => {
    const image = makeImage([]);
    expect(getBestThumbnail(image, true)).toBe(image.originalUrl);
  });
});
