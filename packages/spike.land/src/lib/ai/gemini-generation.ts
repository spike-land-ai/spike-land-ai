/**
 * Image generation, enhancement, and modification using Gemini API.
 */
import logger from "@/lib/logger";
import { type AspectRatio, detectAspectRatio } from "./aspect-ratio";
import { analyzeImage } from "./gemini-analysis";
import { getGeminiClient } from "./gemini-client";
import { DEFAULT_MODEL, GEMINI_TIMEOUT_MS, supportsImageSize } from "./gemini-models";
import { processGeminiStream } from "./gemini-stream";

/**
 * Reference image data for style guidance
 */
export interface ReferenceImageData {
  /** Base64 encoded image data */
  imageData: string;
  /** MIME type of the image */
  mimeType: string;
  /** Optional description of the reference */
  description?: string;
}

export interface EnhanceImageParams {
  imageData: string;
  mimeType: string;
  tier: "1K" | "2K" | "4K";
  originalWidth?: number | undefined;
  originalHeight?: number | undefined;
  /** Optional prompt override - when provided, skips internal analysis and uses this prompt directly */
  promptOverride?: string | undefined;
  /** Optional reference images for style guidance - base64 encoded with mime types */
  referenceImages?: ReferenceImageData[] | undefined;
  /** Optional model override - when provided, uses this model instead of DEFAULT_MODEL */
  model?: string | undefined;
}

export interface GenerateImageParams {
  prompt: string;
  tier: "1K" | "2K" | "4K";
  negativePrompt?: string;
  /** Optional aspect ratio for the generated image (default: 1:1) */
  aspectRatio?: AspectRatio;
}

export interface ModifyImageParams {
  prompt: string;
  imageData: string;
  mimeType: string;
  tier: "1K" | "2K" | "4K";
  /** Optional aspect ratio - auto-detected from input image if not provided */
  aspectRatio?: AspectRatio;
}

const GENERATION_BASE_PROMPT = `You are a professional photographer creating high-quality images. Generate the following image with perfect composition, lighting, and detail. Make it look like a professional photograph taken with a modern camera in 2025.`;

const MODIFICATION_BASE_PROMPT = `Modify this image according to the following instructions while maintaining high quality, proper lighting, and professional appearance.`;

/**
 * Enhances an image using Gemini's image generation API.
 *
 * @param params - Enhancement parameters including image data, MIME type, and tier
 * @returns Buffer containing the enhanced image data
 * @throws Error if API times out, no API key is configured, or no image data is received
 */
export async function enhanceImageWithGemini(params: EnhanceImageParams): Promise<Buffer> {
  const ai = await getGeminiClient();

  // Use promptOverride if provided, otherwise run analysis to generate prompt
  let enhancementPrompt: string;
  if (params.promptOverride) {
    enhancementPrompt = params.promptOverride;
    logger.info("Using provided prompt override (skipping analysis)");
  } else {
    const analysis = await analyzeImage(params.imageData, params.mimeType);
    enhancementPrompt = analysis.enhancementPrompt;
    logger.info("Using dynamically generated enhancement prompt");
  }

  const resolutionMap = {
    "1K": "1024x1024",
    "2K": "2048x2048",
    "4K": "4096x4096",
  };

  // Use model from params if provided, otherwise use default
  const modelToUse = params.model || DEFAULT_MODEL;

  // Detect aspect ratio from original dimensions to preserve orientation
  const detectedAspectRatio =
    params.originalWidth && params.originalHeight
      ? detectAspectRatio(params.originalWidth, params.originalHeight)
      : undefined;

  // Build config based on model capabilities
  // gemini-2.5-flash-image doesn't support imageSize (always 1024px)
  // gemini-3-pro-image-preview supports imageSize
  const config = {
    responseModalities: ["IMAGE", "TEXT"],
    ...(supportsImageSize(modelToUse) && {
      imageConfig: {
        imageSize: params.tier,
        ...(detectedAspectRatio && { aspectRatio: detectedAspectRatio }),
      },
    }),
    ...(!supportsImageSize(modelToUse) &&
      detectedAspectRatio && {
        imageConfig: {
          aspectRatio: detectedAspectRatio,
        },
      }),
  };

  // Build content parts - include reference images if provided
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  // Add the original image to enhance first
  parts.push({
    inlineData: {
      mimeType: params.mimeType,
      data: params.imageData,
    },
  });

  // Add reference images if provided (for style guidance)
  if (params.referenceImages && params.referenceImages.length > 0) {
    logger.info(`Including reference image(s) for style guidance`, {
      count: params.referenceImages.length,
    });
    for (const refImg of params.referenceImages) {
      parts.push({
        inlineData: {
          mimeType: refImg.mimeType,
          data: refImg.imageData,
        },
      });
    }
  }

  // Add the text prompt
  parts.push({
    text: `${enhancementPrompt}\n\nGenerate at ${resolutionMap[params.tier]} resolution.`,
  });

  const contents = [
    {
      role: "user" as const,
      parts,
    },
  ];

  logger.info(`Generating enhanced image with Gemini API`, {
    model: modelToUse,
    tier: params.tier,
    resolution: resolutionMap[params.tier],
    aspectRatio: detectedAspectRatio || "auto",
    timeout: `${GEMINI_TIMEOUT_MS / 1000}s`,
  });

  return processGeminiStream({
    ai,
    model: modelToUse,
    config,
    contents,
    operationType: "enhancement",
  });
}

/**
 * Generates a new image from a text prompt using Gemini's image generation API.
 *
 * @param params - Generation parameters including prompt and tier
 * @returns Buffer containing the generated image data
 * @throws Error if API times out, no API key is configured, or no image data is received
 */
export async function generateImageWithGemini(params: GenerateImageParams): Promise<Buffer> {
  const ai = await getGeminiClient();

  const resolutionMap = {
    "1K": "1024x1024",
    "2K": "2048x2048",
    "4K": "4096x4096",
  };

  // Build config based on model capabilities
  // DEFAULT_MODEL (gemini-3-pro-image-preview) supports imageSize
  const config = {
    responseModalities: ["IMAGE", "TEXT"],
    ...(supportsImageSize(DEFAULT_MODEL) && {
      imageConfig: {
        imageSize: params.tier,
        ...(params.aspectRatio && { aspectRatio: params.aspectRatio }),
      },
    }),
    ...(!supportsImageSize(DEFAULT_MODEL) &&
      params.aspectRatio && {
        imageConfig: {
          aspectRatio: params.aspectRatio,
        },
      }),
  };

  let fullPrompt = `${GENERATION_BASE_PROMPT}\n\nImage to generate: ${params.prompt}\n\nGenerate at ${
    resolutionMap[params.tier]
  } resolution.`;

  if (params.negativePrompt) {
    fullPrompt += `\n\nAvoid: ${params.negativePrompt}`;
  }

  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          text: fullPrompt,
        },
      ],
    },
  ];

  logger.info(`Generating image with Gemini API`, {
    model: DEFAULT_MODEL,
    tier: params.tier,
    resolution: resolutionMap[params.tier],
    aspectRatio: params.aspectRatio || "1:1 (default)",
    prompt: `${params.prompt.substring(0, 100)}...`,
    timeout: `${GEMINI_TIMEOUT_MS / 1000}s`,
  });

  return processGeminiStream({
    ai,
    model: DEFAULT_MODEL,
    config,
    contents,
    operationType: "generation",
  });
}

/**
 * Modifies an existing image based on a text prompt using Gemini's image generation API.
 *
 * @param params - Modification parameters including prompt, image data, and tier
 * @returns Buffer containing the modified image data
 * @throws Error if API times out, no API key is configured, or no image data is received
 */
export async function modifyImageWithGemini(params: ModifyImageParams): Promise<Buffer> {
  const ai = await getGeminiClient();

  const resolutionMap = {
    "1K": "1024x1024",
    "2K": "2048x2048",
    "4K": "4096x4096",
  };

  // Build config based on model capabilities
  // DEFAULT_MODEL (gemini-3-pro-image-preview) supports imageSize
  const config = {
    responseModalities: ["IMAGE", "TEXT"],
    ...(supportsImageSize(DEFAULT_MODEL) && {
      imageConfig: {
        imageSize: params.tier,
        ...(params.aspectRatio && { aspectRatio: params.aspectRatio }),
      },
    }),
    ...(!supportsImageSize(DEFAULT_MODEL) &&
      params.aspectRatio && {
        imageConfig: {
          aspectRatio: params.aspectRatio,
        },
      }),
  };

  const fullPrompt = `${MODIFICATION_BASE_PROMPT}\n\nModification instructions: ${params.prompt}\n\nGenerate at ${
    resolutionMap[params.tier]
  } resolution.`;

  const contents = [
    {
      role: "user" as const,
      parts: [
        {
          inlineData: {
            mimeType: params.mimeType,
            data: params.imageData,
          },
        },
        {
          text: fullPrompt,
        },
      ],
    },
  ];

  logger.info(`Modifying image with Gemini API`, {
    model: DEFAULT_MODEL,
    tier: params.tier,
    resolution: resolutionMap[params.tier],
    aspectRatio: params.aspectRatio || "auto-detected",
    prompt: `${params.prompt.substring(0, 100)}...`,
    timeout: `${GEMINI_TIMEOUT_MS / 1000}s`,
  });

  return processGeminiStream({
    ai,
    model: DEFAULT_MODEL,
    config,
    contents,
    operationType: "modification",
  });
}
