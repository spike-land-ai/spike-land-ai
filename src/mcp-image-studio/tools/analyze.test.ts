import { beforeEach, describe, expect, it, vi } from "vitest";
import { analyze } from "./analyze.js";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/index.js";
import { type ToolContext } from "../types.js";

describe("analyze tool", () => {
  const userId = "test-user";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
    vi.clearAllMocks();
  });

  const mockImage = mockImageRow({
    userId: "test-user",
    originalR2Key: "test/img.jpg",
    name: "My Photo",
    originalWidth: 800,
    originalHeight: 600,
    originalFormat: "jpeg",
    originalSizeBytes: 1024,
  });

  it("returns error if image not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockRejectedValueOnce(new Error("Db error"));
    const res = await analyze({ image_id: "img-123" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("returns error if AI describing is not supported", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
    (deps.generation as Record<string, unknown>).describeImage = undefined;

    const res = await analyze({ image_id: "img-123" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("NOT_SUPPORTED");
  });

  it("returns error if insufficient credits", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
    mocks.credits.consume.mockResolvedValueOnce({
      success: false,
      error: "No credits",
    });

    const res = await analyze({ image_id: "img-123" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("returns error if describeImage fails completely", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
    mocks.credits.hasEnough.mockResolvedValueOnce(true);
    mocks.generation.describeImage.mockRejectedValueOnce(new Error("API Down"));

    const res = await analyze({ image_id: "img-123" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("DESCRIPTION_FAILED");
    expect(res.content[0].text).toContain("API Down");
  });

  it("returns successful result with brief descriptions", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
    mocks.credits.hasEnough.mockResolvedValueOnce(true);
    mocks.generation.describeImage.mockResolvedValueOnce({
      description: "A cool specific photo",
      tags: ["cool", "photo"],
    });
    mocks.generation.extractPalette.mockResolvedValueOnce({
      palette: ["#fff", "#000"],
    });

    const res = await analyze({ image_id: "img-123", detail_level: "brief" }, ctx);
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain("A cool specific photo");
    expect(res.content[0].text).toContain("brief");
    expect(res.content[0].text).toContain("#fff");
  });

  it("returns detailed formatted descriptions", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
    mocks.credits.hasEnough.mockResolvedValueOnce(true);
    mocks.generation.describeImage.mockResolvedValueOnce({
      description: "A cool specific photo",
      tags: ["cool", "photo"],
    });

    const res = await analyze(
      {
        image_id: "img-123",
        detail_level: "detailed",
        include_palette: false,
      },
      ctx,
    );
    expect(res.isError).toBeUndefined();
    expect(res.content[0].text).toContain('Image: \\"My Photo\\"');
    expect(res.content[0].text).toContain("800x600");
    expect(res.content[0].text).toContain("A cool specific photo");
    // Should cost 1 credit without palette
    expect(res.content[0].text).toContain('"creditsCost": 1');
    expect(deps.credits.consume).toHaveBeenCalledWith(expect.objectContaining({ amount: 1 }));
  });

  describe("error fallback cases", () => {
    it("returns generic error if image resolve has no message", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockRejectedValueOnce(new Error());
      const res = await analyze({ image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("IMAGE_NOT_FOUND");
    });

    it("returns job error message on generation failure with payload string", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
      mocks.credits.hasEnough.mockResolvedValueOnce(true);
      mocks.generation.describeImage.mockResolvedValueOnce({
        error: "Missing config",
      });

      const res = await analyze({ image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Missing config");
    });

    it("returns Description failed fallback when describeImage rejects with empty error", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
      mocks.credits.hasEnough.mockResolvedValueOnce(true);
      mocks.generation.describeImage.mockRejectedValueOnce(new Error());

      const res = await analyze({ image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("DESCRIPTION_FAILED");
    });

    it("returns generic Description failed when resolving payload has no error string", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
      mocks.credits.hasEnough.mockResolvedValueOnce(true);
      // Resolve successfully but return null data to trigger !descResult.data
      mocks.generation.describeImage.mockResolvedValueOnce(null);

      const res = await analyze({ image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Description failed");
    });

    it("returns Image not found if resolve ok is false, but data is missing", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockResolvedValueOnce(null);
      const res = await analyze({ image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Image not found");
    });

    it("returns DESCRIPTION_FAILED when describeImage rejects with Error missing message", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
      mocks.credits.hasEnough.mockResolvedValueOnce(true);
      const e = new Error();
      delete (e as unknown as Record<string, unknown>).message;
      mocks.generation.describeImage.mockRejectedValueOnce(e);

      const res = await analyze({ image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("DESCRIPTION_FAILED");
    });

    it("ignores extractPalette failures without exploding", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockResolvedValueOnce(mockImage);
      mocks.credits.hasEnough.mockResolvedValueOnce(true);
      mocks.generation.describeImage.mockResolvedValueOnce({
        description: "A cool specific photo",
        tags: ["cool", "photo"],
      });
      mocks.generation.extractPalette.mockRejectedValueOnce(new Error("color boom"));

      const res = await analyze({ image_id: "img-123", detail_level: "brief" }, ctx);
      expect(res.isError).toBeUndefined();
      expect(res.content[0].text).toContain("A cool specific photo");
      expect(res.content[0].text).not.toContain("palette");
    });
  });
});
