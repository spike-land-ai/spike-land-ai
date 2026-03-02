import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import * as path from "path";

// Load environment variables from .env.local
// Use quiet: true to suppress verbose logging
dotenv.config({ path: path.join(__dirname, "..", ".env.local"), quiet: true });

async function main() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error("GEMINI_API_KEY environment variable is not set");
    process.exit(1);
  }

  console.log("Fetching available Gemini models...\n");

  const ai = new GoogleGenAI({ apiKey });

  try {
    const modelsPager = await ai.models.list();
    const models = [];
    for await (const model of modelsPager) {
      models.push(model);
    }

    console.log(`Found ${models.length} models:\n`);
    console.log("=".repeat(80));

    for (const model of models) {
      // Cast to any to access properties that may exist but aren't in type definitions
      const m = model as Record<string, unknown>;
      console.log(`\nModel: ${m.name}`);
      console.log(`  Display Name: ${m.displayName || "N/A"}`);
      console.log(`  Description: ${m.description || "N/A"}`);
      const supportedMethods = m.supportedGenerationMethods as string[] | undefined;
      console.log(`  Supported Methods: ${supportedMethods?.join(", ") || "N/A"}`);
      console.log(`  Input Token Limit: ${m.inputTokenLimit || "N/A"}`);
      console.log(`  Output Token Limit: ${m.outputTokenLimit || "N/A"}`);

      // Check if model supports image generation
      const supportsImages =
        supportedMethods?.includes("generateContent") ||
        String(m.name).includes("image") ||
        String(m.name).includes("imagen");

      if (supportsImages) {
        console.log(`  ✨ SUPPORTS IMAGE GENERATION`);
      }
    }

    console.log("\n" + "=".repeat(80));

    // Filter for image-related models
    const imageModels = models.filter((model) => {
      const m = model as Record<string, unknown>;
      const name = String(m.name || "");
      const displayName = String(m.displayName || "");
      return (
        name.includes("image") ||
        name.includes("imagen") ||
        name.includes("vision") ||
        displayName.toLowerCase().includes("image")
      );
    });

    if (imageModels.length > 0) {
      console.log("\nImage-related models:");
      imageModels.forEach((model) => {
        const m = model as Record<string, unknown>;
        console.log(`  - ${m.name} (${m.displayName})`);
      });
    }
  } catch (error) {
    console.error("Error fetching models:", error);
    process.exit(1);
  }
}

main();
