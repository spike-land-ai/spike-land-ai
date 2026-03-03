/**
 * Prompt builders for Gemini image enhancement and blending.
 */
import type { AnalysisDetailedResult } from "./gemini-analysis";
import type { PromptConfig } from "./pipeline-types";

/**
 * Builds a dynamic enhancement prompt based on detected image characteristics.
 * Handles extreme cases like VHS artifacts, sketches, and pitch-dark photos.
 *
 * @param analysis - Structured analysis result from vision model
 * @param promptConfig - Optional prompt configuration for overrides
 * @returns Dynamic enhancement prompt tailored to the image's specific defects
 */
export function buildDynamicEnhancementPrompt(
  analysis: AnalysisDetailedResult,
  promptConfig?: PromptConfig,
): string {
  // Apply defect overrides if provided
  const defects = promptConfig?.defectOverrides
    ? { ...analysis.defects, ...promptConfig.defectOverrides }
    : analysis.defects;

  // Track which corrections to skip
  const skipCorrections = new Set(promptConfig?.skipCorrections || []);

  let instruction =
    `You are a professional image restoration AI. Transform this input image into a stunning, high-resolution, professional photograph taken with a modern camera in ideal lighting conditions. Maintain the original subject and composition perfectly.\n\nSpecific Correction Instructions:\n`;

  // Style Conversion (sketches/paintings to photorealistic)
  if (analysis.imageStyle === "sketch") {
    instruction +=
      `- Convert this sketch into a photorealistic image while preserving the composition and subject. Add realistic textures, lighting, and colors.\n`;
  } else if (analysis.imageStyle === "painting") {
    instruction +=
      `- Convert this painting into a photorealistic photograph while maintaining the composition. Replace painted textures with realistic details and natural lighting.\n`;
  } else if (analysis.imageStyle === "screenshot") {
    instruction +=
      `- Clean up this screenshot and enhance it to photographic quality. Remove any UI elements or compression artifacts.\n`;
  }

  // Lighting & Exposure
  if (
    !skipCorrections.has("isDark")
    && (defects.isDark || analysis.lightingCondition.includes("pitch black"))
  ) {
    instruction +=
      `- Dramatically relight the scene. Reveal details hidden in shadows as if illuminated by strong, natural light (e.g., bright moonlight or professional studio lighting) while maintaining a realistic atmosphere.\n`;
  } else if (!skipCorrections.has("isOverexposed") && defects.isOverexposed) {
    instruction +=
      `- Recover details in blown-out highlight areas. Restore natural texture and color to bright spots.\n`;
  }

  // VHS/Analog Artifacts
  if (!skipCorrections.has("hasVHSArtifacts") && defects.hasVHSArtifacts) {
    instruction +=
      `- Completely remove all analog video artifacts, including tracking lines, color bleeding, static noise, and tape distortion.\n`;
  }

  // Noise & Resolution
  if (
    !skipCorrections.has("hasNoise")
    && !skipCorrections.has("isLowResolution")
    && (defects.hasNoise || defects.isLowResolution)
  ) {
    instruction +=
      `- Apply advanced noise reduction to eliminate grain. Sharpen fine details and textures that are currently pixelated or blurry.\n`;
  }

  // Color Correction
  if (
    !skipCorrections.has("hasColorCast") && defects.hasColorCast
    && defects.colorCastType
  ) {
    instruction +=
      `- Neutralize the strong ${defects.colorCastType} color cast to restore natural, accurate colors.\n`;
  }

  // Focus/Blur
  if (!skipCorrections.has("isBlurry") && defects.isBlurry) {
    instruction += `- Bring the entire image into sharp, crisp focus.\n`;
  }

  // Add custom instructions if provided
  if (promptConfig?.customInstructions) {
    instruction += `\nAdditional Instructions:\n${promptConfig.customInstructions}\n`;
  }

  // Add reference image instructions if provided
  if (
    promptConfig?.referenceImages && promptConfig.referenceImages.length > 0
  ) {
    instruction += `\nStyle Reference:\n`;
    instruction +=
      `- Match the visual style, color grading, and overall aesthetic of the provided reference image${
        promptConfig.referenceImages.length > 1 ? "s" : ""
      }.\n`;

    // Add descriptions if available
    const descriptionsWithContent = promptConfig.referenceImages
      .filter(img => img.description)
      .map(img => img.description);

    if (descriptionsWithContent.length > 0) {
      instruction += `- Reference image notes: ${descriptionsWithContent.join("; ")}\n`;
    }
  }

  // Final instruction
  instruction +=
    `\nFinal Output Requirement: A clean, sharp, highly detailed professional photograph.`;

  return instruction;
}

/**
 * Builds a prompt for blending two images together creatively.
 * Used when sourceImageId is provided for image-to-image enhancement.
 *
 * @param targetAnalysis - Structured analysis result from vision model for the target image
 * @returns Enhancement prompt tailored for blending two images
 */
export function buildBlendEnhancementPrompt(
  targetAnalysis: AnalysisDetailedResult,
): string {
  let instruction = `You are a professional image artist specializing in creative image blending.
You have been given TWO images:
1. The TARGET image (the main image to enhance)
2. The SOURCE image (a reference image to blend elements from)

Your task is to creatively merge visual elements, styles, or subjects from the SOURCE image into the TARGET image while maintaining a cohesive, professional result.

Guidelines:
- Preserve the core composition and subject of the TARGET image
- Incorporate artistic elements, color palette, or stylistic qualities from the SOURCE image
- The result should look like a natural, professional photograph
- Blend seamlessly without obvious artificial transitions
`;

  // Add target image defect corrections if any
  const defects = targetAnalysis.defects;
  if (defects.isDark) {
    instruction += `- The target image is dark - ensure proper lighting in the blended result\n`;
  }
  if (defects.hasNoise) {
    instruction += `- Remove any noise or grain from the final result\n`;
  }
  if (defects.isBlurry) {
    instruction += `- Ensure the final result is sharp and in focus\n`;
  }
  if (defects.isOverexposed) {
    instruction += `- Balance exposure in the final result\n`;
  }
  if (defects.hasColorCast && defects.colorCastType) {
    instruction += `- Correct the ${defects.colorCastType} color cast in the final result\n`;
  }

  instruction += `
Final Output: A stunning, high-quality photograph that artistically blends both images into a cohesive masterpiece.`;

  return instruction;
}
