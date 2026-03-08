import { describe, expect, it, vi } from "vitest";
import { defineTool } from "../../src/mcp-tools/image-studio/core-logic/define-tool.js";
import type { ImageStudioDeps } from "../../src/mcp-tools/image-studio/mcp/types.js";
import { jsonResult } from "../../src/mcp-tools/image-studio/mcp/types.js";

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
          resolveImages: vi.fn().mockResolvedValue([
            { id: "img-1" },
            {
              id: "img-2",
            },
          ]),
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
      await tool.handler(
        { imageId: "img-1" },
        {
          userId: "u1",
          deps: mockDeps,
          notify,
        },
      );

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

      const res = await tool.handler(
        { images: ["i1"] },
        {
          userId: "u1",
          deps: mockDeps,
        },
      );
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

      const res = await tool.handler(
        { album: "a1" },
        {
          userId: "u1",
          deps: mockDeps,
        },
      );
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

      const res = await tool.handler(
        { image_id: "img1" },
        {
          userId: "u1",
          deps: mockDeps,
        },
      );
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
          consume: vi.fn().mockResolvedValue({
            success: false,
            error: "Not enough credits",
          }),
        },
      } as unknown as ImageStudioDeps;

      const res = await tool.handler(
        { name: "n1" },
        {
          userId: "u1",
          deps: mockDeps,
        },
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("CREDIT_CONSUME_FAILED");
      expect(res.content[0].text).toContain("Not enough credits");
    });
  });

  describe("requireOwnership", () => {
    it("should return UNAUTHORIZED if image is not owned by user", async () => {
      const tool = defineTool("ownership_test_img", "desc", {
        image_id: z.string(),
      })
        .resolves({ image_id: "image" })
        .requireOwnership(["image_id"])
        .handler(async () => jsonResult({}));

      const mockDeps = {
        resolvers: {
          resolveImage: vi.fn().mockResolvedValue({
            id: "img-1",
            userId: "other-user",
          }),
        },
      };

      const res = await tool.handler(
        { image_id: "img-1" },
        { userId: "u1", deps: mockDeps as unknown as ImageStudioDeps },
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("UNAUTHORIZED");
    });

    it("should return UNAUTHORIZED if one of images is not owned by user", async () => {
      const tool = defineTool("ownership_test_imgs", "desc", {
        image_ids: z.array(z.string()),
      })
        .resolves({ image_ids: "images" })
        .requireOwnership(["image_ids"])
        .handler(async () => jsonResult({}));

      const mockDeps = {
        resolvers: {
          resolveImages: vi.fn().mockResolvedValue([
            { id: "img-1", userId: "u1" },
            { id: "img-2", userId: "other-user" },
          ]),
        },
      };

      const res = await tool.handler(
        { image_ids: ["img-1", "img-2"] },
        { userId: "u1", deps: mockDeps as unknown as ImageStudioDeps },
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("UNAUTHORIZED");
    });

    it("should return UNAUTHORIZED if album is not owned by user", async () => {
      const tool = defineTool("ownership_test_album", "desc", {
        album_handle: z.string(),
      })
        .resolves({ album_handle: "album" })
        .requireOwnership(["album_handle"])
        .handler(async () => jsonResult({}));

      const mockDeps = {
        resolvers: {
          resolveAlbum: vi.fn().mockResolvedValue({
            handle: "alb",
            userId: "other-user",
          }),
        },
      };

      const res = await tool.handler(
        { album_handle: "alb" },
        { userId: "u1", deps: mockDeps as unknown as ImageStudioDeps },
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("UNAUTHORIZED");
    });
  });

  describe("validates and contextValidates", () => {
    it("should run custom validates before resolution", async () => {
      const tool = defineTool("val_test", "desc", { val: z.string() })
        .validate((input) => {
          if (input.val === "bad") {
            return {
              isError: true,
              content: [{ type: "text", text: "BAD_VAL" }],
            };
          }
        })
        .handler(async () => jsonResult({}));

      const res = await tool.handler(
        { val: "bad" },
        {
          userId: "u1",
          deps: {} as unknown as ImageStudioDeps,
        },
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("BAD_VAL");
    });

    it("should run contextValidates after resolution", async () => {
      const tool = defineTool("cval_test", "desc", { val: z.string() })
        .resolves({ val: "image" })
        .validateContext((input, ctx) => {
          if (ctx.entities.val.name === "bad-name") {
            return {
              isError: true,
              content: [{ type: "text", text: "BAD_NAME" }],
            };
          }
        })
        .handler(async () => jsonResult({}));

      const mockDeps = {
        resolvers: {
          resolveImage: vi.fn().mockResolvedValue({
            id: "img-1",
            name: "bad-name",
            userId: "u1",
          }),
        },
      };

      const res = await tool.handler(
        { val: "img-1" },
        {
          userId: "u1",
          deps: mockDeps as unknown as ImageStudioDeps,
        },
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("BAD_NAME");
    });
  });

  describe("agentInstructions", () => {
    it("should append agent instructions to output", async () => {
      const tool = defineTool("agent_test", "desc", { val: z.string() })
        .agentInstructions("Tell the user hi")
        .handler(async () => jsonResult({ ok: true }));

      const res = await tool.handler(
        { val: "v" },
        {
          userId: "u1",
          deps: {} as unknown as ImageStudioDeps,
        },
      );
      expect(res.isError).toBeFalsy();
      expect(
        res.content.some((c) => c.type === "text" && c.text.includes("Tell the user hi")),
      ).toBe(true);
    });
  });

  describe("DomainError catching", () => {
    it("should catch DomainError and convert to errorResult", async () => {
      const { DomainError } = await import("../../src/mcp-tools/image-studio/mcp/try-catch.js");
      const tool = defineTool("domain_err_test", "desc", {}).handler(async () => {
        throw new DomainError("UNKNOWN_ERROR", "A specific domain error", true);
      });

      const res = await tool.handler({}, { userId: "u1", deps: {} as unknown as ImageStudioDeps });
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("UNKNOWN_ERROR");
      expect(res.content[0].text).toContain("A specific domain error");
      expect(res.content[0].text).toContain("Retryable:** true");
    });

    it("should rethrow non-DomainErrors", async () => {
      const tool = defineTool("throw_test", "desc", {}).handler(async () => {
        throw new Error("Normal error");
      });

      await expect(tool.handler({}, { userId: "u1", deps: {} as unknown as ImageStudioDeps })).rejects.toThrow(
        "Normal error",
      );
    });
  });

  describe("job creation failure", () => {
    it("should return JOB_CREATE_FAILED if job creation fails", async () => {
      const tool = defineTool("job_fail_test", "desc", { image_id: z.string() })
        .job({ imageIdField: "image_id" })
        .handler(async () => jsonResult({}));

      const mockDeps = {
        db: {
          jobCreate: vi.fn().mockResolvedValue(null), // fails
        },
      };

      const res = await tool.handler(
        { image_id: "img-1" },
        { userId: "u1", deps: mockDeps as unknown as ImageStudioDeps },
      );
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("JOB_CREATE_FAILED");
    });
  });
});
