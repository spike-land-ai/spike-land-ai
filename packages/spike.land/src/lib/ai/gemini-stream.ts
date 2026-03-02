/**
 * Unified Gemini stream processor with timeout handling.
 */
import logger from "@/lib/logger";
import { tryCatch } from "@/lib/try-catch";
import type { GoogleGenAI } from "@google/genai";
import { GEMINI_TIMEOUT_MS } from "./gemini-models";

/**
 * Configuration for the unified Gemini stream processor.
 * Used by all image generation/enhancement/modification functions.
 */
interface GeminiStreamConfig {
  responseModalities: string[];
  imageConfig?: { imageSize?: string; aspectRatio?: string };
}

/**
 * Content structure for Gemini API requests.
 */
interface GeminiContent {
  role: "user";
  parts: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }>;
}

/**
 * Options for the unified stream processor.
 */
interface StreamProcessorOptions {
  /** GoogleGenAI client instance */
  ai: GoogleGenAI;
  /** Model to use for generation */
  model: string;
  /** API configuration */
  config: GeminiStreamConfig;
  /** Content to send to the API */
  contents: GeminiContent[];
  /** Timeout in milliseconds (defaults to GEMINI_TIMEOUT_MS) */
  timeoutMs?: number;
  /** Type of operation for error messages */
  operationType?: "enhancement" | "generation" | "modification";
}

/**
 * Unified helper function to process Gemini streaming response with timeout.
 * Consolidates duplicate stream processing logic from enhanceImageWithGemini,
 * generateImageWithGemini, and modifyImageWithGemini.
 *
 * @param options - Stream processor options including AI client, model, config, and contents
 * @returns Buffer containing the image data from the stream
 * @throws Error if stream initialization fails, times out, or no image data is received
 */
export async function processGeminiStream(options: StreamProcessorOptions): Promise<Buffer> {
  const {
    ai,
    model,
    config,
    contents,
    timeoutMs = GEMINI_TIMEOUT_MS,
    operationType = "generation",
  } = options;

  // Map operation type to error message prefix
  const errorPrefixMap = {
    enhancement: "Failed to start image enhancement",
    generation: "Failed to start image generation",
    modification: "Failed to start image modification",
  };

  const { data: response, error: streamInitError } = await tryCatch(
    ai.models.generateContentStream({
      model,
      config,
      contents,
    }),
  );

  if (streamInitError) {
    logger.error("Failed to initiate Gemini API stream:", {
      error: streamInitError,
    });
    throw new Error(
      `${errorPrefixMap[operationType]}: ${
        streamInitError instanceof Error ? streamInitError.message : "Unknown error"
      }`,
    );
  }

  const imageChunks: Buffer[] = [];
  let chunkCount = 0;
  let timedOut = false;
  let timeoutId: ReturnType<typeof setTimeout> | null = null;
  const startTime = Date.now();

  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutId = setTimeout(() => {
      timedOut = true;
      reject(
        new Error(
          `Gemini API request timed out after ${timeoutMs / 1000} seconds. ` +
            `Processed ${chunkCount} chunks before timeout.`,
        ),
      );
    }, timeoutMs);
  });

  const processChunks = async (): Promise<Buffer> => {
    const processAllChunks = async () => {
      for await (const chunk of response) {
        if (timedOut) {
          throw new Error("Stream processing aborted due to timeout");
        }

        chunkCount++;
        const elapsed = Math.round((Date.now() - startTime) / 1000);

        if (
          !chunk.candidates ||
          !chunk.candidates[0]?.content ||
          !chunk.candidates[0]?.content.parts
        ) {
          logger.warn(`Skipping chunk, no valid candidates`, {
            chunk: chunkCount,
            elapsed: `${elapsed}s`,
          });
          continue;
        }

        if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const inlineData = chunk.candidates[0].content.parts[0].inlineData;
          const buffer = Buffer.from(inlineData.data || "", "base64");
          imageChunks.push(buffer);
          logger.info(`Received chunk`, {
            chunk: chunkCount,
            bytes: buffer.length,
            totalChunks: imageChunks.length,
            elapsed: `${elapsed}s`,
          });
        }
      }
    };

    const { error: chunkError } = await tryCatch(processAllChunks());

    if (chunkError) {
      if (timedOut) {
        throw chunkError;
      }
      logger.error(`Error processing stream`, {
        chunk: chunkCount,
        error: chunkError,
      });
      throw new Error(
        `Stream processing failed: ${
          chunkError instanceof Error ? chunkError.message : "Unknown error"
        }`,
      );
    }

    if (imageChunks.length === 0) {
      logger.error(`No image data received after processing chunks`, {
        chunks: chunkCount,
      });
      throw new Error("No image data received from Gemini API");
    }

    const totalBytes = imageChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const totalTime = Math.round((Date.now() - startTime) / 1000);
    logger.info(`Successfully received chunks`, {
      chunks: imageChunks.length,
      totalBytes,
      totalTime: `${totalTime}s`,
    });

    return Buffer.concat(imageChunks);
  };

  const processPromise = processChunks();

  // Attach no-op catch handlers to prevent unhandled rejection warnings
  // when one promise resolves/rejects before the other.
  processPromise.catch(() => {});
  timeoutPromise.catch(() => {});

  const { data: result, error: raceError } = await tryCatch(
    Promise.race([processPromise, timeoutPromise]),
  );

  if (timeoutId) clearTimeout(timeoutId);

  if (raceError) {
    throw raceError;
  }

  return result;
}
