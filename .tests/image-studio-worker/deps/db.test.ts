import type {
  AlbumHandle,
  ImageId,
  _ImageRow,
  JobId,
  PipelineId,
} from "@spike-land-ai/mcp-image-studio";
import { describe, expect, it, vi } from "vitest";
import { createD1Db } from "../../../src/edge-api/image-studio-worker/mcp/db.ts";

describe("db", () => {
  const createMockDb = () => {
    const mockRun = vi.fn().mockResolvedValue({ meta: { changes: 1 } });
    const mockFirst = vi.fn().mockResolvedValue({});
    const mockAll = vi.fn().mockResolvedValue({ results: [{}] });
    const bind = vi.fn().mockReturnValue({
      run: mockRun,
      first: mockFirst,
      all: mockAll,
    });
    const prepare = vi.fn().mockReturnValue({ bind });
    return { prepare, mockRun, mockFirst, mockAll, bind };
  };

  it("imageCreate", async () => {
    const d1 = createMockDb();
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    const res = await db.imageCreate({
      userId: "u",
      name: "n",
      originalUrl: "url",
      originalR2Key: "k",
      originalWidth: 1,
      originalHeight: 1,
      originalSizeBytes: 1,
      originalFormat: "png",
      isPublic: false,
      tags: [],
      shareToken: null,
    });
    expect(res.name).toBe("n");
  });

  it("imageFindById", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "img-1", tags: "[]" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    const res = await db.imageFindById("img-1" as ImageId);
    expect(res?.id).toBe("img-1");

    d1.mockFirst.mockResolvedValueOnce(null);
    expect(await db.imageFindById("img-2" as ImageId)).toBeNull();
  });

  it("imageFindMany", async () => {
    const d1 = createMockDb();
    d1.mockAll.mockResolvedValueOnce({
      results: [{ id: "img-1", tags: "[]" }],
    });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    const res = await db.imageFindMany({
      userId: "u",
      search: "test",
      limit: 10,
    });
    expect(res.length).toBe(1);
  });

  it("imageDelete", async () => {
    const d1 = createMockDb();
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.imageDelete("img-1" as ImageId);
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("imageUpdate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "img-1", tags: "[]" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.imageUpdate("img-1" as ImageId, {
      name: "n",
      description: "d",
      tags: [],
      isPublic: true,
      shareToken: "t",
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("imageCount", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ count: 5 });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    expect(await db.imageCount("u")).toBe(5);
  });

  it("jobCreate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "job-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.jobCreate({
      imageId: "img" as ImageId,
      userId: "u",
      tier: "FREE",
      creditsCost: 0,
      status: "PENDING",
      processingStartedAt: new Date(),
      metadata: null,
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("jobFindById", async () => {
    const d1 = createMockDb();
    d1.mockFirst
      .mockResolvedValueOnce({ id: "job-1", imageId: "img-1" })
      .mockResolvedValueOnce({ id: "img-1", name: "n", originalUrl: "url" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    const res = await db.jobFindById("job-1" as JobId);
    expect(res?.id).toBe("job-1");
    expect(res?.image?.id).toBe("img-1");

    d1.mockFirst.mockResolvedValueOnce(null);
    expect(await db.jobFindById("job-2" as JobId)).toBeNull();
  });

  it("jobFindMany", async () => {
    const d1 = createMockDb();
    d1.mockAll.mockResolvedValueOnce({ results: [{ id: "job-1" }] });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.jobFindMany({
      userId: "u",
      imageId: "img-1" as ImageId,
      status: "PENDING",
      limit: 10,
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("jobUpdate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "job-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.jobUpdate("job-1" as JobId, {
      status: "COMPLETED",
      enhancedUrl: "u",
      enhancedR2Key: "k",
      enhancedWidth: 1,
      enhancedHeight: 1,
      enhancedSizeBytes: 1,
      errorMessage: "e",
      processingCompletedAt: new Date(),
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("albumCreate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "alb-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.albumCreate({
      handle: "h" as AlbumHandle,
      userId: "u",
      name: "n",
      description: "d",
      coverImageId: "img-1" as ImageId,
      privacy: "PUBLIC",
      defaultTier: "FREE",
      shareToken: "t",
      sortOrder: 0,
      pipelineId: "p" as PipelineId,
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("albumFindByHandle", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "alb-1" }).mockResolvedValueOnce({
      count: 5,
    });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    const res = await db.albumFindByHandle("h" as AlbumHandle);
    expect(res?.id).toBe("alb-1");

    d1.mockFirst.mockResolvedValueOnce(null);
    expect(await db.albumFindByHandle("h" as AlbumHandle)).toBeNull();
  });

  it("albumFindById", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "alb-1" }).mockResolvedValueOnce({
      count: 5,
    });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    const res = await db.albumFindById("alb-1");
    expect(res?.id).toBe("alb-1");

    d1.mockFirst.mockResolvedValueOnce(null);
    expect(await db.albumFindById("alb-2")).toBeNull();
  });

  it("albumFindMany", async () => {
    const d1 = createMockDb();
    d1.mockAll.mockResolvedValueOnce({ results: [{ id: "alb-1" }] });
    d1.mockFirst.mockResolvedValue({ count: 5 });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.albumFindMany({ userId: "u", limit: 10 });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("albumUpdate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "alb-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.albumUpdate("h" as AlbumHandle, {
      name: "n",
      description: "d",
      coverImageId: "img-1" as ImageId,
      privacy: "PRIVATE",
      defaultTier: "FREE",
      shareToken: "t",
      pipelineId: "p" as PipelineId,
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("albumDelete", async () => {
    const d1 = createMockDb();
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.albumDelete("h" as AlbumHandle);
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("albumMaxSortOrder", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ maxSort: 5 });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    expect(await db.albumMaxSortOrder("u")).toBe(5);
  });

  it("albumImageAdd", async () => {
    const d1 = createMockDb();
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    const res = await db.albumImageAdd("alb-1", "img-1" as ImageId, 1);
    expect(res?.albumId).toBe("alb-1");

    d1.mockRun.mockRejectedValueOnce(new Error("UNIQUE"));
    const res2 = await db.albumImageAdd("alb-1", "img-1" as ImageId, 1);
    expect(res2).toBeNull();
  });

  it("albumImageRemove", async () => {
    const d1 = createMockDb();
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.albumImageRemove("alb-1", ["img-1" as ImageId]);
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("albumImageReorder", async () => {
    const d1 = createMockDb();
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.albumImageReorder("alb-1", ["img-1" as ImageId]);
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("albumImageList", async () => {
    const d1 = createMockDb();
    d1.mockAll.mockResolvedValueOnce({
      results: [{ id: "ai-1", img_id: "img-1" }],
    });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.albumImageList("alb-1");
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("albumImageMaxSortOrder", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ maxSort: 5 });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    expect(await db.albumImageMaxSortOrder("alb-1")).toBe(5);
  });

  it("pipelineCreate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "p-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.pipelineCreate({
      name: "n",
      description: "d",
      userId: "u",
      visibility: "PRIVATE",
      tier: "FREE",
      analysisConfig: {},
      autoCropConfig: {},
      promptConfig: {},
      generationConfig: {},
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("pipelineFindById", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "p-1" }).mockResolvedValueOnce({
      count: 1,
    });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    const res = await db.pipelineFindById("p-1" as PipelineId);
    expect(res?.id).toBe("p-1");

    d1.mockFirst.mockResolvedValueOnce(null);
    expect(await db.pipelineFindById("p-2" as PipelineId)).toBeNull();
  });

  it("pipelineFindMany", async () => {
    const d1 = createMockDb();
    d1.mockAll.mockResolvedValueOnce({ results: [{ id: "p-1" }] });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.pipelineFindMany({ userId: "u", limit: 10 });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("pipelineUpdate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "p-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.pipelineUpdate("p-1" as PipelineId, {
      name: "n",
      description: "d",
      visibility: "PUBLIC",
      tier: "FREE",
      analysisConfig: {},
      autoCropConfig: {},
      promptConfig: {},
      generationConfig: {},
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("pipelineDelete", async () => {
    const d1 = createMockDb();
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.pipelineDelete("p-1" as PipelineId);
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("generationJobCreate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "gj-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.generationJobCreate({
      userId: "u",
      type: "GENERATE",
      tier: "FREE",
      creditsCost: 0,
      status: "PENDING",
      prompt: "p",
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("generationJobFindById", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "gj-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    const res = await db.generationJobFindById("gj-1" as JobId);
    expect(res?.id).toBe("gj-1");
  });

  it("toolCallCreate and Update and List", async () => {
    const d1 = createMockDb();
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    if (db.toolCallCreate) {
      await db.toolCallCreate({
        id: "tc-1",
        userId: "u",
        toolName: "t",
        args: "{}",
        durationMs: 0,
        isError: false,
        status: "COMPLETED",
        result: null,
      });
    }
    if (db.toolCallUpdate) {
      await db.toolCallUpdate("tc-1", {
        durationMs: 1,
        isError: true,
        status: "ERROR",
        result: "err",
      });
    }
    d1.mockAll.mockResolvedValueOnce({
      results: [
        {
          id: "tc-1",
          isError: 1,
          status: "ERROR",
          createdAt: new Date().toISOString(),
        },
      ],
    });
    if (db.toolCallList) {
      const calls = await db.toolCallList({ limit: 10 });
      expect(calls[0].id).toBe("tc-1");
    }
  });

  it("generationJobUpdate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "gj-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    await db.generationJobUpdate("gj-1" as JobId, {
      status: "COMPLETED",
      outputImageUrl: "u",
      outputWidth: 1,
      outputHeight: 1,
      outputSizeBytes: 1,
      errorMessage: "e",
      inputImageUrl: "i",
    });
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("subjectCreate", async () => {
    const d1 = createMockDb();
    d1.mockFirst.mockResolvedValueOnce({ id: "sub-1" });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    if (db.subjectCreate) {
      await db.subjectCreate({
        userId: "u",
        imageId: "img" as ImageId,
        label: "l",
        type: "character",
        description: "d",
      });
    }
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("subjectFindMany", async () => {
    const d1 = createMockDb();
    d1.mockAll.mockResolvedValueOnce({ results: [{ id: "sub-1" }] });
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    if (db.subjectFindMany) {
      await db.subjectFindMany({ userId: "u" });
    }
    expect(d1.prepare).toHaveBeenCalled();
  });

  it("subjectDelete", async () => {
    const d1 = createMockDb();
    const db = createD1Db({ IMAGE_DB: d1 as unknown as D1Database } as never);
    if (db.subjectDelete) {
      await db.subjectDelete("sub-1");
    }
    expect(d1.prepare).toHaveBeenCalled();
  });
});

