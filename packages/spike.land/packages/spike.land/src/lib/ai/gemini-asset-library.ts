/**
 * Asset analysis for content library management using Gemini.
 */
import logger from "@/lib/logger";
import { tryCatch } from "@/lib/try-catch";
import { getGeminiClient } from "./gemini-client";

/**
 * Result of analyzing an asset for the content library.
 * Provides metadata for categorization, accessibility, and quality scoring.
 */
export interface AssetAnalysisResult {
  /** Descriptive alt text for accessibility (1-2 sentences) */
  altText: string;
  /** Technical quality score from 0-100 based on sharpness, exposure, composition */
  qualityScore: number;
  /** Suggested tags for categorization (3-7 relevant keywords) */
  suggestedTags: string[];
  /** Detailed analysis information */
  analysisDetails: {
    /** Brief description of the main subject */
    mainSubject: string;
    /** Type/style of the image */
    imageStyle: "photo" | "illustration" | "graphic" | "screenshot" | "other";
    /** Brief quality assessment */
    technicalQuality: string;
    /** Array of dominant colors (hex codes) */
    colorPalette?: string[];
    /** Array of detected objects/themes */
    detectedObjects?: string[];
  };
}

/**
 * Analyzes an asset for content library management.
 * Generates alt text, quality scoring, and tagging suggestions.
 *
 * @param imageBuffer - Buffer containing the image data
 * @param mimeType - MIME type of the image (e.g., "image/jpeg")
 * @returns Structured analysis result for asset metadata
 * @throws Error if analysis fails or times out
 */
export async function analyzeAssetForLibrary(
  imageBuffer: Buffer,
  mimeType: string,
): Promise<AssetAnalysisResult> {
  const ai = await getGeminiClient();

  const prompt = `Analyze this image for content library management.
Provide a JSON response with:
1. altText: Descriptive alt text for accessibility (1-2 sentences, focus on what the image shows)
2. qualityScore: Technical quality score 0-100 based on:
   - Sharpness and focus (0-33 points)
   - Exposure and lighting (0-33 points)
   - Composition and framing (0-34 points)
3. suggestedTags: Array of 3-7 relevant keywords for categorization (e.g., "product", "person", "landscape", "technology")
4. analysisDetails: {
     mainSubject: Brief description of main subject (1 sentence)
     imageStyle: "photo" OR "illustration" OR "graphic" OR "screenshot" OR "other"
     technicalQuality: Brief quality assessment (e.g., "sharp and well-exposed", "slightly blurry", "low light")
     colorPalette: Array of 3-5 dominant colors as hex codes (e.g., ["#FF5733", "#33FF57"])
     detectedObjects: Array of 3-7 detected objects or themes (e.g., ["person", "laptop", "coffee cup"])
   }

Response must be valid JSON only, no additional text.`;

  logger.info("Analyzing asset for content library", { mimeType });

  const { data: response, error } = await tryCatch(
    ai.models.generateContent({
      model: "gemini-2.5-flash-image",
      config: {
        responseMimeType: "application/json",
        temperature: 0.3,
        maxOutputTokens: 2048,
      },
      contents: [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                mimeType,
                data: imageBuffer.toString("base64"),
              },
            },
          ],
        },
      ],
    }),
  );

  if (error) {
    logger.error("Failed to analyze asset:", { error });
    throw new Error(
      `Asset analysis failed: ${error instanceof Error ? error.message : "Unknown error"}`,
    );
  }

  const text = response?.text;
  if (!text) {
    throw new Error("No analysis response from Gemini");
  }

  // Parse JSON response (handle potential markdown code blocks)
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

  const { data: parsed, error: parseError } = await tryCatch(
    Promise.resolve().then(() => JSON.parse(jsonText)),
  );

  if (parseError) {
    logger.error("Failed to parse asset analysis response:", {
      response: jsonText.slice(0, 500),
    });
    throw new Error("Failed to parse asset analysis JSON");
  }

  // Validate and sanitize the response
  const result: AssetAnalysisResult = {
    altText: String(parsed.altText || "Image"),
    qualityScore: Math.max(
      0,
      Math.min(100, Number(parsed.qualityScore) || 50),
    ),
    suggestedTags: Array.isArray(parsed.suggestedTags)
      ? parsed.suggestedTags.map(String).slice(0, 7)
      : [],
    analysisDetails: {
      mainSubject: String(parsed.analysisDetails?.mainSubject || "Unknown"),
      imageStyle: ["photo", "illustration", "graphic", "screenshot", "other"]
          .includes(parsed.analysisDetails?.imageStyle)
        ? parsed.analysisDetails.imageStyle
        : "other",
      technicalQuality: String(
        parsed.analysisDetails?.technicalQuality || "Unknown quality",
      ),
      colorPalette: Array.isArray(parsed.analysisDetails?.colorPalette)
        ? parsed.analysisDetails.colorPalette.map(String).slice(0, 5)
        : undefined,
      detectedObjects: Array.isArray(parsed.analysisDetails?.detectedObjects)
        ? parsed.analysisDetails.detectedObjects.map(String).slice(0, 7)
        : undefined,
    },
  };

  logger.info("Asset analysis completed", {
    qualityScore: result.qualityScore,
    tagsCount: result.suggestedTags.length,
  });

  return result;
}
