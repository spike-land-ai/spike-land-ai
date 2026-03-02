import { beforeEach, describe, expect, it } from "vitest";
import {
  createMockImageStudioDeps,
  mockGenerationJobRow,
  mockJobRow,
} from "../__test-utils__/mock-deps.js";
import { jobStatus } from "./job-status.js";
import type { ToolContext } from "../types.js";
import { asImageId, asJobId } from "../types.js";

describe("jobStatus", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should return generation job when found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(
      mockGenerationJobRow({
        id: asJobId("g-1"),
        userId,
        status: "PENDING",
        prompt: "test",
      }),
    );

    const result = await jobStatus({ job_id: "g-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.type).toBe("GENERATE");
    expect(data.id).toBe("g-1");
    expect(data.status).toBe("PENDING");
    expect(data.prompt).toBe("test");
    expect(data.tier).toBe("TIER_1K");
  });

  it("should return generation output url when completed", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(
      mockGenerationJobRow({
        id: asJobId("g-1"),
        userId,
        status: "COMPLETED",
        prompt: "test",
        outputImageUrl: "https://example.com/out.png",
        outputWidth: 1024,
        outputHeight: 1024,
      }),
    );

    const result = await jobStatus({ job_id: "g-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.type).toBe("GENERATE");
    expect(data.status).toBe("COMPLETED");
    expect(data.outputUrl).toBe("https://example.com/out.png");
    expect(data.width).toBe(1024);
    expect(data.height).toBe(1024);
  });

  it("should return generation error when failed", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(
      mockGenerationJobRow({
        id: asJobId("g-1"),
        userId,
        status: "FAILED",
        prompt: "test",
        errorMessage: "Burned",
      }),
    );

    const result = await jobStatus({ job_id: "g-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.type).toBe("GENERATE");
    expect(data.status).toBe("FAILED");
    expect(data.error).toBe("Burned");
  });

  it("should return NOT_FOUND if explicitly generation type and not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(null);

    const result = await jobStatus({ job_id: "g-1", job_type: "generation" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_FOUND");
    expect(mocks.db.jobFindById).not.toHaveBeenCalled();
  });

  it("should fallback to enhancement job if not found in generation", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(null);
    mocks.db.jobFindById.mockResolvedValue(
      mockJobRow({
        id: asJobId("e-1"),
        userId,
        status: "PENDING",
        imageId: asImageId("img-1"),
      }),
    );

    const result = await jobStatus({ job_id: "e-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe("e-1");
    expect(data.type).toBe("ENHANCEMENT");
    expect(data.status).toBe("PENDING");
    expect(data.imageId).toBe("img-1");
  });

  it("should return enhancement COMPLETED with enhancedUrl and dimensions", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(null);
    mocks.db.jobFindById.mockResolvedValue(
      mockJobRow({
        id: asJobId("e-1"),
        userId,
        status: "COMPLETED",
        enhancedUrl: "https://example.com/enhanced.png",
        enhancedWidth: 2048,
        enhancedHeight: 2048,
        imageId: asImageId("img-1"),
      }),
    );

    const result = await jobStatus({ job_id: "e-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("COMPLETED");
    expect(data.enhancedUrl).toBe("https://example.com/enhanced.png");
    expect(data.width).toBe(2048);
    expect(data.height).toBe(2048);
  });

  it("should return enhancement FAILED with error message", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(null);
    mocks.db.jobFindById.mockResolvedValue(
      mockJobRow({
        id: asJobId("e-1"),
        userId,
        status: "FAILED",
        errorMessage: "Enhancement failed: timeout",
        imageId: asImageId("img-1"),
      }),
    );

    const result = await jobStatus({ job_id: "e-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.status).toBe("FAILED");
    expect(data.error).toBe("Enhancement failed: timeout");
  });

  it("should return NOT_FOUND if enhancement job mismatch user", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(null);
    mocks.db.jobFindById.mockResolvedValue(
      mockJobRow({
        id: asJobId("e-1"),
        userId: "other",
        status: "PENDING",
      }),
    );

    const result = await jobStatus({ job_id: "e-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_FOUND");
  });

  it("should return NOT_FOUND if completely not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(null);
    mocks.db.jobFindById.mockResolvedValue(null);

    const result = await jobStatus({ job_id: "miss" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_FOUND");
  });

  it("should check enhancement job directly if type is enhancement", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindById.mockResolvedValue(
      mockJobRow({
        id: asJobId("e-1"),
        userId,
        status: "PENDING",
        imageId: asImageId("img-1"),
      }),
    );

    const result = await jobStatus({ job_id: "e-1", job_type: "enhancement" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(mocks.resolverMocks.resolveGenerationJob).not.toHaveBeenCalled();
    expect(mocks.db.jobFindById).toHaveBeenCalledWith(asJobId("e-1"));
    const data = JSON.parse(result.content[0].text);
    expect(data.id).toBe("e-1");
  });

  it("should process image_ids batch", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany
      .mockResolvedValueOnce([
        mockJobRow({
          id: asJobId("j-1"),
          status: "COMPLETED",
          enhancedUrl: "url1",
        }),
      ])
      .mockResolvedValueOnce([]);

    const result = await jobStatus({ image_ids: ["img-1", "img-2"] }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.statuses).toHaveLength(2);
    expect(data.statuses[0]).toEqual({
      imageId: "img-1",
      jobId: "j-1",
      status: "COMPLETED",
      enhancedUrl: "url1",
    });
    expect(data.statuses[0].enhancedUrl).toBe("url1");
    expect(data.statuses[1]).toEqual({
      imageId: "img-2",
      jobId: null,
      status: "NO_JOB",
      enhancedUrl: null,
    });
  });

  it("should return NO_JOB for image without enhancement jobs", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockResolvedValue([]);

    const result = await jobStatus({ image_ids: ["img-solo"] }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.statuses).toHaveLength(1);
    expect(data.statuses[0].status).toBe("NO_JOB");
    expect(data.statuses[0].jobId).toBeNull();
  });

  it("should return BATCH_STATUS_FAILED when jobFindMany throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockRejectedValue(new Error("DB down"));

    const result = await jobStatus({ image_ids: ["img-1"] }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("BATCH_STATUS_FAILED");
  });

  it("should return error if neither provided", async () => {
    const ctx: ToolContext = { userId, deps };

    const result = await jobStatus({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("INVALID_INPUT");
  });

  it("should return NOT_FOUND when enhancement job lookup returns null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveGenerationJob.mockResolvedValue(null);
    mocks.db.jobFindById.mockResolvedValue(null);

    const result = await jobStatus({ job_id: "e-null", job_type: "enhancement" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_FOUND");
    // Should skip generation lookup when type is enhancement
    expect(mocks.resolverMocks.resolveGenerationJob).not.toHaveBeenCalled();
  });

  it("should return NO_JOB status when jobFindMany returns null for batch image lookup", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockResolvedValue(null);

    const result = await jobStatus({ image_ids: ["img-empty"] }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.statuses).toHaveLength(1);
    expect(data.statuses[0].status).toBe("NO_JOB");
    expect(data.statuses[0].enhancedUrl).toBeNull();
  });

  it("should report null jobId when jobFindMany returns null for image", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.jobFindMany.mockResolvedValue(null);

    const result = await jobStatus({ image_ids: ["img-null"] }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.statuses).toHaveLength(1);
    expect(data.statuses[0].jobId).toBeNull();
    expect(data.statuses[0].status).toBe("NO_JOB");
  });
});
