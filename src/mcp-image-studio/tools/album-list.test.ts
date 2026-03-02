import { beforeEach, describe, expect, it } from "vitest";
import { createMockImageStudioDeps, mockAlbumRow } from "../__test-utils__/mock-deps.js";
import { albumList } from "./album-list.js";
import type { ToolContext } from "../types.js";

describe("albumList", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should list albums successfully", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindMany.mockResolvedValue([
      {
        ...mockAlbumRow({ userId, name: "Vacation" }),
        _count: { albumImages: 5 },
      },
      { ...mockAlbumRow({ userId, name: "Work" }), _count: { albumImages: 3 } },
    ]);

    const result = await albumList({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(2);
    expect(data.albums).toHaveLength(2);
    expect(data.albums[0].name).toBe("Vacation");
    expect(data.albums[0].image_count).toBe(5);
  });

  it("should pass limit to db", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindMany.mockResolvedValue([]);

    await albumList({ limit: 5 }, ctx);

    expect(mocks.db.albumFindMany).toHaveBeenCalledWith(
      expect.objectContaining({ userId, limit: 5 }),
    );
  });

  it("should use default limit of 20", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindMany.mockResolvedValue([]);

    await albumList({}, ctx);

    expect(mocks.db.albumFindMany).toHaveBeenCalledWith(expect.objectContaining({ limit: 20 }));
  });

  it("should return empty list when no albums exist", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindMany.mockResolvedValue([]);

    const result = await albumList({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(0);
    expect(data.albums).toHaveLength(0);
  });

  it("should return error when db fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumFindMany.mockRejectedValue(new Error("DB unavailable"));

    const result = await albumList({}, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("LIST_ALBUMS_FAILED");
  });

  it("should map album fields correctly", async () => {
    const ctx: ToolContext = { userId, deps };
    const row = {
      ...mockAlbumRow({
        userId,
        name: "Portfolio",
        privacy: "PUBLIC",
        defaultTier: "TIER_2K",
      }),
      _count: { albumImages: 12 },
    };
    mocks.db.albumFindMany.mockResolvedValue([row]);

    const result = await albumList({}, ctx);

    const data = JSON.parse(result.content[0].text);
    const a = data.albums[0];
    expect(a.album_handle).toBe("my-album");
    expect(a.name).toBe("Portfolio");
    expect(a.privacy).toBe("PUBLIC");
    expect(a.default_tier).toBe("TIER_2K");
    expect(a.image_count).toBe(12);
  });

  it("should gracefully map missing _count.albumImages to 0", async () => {
    const ctx: ToolContext = { userId, deps };
    const row = mockAlbumRow({
      userId,
      name: "Portfolio",
      privacy: "PUBLIC",
      defaultTier: "TIER_2K",
    });
    // Intentionally leaving _count undefined
    delete (row as unknown as Record<string, unknown>)._count;

    mocks.db.albumFindMany.mockResolvedValue([row]);

    const result = await albumList({}, ctx);

    const data = JSON.parse(result.content[0].text);
    const a = data.albums[0];
    expect(a.image_count).toBe(0);
  });

  it("should gracefully handle ok=true but data=null fallback to empty array", async () => {
    const ctx: ToolContext = { userId, deps };
    // Trigger `albumsResult.data ?? []`
    mocks.db.albumFindMany.mockResolvedValue(null as never);

    const result = await albumList({}, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.count).toBe(0);
    expect(data.albums).toHaveLength(0);
  });
});
