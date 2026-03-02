import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { createDeleteTool, deleteImage } from "./delete.js";
import type { ImageStudioDeps, ToolContext } from "../types.js";

describe("deleteImage", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should delete an image successfully", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const image = mockImageRow({ userId, originalR2Key: "key/to/delete" });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    mocks.storage.delete.mockResolvedValue(undefined);
    mocks.db.imageDelete.mockResolvedValue(undefined);

    const result = await deleteImage({ image_id: image.id, confirm: true }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image:deleted", entityId: image.id }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.deleted).toBe(true);
    expect(data.image_id).toBe(image.id);
    expect(mocks.storage.delete).toHaveBeenCalledWith("key/to/delete");
  });

  it("should return error when confirm is false", async () => {
    const ctx: ToolContext = { userId, deps };
    const result = await deleteImage({ image_id: "img-1", confirm: false }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Set confirm=true");
  });

  it("should return error when image not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(null);

    const result = await deleteImage({ image_id: "missing-id", confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return error when storage delete fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ userId, originalR2Key: "key/fail" }),
    );
    mocks.storage.delete.mockRejectedValue(new Error("Storage unavailable"));

    const result = await deleteImage({ image_id: "img-1", confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("STORAGE_ERROR");
    expect(mocks.db.imageDelete).not.toHaveBeenCalled();
  });

  it("should return error when db delete fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.storage.delete.mockResolvedValue(undefined);
    mocks.db.imageDelete.mockRejectedValue(new Error("DB error"));

    const result = await deleteImage({ image_id: "img-1", confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DELETE_FAILED");
  });

  it("should return error when resolver throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockRejectedValue(new Error("Network error"));

    const result = await deleteImage({ image_id: "img-1", confirm: true }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });
});

describe("createDeleteTool (new builder)", () => {
  const userId = "u1";
  let deps: ImageStudioDeps;
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should produce a BuiltTool with correct metadata", () => {
    const tool = createDeleteTool(userId, deps);
    expect(tool.name).toBe("delete");
    expect(tool.description).toBe("Delete an image from the library");
    expect(tool.inputSchema).toHaveProperty("image_id");
    expect(tool.inputSchema).toHaveProperty("confirm");
    expect(tool.outputSchema).toBeDefined();
  });

  it("should delete an image via the new builder handler", async () => {
    const notify = vi.fn();
    const image = mockImageRow({ userId, originalR2Key: "key/to/delete" });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    mocks.storage.delete.mockResolvedValue(undefined);
    mocks.db.imageDelete.mockResolvedValue(undefined);

    const tool = createDeleteTool(userId, deps, notify);
    const result = await tool.handler({ image_id: image.id, confirm: true });

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image:deleted", entityId: image.id }),
    );
    const data = JSON.parse(result.content[0].text!);
    expect(data.deleted).toBe(true);
    expect(data.image_id).toBe(image.id);
    expect(mocks.storage.delete).toHaveBeenCalledWith("key/to/delete");
  });

  it("should return error when confirm is false", async () => {
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    const tool = createDeleteTool(userId, deps);
    const result = await tool.handler({ image_id: "img-1", confirm: false });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Set confirm=true");
  });

  it("should return error when image not found", async () => {
    mocks.resolverMocks.resolveImage.mockResolvedValue(null);

    const tool = createDeleteTool(userId, deps);
    const result = await tool.handler({
      image_id: "missing-id",
      confirm: true,
    });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return error for unauthorized access", async () => {
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ userId: "other-user", originalR2Key: "key" }),
    );

    const tool = createDeleteTool(userId, deps);
    const result = await tool.handler({ image_id: "img-1", confirm: true });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("UNAUTHORIZED");
  });

  it("should return error when storage delete fails", async () => {
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ userId, originalR2Key: "key/fail" }),
    );
    mocks.storage.delete.mockRejectedValue(new Error("Storage unavailable"));

    const tool = createDeleteTool(userId, deps);
    const result = await tool.handler({ image_id: "img-1", confirm: true });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("STORAGE_ERROR");
    expect(mocks.db.imageDelete).not.toHaveBeenCalled();
  });

  it("should return error when db delete fails", async () => {
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.storage.delete.mockResolvedValue(undefined);
    mocks.db.imageDelete.mockRejectedValue(new Error("DB error"));

    const tool = createDeleteTool(userId, deps);
    const result = await tool.handler({ image_id: "img-1", confirm: true });

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("DELETE_FAILED");
  });

  it("should validate input schema", async () => {
    const tool = createDeleteTool(userId, deps);
    const result = await tool.handler({} as never);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Validation Error");
  });
});
