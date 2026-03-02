import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { share } from "./share.js";
import type { ToolContext } from "../types.js";

describe("share", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should share an image and return a share URL", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const image = mockImageRow({ userId, shareToken: null });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    vi.mocked(deps.nanoid).mockReturnValue("tok123");
    mocks.db.imageUpdate.mockResolvedValue({
      ...image,
      isPublic: true,
      shareToken: "tok123",
    });

    const result = await share({ image_id: image.id, action: "share" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image:updated", entityId: image.id }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("share");
    expect(data.shareToken).toBe("tok123");
    expect(data.shareUrl).toBe("https://spike.land/pixel/shared/tok123");
    expect(data.isPublic).toBe(true);
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith(image.id, {
      isPublic: true,
      shareToken: "tok123",
    });
  });

  it("should reuse an existing share token when sharing again", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const image = mockImageRow({ userId, shareToken: "existing-token" });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    mocks.db.imageUpdate.mockResolvedValue({
      ...image,
      isPublic: true,
      shareToken: "existing-token",
    });

    const result = await share({ image_id: image.id, action: "share" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(
      expect.objectContaining({ type: "image:updated", entityId: image.id }),
    );
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("share");
    expect(data.shareToken).toBe("existing-token");
    expect(data.shareUrl).toBe("https://spike.land/pixel/shared/existing-token");
    expect(data.isPublic).toBe(true);
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith(image.id, {
      isPublic: true,
      shareToken: "existing-token",
    });
  });

  it("should unshare an image", async () => {
    const ctx: ToolContext = { userId, deps };
    const image = mockImageRow({
      userId,
      isPublic: true,
      shareToken: "old-token",
    });
    mocks.resolverMocks.resolveImage.mockResolvedValue(image);
    mocks.db.imageUpdate.mockResolvedValue({
      ...image,
      isPublic: false,
      shareToken: "old-token",
    });

    const result = await share({ image_id: image.id, action: "unshare" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.action).toBe("unshare");
    expect(data.isPublic).toBe(false);
    expect(data.shareToken).toBeUndefined();
    expect(mocks.db.imageUpdate).toHaveBeenCalledWith(image.id, { isPublic: false });
  });

  it("should return error when resolver throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockRejectedValue(new Error("Network error"));

    const result = await share({ image_id: "img-1", action: "share" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return error when update fails on share", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    vi.mocked(deps.nanoid).mockReturnValue("tok-fail");
    mocks.db.imageUpdate.mockRejectedValue(new Error("DB error"));

    const result = await share({ image_id: "img-1", action: "share" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("UPDATE_FAILED");
  });

  it("should return error when update fails on unshare", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.db.imageUpdate.mockRejectedValue(new Error("DB error"));

    const result = await share({ image_id: "img-1", action: "unshare" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("UPDATE_FAILED");
  });
});
