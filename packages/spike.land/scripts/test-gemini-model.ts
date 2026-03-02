import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
// Use quiet: true to suppress verbose logging
dotenv.config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });

async function testModel(modelName: string) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is not set");
    process.exit(1);
  }

  console.log(`\nTesting model: ${modelName}`);
  console.log("=".repeat(60));

  const ai = new GoogleGenAI({ apiKey });

  try {
    // Create a simple test image (1x1 red pixel)
    const testImageBase64 = Buffer.from(
      Buffer.from([
        0x89,
        0x50,
        0x4e,
        0x47,
        0x0d,
        0x0a,
        0x1a,
        0x0a, // PNG signature
        0x00,
        0x00,
        0x00,
        0x0d,
        0x49,
        0x48,
        0x44,
        0x52, // IHDR chunk
        0x00,
        0x00,
        0x00,
        0x01,
        0x00,
        0x00,
        0x00,
        0x01, // 1x1
        0x08,
        0x02,
        0x00,
        0x00,
        0x00,
        0x90,
        0x77,
        0x53, // RGB
        0xde,
        0x00,
        0x00,
        0x00,
        0x0c,
        0x49,
        0x44,
        0x41, // IDAT chunk
        0x54,
        0x08,
        0xd7,
        0x63,
        0xf8,
        0xcf,
        0xc0,
        0x00, // Red pixel
        0x00,
        0x03,
        0x01,
        0x01,
        0x00,
        0x18,
        0xdd,
        0x8d,
        0xb4,
        0x00,
        0x00,
        0x00,
        0x00,
        0x49,
        0x45,
        0x4e, // IEND chunk
        0x44,
        0xae,
        0x42,
        0x60,
        0x82,
      ]),
    ).toString("base64");

    const config = {
      responseModalities: ["IMAGE"],
      imageConfig: {
        imageSize: "1K",
      },
    };

    const contents = [
      {
        role: "user" as const,
        parts: [
          {
            inlineData: {
              mimeType: "image/png",
              data: testImageBase64,
            },
          },
          {
            text: "Create a high quality version of this image at 1024x1024 resolution.",
          },
        ],
      },
    ];

    console.log("Sending request to Gemini API...");
    const startTime = Date.now();

    const response = await ai.models.generateContentStream({
      model: modelName,
      config,
      contents,
    });

    let chunkCount = 0;
    for await (const chunk of response) {
      chunkCount++;
      if (chunk.candidates?.[0]?.content?.parts?.[0]?.inlineData) {
        console.log(`✓ Received chunk ${chunkCount}`);
      }
    }

    const elapsed = Date.now() - startTime;
    console.log(`\n✓ SUCCESS: Model "${modelName}" works!`);
    console.log(`  - Received ${chunkCount} chunks`);
    console.log(`  - Time: ${elapsed}ms`);
  } catch (error) {
    console.log(`\n✗ FAILED: Model "${modelName}" does not work`);
    console.log(`  - Error: ${error instanceof Error ? error.message : String(error)}`);

    if (error instanceof Error && error.message.includes("not found")) {
      console.log(`  - This model does not exist in the API`);
    }
  }
}

async function main() {
  console.log("Gemini Model Verification Tool");
  console.log("=".repeat(60));

  const modelsToTest = [
    "gemini-3-pro-image-preview", // Current (likely broken)
    "gemini-2.5-flash-preview-05-20", // Old model from error message
    "gemini-2.5-flash-image", // Documented working model
    "nano-banana-pro-preview", // High quality alternative
  ];

  for (const model of modelsToTest) {
    await testModel(model);
    await new Promise((resolve) => setTimeout(resolve, 1000)); // Rate limit
  }

  console.log("\n" + "=".repeat(60));
  console.log("Testing complete!");
}

main().catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});
