import { describe, expect, it, vi } from "vitest";
import { createResolvers } from "../../../src/edge-api/image-studio-worker/mcp/resolvers.ts";
import {
  type AlbumHandle,
  type ImageId,
  type ImageStudioDeps,
  ImageStudioResolverError,
  type JobId,
  type PipelineId,
} from "@spike-land-ai/mcp-image-studio";

describe("resolvers", () => {
  const db = {
    imageFindById: vi.fn(),
    albumFindByHandle: vi.fn(),
    pipelineFindById: vi.fn(),
    jobFindById: vi.fn(),
    generationJobFindById: vi.fn(),
  } as unknown as ImageStudioDeps["db"];

  const resolvers = createResolvers(db, "user-1");

  it("resolveImage", async () => {
    (db.imageFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(resolvers.resolveImage("img-1" as ImageId)).rejects.toThrow(ImageStudioResolverError);

    (db.imageFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveImage("img-1" as ImageId)).rejects.toThrow(ImageStudioResolverError);

    (db.imageFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "user-1", id: "img-1" });
    const img = await resolvers.resolveImage("img-1" as ImageId);
    expect(img.id).toBe("img-1");
  });

  it("resolveAlbum", async () => {
    (db.albumFindByHandle as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(resolvers.resolveAlbum("alb-1" as AlbumHandle)).rejects.toThrow(ImageStudioResolverError);

    (db.albumFindByHandle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveAlbum("alb-1" as AlbumHandle)).rejects.toThrow(ImageStudioResolverError);

    (db.albumFindByHandle as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      userId: "user-1",
      handle: "alb-1",
    });
    const alb = await resolvers.resolveAlbum("alb-1" as AlbumHandle);
    expect(alb.handle).toBe("alb-1");
  });

  it("resolvePipeline", async () => {
    (db.pipelineFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(resolvers.resolvePipeline("pipe-1" as PipelineId)).rejects.toThrow(
      ImageStudioResolverError,
    );

    (db.pipelineFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolvePipeline("pipe-1" as PipelineId)).rejects.toThrow(
      ImageStudioResolverError,
    );

    (db.pipelineFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "other" });
    const p1 = await resolvers.resolvePipeline("pipe-1" as PipelineId, {
      requireOwnership: false,
    });
    expect(p1).toBeDefined();

    (db.pipelineFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      userId: "user-1",
      id: "pipe-1",
    });
    const p2 = await resolvers.resolvePipeline("pipe-1" as PipelineId);
    expect(p2.id).toBe("pipe-1");
  });

  it("resolveJob", async () => {
    (db.jobFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(resolvers.resolveJob("job-1" as JobId)).rejects.toThrow(ImageStudioResolverError);

    (db.jobFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveJob("job-1" as JobId)).rejects.toThrow(ImageStudioResolverError);

    (db.jobFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "user-1", id: "job-1" });
    const job = await resolvers.resolveJob("job-1" as JobId);
    expect(job.id).toBe("job-1");
  });

  it("resolveGenerationJob", async () => {
    (db.generationJobFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(resolvers.resolveGenerationJob("gjob-1" as JobId)).rejects.toThrow(
      ImageStudioResolverError,
    );

    (db.generationJobFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveGenerationJob("gjob-1" as JobId)).rejects.toThrow(
      ImageStudioResolverError,
    );

    (db.generationJobFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      userId: "user-1",
      id: "gjob-1",
    });
    const job = await resolvers.resolveGenerationJob("gjob-1" as JobId);
    expect(job.id).toBe("gjob-1");
  });

  it("resolveImages", async () => {
    (db.imageFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce(null);
    await expect(resolvers.resolveImages(["img-1" as ImageId])).rejects.toThrow(
      ImageStudioResolverError,
    );

    (db.imageFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "other" });
    await expect(resolvers.resolveImages(["img-1" as ImageId])).rejects.toThrow(
      ImageStudioResolverError,
    );

    (db.imageFindById as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ userId: "user-1", id: "img-1" });
    const imgs = await resolvers.resolveImages(["img-1" as ImageId]);
    expect(imgs[0].id).toBe("img-1");
  });
});
