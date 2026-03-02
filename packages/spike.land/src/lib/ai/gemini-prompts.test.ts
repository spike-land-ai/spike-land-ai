import { describe, expect, it } from "vitest";
import { buildBlendEnhancementPrompt, buildDynamicEnhancementPrompt } from "./gemini-prompts";
import { getDefaultAnalysis } from "./gemini-analysis";
import type { AnalysisDetailedResult } from "./gemini-analysis";

describe("gemini-prompts", () => {
  describe("buildDynamicEnhancementPrompt", () => {
    it("builds prompt for default photograph", () => {
      const analysis = getDefaultAnalysis();
      // Modify default to not have low res for this test
      analysis.defects.isLowResolution = false;

      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("You are a professional image restoration AI");
      expect(prompt).not.toContain("Convert this sketch");
      expect(prompt).not.toContain("Dramatically relight");
    });

    it("includes style conversion for sketch", () => {
      const analysis = getDefaultAnalysis();
      analysis.imageStyle = "sketch";
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Convert this sketch into a photorealistic image");
    });

    it("includes style conversion for painting", () => {
      const analysis = getDefaultAnalysis();
      analysis.imageStyle = "painting";
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Convert this painting into a photorealistic photograph");
    });

    it("includes style conversion for screenshot", () => {
      const analysis = getDefaultAnalysis();
      analysis.imageStyle = "screenshot";
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Clean up this screenshot and enhance it to photographic quality");
    });

    it("includes lighting instructions for dark images", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.isDark = true;
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Dramatically relight the scene");
    });

    it("includes lighting instructions for pitch black condition", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.isDark = false;
      analysis.lightingCondition = "pitch black room";
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Dramatically relight the scene");
    });

    it("includes exposure instructions for overexposed images", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.isOverexposed = true;
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Recover details in blown-out highlight areas");
    });

    it("includes VHS artifact instructions", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.hasVHSArtifacts = true;
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Completely remove all analog video artifacts");
    });

    it("includes noise reduction instructions for noise", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.hasNoise = true;
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Apply advanced noise reduction");
    });

    it("includes noise reduction instructions for low resolution", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.isLowResolution = true;
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Apply advanced noise reduction");
    });

    it("includes color correction instructions", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.hasColorCast = true;
      analysis.defects.colorCastType = "red";
      const prompt = buildDynamicEnhancementPrompt(analysis);
      // In the file it adds instructions but only later in the flow
      expect(prompt).toContain("Neutralize the strong red color cast");
    });

    it("includes blur instructions", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.isBlurry = true;
      // Need to match the exact order, but colorCastType is checked first in the file?
      const prompt = buildDynamicEnhancementPrompt(analysis);
      expect(prompt).toContain("Bring the entire image into sharp");
    });

    it("skips corrections if told to do so", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.isBlurry = true;
      analysis.defects.hasNoise = true;
      analysis.defects.isDark = true;
      analysis.lightingCondition = "pitch black";

      const prompt = buildDynamicEnhancementPrompt(analysis, {
        skipCorrections: ["isBlurry", "hasNoise", "isDark"],
      });

      expect(prompt).not.toContain("Bring the entire image into sharp");
      expect(prompt).not.toContain("Apply advanced noise reduction");
      expect(prompt).not.toContain("Dramatically relight the scene");
    });

    it("allows defect overrides to force corrections", () => {
      const analysis = getDefaultAnalysis();
      analysis.defects.isBlurry = false;

      const prompt = buildDynamicEnhancementPrompt(analysis, {
        defectOverrides: { isBlurry: true },
      });

      expect(prompt).toContain("Bring the entire image into sharp");
    });

    it("includes custom instructions", () => {
      const analysis = getDefaultAnalysis();
      const prompt = buildDynamicEnhancementPrompt(analysis, {
        customInstructions: "Make it pop like the 80s",
      });
      expect(prompt).toContain("Make it pop like the 80s");
    });

    it("includes reference image styles without descriptions", () => {
      const analysis = getDefaultAnalysis();
      const prompt = buildDynamicEnhancementPrompt(analysis, {
        referenceImages: [{ url: "1", r2Key: "1" }],
      });
      expect(prompt).toContain("Style Reference:");
      expect(prompt).toContain("Match the visual style, color grading");
      expect(prompt).not.toContain("Reference image notes");
    });

    it("includes reference image styles with descriptions", () => {
      const analysis = getDefaultAnalysis();
      const prompt = buildDynamicEnhancementPrompt(analysis, {
        referenceImages: [
          { url: "1", r2Key: "1", description: "Dark and moody" },
          { url: "2", r2Key: "2" },
        ],
      });
      expect(prompt).toContain("Reference image notes: Dark and moody");
      expect(prompt).toContain("reference images"); // Plural 's'
    });
  });

  describe("buildBlendEnhancementPrompt", () => {
    it("includes base instructions", () => {
      const analysis = getDefaultAnalysis();
      const prompt = buildBlendEnhancementPrompt(analysis);
      expect(prompt).toContain(
        "You are a professional image artist specializing in creative image blending",
      );
      expect(prompt).toContain("The TARGET image");
      expect(prompt).toContain("The SOURCE image");
    });

    it("includes target defect corrections", () => {
      const analysis: AnalysisDetailedResult = {
        ...getDefaultAnalysis(),
        defects: {
          isDark: true,
          isBlurry: true,
          hasNoise: true,
          isOverexposed: true,
          hasColorCast: true,
          colorCastType: "green",
          hasVHSArtifacts: false,
          isLowResolution: false,
        },
      };

      const prompt = buildBlendEnhancementPrompt(analysis);
      expect(prompt).toContain("The target image is dark - ensure proper lighting");
      expect(prompt).toContain("Remove any noise or grain");
      expect(prompt).toContain("Ensure the final result is sharp");
      expect(prompt).toContain("Balance exposure");
      expect(prompt).toContain("Correct the green color cast");
    });
  });
});
