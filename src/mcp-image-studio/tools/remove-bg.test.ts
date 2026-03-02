import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockImageStudioDeps,
  mockImageRow,
  mockJobRow,
} from "../__test-utils__/mock-deps.js";
import { removeBg } from "./remove-bg.js";
import type { ToolContext } from "../types.js";
import { asImageId } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("removeBg", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  const { deps: defaultDeps, mocks: defaultMocks } = createMockImageStudioDeps();
  defaultMocks.resolverMocks.resolveImage.mockResolvedValue(
    mockImageRow({ id: asImageId("img-1"), userId }),
  );

  standardScenarios({
    handler: removeBg,
    validInput: { image_id: "img-1" },
    deps: defaultDeps,
    resolvesImage: true,
  });

  it("should create a background removal job successfully", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-1"), userId, name: "portrait.jpg" }),
    );
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 99 });
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({ userId, status: "PENDING", tier: "FREE", creditsCost: 1 }),
    );

    const result = await removeBg({ image_id: "img-1" }, ctx);

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBeDefined();
    expect(data.status).toBe("PENDING");
    expect(data.creditsCost).toBe(1);
  });

  it("should return error when image name contains _nobg (already processed)", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-2"), userId, name: "portrait_nobg.png" }),
    );

    const result = await removeBg({ image_id: "img-2" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("ALREADY_PROCESSED");
    expect(mocks.credits.consume).not.toHaveBeenCalled();
    expect(mocks.db.jobCreate).not.toHaveBeenCalled();
  });

  it("should return error when credit check fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-1"), userId, name: "portrait.jpg" }),
    );
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Credit service error",
    });

    const result = await removeBg({ image_id: "img-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("should return error when job creation fails", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(
      mockImageRow({ id: asImageId("img-1"), userId, name: "portrait.jpg" }),
    );
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 99 });
    mocks.db.jobCreate.mockRejectedValue(new Error("DB error"));

    const result = await removeBg({ image_id: "img-1" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("JOB_CREATE_FAILED");
  });
});
