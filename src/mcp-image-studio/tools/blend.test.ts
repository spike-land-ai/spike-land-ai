import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createMockImageStudioDeps,
  mockImageRow,
  mockJobRow,
} from "../__test-utils__/mock-deps.js";
import { blend } from "./blend.js";
import type { ToolContext } from "../types.js";
import { asImageId } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("blend", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  standardScenarios({
    handler: blend,
    validInput: { source_image_id: "src-1", target_image_id: "tgt-1" },
    get deps() {
      return deps;
    },
    resolvesImage: true,
    consumesCredits: true,
    createsJob: true,
  });

  it("should create a blend job with defaults", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const src = mockImageRow({ userId, id: asImageId("src-1") });
    const tgt = mockImageRow({ userId, id: asImageId("tgt-1") });
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(src).mockResolvedValueOnce(tgt);
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 98 });
    mocks.credits.calculateGenerationCost.mockReturnValue(2);
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({
        userId,
        status: "PENDING",
        tier: "TIER_1K",
        creditsCost: 2,
      }),
    );

    const result = await blend(
      {
        source_image_id: "src-1",
        target_image_id: "tgt-1",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBeDefined();
    expect(data.blendMode).toBe("overlay");
    expect(data.blendStrength).toBe(50);
    expect(data.tier).toBe("TIER_1K");
    expect(data.creditsCost).toBe(2);
    expect(data.status).toBe("PENDING");
  });

  it("should use creditsCost of 0 when cost is FREE tier", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    const src = mockImageRow({ userId, id: asImageId("src-2") });
    const tgt = mockImageRow({ userId, id: asImageId("tgt-2") });
    mocks.resolverMocks.resolveImage.mockResolvedValueOnce(src).mockResolvedValueOnce(tgt);
    mocks.credits.calculateGenerationCost.mockReturnValue(0);
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({
        userId,
        status: "PENDING",
        tier: "FREE",
        creditsCost: 0,
      }),
    );

    const result = await blend(
      {
        source_image_id: "src-2",
        target_image_id: "tgt-2",
        tier: "FREE",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(0);
    expect(mocks.credits.consume).not.toHaveBeenCalled();
  });

  it("should return error when target image not found", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage
      .mockResolvedValueOnce(mockImageRow({ userId }))
      .mockResolvedValueOnce(null);

    const result = await blend(
      {
        source_image_id: "src-1",
        target_image_id: "missing",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("IMAGE_NOT_FOUND");
  });
});
