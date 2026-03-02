import { describe, it, expect, vi } from "vitest";
import { defineTool } from "./define-tool.js";
import type { ImageStudioDeps } from "./types.js";
import { jsonResult } from "./types.js";

import { z } from "zod";

describe("define-tool framework", () => {
  describe("defineTool builder", () => {
    it("should build a tool correctly", async () => {
      const tool = defineTool("test_tool", "A test tool", {
        val: z.string().describe("A value"),
      }).handler(async (input) => {
        return jsonResult({ inputVal: input.val });
      });

      expect(tool.name).toBe("test_tool");
      expect(tool.description).toBe("A test tool");
      expect(typeof tool.handler).toBe("function");

      const result = await tool.handler(
        { val: "hello" },
        { userId: "u1", deps: {} as unknown as ImageStudioDeps },
      );
      expect(result.content[0].text).toContain("hello");
    });

    it("should resolve albums and images arrays", async () => {
      const tool = defineTool("resolver_test", "desc", {
        album: z.string().describe("album"),
        images: z.array(z.string()).describe("Images"),
      })
        .resolves({ album: "album", images: "images" })
        .handler(async (_, ctx) => {
          return jsonResult({
            albumId: ctx.entities.album.id,
            imageCount: ctx.entities.images.length,
          });
        });

      const mockDeps = {
        resolvers: {
          resolveAlbum: vi.fn().mockResolvedValue({ id: "album-1" }),
          resolveImages: vi.fn().mockResolvedValue([{ id: "img-1" }, { id: "img-2" }]),
        },
      } as unknown as ImageStudioDeps;

      const res = await tool.handler(
        { album: "alb", images: ["i1", "i2"] },
        { userId: "u1", deps: mockDeps },
      );
      expect(mockDeps.resolvers.resolveAlbum).toHaveBeenCalledWith("alb");
      expect(mockDeps.resolvers.resolveImages).toHaveBeenCalledWith(["i1", "i2"]);
      expect(res.content[0].text).toContain("album-1");
      expect(res.content[0].text).toContain("2");
    });

    it("should auto-emit job:created and credits:consumed events", async () => {
      const tool = defineTool("auto_notify", "desc", {
        imageId: z.string().describe("img"),
      })
        .credits({ source: "auto_notify", cost: () => 5 })
        .job({ imageIdField: "imageId" })
        .handler(async () => jsonResult({ ok: true }));

      const mockDeps = {
        credits: {
          consume: vi.fn().mockResolvedValue({ success: true }),
        },
        db: {
          jobCreate: vi.fn().mockResolvedValue({ id: "job-123" }),
        },
      } as unknown as ImageStudioDeps;

      const notify = vi.fn();
      await tool.handler({ imageId: "img-1" }, { userId: "u1", deps: mockDeps, notify });

      expect(notify).toHaveBeenCalledTimes(2);
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({
          type: "credits:consumed",
          payload: expect.objectContaining({ amount: 5 }),
        }),
      );
      expect(notify).toHaveBeenCalledWith(
        expect.objectContaining({ type: "job:created", entityId: "job-123" }),
      );
    });

    it("should return RESOLVE_FAILED when resolveImages fails", async () => {
      const tool = defineTool("images_fail_test", "desc", {
        images: z.array(z.string()),
      })
        .resolves({ images: "images" })
        .handler(async () => jsonResult({}));

      const mockDeps = {
        resolvers: {
          resolveImages: vi.fn().mockRejectedValue(new Error("Resolution error")),
        },
      } as unknown as ImageStudioDeps;

      const res = await tool.handler({ images: ["i1"] }, { userId: "u1", deps: mockDeps });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("RESOLVE_FAILED");
      expect(res.content[0].text).toContain("Resolution error");
    });

    it("should return ALBUM_NOT_FOUND when resolveAlbum fails", async () => {
      const tool = defineTool("album_fail_test", "desc", {
        album: z.string(),
      })
        .resolves({ album: "album" })
        .handler(async () => jsonResult({}));

      const mockDeps = {
        resolvers: {
          resolveAlbum: vi.fn().mockRejectedValue(new Error("Album not found")),
        },
      } as unknown as ImageStudioDeps;

      const res = await tool.handler({ album: "a1" }, { userId: "u1", deps: mockDeps });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("ALBUM_NOT_FOUND");
      expect(res.content[0].text).toContain("Album not found");
    });

    it("should return IMAGE_NOT_FOUND when resolveImage fails", async () => {
      const tool = defineTool("image_fail_test", "desc", {
        image_id: z.string(),
      })
        .resolves({ image_id: "image" })
        .handler(async () => jsonResult({}));

      const mockDeps = {
        resolvers: {
          resolveImage: vi.fn().mockRejectedValue(new Error("Image error")),
        },
      } as unknown as ImageStudioDeps;

      const res = await tool.handler({ image_id: "img1" }, { userId: "u1", deps: mockDeps });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("IMAGE_NOT_FOUND");
      expect(res.content[0].text).toContain("Image error");
    });

    it("should return CREDIT_CONSUME_FAILED when credits consume fails", async () => {
      const tool = defineTool("credit_fail_test", "desc", {
        name: z.string(),
      })
        .credits({ source: "credit_fail_test", cost: () => 5 })
        .handler(async () => jsonResult({}));

      const mockDeps = {
        credits: {
          consume: vi.fn().mockResolvedValue({ success: false, error: "Not enough credits" }),
        },
      } as unknown as ImageStudioDeps;

      const res = await tool.handler({ name: "n1" }, { userId: "u1", deps: mockDeps });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("CREDIT_CONSUME_FAILED");
      expect(res.content[0].text).toContain("Not enough credits");
    });
  });
});
