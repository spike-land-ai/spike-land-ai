import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { update } from "./update.js";
import type { ToolContext } from "../types.js";
import { asImageId } from "../types.js";

describe("update", () => {
  const userId = "test-user-123";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should update image name", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const image = mockImageRow({ userId });
    mocks.resolverMocks.resolveImages.mockResolvedValue([image]);
    mocks.db.imageUpdate.mockResolvedValue({ ...image, name: "new-name" });

    const result = await update({ image_id: "img-1", name: "new-name" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image:updated", entityId: "img-1" }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("new-name");
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith("img-1", { name: "new-name" });
  });

  it("should update image description", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({ userId });
    mocks.resolverMocks.resolveImages.mockResolvedValue([image]);
    mocks.db.imageUpdate.mockResolvedValue({
      ...image,
      description: "A sunset photo",
    });

    const result = await update(
      {
        image_id: "img-1",
        description: "A sunset photo",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.description).toBe("A sunset photo");
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith("img-1", { description: "A sunset photo" });
  });

  it("should update image tags", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({ userId });
    mocks.resolverMocks.resolveImages.mockResolvedValue([image]);
    mocks.db.imageUpdate.mockResolvedValue({
      ...image,
      tags: ["sunset", "beach"],
    });

    const result = await update(
      {
        image_id: "img-1",
        tags: ["sunset", "beach"],
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.tags).toEqual(["sunset", "beach"]);
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith("img-1", { tags: ["sunset", "beach"] });
  });

  it("should update all fields at once", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({ userId });
    mocks.resolverMocks.resolveImages.mockResolvedValue([image]);
    const updated = {
      ...image,
      name: "renamed",
      description: "updated desc",
      tags: ["a", "b"],
    };
    mocks.db.imageUpdate.mockResolvedValue(updated);

    const result = await update(
      {
        image_id: "img-1",
        name: "renamed",
        description: "updated desc",
        tags: ["a", "b"],
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("renamed");
    expect(data.description).toBe("updated desc");
    expect(data.tags).toEqual(["a", "b"]);
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith("img-1", {
      name: "renamed",
      description: "updated desc",
      tags: ["a", "b"],
    });
  });

  it("should return error when no fields provided", async () => {
    const ctx: ToolContext = { userId, deps };

    const result = await update({ image_id: "img-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NO_FIELDS");
  });

  it("should return error when imageUpdate fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImages.mockResolvedValue([
      mockImageRow({ id: asImageId("img-1"), userId }),
    ]);
    mocks.db.imageUpdate.mockRejectedValue(new Error("DB error"));

    const result = await update({ image_id: "img-1", name: "fail" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("UPDATE_FAILED");
  });
});
