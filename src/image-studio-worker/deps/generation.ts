import { Buffer } from "node:buffer";
import { ENHANCEMENT_COSTS, type ImageStudioDeps } from "@spike-land-ai/mcp-image-studio";
import type { Env } from "../env.d.ts";

export function createGeminiGeneration(
  env: Env,
  db: ImageStudioDeps["db"],
  credits: ImageStudioDeps["credits"],
  storage: ImageStudioDeps["storage"],
  options: { userApiKey?: string; modelName?: string } = {},
): ImageStudioDeps["generation"] {
  const { userApiKey, modelName: preferredImageModel } = options;
  const AI_GATEWAY_BASE =
    "https://gateway.ai.cloudflare.com/v1/1f98921051196545ebe79a450d3c71ed/image-studio/google-ai-studio";
  const gatewayHeaders = () => ({
    "cf-aig-authorization": `Bearer ${env.CF_AIG_TOKEN}`,
  });
  const useGateway = !userApiKey && env.CF_AIG_TOKEN;

  const IMAGE_MODELS = [
    preferredImageModel || "gemini-2.0-flash-preview-image-generation",
    "gemini-2.0-flash-exp",
  ];

  async function callGeminiOnce(
    model: string,
    prompt: string,
    imageBase64?: string,
    imageMimeType?: string,
  ): Promise<{ base64: string; mimeType: string }> {
    const { GoogleGenAI } = await import("@google/genai");
    const ai = new GoogleGenAI({
      apiKey: userApiKey || env.GEMINI_API_KEY,
      ...(useGateway
        ? {
            httpOptions: { baseUrl: AI_GATEWAY_BASE, headers: gatewayHeaders() },
          }
        : {}),
    });

    const contents: Array<Record<string, unknown>> = [];

    if (imageBase64 && imageMimeType) {
      contents.push({
        inlineData: { data: imageBase64, mimeType: imageMimeType },
      });
    }

    contents.push({ text: prompt });

    const response = await ai.models.generateContent({
      model,
      contents: [{ role: "user", parts: contents }],
      config: {
        responseModalities: ["IMAGE", "TEXT"],
      },
    });

    const parts = response.candidates?.[0]?.content?.parts;
    if (!parts) throw new Error("No response from Gemini");

    for (const part of parts) {
      if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("image/")) {
        return {
          base64: part.inlineData.data,
          mimeType: part.inlineData.mimeType,
        };
      }
    }

    throw new Error("No image in Gemini response");
  }

  async function callGemini(
    prompt: string,
    imageBase64?: string,
    imageMimeType?: string,
  ): Promise<{ base64: string; mimeType: string }> {
    let lastError: Error | undefined;
    for (const model of IMAGE_MODELS) {
      try {
        return await callGeminiOnce(model, prompt, imageBase64, imageMimeType);
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err));
        const msg = lastError.message.toLowerCase();
        const isRetryable =
          msg.includes("region") ||
          msg.includes("unavailable") ||
          msg.includes("not found") ||
          msg.includes("not supported") ||
          msg.includes("503") ||
          msg.includes("404") ||
          msg.includes("429");
        if (!isRetryable) throw lastError;
        console.warn(`Image model ${model} failed (${lastError.message}), trying next...`);
      }
    }
    throw lastError ?? new Error("All image models failed");
  }

  return {
    async createGenerationJob(opts) {
      const cost = ENHANCEMENT_COSTS[opts.tier];

      const consumeResult = await credits.consume({
        userId: opts.userId,
        amount: cost,
        source: "generation",
      });
      if (!consumeResult.success) {
        return { success: false, error: "Insufficient credits" };
      }

      const job = await db.generationJobCreate({
        userId: opts.userId,
        type: "GENERATE",
        tier: opts.tier,
        creditsCost: cost,
        status: "PROCESSING",
        prompt: opts.prompt,
      });

      try {
        const fullPrompt = opts.aspectRatio
          ? `${opts.prompt} (aspect ratio: ${opts.aspectRatio})`
          : opts.prompt;

        const result = await callGemini(fullPrompt);
        const imageBytes = Buffer.from(result.base64, "base64");
        const ext = result.mimeType === "image/png" ? "png" : "jpg";

        const uploaded = await storage.upload(opts.userId, imageBytes, {
          filename: `gen-${job.id}.${ext}`,
          contentType: result.mimeType,
        });

        await db.generationJobUpdate(job.id, {
          status: "COMPLETED",
          outputImageUrl: uploaded.url,
          outputSizeBytes: uploaded.sizeBytes,
        });

        return { success: true, jobId: job.id, creditsCost: cost };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Generation failed";
        await db.generationJobUpdate(job.id, {
          status: "FAILED",
          errorMessage: message,
        });
        await credits.refund(opts.userId, cost);
        return { success: false, error: message };
      }
    },

    async createModificationJob(opts) {
      const cost = ENHANCEMENT_COSTS[opts.tier];

      const consumeResult = await credits.consume({
        userId: opts.userId,
        amount: cost,
        source: "modification",
      });
      if (!consumeResult.success) {
        return { success: false, error: "Insufficient credits" };
      }

      const job = await db.generationJobCreate({
        userId: opts.userId,
        type: "MODIFY",
        tier: opts.tier,
        creditsCost: cost,
        status: "PROCESSING",
        prompt: opts.prompt,
      });

      try {
        const result = await callGemini(opts.prompt, opts.imageData, opts.mimeType);
        const imageBytes = Buffer.from(result.base64, "base64");
        const ext = result.mimeType === "image/png" ? "png" : "jpg";

        const uploaded = await storage.upload(opts.userId, imageBytes, {
          filename: `mod-${job.id}.${ext}`,
          contentType: result.mimeType,
        });

        await db.generationJobUpdate(job.id, {
          status: "COMPLETED",
          outputImageUrl: uploaded.url,
          outputSizeBytes: uploaded.sizeBytes,
        });

        return { success: true, jobId: job.id, creditsCost: cost };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Modification failed";
        await db.generationJobUpdate(job.id, {
          status: "FAILED",
          errorMessage: message,
        });
        await credits.refund(opts.userId, cost);
        return { success: false, error: message };
      }
    },

    async createAdvancedGenerationJob(opts) {
      const cost = ENHANCEMENT_COSTS[opts.tier];

      const consumeResult = await credits.consume({
        userId: opts.userId,
        amount: cost,
        source: "advanced_generation",
      });
      if (!consumeResult.success) {
        return { success: false, error: "Insufficient credits" };
      }

      const job = await db.generationJobCreate({
        userId: opts.userId,
        type: "GENERATE",
        tier: opts.tier,
        creditsCost: cost,
        status: "PROCESSING",
        prompt: opts.prompt,
      });

      try {
        let fullPrompt = opts.prompt;
        if (opts.options.negativePrompt) {
          fullPrompt += ` (avoid: ${opts.options.negativePrompt})`;
        }
        if (opts.options.aspectRatio) {
          fullPrompt += ` (aspect ratio: ${opts.options.aspectRatio})`;
        }
        if (opts.options.textToRender) {
          fullPrompt += ` (render text: "${opts.options.textToRender}")`;
        }

        const result = await callGemini(fullPrompt);
        const imageBytes = Buffer.from(result.base64, "base64");
        const ext = result.mimeType === "image/png" ? "png" : "jpg";

        const uploaded = await storage.upload(opts.userId, imageBytes, {
          filename: `adv-${job.id}.${ext}`,
          contentType: result.mimeType,
        });

        await db.generationJobUpdate(job.id, {
          status: "COMPLETED",
          outputImageUrl: uploaded.url,
          outputSizeBytes: uploaded.sizeBytes,
        });

        return { success: true, jobId: job.id, creditsCost: cost };
      } catch (err) {
        const message = err instanceof Error ? err.message : "Advanced generation failed";
        await db.generationJobUpdate(job.id, {
          status: "FAILED",
          errorMessage: message,
        });
        await credits.refund(opts.userId, cost);
        return { success: false, error: message };
      }
    },

    async describeImage(opts) {
      try {
        const image = await db.imageFindById(opts.imageId);
        if (!image) {
          return { description: "", tags: [], error: "Image not found" };
        }

        const imageData = await storage.download(image.originalR2Key);
        const base64 = imageData.toString("base64");

        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: userApiKey || env.GEMINI_API_KEY,
          ...(useGateway
            ? {
                httpOptions: {
                  baseUrl: AI_GATEWAY_BASE,
                  headers: gatewayHeaders(),
                },
              }
            : {}),
        });

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: base64,
                    mimeType: `image/${image.originalFormat}`,
                  },
                },
                {
                  text: 'Describe this image in detail. Also provide 5-10 relevant tags. Format as JSON: {"description": "...", "tags": ["..."]}',
                },
              ],
            },
          ],
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            description: string;
            tags: string[];
          };
          return { description: parsed.description, tags: parsed.tags };
        }
        return { description: text, tags: [] };
      } catch (err) {
        return {
          description: "",
          tags: [],
          error: err instanceof Error ? err.message : "Failed to describe image",
        };
      }
    },

    async extractPalette(opts) {
      try {
        const image = await db.imageFindById(opts.imageId);
        if (!image) return { palette: [], error: "Image not found" };

        const imageData = await storage.download(image.originalR2Key);
        const base64 = imageData.toString("base64");

        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: userApiKey || env.GEMINI_API_KEY,
          ...(useGateway
            ? {
                httpOptions: {
                  baseUrl: AI_GATEWAY_BASE,
                  headers: gatewayHeaders(),
                },
              }
            : {}),
        });

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [
            {
              role: "user",
              parts: [
                {
                  inlineData: {
                    data: base64,
                    mimeType: `image/${image.originalFormat}`,
                  },
                },
                {
                  text: 'Extract the 5 most dominant colors from this image as hex codes. Return only a JSON array of hex strings like ["#ff0000", ...]',
                },
              ],
            },
          ],
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const jsonMatch = text.match(/\[[\s\S]*\]/);
        if (jsonMatch) {
          const palette = JSON.parse(jsonMatch[0]) as string[];
          return { palette };
        }
        return { palette: [] };
      } catch (err) {
        return {
          palette: [],
          error: err instanceof Error ? err.message : "Failed to extract palette",
        };
      }
    },

    async compareImages(opts) {
      try {
        const { GoogleGenAI } = await import("@google/genai");
        const ai = new GoogleGenAI({
          apiKey: userApiKey || env.GEMINI_API_KEY,
          ...(useGateway
            ? {
                httpOptions: {
                  baseUrl: AI_GATEWAY_BASE,
                  headers: gatewayHeaders(),
                },
              }
            : {}),
        });

        const parts: Array<Record<string, unknown>> = [];

        // Load both images
        for (const id of [opts.image1Id, opts.image2Id]) {
          if (id) {
            const image = await db.imageFindById(id);
            if (image) {
              const data = await storage.download(image.originalR2Key);
              parts.push({
                inlineData: {
                  data: data.toString("base64"),
                  mimeType: `image/${image.originalFormat}`,
                },
              });
            }
          }
        }

        parts.push({
          text: 'Compare these two images. Rate similarity from 0 to 1 and list key differences. Return JSON: {"similarity": 0.X, "differences": ["..."]}',
        });

        const response = await ai.models.generateContent({
          model: "gemini-2.0-flash",
          contents: [{ role: "user", parts }],
        });

        const text = response.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          const parsed = JSON.parse(jsonMatch[0]) as {
            similarity: number;
            differences: string[];
          };
          return { comparison: parsed };
        }
        return { comparison: { similarity: 0, differences: [] } };
      } catch (err) {
        return {
          comparison: { similarity: 0, differences: [] },
          error: err instanceof Error ? err.message : "Comparison failed",
        };
      }
    },
  };
}
