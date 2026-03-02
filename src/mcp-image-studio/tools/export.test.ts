import { asImageId } from "../types.js";
import { beforeEach, describe, expect, it } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { exportImage } from "./export.js";
import type { ToolContext } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("exportImage", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  standardScenarios({
    handler: exportImage,
    validInput: { image_id: "img1" },
    get deps() {
      return deps;
    },
    resolvesImages: true,
  });

  it("should export an image", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId, originalR2Key: "k1" }),
    );
    mocks.storage.download.mockResolvedValue(Buffer.from("data"));

    const result = await exportImage({ image_id: "img1", format: "webp" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.format).toBe("webp");
  });

  it("should return error if download fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.storage.download.mockRejectedValue(new Error("Download failed"));

    const result = await exportImage({ image_id: "img1" }, ctx);
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("EXPORT_FAILED");
  });

  it("should use default format and quality if not provided", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.storage.download.mockResolvedValue(Buffer.from("data"));

    const result = await exportImage({ image_id: "img1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.format).toBe("png");
    expect(data.quality).toBeUndefined();
  });

  it("should strip quality parameter if format is png", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img1"), userId }),
    );
    mocks.storage.download.mockResolvedValue(Buffer.from("data"));

    const result = await exportImage(
      {
        image_id: "img1",
        format: "png",
        quality: 100,
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.format).toBe("png");
    expect(data.quality).toBeUndefined();
  });
});
