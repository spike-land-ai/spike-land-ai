import { beforeEach, describe, expect, it } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { list } from "./list.js";
import type { ToolContext } from "../types.js";

describe("list", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should list images with defaults", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.imageFindMany.mockResolvedValue([
      mockImageRow({ userId, name: "img1.jpg" }),
      mockImageRow({ userId, name: "img2.jpg" }),
    ]);

    const result = await list({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(2);
    expect(data.images).toHaveLength(2);
    expect(data.cursor).toBeUndefined();
    expect(data.query).toBeUndefined();
  });

  it("should pass limit and cursor to db", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.imageFindMany.mockResolvedValue([]);

    await list({ limit: 5, cursor: "img-last" }, ctx);

    expect(mocks.db.imageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ userId, limit: 5, cursor: "img-last" }),
    );
  });

  it("should search images by query", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.imageFindMany.mockResolvedValue([mockImageRow({ userId, name: "sunset.jpg" })]);

    const result = await list({ query: "sunset" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.query).toBe("sunset");
    expect(data.cursor).toBeUndefined();
    expect(mocks.db.imageFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ search: "sunset", cursor: undefined }),
    );
  });

  it("should return empty list when no images found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.imageFindMany.mockResolvedValue([]);

    const result = await list({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(0);
    expect(data.images).toHaveLength(0);
  });

  it("should return error when db fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.imageFindMany.mockRejectedValue(new Error("DB error"));

    const result = await list({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LIST_FAILED");
  });

  it("should return empty list when db returns null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.imageFindMany.mockResolvedValue(null);

    const result = await list({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(0);
    expect(data.images).toHaveLength(0);
  });

  it("should map image fields correctly", async () => {
    const ctx: ToolContext = { userId, deps };
    const img = mockImageRow({
      userId,
      name: "landscape.png",
      originalUrl: "https://r2.spike.land/landscape.png",
      tags: ["nature", "green"],
    });
    mocks.db.imageFindMany.mockResolvedValue([img]);

    const result = await list({}, ctx);

    const data = JSON.parse(result.content[0].text);
    const mapped = data.images[0];
    expect(mapped.id).toBe(img.id);
    expect(mapped.name).toBe("landscape.png");
    expect(mapped.url).toBe("https://r2.spike.land/landscape.png");
    expect(mapped.tags).toEqual(["nature", "green"]);
  });
});
