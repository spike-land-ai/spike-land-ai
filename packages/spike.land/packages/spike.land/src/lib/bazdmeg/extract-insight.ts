import { getClaudeClient } from "@/lib/ai/claude-client";
import logger from "@/lib/logger";

const INSIGHT_EXTRACTION_PROMPT =
  `You extract concise insights from Q&A exchanges about the BAZDMEG methodology.

Given a question and answer, return a JSON object:
{
  "insight": "A single concise insight (1-2 sentences) capturing the key takeaway",
  "tags": ["tag1", "tag2"],
  "skip": false
}

Rules:
- Set skip=true if the exchange is trivial (greetings, off-topic, nonsensical)
- Tags should be BAZDMEG-relevant terms: principle names, checklist phases, concepts
- Keep insights actionable and specific, not vague summaries
- Return ONLY the JSON object, no other text`;

interface ExtractedInsight {
  insight: string;
  tags: string[];
  skip?: boolean;
}

/**
 * Extract an insight from a Q&A pair and save to the database.
 * Fire-and-forget — errors are logged, never thrown to caller.
 */
export async function extractAndSaveInsight(params: {
  question: string;
  answer: string;
}): Promise<void> {
  try {
    const anthropic = await getClaudeClient();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      temperature: 0.2,
      system: INSIGHT_EXTRACTION_PROMPT,
      messages: [
        {
          role: "user",
          content: `Question: ${params.question}\n\nAnswer: ${params.answer}`,
        },
      ],
    });

    let text = "";
    for (const block of response.content) {
      if (block.type === "text") text += block.text;
    }

    const parsed = parseInsight(text);
    if (!parsed || parsed.skip) return;

    const prisma = (await import("@/lib/prisma")).default;

    // Deduplicate: check for similar existing insight (case-insensitive)
    const existing = await prisma.bazdmegMemory.findFirst({
      where: {
        insight: { equals: parsed.insight, mode: "insensitive" },
      },
      select: { id: true, confidence: true },
    });

    if (existing) {
      // Boost confidence of existing insight (cap at 1.0)
      await prisma.bazdmegMemory.update({
        where: { id: existing.id },
        data: {
          confidence: Math.min(existing.confidence + 0.1, 1.0),
        },
      });
      return;
    }

    await prisma.bazdmegMemory.create({
      data: {
        insight: parsed.insight,
        tags: parsed.tags,
        sourceQuestion: params.question.slice(0, 500),
        confidence: 0.5,
      },
    });

    logger.info("Saved BAZDMEG insight", {
      insight: parsed.insight.slice(0, 80),
    });
  } catch (err) {
    logger.warn("Failed to extract/save BAZDMEG insight", { error: err });
  }
}

function parseInsight(text: string): ExtractedInsight | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.skip) return { insight: "", tags: [], skip: true };
    if (!parsed.insight || typeof parsed.insight !== "string") return null;

    return {
      insight: String(parsed.insight).slice(0, 500),
      tags: Array.isArray(parsed.tags)
        ? parsed.tags.map(String).slice(0, 10)
        : [],
      skip: false,
    };
  } catch {
    return null;
  }
}
