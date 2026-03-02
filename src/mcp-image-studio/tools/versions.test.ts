import { beforeEach, describe, expect, it } from "vitest";
import {
  createMockImageStudioDeps,
  mockImageRow,
  mockJobRow,
} from "../__test-utils__/mock-deps.js";
import { versions } from "./versions.js";
import type { ToolContext } from "../types.js";

describe("versions", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should list enhancement versions for an image", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({ userId, name: "photo.jpg" });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    const job1 = mockJobRow({ userId, status: "COMPLETED", tier: "TIER_1K" });
    const job2 = mockJobRow({ userId, status: "PENDING", tier: "TIER_2K" });
    mocks.db.jobFindMany.mockResolvedValue([job1, job2]);

    const result = await versions({ image_id: image.id }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.imageId).toBe(image.id);
    expect(data.imageName).toBe("photo.jpg");
    expect(data.count).toBe(2);
    expect(data.versions).toHaveLength(2);
    expect(data.versions[0].status).toBe("COMPLETED");
    expect(data.versions[1].status).toBe("PENDING");
  });

  it("should return empty versions list when no jobs exist", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({ userId, name: "fresh.jpg" });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    mocks.db.jobFindMany.mockResolvedValue([]);

    const result = await versions({ image_id: image.id }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(0);
    expect(data.versions).toHaveLength(0);
  });

  it("should return empty versions when jobFindMany fails", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({ userId, name: "err.jpg" });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    mocks.db.jobFindMany.mockRejectedValue(new Error("DB error"));

    const result = await versions({ image_id: image.id }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(0);
    expect(data.versions).toHaveLength(0);
  });

  it("should return error when image not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(null);

    const result = await versions({ image_id: "missing-id" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return error when resolver throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockRejectedValue(new Error("Network error"));

    const result = await versions({ image_id: "img-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should map job fields correctly", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({ userId });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    const job = mockJobRow({
      userId,
      tier: "TIER_4K",
      creditsCost: 10,
      enhancedUrl: "https://r2.spike.land/enhanced.jpg",
      enhancedWidth: 4096,
      enhancedHeight: 4096,
    });
    mocks.db.jobFindMany.mockResolvedValue([job]);

    const result = await versions({ image_id: image.id }, ctx);

    const data = JSON.parse(result.content[0].text);
    const v = data.versions[0];
    expect(v.jobId).toBe(job.id);
    expect(v.tier).toBe("TIER_4K");
    expect(v.creditsCost).toBe(10);
    expect(v.enhancedUrl).toBe("https://r2.spike.land/enhanced.jpg");
    expect(v.enhancedWidth).toBe(4096);
    expect(v.enhancedHeight).toBe(4096);
  });
});
