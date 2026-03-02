import { beforeEach, describe, expect, it } from "vitest";
import {
  createMockImageStudioDeps,
  mockImageRow,
  mockJobRow,
} from "../__test-utils__/mock-deps.js";
import { resize } from "./resize.js";
import type { ToolContext } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("resize", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  // Use the scenario generator to replace 3+ hand-written error test blocks!
  standardScenarios({
    handler: resize,
    validInput: { image_id: "img-1", width: 800, height: 600 },
    get deps() {
      // Must use getter to ensure we retrieve the latest freshly-created mock from beforeEach
      return deps;
    },
    resolvesImages: true,
    consumesCredits: true,
    createsJob: true,
  });

  it("should resize with default fit (cover) and FREE tier", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.credits.calculateGenerationCost.mockReturnValue(0);
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({ userId, status: "PENDING", tier: "FREE", creditsCost: 0 }),
    );

    const result = await resize({ image_id: "img-1", width: 800, height: 600 }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBeDefined();
    expect(data.type).toBe("resize");
    expect(data.width).toBe(800);
    expect(data.height).toBe(600);
    expect(data.fit).toBe("cover");
    expect(data.tier).toBe("FREE");
    expect(data.creditsCost).toBe(0);
    expect(data.status).toBe("PENDING");
    // FREE tier should not consume credits
    expect(mocks.credits.consume).not.toHaveBeenCalled();
  });

  it("should resize with explicit fit mode and paid tier", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.credits.calculateGenerationCost.mockReturnValue(5);
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 95 });
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({
        userId,
        status: "PENDING",
        tier: "TIER_2K",
        creditsCost: 5,
      }),
    );

    const result = await resize(
      {
        image_id: "img-1",
        width: 1920,
        height: 1080,
        fit: "contain",
        tier: "TIER_2K",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.width).toBe(1920);
    expect(data.height).toBe(1080);
    expect(data.fit).toBe("contain");
    expect(data.tier).toBe("TIER_2K");
    expect(data.creditsCost).toBe(5);
    expect(mocks.credits.consume).toHaveBeenCalledWith({
      userId,
      amount: 5,
      source: "resize",
      sourceId: "img-1",
    });
  });

  it("should propagate error message from credit consume failure", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.credits.calculateGenerationCost.mockReturnValue(2);
    mocks.credits.consume.mockResolvedValue({
      success: false,
      remaining: 0,
      error: "Depleted",
    });

    const result = await resize(
      { image_id: "img-1", width: 800, height: 600, tier: "TIER_1K" },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
    expect(result.content[0].text).toContain("Depleted");
  });

  it("should validate width and height are positive integers using schema", async () => {
    const { ResizeInputSchema } = await import("./resize.js");

    const resultWidth = ResizeInputSchema.safeParse({
      image_id: "img-1",
      width: -100,
      height: 600,
    });
    expect(resultWidth.success).toBe(false);

    const resultHeight = ResizeInputSchema.safeParse({
      image_id: "img-1",
      width: 800,
      height: 0,
    });
    expect(resultHeight.success).toBe(false);

    const resultFloat = ResizeInputSchema.safeParse({
      image_id: "img-1",
      width: 800.5,
      height: 600,
    });
    expect(resultFloat.success).toBe(false);
  });
});
