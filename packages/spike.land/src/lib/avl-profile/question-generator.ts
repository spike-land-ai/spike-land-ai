/**
 * Question Generator for AVL Profile Tree
 *
 * Generates differentiating yes/no questions when two users collide
 * at the same leaf node. Uses Claude AI when available, with a static
 * fallback list for offline/unconfigured environments.
 */

import type { AnswerPathEntry, GeneratedQuestion } from "./types";

const FALLBACK_QUESTIONS: readonly GeneratedQuestion[] = [
  {
    question: "Do you analyze data regularly?",
    tags: ["analytics", "technical"],
  },
  {
    question: "Do you create content for an audience?",
    tags: ["content-creator", "marketing"],
  },
  {
    question: "Do you use design tools like Figma or Photoshop?",
    tags: ["design", "creative"],
  },
  {
    question: "Are you involved in project management?",
    tags: ["management", "productivity"],
  },
  {
    question: "Do you build or maintain websites?",
    tags: ["webdev", "developer"],
  },
  {
    question: "Do you work with APIs or integrations?",
    tags: ["api", "developer"],
  },
  {
    question: "Are you interested in gaming?",
    tags: ["gaming", "lifestyle"],
  },
  {
    question: "Do you work in education or training?",
    tags: ["education", "productivity"],
  },
] as const;

export function getFallbackQuestion(usedQuestions: string[]): GeneratedQuestion {
  const available = FALLBACK_QUESTIONS.find((q) => !usedQuestions.includes(q.question));
  if (available) {
    return { question: available.question, tags: [...available.tags] };
  }
  const index = usedQuestions.length + 1;
  return {
    question: `Do you use spike.land feature set #${index}?`,
    tags: ["general"],
  };
}

function buildPrompt(
  existingAnswers: AnswerPathEntry[],
  usedQuestions: string[],
  contextHint?: string,
): string {
  const answersDescription = existingAnswers
    .map((a) => `Q: "${a.question}" → ${a.answer ? "Yes" : "No"}`)
    .join("\n");

  const usedList = usedQuestions.map((q) => `- "${q}"`).join("\n");

  const contextLine = contextHint ? `\nAdditional context: ${contextHint}` : "";

  return `You are generating profiling questions for spike.land, a platform with apps for developers, creatives, marketers, and general users. Given two users who answered these questions identically:
${answersDescription}
${contextLine}
Generate a NEW yes/no question that would help differentiate between types of users for app personalization. The question must NOT be one of these already-used questions:
${usedList}

Return ONLY valid JSON: {"question": "...", "tags": ["tag1", "tag2"]}`;
}

interface ClaudeGeneratedResponse {
  question: string;
  tags: string[];
}

function parseClaudeResponse(text: string): GeneratedQuestion | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed: unknown = JSON.parse(jsonMatch[0]);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      !("question" in parsed) ||
      !("tags" in parsed)
    ) {
      return null;
    }

    const response = parsed as ClaudeGeneratedResponse;
    if (
      typeof response.question !== "string" ||
      !Array.isArray(response.tags) ||
      response.tags.some((t) => typeof t !== "string")
    ) {
      return null;
    }

    return { question: response.question, tags: response.tags };
  } catch {
    return null;
  }
}

export async function generateDifferentiatingQuestion(
  existingAnswers: AnswerPathEntry[],
  usedQuestions: string[],
  contextHint?: string,
): Promise<GeneratedQuestion> {
  try {
    const { getClaudeClient, isClaudeConfigured } = await import("@/lib/ai/claude-client");

    const configured = await isClaudeConfigured();
    if (!configured) {
      return getFallbackQuestion(usedQuestions);
    }

    const client = await getClaudeClient();
    const prompt = buildPrompt(existingAnswers, usedQuestions, contextHint);

    const response = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 256,
      messages: [{ role: "user", content: prompt }],
    });

    const textBlock = response.content.find((block) => block.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return getFallbackQuestion(usedQuestions);
    }

    const parsed = parseClaudeResponse(textBlock.text);
    if (!parsed) {
      return getFallbackQuestion(usedQuestions);
    }

    return parsed;
  } catch {
    return getFallbackQuestion(usedQuestions);
  }
}
