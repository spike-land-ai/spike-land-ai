import { readdir, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { GoogleGenAI } from '@google/genai';

const GEMINI_API_KEY = "AIzaSyBI5sIrfqz8e41LElePt4oUXd-qrRyzsBI";

async function generateImages() {
  const blogDir = 'content/blog';
  const outputBaseDir = 'content/blog-images';
  const entries = await readdir(blogDir, { withFileTypes: true });

  const ai = new GoogleGenAI(GEMINI_API_KEY);
  const model = ai.getGenerativeModel({ model: "gemini-2.0-flash-exp" }); // Use 2.0 Flash as it's fast and supports images

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.mdx')) continue;
    const content = await readFile(join(blogDir, entry.name), 'utf-8');
    
    const heroImageMatch = content.match(/heroImage:\s*"\/blog\/([^/]+)\/([^"]+)"/);
    if (!heroImageMatch) continue;

    const slug = heroImageMatch[1];
    const filename = heroImageMatch[2];
    const outputDir = join(outputBaseDir, slug);
    const outputPath = join(outputDir, filename);

    // Check if already exists
    try {
      await mkdir(outputDir, { recursive: true });
    } catch (e) {}

    // We only generate if it's missing (or we can force it)
    // For this task, we assume they are missing because we couldn't find them earlier.

    let prompt = "Professional blog hero image";
    const promptMatch = content.match(/!\[([^\]]+)\]\(([^)]+)\)/);
    if (promptMatch && promptMatch[2].includes(filename)) {
      prompt = promptMatch[1];
    }

    console.log(`Generating image for ${slug} with prompt: ${prompt}`);

    try {
      const response = await model.generateContent({
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        generationConfig: {
            // @ts-ignore
            responseModalities: ["IMAGE"]
        }
      });

      const parts = response.response.candidates?.[0]?.content?.parts;
      if (!parts) throw new Error("No response from Gemini");

      for (const part of parts) {
        if (part.inlineData?.data && part.inlineData.mimeType?.startsWith("image/")) {
          const buffer = Buffer.from(part.inlineData.data, 'base64');
          await writeFile(outputPath, buffer);
          console.log(`Successfully saved ${outputPath}`);
          break;
        }
      }
    } catch (err) {
      console.error(`Failed to generate image for ${slug}:`, err);
    }
  }
}

generateImages();
