import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps, mockImageRow } from "../__test-utils__/mock-deps.js";
import { subjectSave } from "./subject-save.js";
import type { ToolContext } from "../types.js";
import { asImageId } from "../types.js";

describe("subjectSave", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should register a subject successfully", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ userId, id: asImageId("img-1") }),
    );
    mocks.db.subjectCreate.mockResolvedValue({
      id: "sub-1",
      userId,
      imageId: asImageId("img-1"),
      label: "Hero Character",
      type: "character",
      description: "Main protagonist",
      createdAt: new Date(),
    });

    const result = await subjectSave(
      {
        image_id: "img-1",
        label: "Hero Character",
        type: "character",
        description: "Main protagonist",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "subject:created" }));
    expect(data.subject_id).toBe("sub-1");
    expect(data.label).toBe("Hero Character");
    expect(data.type).toBe("character");
    expect(data.status).toBe("REGISTERED");
  });

  it("should use default type (character) when not specified", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.db.subjectCreate.mockResolvedValue({
      id: "sub-2",
      userId,
      imageId: asImageId("img-1"),
      label: "Unnamed",
      type: "character",
      description: null,
      createdAt: new Date(),
    });

    await subjectSave({ image_id: "img-1", label: "Unnamed" }, ctx);

    expect(mocks.db.subjectCreate).toHaveBeenCalledWith(
      expect.objectContaining({ type: "character" }),
    );
  });

  it("should register an object-type subject", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.db.subjectCreate.mockResolvedValue({
      id: "sub-3",
      userId,
      imageId: asImageId("img-1"),
      label: "Magic Sword",
      type: "object",
      description: null,
      createdAt: new Date(),
    });

    const result = await subjectSave(
      { image_id: "img-1", label: "Magic Sword", type: "object" },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "subject:created" }));
    expect(data.type).toBe("object");
  });

  it("should return NOT_SUPPORTED when subjectCreate is not available", async () => {
    const ctx: ToolContext = { userId, deps };
    // Remove subjectCreate to simulate unsupported environment
    (deps.db as Record<string, unknown>).subjectCreate = undefined;

    const result = await subjectSave({ image_id: "img-1", label: "Hero" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("NOT_SUPPORTED");
  });

  it("should return IMAGE_NOT_FOUND when image does not exist", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(null);

    const result = await subjectSave({ image_id: "missing", label: "Hero" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return error when resolver throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockRejectedValue(new Error("Resolver error"));

    const result = await subjectSave({ image_id: "img-1", label: "Hero" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });

  it("should return REGISTER_FAILED when subjectCreate fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.db.subjectCreate.mockRejectedValue(new Error("DB error"));

    const result = await subjectSave({ image_id: "img-1", label: "Hero" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("REGISTER_FAILED");
  });

  it("should return REGISTER_FAILED when subjectCreate returns null", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.db.subjectCreate.mockResolvedValue(null);

    const result = await subjectSave({ image_id: "img-1", label: "Hero" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("REGISTER_FAILED");
  });
});
