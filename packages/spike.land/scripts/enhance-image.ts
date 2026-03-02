import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as fs from "fs";
import * as path from "path";
import { detectMimeType, getImageDimensionsFromBuffer } from "../src/lib/images/image-dimensions";

// Load environment variables from .env.local
// Use quiet: true to suppress verbose logging
dotenv.config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });

const GEMINI_API_TIMEOUT_MS = 55000; // 55 seconds (under Vercel's 60s limit)
const DEFAULT_MODEL = "gemini-3-pro-image-preview";

interface EnhanceImageParams {
  imageData: string;
  mimeType: string;
  tier: "1K" | "2K" | "4K";
  originalWidth?: number;
  originalHeight?: number;
}

const ENHANCEMENT_BASE_PROMPT = `Create a high resolution version of this photo. Please generate it detailed with perfect focus, lights, and colors, make it look like if this photo was taken by a professional photographer with a modern professional camera in 2025.`;

async function enhanceImageWithGemini(params: EnhanceImageParams): Promise<Buffer> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is not set");
  }

  const ai = new GoogleGenAI({ apiKey });

  const resolutionMap = {
    "1K": "1024x1024",
    "2K": "2048x2048",
    "4K": "4096x4096",
  };

  const config = {
    responseModalities: ["IMAGE"],
    imageConfig: {
      imageSize: params.tier,
    },
  };

  const enhancementPrompt = `${ENHANCEMENT_BASE_PROMPT}\n\nFocus on improving: sharpness, color enhancement, detail preservation`;

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
          text: `${enhancementPrompt}\n\nGenerate at ${resolutionMap[params.tier]} resolution.`,
        },
      ],
    },
  ];

  console.log(`Generating enhanced image with Gemini API using model: ${DEFAULT_MODEL}`);
  console.log(`Tier: ${params.tier}, Resolution: ${resolutionMap[params.tier]}`);

  const processStream = async (): Promise<Buffer> => {
    let response;
    try {
      response = await ai.models.generateContentStream({
        model: DEFAULT_MODEL,
        config,
        contents,
      });
    } catch (error) {
      console.error("Failed to initiate Gemini API stream:", error);
      throw new Error(
        `Failed to start image enhancement: ${
          error instanceof Error ? error.message : "Unknown error"
        }`,
      );
    }

    const imageChunks: Buffer[] = [];
    let chunkCount = 0;

    try {
      for await (const chunk of response) {
        chunkCount++;
        if (
          !chunk.candidates ||
          !chunk.candidates[0]?.content ||
          !chunk.candidates[0]?.content.parts
        ) {
          continue;
        }

        if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
          const inlineData = chunk.candidates[0].content.parts[0].inlineData;
          const buffer = Buffer.from(inlineData.data || "", "base64");
          imageChunks.push(buffer);
          process.stdout.write(".");
        }
      }
    } catch (error) {
      console.error(`\nError processing stream at chunk ${chunkCount}:`, error);
      throw new Error(
        `Stream processing failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      );
    }

    console.log("");

    if (imageChunks.length === 0) {
      console.error(`No image data received after processing ${chunkCount} chunks`);
      throw new Error("No image data received from Gemini API");
    }

    const totalBytes = imageChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    console.log(`Successfully received ${imageChunks.length} chunks, total ${totalBytes} bytes`);

    return Buffer.concat(imageChunks);
  };

  const createTimeoutPromise = (ms: number): Promise<never> => {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Gemini API request timed out after ${ms}ms`));
      }, ms);
    });
  };

  return Promise.race([processStream(), createTimeoutPromise(GEMINI_API_TIMEOUT_MS)]);
}

async function main() {
  const inputPath = process.argv[2];
  const outputPath = process.argv[3];
  const tier = (process.argv[4] as "1K" | "2K" | "4K") || "2K";

  if (!inputPath) {
    console.error("Usage: npx tsx scripts/enhance-image.ts <input-path> [output-path] [tier]");
    console.error("Tiers: 1K, 2K, 4K (default: 2K)");
    process.exit(1);
  }

  const absoluteInputPath = path.resolve(inputPath);
  if (!fs.existsSync(absoluteInputPath)) {
    console.error(`Input file not found: ${absoluteInputPath}`);
    process.exit(1);
  }

  const defaultOutputPath = absoluteInputPath.replace(/(\.[^.]+)$/, `-enhanced-${tier}$1`);
  const absoluteOutputPath = outputPath ? path.resolve(outputPath) : defaultOutputPath;

  console.log(`Input: ${absoluteInputPath}`);
  console.log(`Output: ${absoluteOutputPath}`);
  console.log(`Tier: ${tier}`);
  console.log("");

  const originalBuffer = fs.readFileSync(absoluteInputPath);
  const dimensions = getImageDimensionsFromBuffer(originalBuffer);

  const originalWidth = dimensions?.width || 1024;
  const originalHeight = dimensions?.height || 1024;
  const mimeType = detectMimeType(originalBuffer);

  console.log(`Original dimensions: ${originalWidth}x${originalHeight}`);
  console.log(`MIME type: ${mimeType}`);
  console.log("");

  const base64Image = originalBuffer.toString("base64");

  console.log("Sending to Gemini for enhancement...");
  const geminiBuffer = await enhanceImageWithGemini({
    imageData: base64Image,
    mimeType,
    tier,
    originalWidth,
    originalHeight,
  });

  console.log("Received enhanced image from Gemini");

  // Get dimensions of enhanced output
  const enhancedDimensions = getImageDimensionsFromBuffer(geminiBuffer);

  // Save the enhanced image directly (Gemini outputs at requested resolution)
  fs.writeFileSync(absoluteOutputPath, geminiBuffer);

  console.log("");
  console.log("Enhancement complete!");
  console.log(
    `Final dimensions: ${enhancedDimensions?.width || "unknown"}x${
      enhancedDimensions?.height || "unknown"
    }`,
  );
  console.log(`File size: ${(geminiBuffer.length / 1024 / 1024).toFixed(2)} MB`);
  console.log(`Saved to: ${absoluteOutputPath}`);
}

main().catch((error) => {
  console.error("Enhancement failed:", error.message);
  process.exit(1);
});
