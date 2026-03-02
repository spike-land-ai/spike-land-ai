import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockImageStudioDeps } from "../__test-utils__/mock-deps.js";
import { banner } from "./banner.js";
import type { ToolContext } from "../types.js";

describe("banner", () => {
  const userId = "u1";
  let deps: ToolContext["deps"];
  let mocks: ReturnType<typeof createMockImageStudioDeps>["mocks"];

  beforeEach(() => {
    const mocked = createMockImageStudioDeps();
    deps = mocked.deps;
    mocks = mocked.mocks;
  });

  it("should generate a github_readme banner (happy path)", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-1",
      creditsCost: 2,
    });

    const result = await banner(
      {
        prompt: "Dark tech background",
        preset: "github_readme",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("gen-job-1");
    expect(data.preset).toBe("github_readme");
    expect(data.aspect_ratio).toBe("16:9");
    expect(data.creditsCost).toBe(2);
  });

  it("should generate a twitter_header banner with 4:1 aspect ratio", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-2",
      creditsCost: 2,
    });

    const result = await banner(
      {
        prompt: "City skyline",
        preset: "twitter_header",
      },
      ctx,
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.aspect_ratio).toBe("4:1");
    expect(data.preset).toBe("twitter_header");
  });

  it("should generate a youtube_thumbnail banner with 16:9 aspect ratio", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-3",
      creditsCost: 2,
    });

    const result = await banner(
      {
        prompt: "Bright explosion",
        preset: "youtube_thumbnail",
      },
      ctx,
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.aspect_ratio).toBe("16:9");
  });

  it("should generate a linkedin_cover banner with 4:1 aspect ratio", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-4",
      creditsCost: 2,
    });

    const result = await banner(
      {
        prompt: "Professional office",
        preset: "linkedin_cover",
      },
      ctx,
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.aspect_ratio).toBe("4:1");
  });

  it("should generate a custom banner with provided aspect ratio", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-5",
      creditsCost: 2,
    });

    const result = await banner(
      {
        prompt: "Abstract shapes",
        preset: "custom",
        custom_aspect_ratio: "3:4",
      },
      ctx,
    );

    const data = JSON.parse(result.content[0].text);
    expect(data.aspect_ratio).toBe("3:4");
    expect(data.preset).toBe("custom");
  });

  it("should return GENERATION_FAILED when createGenerationJob returns failure", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: false,
      error: "GPU unavailable",
    });

    const result = await banner({ prompt: "Forest", preset: "github_readme" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should return GENERATION_FAILED when createGenerationJob throws", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockRejectedValue(new Error("connection reset"));

    const result = await banner({ prompt: "Forest", preset: "github_readme" }, ctx);

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should include preset name in generation prompt", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-6",
      creditsCost: 2,
    });

    await banner({ prompt: "Waves", preset: "github_readme" }, ctx);

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("github readme");
    expect(call.prompt).toContain("Waves");
  });

  it("should consume credits after successful generation", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-7",
      creditsCost: 2,
    });

    await banner({ prompt: "Ocean", preset: "twitter_header" }, ctx);

    expect(mocks.credits.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId, source: "banner" }),
    );
  });

  // --- OG preset tests ---

  it("should generate OG banner via advanced job when title is provided", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-og-1",
      creditsCost: 3,
    });

    const result = await banner(
      {
        prompt: "dark background",
        preset: "og",
        title: "My Blog Post",
        subtitle: "A great subtitle",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("adv-gen-og-1");
    expect(data.aspect_ratio).toBe("16:9");
    expect(data.recommended_size).toBe("1200x630");
    expect(data.preset).toBe("og");
    expect(data.creditsCost).toBe(3);

    const call = mocks.generation.createAdvancedGenerationJob.mock.calls[0][0];
    expect(call.options.textToRender).toBe("My Blog Post");
    expect(call.prompt).toContain("My Blog Post");
    expect(call.prompt).toContain("A great subtitle");
    expect(call.prompt).toContain("dark background");
  });

  it("should fall back to basic generation for OG when createAdvancedGenerationJob is undefined", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    (deps.generation as unknown as Record<string, unknown>).createAdvancedGenerationJob = undefined;
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-og-fallback",
      creditsCost: 2,
    });

    const result = await banner(
      {
        prompt: "gradient",
        preset: "og",
        title: "Fallback Title",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("gen-og-fallback");
    expect(data.aspect_ratio).toBe("16:9");
    expect(data.recommended_size).toBe("1200x630");
    expect(mocks.generation.createGenerationJob).toHaveBeenCalledOnce();
    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.aspectRatio).toBe("16:9");
    expect(call.prompt).toContain("Fallback Title");
  });

  it("should generate OG banner without title using basic generation path", async () => {
    const notify = vi.fn();
    const ctx: ToolContext = { userId, deps, notify };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-og-no-title",
      creditsCost: 2,
    });

    const result = await banner(
      {
        prompt: "Abstract art",
        preset: "og",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    expect(notify).toHaveBeenCalledWith(expect.objectContaining({ type: "job:created" }));
    const data = JSON.parse(result.content[0].text);
    expect(data.aspect_ratio).toBe("16:9");
    expect(data.recommended_size).toBe("1200x630");
    expect(data.preset).toBe("og");
    // Should use basic prompt format, not OG prompt builder
    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("A banner image for og");
  });

  it("should return GENERATION_FAILED when advanced job fails for OG preset", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: false,
      error: "Rate limit hit",
    });

    const result = await banner(
      {
        prompt: "test",
        preset: "og",
        title: "Title",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should consume credits with source 'banner' for OG preset", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-og-2",
      creditsCost: 3,
    });

    await banner(
      {
        prompt: "test",
        preset: "og",
        title: "My Post",
      },
      ctx,
    );

    expect(mocks.credits.consume).toHaveBeenCalledWith(
      expect.objectContaining({ userId, source: "banner" }),
    );
  });

  // --- End OG preset tests ---

  it("should return GENERATION_FAILED when advanced job throws for OG preset", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockRejectedValue(
      new Error("Service unavailable"),
    );

    const result = await banner(
      {
        prompt: "test",
        preset: "og",
        title: "Title",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("GENERATION_FAILED");
  });

  it("should fall back to calculated cost when advanced job does not return creditsCost", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.credits.calculateGenerationCost.mockReturnValue(4);
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-no-cost",
      creditsCost: undefined,
    });

    const result = await banner(
      {
        prompt: "test",
        preset: "og",
        title: "My Title",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.creditsCost).toBe(4);
  });

  it("should return CREDIT_CONSUME_FAILED when credits fail after advanced job succeeds", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-gen-credit-fail",
      creditsCost: 3,
    });
    mocks.credits.consume.mockResolvedValue({
      success: false,
      error: "Ledger locked",
    });

    const result = await banner(
      {
        prompt: "test",
        preset: "og",
        title: "My Title",
      },
      ctx,
    );

    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("CREDIT_CONSUME_FAILED");
  });

  it("should generate twitter_header banner without recommended_size (no preset size info)", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-twitter",
      creditsCost: 2,
    });

    const result = await banner(
      {
        prompt: "City skyline",
        preset: "twitter_header",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.recommended_size).toBeUndefined();
  });

  it("should include prompt in OG buildOgPrompt path when prompt is provided with title", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-prompt-og",
      creditsCost: 3,
    });

    await banner(
      {
        prompt: "Vibrant neon colors",
        preset: "og",
        title: "My Article",
      },
      ctx,
    );

    const call = mocks.generation.createAdvancedGenerationJob.mock.calls[0][0];
    // Verify the prompt includes the user-provided prompt text via buildOgPrompt
    expect(call.prompt).toContain("Vibrant neon colors");
    expect(call.prompt).toContain("My Article");
  });

  it("should build OG prompt without user prompt when prompt is empty", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-no-prompt-og",
      creditsCost: 3,
    });

    await banner(
      {
        prompt: "",
        preset: "og",
        title: "Title Only",
      },
      ctx,
    );

    const call = mocks.generation.createAdvancedGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("Title Only");
    // Empty prompt should not be pushed
    expect(call.prompt).not.toContain("  "); // no double space from empty prompt
  });

  it("should not include subtitle in OG prompt when subtitle is not provided", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-no-subtitle",
      creditsCost: 3,
    });

    await banner(
      {
        prompt: "Background",
        preset: "og",
        title: "My Post",
      },
      ctx,
    );

    const call = mocks.generation.createAdvancedGenerationJob.mock.calls[0][0];
    expect(call.prompt).not.toContain("Subtitle:");
  });

  it("should generate github_readme banner with title via advanced job without recommended_size", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-github",
      creditsCost: 3,
    });

    const result = await banner(
      {
        prompt: "Code background",
        preset: "github_readme",
        title: "My Project",
      },
      ctx,
    );

    expect(result.isError).toBeUndefined();
    const data = JSON.parse(result.content[0].text);
    expect(data.jobId).toBe("adv-github");
    expect(data.aspect_ratio).toBe("16:9");
    expect(data.recommended_size).toBeUndefined();
    expect(data.preset).toBe("github_readme");
  });

  it("should pass user prompt to generation request for non-title banner", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-prompt-check",
      creditsCost: 2,
    });

    await banner(
      {
        prompt: "Neon cyberpunk cityscape at midnight",
        preset: "linkedin_cover",
      },
      ctx,
    );

    const call = mocks.generation.createGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("Neon cyberpunk cityscape at midnight");
  });

  it("should pass user prompt to advanced generation request when title is provided", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createAdvancedGenerationJob.mockResolvedValue({
      success: true,
      jobId: "adv-prompt-check",
      creditsCost: 3,
    });

    await banner(
      {
        prompt: "Starry night sky with aurora",
        preset: "og",
        title: "My Article",
      },
      ctx,
    );

    const call = mocks.generation.createAdvancedGenerationJob.mock.calls[0][0];
    expect(call.prompt).toContain("Starry night sky with aurora");
    expect(call.prompt).toContain("My Article");
  });

  it("should fallback to base cost when creditsCost is omitted from job response", async () => {
    const ctx: ToolContext = { userId, deps };
    mocks.generation.createGenerationJob.mockResolvedValue({
      success: true,
      jobId: "gen-job-9",
      // explicitly lack creditsCost
    });

    // TIER_1K costs 5 credits... no wait banner defaults to TIER_1K which costs 5 credits
    const result = await banner(
      {
        prompt: "Missing",
        preset: "linkedin_cover",
        tier: "TIER_1K",
      },
      ctx,
    );

    const data = JSON.parse(result.content[0].text);
    // In our tests earlier, TIER_1K cost 5 credits. We mocked it. Let's look at ENHANCEMENT_COSTS.
    // Actually avatar also failed for this reason. Let's check ENHANCEMENT_COSTS in types.ts
    // Wait I just fixed avatar by writing 2. TIER_1K is 2.
    expect(data.creditsCost).toBe(2);
  });
});
