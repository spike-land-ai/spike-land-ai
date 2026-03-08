import { beforeEach, describe, expect, it, vi } from "vitest";
import { createGeminiGeneration } from "../../../src/edge-api/image-studio-worker/ai-mcp/generation.ts";
import type { ImageStudioDeps } from "@spike-land-ai/mcp-image-studio";
import type { Env } from "../../../src/edge-api/image-studio-worker/env.d.ts";

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockImplementation((opts: { contents: Array<{ parts: Array<{ text?: string }> }> }) => {
          const prompt = opts.contents[0].parts.find((p) => p.text)?.text || "";
          let text = "";
          if (prompt.includes("Describe")) {
            text = '{"description":"desc","tags":["t"]}';
          } else if (prompt.includes("Extract")) {
            text = '["#000"]';
          } else if (prompt.includes("Compare")) {
            text = '{"similarity":1,"differences":[]}';
          }
          return Promise.resolve({
            candidates: [
              {
                content: {
                  parts: [
                    {
                      inlineData: { data: "base64", mimeType: "image/png" },
                      text,
                    },
                  ],
                },
              },
            ],
          });
        }),
      };
    },
  };
});

describe("generation", () => {
  const db = {
    generationJobCreate: vi.fn().mockResolvedValue({ id: "job-1" }),
    generationJobUpdate: vi.fn().mockResolvedValue({}),
    imageFindById: vi.fn().mockResolvedValue({
      originalR2Key: "k",
      originalFormat: "png",
    }),
  } as unknown as ImageStudioDeps["db"];

  const credits = {
    consume: vi.fn().mockResolvedValue({ success: true }),
    refund: vi.fn(),
  } as unknown as ImageStudioDeps["credits"];

  const storage = {
    upload: vi.fn().mockResolvedValue({ url: "u", sizeBytes: 1 }),
    download: vi.fn().mockResolvedValue(Buffer.from("a")),
  } as unknown as ImageStudioDeps["storage"];

  beforeEach(() => {
    vi.clearAllMocks();
    (db.generationJobCreate as ReturnType<typeof vi.fn>).mockResolvedValue({ id: "job-1" });
    (db.generationJobUpdate as ReturnType<typeof vi.fn>).mockResolvedValue({});
    (db.imageFindById as ReturnType<typeof vi.fn>).mockResolvedValue({
      originalR2Key: "k",
      originalFormat: "png",
    });
    (credits.consume as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
    (storage.upload as ReturnType<typeof vi.fn>).mockResolvedValue({ url: "u", sizeBytes: 1 });
    (storage.download as ReturnType<typeof vi.fn>).mockResolvedValue(Buffer.from("a"));
  });

  it("createGenerationJob", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as unknown as Env, db, credits, storage);
    const res = await gen.createGenerationJob({
      userId: "u",
      prompt: "p",
      tier: "FREE",
      aspectRatio: "1:1",
    } as unknown as Parameters<ImageStudioDeps["generation"]["createGenerationJob"]>[0]);
    expect(res.success).toBe(true);
  });

  it("createGenerationJob fail credits", async () => {
    (credits.consume as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ success: false });
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as unknown as Env, db, credits, storage);
    const res = await gen.createGenerationJob({ userId: "u", prompt: "p", tier: "FREE" } as unknown as Parameters<ImageStudioDeps["generation"]["createGenerationJob"]>[0]);
    expect(res.success).toBe(false);
  });

  it("createGenerationJob error", async () => {
    // If generationJobCreate fails, it throws
    (db.generationJobCreate as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error("fail"));
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as unknown as Env, db, credits, storage);
    await expect(
      gen.createGenerationJob({ userId: "u", prompt: "p", tier: "FREE" } as unknown as Parameters<ImageStudioDeps["generation"]["createGenerationJob"]>[0]),
    ).rejects.toThrow();
  });

  it("createModificationJob", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as unknown as Env, db, credits, storage);
    const res = await gen.createModificationJob({
      userId: "u",
      prompt: "p",
      imageData: "b64",
      mimeType: "image/png",
      tier: "FREE",
    } as unknown as Parameters<ImageStudioDeps["generation"]["createModificationJob"]>[0]);
    expect(res.success).toBe(true);
  });

  it("createAdvancedGenerationJob", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as unknown as Env, db, credits, storage);
    const res = await gen.createAdvancedGenerationJob!({
      userId: "u",
      prompt: "p",
      tier: "FREE",
      options: { negativePrompt: "n", aspectRatio: "1:1", textToRender: "t" },
    } as unknown as Parameters<NonNullable<ImageStudioDeps["generation"]["createAdvancedGenerationJob"]>>[0]);
    expect(res.success).toBe(true);
  });

  it("describeImage", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as unknown as Env, db, credits, storage);
    const res = await gen.describeImage!({
      userId: "u",
      imageId: "img" as unknown as string,
    });
    expect(res.description).toBe("desc");
  });

  it("extractPalette", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as unknown as Env, db, credits, storage);
    const res = await gen.extractPalette!({
      userId: "u",
      imageId: "img" as unknown as string,
    });
    expect(res.palette[0]).toBe("#000");
  });

  it("compareImages", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as unknown as Env, db, credits, storage);
    const res = await gen.compareImages!({
      userId: "u",
      image1Id: "img" as unknown as string,
    });
    expect(res.comparison.similarity).toBe(1);
  });
});
