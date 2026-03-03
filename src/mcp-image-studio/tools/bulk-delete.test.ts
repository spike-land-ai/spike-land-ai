import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { bulkDelete } from "./bulk-delete.js";
import type { ToolContext } from "../types.js";
import { asImageId, MAX_BATCH_SIZE } from "../types.js";

describe("bulkDelete", () => {
  const userId = "test-user-123";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should delete 3 images successfully", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const images = [
      mockImageRow({ id: asImageId("img-1"), userId, originalR2Key: "key-1" }),
      mockImageRow({ id: asImageId("img-2"), userId, originalR2Key: "key-2" }),
      mockImageRow({ id: asImageId("img-3"), userId, originalR2Key: "key-3" }),
    ];
    mocks.resolverMocks.resolveImages.mockResolvedValue(images);
    mocks.storage.delete.mockResolvedValue(undefined);
    mocks.db.imageDelete.mockResolvedValue(undefined);

    const result = await bulkDelete({ image_ids: ["img-1", "img-2", "img-3"], confirm: true }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledTimes(3);
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image:deleted", entityId: "img-1" }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(3);
    expect(data.failed).toBe(0);
    expect(data.total).toBe(3);
    expect(mocks.storage.delete).toHaveBeenCalledTimes(3);
    expect(mocks.db.imageDelete).toHaveBeenCalledTimes(3);
  });

  it("should return error when confirm is false", async () => {
    const ctx: ToolContext = { userId, deps };
    const result = await bulkDelete({ image_ids: ["img-1"], confirm: false }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Set confirm=true");
  });

  it("should return error when image_ids is empty", async () => {
    const ctx: ToolContext = { userId, deps };
    const result = await bulkDelete({ image_ids: [], confirm: true }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });

  it("should return error when too many images", async () => {
    const tooMany = Array.from({ length: MAX_BATCH_SIZE + 1 }, (_, i) => `img-${i}`);

    const ctx: ToolContext = { userId, deps };
    const result = await bulkDelete({ image_ids: tooMany, confirm: true }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain(`Validation Error`);
  });

  it("should return error when resolveImages fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockRejectedValue(new Error("Not found"));

    const result = await bulkDelete({ image_ids: ["img-1", "img-2"], confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("RESOLVE_FAILED");
  });

  it("should return RESOLVE_FAILED when resolveImages returns null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockResolvedValue(null);

    const result = await bulkDelete({ image_ids: ["img-1"], confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("RESOLVE_FAILED");
  });

  it("should count db deletion failure as failed", async () => {
    const ctx: ToolContext = { userId, deps };
    const images = [mockImageRow({ id: asImageId("img-1"), userId, originalR2Key: "key-1" })];
    mocks.resolverMocks.resolveImages.mockResolvedValue(images);
    mocks.storage.delete.mockResolvedValue(undefined);
    mocks.db.imageDelete.mockRejectedValue(new Error("DB error"));

    const result = await bulkDelete({ image_ids: ["img-1"], confirm: true }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(0);
    expect(data.failed).toBe(1);
  });

  it("should handle partial failure when storage.delete fails for one image", async () => {
    const ctx: ToolContext = { userId, deps };
    const images = [
      mockImageRow({ id: asImageId("img-1"), userId, originalR2Key: "key-1" }),
      mockImageRow({ id: asImageId("img-2"), userId, originalR2Key: "key-2" }),
      mockImageRow({ id: asImageId("img-3"), userId, originalR2Key: "key-3" }),
    ];
    mocks.resolverMocks.resolveImages.mockResolvedValue(images);
    mocks.storage.delete
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error("Storage unavailable"))
      .mockResolvedValueOnce(undefined);
    mocks.db.imageDelete.mockResolvedValue(undefined);

    const result = await bulkDelete({ image_ids: ["img-1", "img-2", "img-3"], confirm: true }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(2);
    expect(data.failed).toBe(1);
    expect(data.total).toBe(3);
    // db.imageDelete should only be called for images where storage succeeded
    expect(mocks.db.imageDelete).toHaveBeenCalledTimes(2);
  });

  it("should use bulk optimization when available", async () => {
    const notify = vi.fn();
    const ctx = { userId, deps, notify };
    const images = [
      mockImageRow({ id: asImageId("img-1"), userId, originalR2Key: "key-1" }),
      mockImageRow({ id: asImageId("img-2"), userId, originalR2Key: "key-2" }),
    ];
    mocks.resolverMocks.resolveImages.mockResolvedValue(images);
    
    deps.db.imageDeleteMany = vi.fn().mockResolvedValue(2);
    deps.storage.deleteMany = vi.fn().mockResolvedValue(2);

    const result = await bulkDelete({ image_ids: ["img-1", "img-2"], confirm: true }, ctx);

    expect(result.isError).toBeUndefined();
    expect(deps.storage.deleteMany).toHaveBeenCalledWith(["key-1", "key-2"]);
    expect(deps.db.imageDeleteMany).toHaveBeenCalledWith(["img-1", "img-2"]);
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(2);
    expect(data.failed).toBe(0);
  });

  it("should throw DomainError when storage.deleteMany fails", async () => {
    const ctx = { userId, deps };
    const images = [mockImageRow({ id: asImageId("img-1"), userId, originalR2Key: "key-1" })];
    mocks.resolverMocks.resolveImages.mockResolvedValue(images);
    
    deps.db.imageDeleteMany = vi.fn();
    deps.storage.deleteMany = vi.fn().mockRejectedValue(new Error("Bulk storage err"));

    const result = await bulkDelete({ image_ids: ["img-1"], confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("STORAGE_ERROR");
  });

  it("should throw DomainError when db.imageDeleteMany fails", async () => {
    const ctx = { userId, deps };
    const images = [mockImageRow({ id: asImageId("img-1"), userId, originalR2Key: "key-1" })];
    mocks.resolverMocks.resolveImages.mockResolvedValue(images);
    
    deps.db.imageDeleteMany = vi.fn().mockRejectedValue(new Error("Bulk DB err"));
    deps.storage.deleteMany = vi.fn().mockResolvedValue(1);

    const result = await bulkDelete({ image_ids: ["img-1"], confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DB_ERROR");
  });
});
