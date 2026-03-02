import { beforeEach, describe, expect, it, vi } from "vitest";
import { albumDelete } from "./album-delete.js";
import { createMockImageStudioDeps, mockAlbumRow } from "../__test-utils__/index.js";
import type { ToolContext } from "../types.js";
import { asAlbumHandle } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("albumDelete tool", () => {
  const userId = "test-user";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
    vi.resetAllMocks();
  });

  const baseInput = {
    album_handle: "mock-album-123",
    confirm: true,
  };

  const { deps: defaultDeps, mocks: defaultMocks } = createMockImageStudioDeps();
  defaultMocks.resolverMocks.resolveAlbum.mockResolvedValue(
    mockAlbumRow({ handle: asAlbumHandle("mock-album-123"), userId }),
  );

  standardScenarios({
    handler: albumDelete,
    validInput: baseInput,
    deps: defaultDeps,
    resolvesAlbum: true,
  });

  it("returns error if confirm is false", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveAlbum.mockResolvedValueOnce(
      mockAlbumRow({ handle: asAlbumHandle("mock-album-123"), userId }),
    );
    const res = await albumDelete({ ...baseInput, confirm: false }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("CONFIRMATION_REQUIRED");
  });

  it("returns error if deletion from DB fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveAlbum.mockResolvedValueOnce(
      mockAlbumRow({ handle: asAlbumHandle("mock-album-123"), userId }),
    );
    mocks.db.albumDelete.mockRejectedValueOnce(new Error("Database drop failed"));

    const res = await albumDelete(baseInput, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("DELETE_FAILED");
  });

  it("successfully deletes album and returns deletion metadata", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolveAlbum.mockResolvedValueOnce(
      mockAlbumRow({ handle: asAlbumHandle("mock-album-123"), userId }),
    );
    mocks.db.albumDelete.mockResolvedValueOnce(true);

    const res = await albumDelete(baseInput, ctx);

    expect(res.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "album:deleted", entityId: "mock-album-123" }),
    );
    expect(deps.db.albumDelete).toHaveBeenCalledWith("mock-album-123");

    const payload = JSON.parse(res.content[0].text);
    expect(payload.deleted).toBe(true);
    expect(payload.album_handle).toBe("mock-album-123");
    expect(payload.name).toBe("Test Album");
  });
});
