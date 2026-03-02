import { beforeEach, describe, expect, it, vi } from "vitest";
import { edit } from "./edit.js";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/index.js";
import type { ToolContext } from "../types.js";

const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("edit tool", () => {
  const userId = "test-user-123";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
    vi.resetAllMocks();
  });

  it("returns error if no image source is provided", async () => {
    const ctx: ToolContext = { userId, deps };
    const res = await edit({ prompt: "hello" }, ctx);
    expect(res.isError).toBe(true);
    expect(res.content[0].text).toContain("MISSING_IMAGE");
  });

  describe("source_image_id", () => {
    it("returns error if image not found", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockRejectedValueOnce(new Error("db issue"));
      const res = await edit({ source_image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("IMAGE_NOT_FOUND");
    });

    it("returns error if storage download fails", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockResolvedValueOnce(
        mockImageRow({ originalR2Key: "key-123", userId }),
      );
      mocks.storage.download.mockRejectedValueOnce(new Error("storage issue"));

      const res = await edit({ source_image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("DOWNLOAD_FAILED");
    });

    it("resolves and initiates job on success", async () => {
      const notify = vi.fn();
      const ctx: ToolContext = { userId, deps, notify };
      mocks.resolverMocks.resolveImage.mockResolvedValueOnce(
        mockImageRow({ originalR2Key: "key-123", userId }),
      );
      mocks.storage.download.mockResolvedValueOnce(Buffer.from("fake-img-data"));
      mocks.generation.createModificationJob.mockResolvedValueOnce({
        success: true,
        jobId: "job-1",
        creditsCost: 1,
      });

      const res = await edit({ source_image_id: "img-123" }, ctx);
      expect(res.isError).toBeUndefined();
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
      expect(res.content[0].text).toContain("job-1");
    });
  });

  describe("image_base64", () => {
    it("initiates job with base64 data", async () => {
      const notify = vi.fn();
      const ctx: ToolContext = { userId, deps, notify };
      mocks.generation.createModificationJob.mockResolvedValueOnce({
        success: true,
        jobId: "job-1",
        creditsCost: 1,
      });

      const res = await edit({ image_base64: "base64-data" }, ctx);
      expect(res.isError).toBeUndefined();
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
      expect(res.content[0].text).toContain("job-1");
      expect(deps.generation.createModificationJob).toHaveBeenCalledWith(
        expect.objectContaining({ imageData: "base64-data" }),
      );
    });
  });

  describe("image_url", () => {
    it("returns error if fetch fails", async () => {
      const ctx: ToolContext = { userId, deps };
      mockFetch.mockRejectedValueOnce(new Error("Network Error"));
      const res = await edit({ image_url: "https://example.com/img.jpg" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("FETCH_FAILED");
    });

    it("returns error if response is not ok", async () => {
      const ctx: ToolContext = { userId, deps };
      mockFetch.mockResolvedValueOnce({ ok: false, status: 404 });
      const res = await edit({ image_url: "https://example.com/img.jpg" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("FETCH_FAILED");
      expect(res.content[0].text).toContain("404");
    });

    it("returns error if arrayBuffer throws", async () => {
      const ctx: ToolContext = { userId, deps };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.reject(new Error("bad stream")),
      });
      const res = await edit({ image_url: "https://example.com/img.jpg" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("FETCH_FAILED");
      expect(res.content[0].text).toContain("Failed to read image data");
    });

    it("initiates job after fetch", async () => {
      const notify = vi.fn();
      const ctx: ToolContext = { userId, deps, notify };
      mockFetch.mockResolvedValueOnce({
        ok: true,
        arrayBuffer: () => Promise.resolve(new ArrayBuffer(8)),
      });
      mocks.generation.createModificationJob.mockResolvedValueOnce({
        success: true,
        jobId: "job-2",
        creditsCost: 1,
      });

      const res = await edit({ image_url: "https://example.com/img.jpg" }, ctx);
      expect(res.isError).toBeUndefined();
      expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
      expect(res.content[0].text).toContain("job-2");
    });
  });

  describe("job completion", () => {
    it("returns error if job creation fails", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.generation.createModificationJob.mockRejectedValueOnce(new Error("job rejection"));
      const res = await edit({ image_base64: "base64-data" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("MODIFICATION_FAILED");
      expect(res.content[0].text).toContain("job rejection");
    });

    it("returns structured error message from job payload", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.generation.createModificationJob.mockResolvedValueOnce({
        success: false,
        error: "Custom Job Error",
      });
      const res = await edit({ image_base64: "base64-data" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("MODIFICATION_FAILED");
      expect(res.content[0].text).toContain("Custom Job Error");
    });
  });

  describe("error fallback cases", () => {
    it("returns generic error if image resolve error has no message", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockRejectedValueOnce(new Error());
      const res = await edit({ source_image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("IMAGE_NOT_FOUND");
    });

    it("returns Image not found if resolve ok is false, but data is missing", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.resolverMocks.resolveImage.mockResolvedValueOnce(null);
      const res = await edit({ source_image_id: "img-123" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Image not found");
    });

    it("returns generic job error if job data error is missing", async () => {
      const ctx: ToolContext = { userId, deps };
      mocks.generation.createModificationJob.mockResolvedValueOnce({
        success: false,
      });
      const res = await edit({ image_base64: "base64-data" }, ctx);
      expect(res.isError).toBe(true);
      expect(res.content[0].text).toContain("Failed to create modification job");
    });
  });
});
