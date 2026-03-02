/**
 * Image analysis types and functions using Gemini vision model.
 */
import logger from "@/lib/logger";
import { tryCatch } from "@/lib/try-catch";
import type { GoogleGenAI } from "@google/genai";
import { ANALYSIS_TIMEOUT_MS, DEFAULT_MODEL } from "./gemini-models";
import { getGeminiClient } from "./gemini-client";
import { buildDynamicEnhancementPrompt } from "./gemini-prompts";
import type { AnalysisConfig } from "./pipeline-types";

// Analysis prompt schema for structured JSON output from vision model
const ANALYSIS_PROMPT_SCHEMA = `Analyze this image and provide a JSON object describing its content, technical flaws, and potential cropping needs.
The JSON MUST strictly adhere to this structure, with no additional text before or after:
{
    "mainSubject": "brief description of image content",
    "imageStyle": "photograph" OR "sketch" OR "painting" OR "screenshot" OR "other",
    "defects": {
      "isDark": boolean (true if severely underexposed/pitch black),
      "isBlurry": boolean (true if significant motion or focus blur),
      "hasNoise": boolean (true if grainy or high ISO noise),
      "hasVHSArtifacts": boolean (true if tracking lines, tape distortion, color bleed),
      "isLowResolution": boolean (true if pixelated),
      "isOverexposed": boolean (true if blown-out highlights),
      "hasColorCast": boolean (true if unnatural tint),
      "colorCastType": "yellow" OR "blue" OR "green" OR "red" OR "magenta" OR "cyan" (null if no cast)
    },
    "lightingCondition": "e.g., pitch black, dim indoors, sunny, harsh flash",
    "cropping": {
      "isCroppingNeeded": boolean (true if there are black bars, UI elements, or excessive empty space),
      "suggestedCrop": { "x": number, "y": number, "width": number, "height": number } (percentages 0.0-1.0, null if no crop),
      "cropReason": "reason for crop" (null if no crop needed)
    }
}`;

interface ImageAnalysisResult {
  description: string;
  quality: "low" | "medium" | "high";
  suggestedImprovements: string[];
  enhancementPrompt: string;
}

/**
 * Crop dimensions as percentages (0.0-1.0) of the original image dimensions.
 * Used by the vision model to suggest cropping areas.
 */
export interface CropDimensions {
  x: number; // Left edge as percentage (0.0-1.0)
  y: number; // Top edge as percentage (0.0-1.0)
  width: number; // Width as percentage (0.0-1.0)
  height: number; // Height as percentage (0.0-1.0)
}

/**
 * Pixel-based crop region used for Sharp image processing.
 * Converted from CropDimensions percentages.
 */
export interface CropRegionPixels {
  left: number;
  top: number;
  width: number;
  height: number;
}

/**
 * Detailed analysis result from vision model.
 * Provides structured information about image characteristics and defects.
 */
export interface AnalysisDetailedResult {
  /** Brief description of the main subject in the image */
  mainSubject: string;
  /** Detected style/type of the image */
  imageStyle: "photograph" | "sketch" | "painting" | "screenshot" | "other";
  /** Detected defects that need correction */
  defects: {
    /** True if severely underexposed (pitch dark) */
    isDark: boolean;
    /** True if image has motion blur or is out of focus */
    isBlurry: boolean;
    /** True if image has visible ISO/sensor noise or grain */
    hasNoise: boolean;
    /** True if image has VHS tracking lines, color bleed, or analog artifacts */
    hasVHSArtifacts: boolean;
    /** True if image is pixelated or low detail */
    isLowResolution: boolean;
    /** True if image has blown-out highlights */
    isOverexposed: boolean;
    /** True if image has unnatural color tint */
    hasColorCast: boolean;
    /** Type of color cast if hasColorCast is true */
    colorCastType?: "yellow" | "blue" | "green" | "red" | "magenta" | "cyan";
  };
  /** Description of lighting conditions (e.g., "pitch black", "dim indoors", "sunny") */
  lightingCondition: string;
  /** Cropping analysis */
  cropping: {
    /** True if image has black bars, UI elements, or excessive empty space */
    isCroppingNeeded: boolean;
    /** Suggested crop dimensions as percentages (0.0-1.0) */
    suggestedCrop?: CropDimensions;
    /** Reason for suggested cropping */
    cropReason?: string;
  };
}

/**
 * Extended ImageAnalysisResult with structured analysis from vision model.
 */
export interface ImageAnalysisResultV2 {
  description: string;
  quality: "low" | "medium" | "high";
  structuredAnalysis: AnalysisDetailedResult;
}

/**
 * Returns default analysis result for fallback scenarios.
 * Used when vision model analysis fails or times out.
 * @internal
 */
export function getDefaultAnalysis(): AnalysisDetailedResult {
  return {
    mainSubject: "General image",
    imageStyle: "photograph",
    defects: {
      isDark: false,
      isBlurry: false,
      hasNoise: false,
      hasVHSArtifacts: false,
      isLowResolution: true, // Assume low res since we're enhancing
      isOverexposed: false,
      hasColorCast: false,
    },
    lightingCondition: "unknown",
    cropping: {
      isCroppingNeeded: false,
    },
  };
}

/**
 * Validates the imageStyle field from analysis response.
 * @internal
 */
function validateImageStyle(style: unknown): AnalysisDetailedResult["imageStyle"] {
  const validStyles = ["photograph", "sketch", "painting", "screenshot", "other"];
  if (typeof style === "string" && validStyles.includes(style)) {
    return style as AnalysisDetailedResult["imageStyle"];
  }
  return "photograph";
}

/**
 * Validates the colorCastType field from analysis response.
 * @internal
 */
function validateColorCastType(type: unknown): AnalysisDetailedResult["defects"]["colorCastType"] {
  const validTypes = ["yellow", "blue", "green", "red", "magenta", "cyan"];
  if (typeof type === "string" && validTypes.includes(type)) {
    return type as AnalysisDetailedResult["defects"]["colorCastType"];
  }
  return undefined;
}

/**
 * Parses the analysis response, handling potential markdown code blocks.
 * @internal
 */
function parseAnalysisResponse(text: string): AnalysisDetailedResult {
  // Remove markdown code blocks if present
  let jsonText = text.trim();
  if (jsonText.startsWith("```json")) {
    jsonText = jsonText.slice(7);
  } else if (jsonText.startsWith("```")) {
    jsonText = jsonText.slice(3);
  }
  if (jsonText.endsWith("```")) {
    jsonText = jsonText.slice(0, -3);
  }
  jsonText = jsonText.trim();

  const parsed = JSON.parse(jsonText);

  // Validate and sanitize the parsed response
  const colorCastType = validateColorCastType(parsed.defects?.colorCastType);
  return {
    mainSubject: String(parsed.mainSubject || "Unknown subject"),
    imageStyle: validateImageStyle(parsed.imageStyle),
    defects: {
      isDark: Boolean(parsed.defects?.isDark),
      isBlurry: Boolean(parsed.defects?.isBlurry),
      hasNoise: Boolean(parsed.defects?.hasNoise),
      hasVHSArtifacts: Boolean(parsed.defects?.hasVHSArtifacts),
      isLowResolution: Boolean(parsed.defects?.isLowResolution),
      isOverexposed: Boolean(parsed.defects?.isOverexposed),
      hasColorCast: Boolean(parsed.defects?.hasColorCast),
      ...(colorCastType !== undefined ? { colorCastType } : {}),
    },
    lightingCondition: String(parsed.lightingCondition || "unknown"),
    cropping: {
      isCroppingNeeded: Boolean(parsed.cropping?.isCroppingNeeded),
      ...(parsed.cropping?.suggestedCrop
        ? {
            suggestedCrop: {
              x: Number(parsed.cropping.suggestedCrop.x) || 0,
              y: Number(parsed.cropping.suggestedCrop.y) || 0,
              width: Number(parsed.cropping.suggestedCrop.width) || 1,
              height: Number(parsed.cropping.suggestedCrop.height) || 1,
            },
          }
        : {}),
      ...(parsed.cropping?.cropReason ? { cropReason: String(parsed.cropping.cropReason) } : {}),
    },
  };
}

/**
 * Performs actual vision analysis using Gemini model.
 * @internal
 */
async function performVisionAnalysis(
  ai: GoogleGenAI,
  imageData: string,
  mimeType: string,
  modelOverride?: string,
  temperatureOverride?: number,
): Promise<AnalysisDetailedResult> {
  const model = modelOverride || DEFAULT_MODEL;
  const temperature = temperatureOverride ?? 0.1; // Low temperature for deterministic JSON output

  const response = await ai.models.generateContent({
    model,
    config: {
      responseMimeType: "application/json",
      temperature,
    },
    contents: [
      {
        role: "user" as const,
        parts: [
          { text: ANALYSIS_PROMPT_SCHEMA },
          {
            inlineData: {
              mimeType,
              data: imageData,
            },
          },
        ],
      },
    ],
  });

  // Extract text response
  const text = response.candidates?.[0]?.content?.parts?.[0]?.text;
  if (!text) {
    throw new Error("No analysis response from vision model");
  }

  return parseAnalysisResponse(text);
}

/**
 * Analyzes an image using Gemini vision model to detect defects and content type.
 * Used by the orchestrator to build dynamic enhancement prompts.
 *
 * @param imageData - Base64 encoded image data
 * @param mimeType - MIME type of the image
 * @param config - Optional analysis configuration overrides
 * @returns Structured analysis result with defects, style, and cropping suggestions
 */
export async function analyzeImageV2(
  imageData: string,
  mimeType: string,
  config?: AnalysisConfig,
): Promise<ImageAnalysisResultV2> {
  // If analysis is disabled via config, return default analysis immediately
  if (config?.enabled === false) {
    logger.info("Image analysis disabled by pipeline config, using defaults");
    return {
      description: "Analysis skipped",
      quality: "medium",
      structuredAnalysis: getDefaultAnalysis(),
    };
  }

  logger.info(`Analyzing image with vision model`, {
    mimeType,
    dataLength: imageData.length,
  });

  const ai = await getGeminiClient();
  let structuredAnalysis: AnalysisDetailedResult;

  // Create analysis promise with timeout protection
  const analysisPromise = performVisionAnalysis(
    ai,
    imageData,
    mimeType,
    config?.model,
    config?.temperature,
  );
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`Analysis timed out after ${ANALYSIS_TIMEOUT_MS / 1000}s`));
    }, ANALYSIS_TIMEOUT_MS);
  });

  const { data: analysisResult, error: analysisError } = await tryCatch(
    Promise.race([analysisPromise, timeoutPromise]),
  );

  if (analysisError) {
    logger.warn("Vision analysis failed, using fallback:", {
      error: analysisError instanceof Error ? analysisError.message : String(analysisError),
    });
    structuredAnalysis = getDefaultAnalysis();
  } else {
    structuredAnalysis = analysisResult;
    logger.info("Vision analysis successful:", {
      defects: structuredAnalysis.defects,
    });
  }

  // Determine quality based on defect count
  const defectCount = Object.values(structuredAnalysis.defects).filter((v) => v === true).length;
  const quality: "low" | "medium" | "high" =
    defectCount >= 3 ? "low" : defectCount >= 1 ? "medium" : "high";

  return {
    description: structuredAnalysis.mainSubject,
    quality,
    structuredAnalysis,
  };
}

/**
 * Backward-compatible analyzeImage function.
 * Wraps analyzeImageV2 and returns the legacy ImageAnalysisResult format.
 *
 * @deprecated Use analyzeImageV2 for new code - it returns structured analysis
 * @param imageData - Base64 encoded image data
 * @param mimeType - MIME type of the image
 * @returns Legacy analysis result format for backward compatibility
 */
export async function analyzeImage(
  imageData: string,
  mimeType: string,
): Promise<ImageAnalysisResult> {
  const v2Result = await analyzeImageV2(imageData, mimeType);

  // Build suggested improvements from detected defects
  const suggestedImprovements: string[] = [];
  const defects = v2Result.structuredAnalysis.defects;

  if (v2Result.structuredAnalysis.imageStyle !== "photograph") {
    suggestedImprovements.push("photorealistic conversion");
  }
  if (defects.isDark) suggestedImprovements.push("exposure correction");
  if (defects.isOverexposed) suggestedImprovements.push("highlight recovery");
  if (defects.isBlurry) suggestedImprovements.push("sharpening");
  if (defects.hasNoise) suggestedImprovements.push("noise reduction");
  if (defects.hasVHSArtifacts) suggestedImprovements.push("artifact removal");
  if (defects.isLowResolution) {
    suggestedImprovements.push("resolution enhancement");
  }
  if (defects.hasColorCast) suggestedImprovements.push("color correction");

  // Always add standard improvements
  suggestedImprovements.push("color optimization", "detail enhancement");

  // Build enhancement prompt using dynamic prompt builder
  const enhancementPrompt = buildDynamicEnhancementPrompt(v2Result.structuredAnalysis);

  return {
    description: v2Result.description,
    quality: v2Result.quality,
    suggestedImprovements,
    enhancementPrompt,
  };
}

/**
 * Analyzes image(s) with a text prompt using Gemini Vision.
 * Used by CleanSweep tools for room analysis and task verification.
 *
 * @param imageData - Base64-encoded image data (single string or array for comparison)
 * @param prompt - Text prompt describing what to analyze
 * @returns Raw text response from the model
 */
export async function analyzeImageWithGemini(
  imageData: string | string[],
  prompt: string,
): Promise<string> {
  const ai = await getGeminiClient();

  const images = Array.isArray(imageData) ? imageData : [imageData];
  const parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> = [];

  for (const img of images) {
    parts.push({
      inlineData: {
        mimeType: "image/jpeg",
        data: img,
      },
    });
  }
  parts.push({ text: prompt });

  const { data: response, error } = await tryCatch(
    ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      contents: [{ role: "user", parts }],
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
    }),
  );

  if (error) {
    throw new Error(
      `Gemini vision analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  const text = response?.text;
  if (!text) {
    throw new Error("No response from Gemini vision analysis");
  }

  return text;
}
