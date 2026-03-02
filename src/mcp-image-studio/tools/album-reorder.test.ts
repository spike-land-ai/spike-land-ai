import { beforeEach, describe, expect, it, vi } from "vitest";
import { z } from "zod";
import { createMockImageStudioDeps, mockAlbumRow } from "../__test-utils__/index.js";
import { albumReorderTool } from "./album-reorder.js";
import type { CallToolResult, ToolContext } from "../types.js";
import { asImageId, asAlbumHandle } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("albumReorder", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  const { deps: defaultDeps, mocks: defaultMocks } = createMockImageStudioDeps();
  defaultMocks.resolverMocks.resolveAlbum.mockResolvedValue(
    mockAlbumRow({ handle: asAlbumHandle("vacation"), userId }),
  );

  standardScenarios({
    handler: albumReorderTool.handler as unknown as (
      input: unknown,
      ctx: ToolContext,
    ) => Promise<CallToolResult>,
    validInput: {
      album_handle: "vacation",
      image_ids: ["img-1", "img-2", "img-3"],
    },
    deps: defaultDeps,
    resolvesAlbum: true,
  });

  it("should reorder images in an album", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const albumRow = mockAlbumRow({ userId, handle: asAlbumHandle("vacation") });
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(albumRow);
    mocks.db.albumImageReorder.mockResolvedValue(undefined);

    const result = await albumReorderTool.handler(
      { album_handle: "vacation", image_ids: ["img-1", "img-2", "img-3"] },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "album:updated", entityId: "vacation" }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.reordered).toBe(true);
    expect(data.album_handle).toBe(albumRow.handle);
    expect(data.image_count).toBe(3);
    expect(mocks.db.albumImageReorder).toHaveBeenCalledWith(albumRow.id, [
      asImageId("img-1"),
      asImageId("img-2"),
      asImageId("img-3"),
    ]);
  });

  it("should return INVALID_INPUT when image_ids is empty", async () => {
    const parsed = z.object(albumReorderTool.inputSchema).safeParse({
      album_handle: "vacation",
      image_ids: [],
    });

    expect(parsed.success).toBe(false);
  });

  it("should return REORDER_FAILED when albumImageReorder throws", async () => {
    const ctx: ToolContext = { userId, deps };
    const albumRow = mockAlbumRow({ userId, handle: asAlbumHandle("work") });
    mocks.resolverMocks.resolveAlbum.mockResolvedValue(albumRow);
    mocks.db.albumImageReorder.mockRejectedValue(new Error("DB constraint violation"));

    const result = await albumReorderTool.handler(
      { album_handle: "work", image_ids: ["img-1", "img-2"] },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("REORDER_FAILED");
    expect(result.content[0].text).toContain("DB constraint violation");
  });
});
