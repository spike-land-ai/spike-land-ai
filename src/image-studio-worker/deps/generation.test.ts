import { describe, it, expect, vi, beforeEach } from "vitest";
import { createGeminiGeneration } from "./generation.ts";

vi.mock("@google/genai", () => {
  return {
    GoogleGenAI: class {
      models = {
        generateContent: vi.fn().mockImplementation((opts) => {
          const prompt = opts.contents[0].parts.find((p: any) => p.text)?.text || "";
          let text = "";
          if (prompt.includes("Describe")) text = '{"description":"desc","tags":["t"]}';
          else if (prompt.includes("Extract")) text = '["#000"]';
          else if (prompt.includes("Compare")) text = '{"similarity":1,"differences":[]}';
          return Promise.resolve({
            candidates: [{ content: { parts: [{ inlineData: { data: "base64", mimeType: "image/png" }, text }] } }]
          });
        })
      };
    }
  };
});

describe("generation", () => {
  const db = {
    generationJobCreate: vi.fn().mockResolvedValue({ id: "job-1" }),
    generationJobUpdate: vi.fn().mockResolvedValue({}),
    imageFindById: vi.fn().mockResolvedValue({ originalR2Key: "k", originalFormat: "png" })
  } as any;

  const credits = {
    consume: vi.fn().mockResolvedValue({ success: true }),
    refund: vi.fn()
  } as any;

  const storage = {
    upload: vi.fn().mockResolvedValue({ url: "u", sizeBytes: 1 }),
    download: vi.fn().mockResolvedValue(Buffer.from("a"))
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
    db.generationJobCreate.mockResolvedValue({ id: "job-1" });
    db.generationJobUpdate.mockResolvedValue({});
    db.imageFindById.mockResolvedValue({ originalR2Key: "k", originalFormat: "png" });
    credits.consume.mockResolvedValue({ success: true });
    storage.upload.mockResolvedValue({ url: "u", sizeBytes: 1 });
    storage.download.mockResolvedValue(Buffer.from("a"));
  });

  it("createGenerationJob", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as any, db, credits, storage);
    const res = await gen.createGenerationJob({ userId: "u", prompt: "p", tier: "FREE", aspectRatio: "1:1" } as any);
    expect(res.success).toBe(true);
  });

  it("createGenerationJob fail credits", async () => {
    credits.consume.mockResolvedValueOnce({ success: false });
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as any, db, credits, storage);
    const res = await gen.createGenerationJob({ userId: "u", prompt: "p", tier: "FREE" } as any);
    expect(res.success).toBe(false);
  });
  
  it("createGenerationJob error", async () => {
    // If generationJobCreate fails, it throws
    db.generationJobCreate.mockRejectedValueOnce(new Error("fail"));
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as any, db, credits, storage);
    await expect(gen.createGenerationJob({ userId: "u", prompt: "p", tier: "FREE" } as any)).rejects.toThrow();
  });

  it("createModificationJob", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as any, db, credits, storage);
    const res = await gen.createModificationJob({ userId: "u", prompt: "p", imageData: "b64", mimeType: "image/png", tier: "FREE" } as any);
    expect(res.success).toBe(true);
  });

  it("createAdvancedGenerationJob", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as any, db, credits, storage);
    const res = await gen.createAdvancedGenerationJob!({ userId: "u", prompt: "p", tier: "FREE", options: { negativePrompt: "n", aspectRatio: "1:1", textToRender: "t" } } as any);
    expect(res.success).toBe(true);
  });

  it("describeImage", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as any, db, credits, storage);
    const res = await gen.describeImage!({ userId: "u", imageId: "img" as any });
    expect(res.description).toBe("desc");
  });

  it("extractPalette", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as any, db, credits, storage);
    const res = await gen.extractPalette!({ userId: "u", imageId: "img" as any });
    expect(res.palette[0]).toBe("#000");
  });

  it("compareImages", async () => {
    const gen = createGeminiGeneration({ GEMINI_API_KEY: "k" } as any, db, credits, storage);
    const res = await gen.compareImages!({ userId: "u", image1Id: "img" as any });
    expect(res.comparison.similarity).toBe(1);
  });
});
