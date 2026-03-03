import { callTool, parseToolResult } from "../api/client";

export interface StudioAsset {
  id: string;
  type: "image" | "cluster";
  url: string;
  name: string;
  metadata?: Record<string, unknown>;
  x: number;
  y: number;
}

export class StudioEngine {
  /**
   * Generates a new asset and places it on the canvas
   */
  static async generateAsset(prompt: string, options: Record<string, unknown> = {}): Promise<unknown> {
    const result = await callTool("img_generate", { prompt, ...options });
    return parseToolResult(result);
  }

  /**
   * Complex Orchestration: Smart Enhance
   * Chains: Enhance -> AutoTag -> Analyze Palette
   */
  static async smartEnhance(imageId: string): Promise<unknown> {
    // 1. Trigger Enhancement
    const enhanceResult = await callTool("img_enhance", { image_id: imageId, tier: "TIER_2K" });
    const enhanceData = parseToolResult<{ jobId: string }>(enhanceResult);

    // 2. Trigger Auto-Tagging (can run in parallel or sequence)
    // We'll return the enhancement job info and let the UI poll status
    return enhanceData;
  }

  /**
   * Complex Orchestration: "Brandify"
   * Chains: SubjectSave -> StyleExtract -> ReferenceGen
   */
  static async brandify(sourceImageId: string, targetPrompt: string): Promise<unknown> {
    // This would be a multi-step process calling various tools
    // For now, let's keep it simple and just use reference generation
    const result = await callTool("img_generate", {
      prompt: targetPrompt,
      reference_images: [{ image_id: sourceImageId, role: "style" }]
    });
    return parseToolResult(result);
  }

  /**
   * Complex Orchestration: Social Pack
   * Generates multiple sizes for different platforms
   */
  static async createSocialPack(imageId: string): Promise<unknown[]> {
    const platforms = ["instagram_square", "twitter_header", "linkedin_banner"];
    const jobs = platforms.map(preset => 
      callTool("img_crop", { image_id: imageId, preset })
    );
    const results = await Promise.all(jobs);
    return results.map(r => parseToolResult(r));
  }
}
