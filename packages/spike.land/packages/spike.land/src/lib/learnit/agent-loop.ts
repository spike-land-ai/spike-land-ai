import { getClaudeClient } from "@/lib/ai/claude-client";
import logger from "@/lib/logger";

import { createOrUpdateContent } from "./content-service";
import { parseWikiLinks } from "./wiki-links";

export type StreamEvent =
  | { type: "agent"; name: string; model: string; }
  | { type: "chunk"; content: string; }
  | {
    type: "complete";
    content: string;
    title: string;
    description: string;
    agent?: string;
  }
  | { type: "error"; message: string; };

export function buildLearnItPrompt(topic: string): string {
  return `You are an expert technical educator creating a high-quality, interactive learning wiki called LearnIt.

Your task is to generate a comprehensive tutorial for the topic: "${topic}".

The content should be:
1. **Beginner-friendly but deep**: targeted at developers learning this specific concept.
2. **Structured**: Broken into clear sections with H2 headings.
3. **Interactive**: Include code examples where relevant.
4. **Interconnected**: Use [[Wiki Link]] syntax to link to related concepts. For example, if you mention "State Management", write it as [[State Management]].

Format requirements:
- Start with a brief title and description
- Use ## for section headings
- Ensure code blocks have language tags (e.g. \`\`\`typescript).
- At the end, include a "Related Topics" section with 3-5 [[Wiki Links]] to related concepts.

Begin with the title on the first line (just the title text, no heading markup), followed by a brief description paragraph, then the main content.`;
}

/**
 * Stream LearnIt content from Claude Opus.
 * Re-throws errors to allow the caller to fall back to Gemini.
 */
export async function* agentGenerateLearnIt(
  path: string[],
  slug: string,
  userId: string | undefined,
): AsyncGenerator<StreamEvent> {
  const topic = path.join(" > ");

  yield { type: "agent", name: "Claude Opus", model: "claude-opus-4-6" };

  const anthropic = await getClaudeClient();
  const prompt = buildLearnItPrompt(topic);

  const messageStream = anthropic.messages.stream({
    model: "claude-opus-4-6",
    max_tokens: 8192,
    temperature: 0.3,
    system: [
      {
        type: "text",
        text: "You are an expert technical educator for the LearnIt wiki platform.",
        cache_control: { type: "ephemeral" },
      },
    ],
    messages: [{ role: "user", content: prompt }],
  });

  let fullContent = "";
  let title = "";
  let description = "";
  let chunkCount = 0;

  try {
    for await (const event of messageStream) {
      if (
        event.type === "content_block_delta"
        && event.delta.type === "text_delta"
      ) {
        const text = event.delta.text;
        fullContent += text;

        if (!title) {
          const lines = fullContent.split("\n");
          const firstLine = lines[0];
          if (firstLine?.trim()) {
            title = firstLine.trim().replace(/^#*\s*/, "");
          }
        }

        if (!description && fullContent.includes("\n\n")) {
          const contentParts = fullContent.split("\n\n");
          const secondPart = contentParts[1];
          if (secondPart?.trim()) {
            description = secondPart.trim().substring(0, 200);
          }
        }

        yield { type: "chunk", content: text };
        chunkCount++;

        if (chunkCount % 10 === 0) {
          logger.info(`LearnIt Claude streaming: ${chunkCount} chunks sent`, {
            slug,
          });
        }
      }
    }
  } catch (streamError) {
    const msg = streamError instanceof Error
      ? streamError.message
      : String(streamError);
    if (/aborted|cancel|ECONNRESET/i.test(msg)) {
      logger.warn("[LearnIt] Client disconnected during stream", { slug });
      yield { type: "error", message: "Client disconnected" };
      return;
    }
    throw streamError;
  }

  if (!title) {
    title = path[path.length - 1]?.replace(/-/g, " ") ?? "Topic";
  }
  if (!description) {
    description = `Learn about ${title}`;
  }

  // Process wiki links and save to database
  logger.info("LearnIt Claude generated content", {
    length: fullContent.length,
    slug,
  });
  const { content: processedContent } = parseWikiLinks(fullContent);

  let finalContent = processedContent;
  const firstNewline = processedContent.indexOf("\n");
  if (firstNewline > 0) {
    finalContent = processedContent.substring(firstNewline + 1).trim();
  }

  await createOrUpdateContent({
    slug,
    path,
    parentSlug: path.length > 1 ? path.slice(0, -1).join("/") : null,
    title,
    description,
    content: finalContent,
    generatedById: userId,
    aiModel: "claude-opus-4-6",
  });

  yield {
    type: "complete",
    content: finalContent,
    title,
    description,
    agent: "Claude Opus",
  };
}
