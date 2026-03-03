import { describe, it, expect, vi } from "vitest";
import { createResolvers } from "./resolvers.ts";
import { ImageStudioResolverError } from "@spike-land-ai/mcp-image-studio";

describe("resolvers", () => {
  const db = {
    imageFindById: vi.fn(),
    albumFindByHandle: vi.fn(),
    pipelineFindById: vi.fn(),
    jobFindById: vi.fn(),
    generationJobFindById: vi.fn()
  } as any;

  const resolvers = createResolvers(db, "user-1");

  it("resolveImage", async () => {
    db.imageFindById.mockResolvedValueOnce(null);
    await expect(resolvers.resolveImage("img-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.imageFindById.mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveImage("img-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.imageFindById.mockResolvedValueOnce({ userId: "user-1", id: "img-1" });
    const img = await resolvers.resolveImage("img-1" as any);
    expect(img.id).toBe("img-1");
  });

  it("resolveAlbum", async () => {
    db.albumFindByHandle.mockResolvedValueOnce(null);
    await expect(resolvers.resolveAlbum("alb-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.albumFindByHandle.mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveAlbum("alb-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.albumFindByHandle.mockResolvedValueOnce({ userId: "user-1", handle: "alb-1" });
    const alb = await resolvers.resolveAlbum("alb-1" as any);
    expect(alb.handle).toBe("alb-1");
  });

  it("resolvePipeline", async () => {
    db.pipelineFindById.mockResolvedValueOnce(null);
    await expect(resolvers.resolvePipeline("pipe-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.pipelineFindById.mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolvePipeline("pipe-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.pipelineFindById.mockResolvedValueOnce({ userId: "other" });
    const p1 = await resolvers.resolvePipeline("pipe-1" as any, { requireOwnership: false });
    expect(p1).toBeDefined();

    db.pipelineFindById.mockResolvedValueOnce({ userId: "user-1", id: "pipe-1" });
    const p2 = await resolvers.resolvePipeline("pipe-1" as any);
    expect(p2.id).toBe("pipe-1");
  });

  it("resolveJob", async () => {
    db.jobFindById.mockResolvedValueOnce(null);
    await expect(resolvers.resolveJob("job-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.jobFindById.mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveJob("job-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.jobFindById.mockResolvedValueOnce({ userId: "user-1", id: "job-1" });
    const job = await resolvers.resolveJob("job-1" as any);
    expect(job.id).toBe("job-1");
  });

  it("resolveGenerationJob", async () => {
    db.generationJobFindById.mockResolvedValueOnce(null);
    await expect(resolvers.resolveGenerationJob("gjob-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.generationJobFindById.mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveGenerationJob("gjob-1" as any)).rejects.toThrow(ImageStudioResolverError);

    db.generationJobFindById.mockResolvedValueOnce({ userId: "user-1", id: "gjob-1" });
    const job = await resolvers.resolveGenerationJob("gjob-1" as any);
    expect(job.id).toBe("gjob-1");
  });

  it("resolveImages", async () => {
    db.imageFindById.mockResolvedValueOnce(null);
    await expect(resolvers.resolveImages(["img-1" as any])).rejects.toThrow(ImageStudioResolverError);

    db.imageFindById.mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveImages(["img-1" as any])).rejects.toThrow(ImageStudioResolverError);

    db.imageFindById.mockResolvedValueOnce({ userId: "user-1", id: "img-1" });
    const imgs = await resolvers.resolveImages(["img-1" as any]);
    expect(imgs[0].id).toBe("img-1");
  });
});
