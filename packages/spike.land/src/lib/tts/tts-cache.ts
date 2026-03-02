import {
  getAudioMetadata,
  getAudioPublicUrl,
  uploadAudioToR2,
} from "@/lib/storage/audio-r2-client";
import { tryCatch } from "@/lib/try-catch";
import crypto from "crypto";
import { logger } from "@/lib/logger";

const TTS_KEY_PREFIX = "tts";

/**
 * Generate a cache key for TTS audio based on normalized text content.
 * Uses SHA-256 hash for consistent, compact keys.
 */
export function generateTTSCacheKey(text: string): string {
  const normalized = text.trim().toLowerCase();
  const hash = crypto.createHash("sha256").update(normalized).digest("hex");

  return `${TTS_KEY_PREFIX}/${hash}.mp3`;
}

/**
 * Check if TTS audio for the given text already exists in R2.
 * Returns the public URL if cached, null otherwise.
 */
export async function getCachedTTSUrl(text: string): Promise<string | null> {
  const key = generateTTSCacheKey(text);

  const { data: metadata, error } = await tryCatch(getAudioMetadata(key));

  if (error) {
    logger.warn("[TTS_CACHE] Failed to check cache", { error: error });
    return null;
  }

  if (!metadata) {
    return null;
  }

  const { data: url, error: urlError } = await tryCatch(Promise.resolve(getAudioPublicUrl(key)));

  if (urlError) {
    logger.warn("[TTS_CACHE] Failed to get public URL", { error: urlError });
    return null;
  }

  return url;
}

/**
 * Upload TTS audio to R2 cache.
 * Returns the public URL of the cached audio.
 */
export async function cacheTTSAudio(text: string, buffer: Buffer): Promise<string | null> {
  const key = generateTTSCacheKey(text);

  const { data: result, error } = await tryCatch(
    uploadAudioToR2({
      key,
      buffer,
      contentType: "audio/mpeg",
      metadata: {
        source: "elevenlabs",
        textLength: String(text.length),
        generatedAt: new Date().toISOString(),
      },
    }),
  );

  if (error) {
    logger.warn("[TTS_CACHE] Failed to cache audio", { error: error });
    return null;
  }

  if (!result.success) {
    logger.warn("[TTS_CACHE] Upload failed:", { error: String(result.error) });
    return null;
  }

  return result.url;
}
