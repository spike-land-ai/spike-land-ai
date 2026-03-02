import { getClaudeClient, isClaudeConfigured } from "@/lib/ai/claude-client";
import { generateStructuredResponse } from "@/lib/ai/gemini-client";
import logger from "@/lib/logger";
import { z } from "zod";

const LearnItGeneratedSchema = z.object({
  title: z.string().describe("The main title of the topic/tutorial"),
  description: z.string().describe("A concise summary (1-2 sentences) of what this topic covers"),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        content: z
          .string()
          .describe(
            "The MDX content for this section. Use code blocks, standard markdown, and [[wiki links]] to other topics.",
          ),
      }),
    )
    .describe("The main content sections of the tutorial"),
  relatedTopics: z
    .array(z.string())
    .describe(
      "List of 3-5 related topics that would make good next steps, as simple strings (e.g. 'Advanced React', 'State Management')",
    ),
});

export type GeneratedLearnItContent = z.infer<typeof LearnItGeneratedSchema>;

const LEARNIT_STRUCTURED_PROMPT = `You are an expert technical educator creating a high-quality, interactive learning wiki called LearnIt.

The content should be:
1. **Beginner-friendly but deep**: targeted at developers learning this specific concept.
2. **Structured**: Broken into clear sections with H2 headings.
3. **Interactive**: Include code examples where relevant.
4. **Interconnected**: Use [[Wiki Link]] syntax to link to related concepts. For example, if you mention "State Management", write it as [[State Management]].

Format requirements:
- Return valid JSON matching the schema.
- Content must be valid MDX (Markdown + React components if needed, but stick to standard MDX).
- Do NOT include the main title in the sections, it will be rendered separately.
- Ensure code blocks have language tags (e.g. \`\`\`typescript).

Expected JSON Structure:
{
  "title": "string",
  "description": "string",
  "sections": [
    { "heading": "string", "content": "string (markdown)" }
  ],
  "relatedTopics": ["string", "string"]
}`;

/**
 * Generate LearnIt content using Claude Opus 4.6 (primary) with Gemini fallback.
 */
export async function generateLearnItTopic(
  path: string[],
): Promise<(GeneratedLearnItContent & { aiModel: string }) | null> {
  const topic = path.join(" > ");

  // Try Claude Opus 4.6 first
  if (await isClaudeConfigured()) {
    try {
      const result = await generateWithClaude(topic);
      if (result) return { ...result, aiModel: "claude-opus-4-6" };
    } catch (error) {
      logger.warn("LearnIt: Claude Opus failed, falling back to Gemini", {
        topic,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  // Fallback to Gemini
  try {
    const result = await generateWithGemini(topic);
    if (result) return { ...result, aiModel: "gemini-3-flash-preview" };
  } catch (error) {
    logger.error("LearnIt: Gemini fallback also failed", {
      topic,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  return null;
}

async function generateWithClaude(topic: string): Promise<GeneratedLearnItContent | null> {
  const anthropic = await getClaudeClient();

  const prompt = `${LEARNIT_STRUCTURED_PROMPT}

Your task is to generate a comprehensive tutorial for the topic: "${topic}".

Return ONLY valid JSON, no markdown code fences.`;

  const response = await anthropic.messages.create({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    temperature: 0.3,
    system:
      "You are an expert technical educator for the LearnIt wiki platform. Always respond with valid JSON only.",
    messages: [{ role: "user", content: prompt }],
  });

  const text = response.content
    .filter((block) => block.type === "text")
    .map((block) => block.text)
    .join("");

  // Strip markdown code fences if present
  const cleaned = text
    .replace(/^```json\s*/m, "")
    .replace(/```\s*$/m, "")
    .trim();
  const parsed = JSON.parse(cleaned);
  return LearnItGeneratedSchema.parse(parsed);
}

async function generateWithGemini(topic: string): Promise<GeneratedLearnItContent | null> {
  const prompt = `${LEARNIT_STRUCTURED_PROMPT}

Your task is to generate a comprehensive tutorial for the topic: "${topic}".`;

  const result = await generateStructuredResponse<GeneratedLearnItContent>({
    prompt,
    maxTokens: 8192,
    temperature: 0.3,
  });

  return LearnItGeneratedSchema.parse(result);
}
