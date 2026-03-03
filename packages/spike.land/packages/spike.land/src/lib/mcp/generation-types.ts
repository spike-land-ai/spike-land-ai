import type { AspectRatio } from "@/lib/ai/aspect-ratio";
import type { EnhancementTier } from "@/lib/credits/costs";

export interface CreateGenerationJobParams {
  userId: string;
  apiKeyId?: string;
  prompt: string;
  tier: EnhancementTier;
  negativePrompt?: string;
  /** Optional aspect ratio for the generated image (default: 1:1) */
  aspectRatio?: AspectRatio;
}

export interface CreateModificationJobParams {
  userId: string;
  apiKeyId?: string;
  prompt: string;
  tier: EnhancementTier;
  imageData: string; // Base64 encoded
  mimeType: string;
}

export interface JobResult {
  success: boolean;
  jobId?: string;
  creditsCost?: number;
  error?: string;
}
