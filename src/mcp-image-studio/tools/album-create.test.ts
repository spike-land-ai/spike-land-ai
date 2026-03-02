import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockAlbumRow } from "../__test-utils__/mock-deps.js";
import { albumCreate } from "./album-create.js";
import type { ToolContext } from "../types.js";
import { asAlbumHandle } from "../types.js";

describe("albumCreate", () => {
  const userId = "test-user";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should create a new album successfully", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const input = {
      name: "Vacation",
      privacy: "PUBLIC" as const,
      default_tier: "TIER_1K" as const,
    };

    mocks.db.albumMaxSortOrder.mockResolvedValue(5);
    vi.mocked(deps.nanoid).mockReturnValue("random-id");
    mocks.db.albumCreate.mockResolvedValue(
      mockAlbumRow({
        handle: asAlbumHandle("random-id"),
        name: "Vacation",
        userId,
      }),
    );

    const result = await albumCreate(input, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "album:created", entityId: "random-id" }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.name).toBe("Vacation");
    expect(data.album_handle).toBe("random-id");
  });

  it("should handle maxSort rejection by defaulting to 0", async () => {
    const ctx: ToolContext = { userId, deps };
    // Trigger tryCatch failure on albumMaxSortOrder
    mocks.db.albumMaxSortOrder.mockRejectedValue(new Error("Sort DB Down"));

    vi.mocked(deps.nanoid).mockReturnValue("random-id");
    mocks.db.albumCreate.mockResolvedValue(
      mockAlbumRow({
        handle: asAlbumHandle("random-id"),
        name: "Fallback Sort",
        userId,
        privacy: "PRIVATE",
      }),
    );

    const result = await albumCreate(
      {
        name: "Fallback Sort",
        privacy: "PRIVATE",
        default_tier: "FREE",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(mocks.db.albumCreate).toHaveBeenCalledWith(
      expect.objectContaining({ sortOrder: 1 }), // 0 + 1
    );
  });

  it("should generate a share token and url if privacy is not PRIVATE", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumMaxSortOrder.mockResolvedValue(5);

    // nanoid is called twice: once for token, once for handle
    vi.mocked(deps.nanoid).mockReturnValueOnce("test-token").mockReturnValueOnce("test-handle");

    mocks.db.albumCreate.mockResolvedValue(
      mockAlbumRow({
        handle: asAlbumHandle("test-handle"),
        name: "Public Album",
        shareToken: "test-token",
        userId,
        privacy: "PUBLIC",
      }),
    );

    const result = await albumCreate(
      {
        name: "Public Album",
        privacy: "PUBLIC",
        default_tier: "FREE",
        description: "Hello",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.share_token).toBe("test-token");
    expect(data.share_url).toBe("https://spike.land/pixel/album/test-token");

    // Check description made it through since it's an optional parameter
    expect(mocks.db.albumCreate).toHaveBeenCalledWith(
      expect.objectContaining({ description: "Hello" }),
    );
  });

  it("should return error if database fails to create album", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.db.albumMaxSortOrder.mockResolvedValue(0);
    mocks.db.albumCreate.mockRejectedValue(new Error("Storage full"));

    const result = await albumCreate(
      {
        name: "New",
        privacy: "PRIVATE",
        default_tier: "FREE",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ALBUM_CREATE_FAILED");
  });
});
