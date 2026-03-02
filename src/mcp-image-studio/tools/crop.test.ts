import { beforeEach, describe, expect, it } from "vitest";
import {
  createMockImageStudioDeps,
  mockImageRow,
  mockJobRow,
} from "../__test-utils__/mock-deps.js";
import { crop } from "./crop.js";
import type { ToolContext } from "../types.js";
import { standardScenarios } from "../__test-utils__/standard-scenarios.js";

describe("crop", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  standardScenarios({
    handler: crop,
    validInput: { image_id: "img-1", preset: "instagram_square" },
    get deps() {
      return deps;
    },
    resolvesImage: true,
    consumesCredits: true,
    createsJob: true,
  });

  it("should create a smart crop job with a preset", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 99 });
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({ userId, status: "PENDING", tier: "FREE", creditsCost: 1 }),
    );

    const result = await crop({ image_id: "img-1", preset: "instagram_square" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBeDefined();
    expect(data.type).toBe("smart_crop");
    expect(data.preset).toBe("instagram_square");
    expect(data.targetWidth).toBe(1080);
    expect(data.targetHeight).toBe(1080);
    expect(data.creditsCost).toBe(1);
  });

  it("should create a smart crop job with custom dimensions", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 99 });
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({ userId, status: "PENDING", tier: "FREE", creditsCost: 1 }),
    );

    const result = await crop(
      {
        image_id: "img-1",
        preset: "custom",
        custom_width: 400,
        custom_height: 300,
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.preset).toBe("custom");
    expect(data.targetWidth).toBe(400);
    expect(data.targetHeight).toBe(300);
  });

  it("should use default preset (instagram_square) when none is provided", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.resolverMocks.resolveImage.mockResolvedValue(mockImageRow({ userId }));
    mocks.credits.consume.mockResolvedValue({ success: true, remaining: 99 });
    mocks.db.jobCreate.mockResolvedValue(
      mockJobRow({ userId, status: "PENDING", tier: "FREE", creditsCost: 1 }),
    );

    const result = await crop({ image_id: "img-1" }, ctx);

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.preset).toBe("instagram_square");
  });

  it("should return error for unknown preset", async () => {
    const parsed = (await import("./crop.js")).CropInputSchema.safeParse({
      image_id: "img-1",
      preset: "tiktok_vertical" as unknown as string,
    });
    expect(parsed.success).toBe(false);
  });
});
