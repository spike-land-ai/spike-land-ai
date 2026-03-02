import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { extractKeywords } from "./keyword-utils";
import { callClaude } from "./agent-client";
import { type LearningNote, NOTE_EXTRACTION_PROMPT } from "./agent-prompts";

/**
 * Retrieve learning notes relevant to the given app request.
 * Matches on libraries, tags, and universal notes.
 * Returns up to 20 notes sorted by confidence score.
 */
export async function retrieveRelevantNotes(path: string[]): Promise<LearningNote[]> {
  try {
    const keywords = extractKeywords(path.join("/"));

    const notes = await prisma.agentLearningNote.findMany({
      where: {
        status: { in: ["ACTIVE", "CANDIDATE"] },
        OR: [
          { libraries: { hasSome: keywords } },
          { tags: { hasSome: keywords } },
          { triggerType: "universal" },
        ],
      },
      orderBy: { confidenceScore: "desc" },
      take: 20,
    });

    return notes.map((n) => ({
      id: n.id,
      trigger: n.trigger,
      lesson: n.lesson,
      confidenceScore: n.confidenceScore,
    }));
  } catch (error) {
    logger.warn("Failed to retrieve learning notes, continuing without them", {
      error,
    });
    return [];
  }
}

/**
 * Retrieve notes specifically relevant to an error message.
 * Matches against errorPatterns stored in notes for precise error-to-lesson lookup.
 */
export async function retrieveNotesForError(errorMessage: string): Promise<LearningNote[]> {
  try {
    // Find notes whose errorPatterns overlap with the actual error text
    const errorLower = errorMessage.toLowerCase();
    const notes = await prisma.agentLearningNote.findMany({
      where: {
        status: { in: ["ACTIVE", "CANDIDATE"] },
        NOT: { errorPatterns: { isEmpty: true } },
      },
      orderBy: { confidenceScore: "desc" },
      take: 10,
    });

    // Filter in-app: check if any errorPattern substring appears in the error message
    const matched = notes.filter((n) =>
      n.errorPatterns.some((pattern) => errorLower.includes(pattern.toLowerCase())),
    );

    return matched.map((n) => ({
      id: n.id,
      trigger: n.trigger,
      lesson: n.lesson,
      confidenceScore: n.confidenceScore,
    }));
  } catch (error) {
    logger.warn("Failed to retrieve error-specific notes", { error });
    return [];
  }
}

/**
 * Batch extract learning notes from multiple error/fix pairs.
 * Called once after generation completes, not in the hot path.
 * Skips duplicate errors and pairs where the fix failed.
 */
export async function batchExtractAndSaveNotes(
  errorFixPairs: Array<{
    error: string;
    code: string;
    fixedCode: string | null;
    fixed: boolean;
  }>,
  path: string[],
): Promise<void> {
  // Deduplicate: only process unique errors where the fix succeeded
  const seen = new Set<string>();
  const uniquePairs = errorFixPairs.filter((pair) => {
    if (!pair.fixed || !pair.fixedCode) return false;
    if (seen.has(pair.error)) return false;
    seen.add(pair.error);
    return true;
  });

  if (uniquePairs.length === 0) return;

  // Process each pair sequentially to avoid race conditions on similar notes
  for (const pair of uniquePairs) {
    try {
      await extractAndSaveNote(pair.code, pair.error, pair.fixedCode, path);
    } catch (err) {
      logger.warn("Batch note extraction failed for one pair", { error: err });
    }
  }
}

/**
 * Extract a learning note from an error → fix pair using Claude Haiku.
 * The note is either merged into an existing similar note or created new.
 */
export async function extractAndSaveNote(
  failingCode: string,
  error: string,
  fixedCode: string | null,
  path: string[],
): Promise<void> {
  try {
    const response = await callClaude({
      systemPrompt: NOTE_EXTRACTION_PROMPT,
      userPrompt: `Error: ${error}\n\nFailing code (excerpt):\n${failingCode.slice(
        0,
        2000,
      )}\n\nFixed code (excerpt):\n${fixedCode?.slice(0, 2000) || "N/A"}`,
      model: "haiku",
      maxTokens: 1024,
      temperature: 0.2,
    });

    const parsed = parseNoteFromAI(response.text);
    if (!parsed || parsed.skip) return;

    // Check for similar existing note to avoid duplicates
    const existing = await findSimilarNote(parsed.trigger);
    if (existing) {
      await prisma.agentLearningNote.update({
        where: { id: existing.id },
        data: {
          helpCount: { increment: 1 },
          updatedAt: new Date(),
        },
      });
      return;
    }

    const slug = path.join("/");
    await prisma.agentLearningNote.create({
      data: {
        trigger: parsed.trigger,
        triggerType: parsed.triggerType,
        lesson: parsed.lesson,
        libraries: parsed.libraries,
        errorPatterns: parsed.errorPatterns,
        tags: parsed.tags,
        sourceSlug: slug,
        sourceError: error.slice(0, 1000),
        ...(fixedCode != null ? { sourceFix: fixedCode.slice(0, 2000) } : {}),
      },
    });

    logger.info("Saved new learning note", { trigger: parsed.trigger, slug });
  } catch (err) {
    logger.warn("Failed to extract/save learning note", { error: err });
  }
}

interface ParsedNote {
  skip?: boolean;
  trigger: string;
  triggerType: string;
  lesson: string;
  libraries: string[];
  errorPatterns: string[];
  tags: string[];
}

function parseNoteFromAI(text: string): ParsedNote | null {
  try {
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;

    const parsed = JSON.parse(jsonMatch[0]);
    if (parsed.skip) return { skip: true } as ParsedNote;
    if (!parsed.trigger || !parsed.lesson) return null;

    return {
      trigger: String(parsed.trigger).slice(0, 200),
      triggerType: parsed.triggerType || "error_class",
      lesson: String(parsed.lesson).slice(0, 500),
      libraries: Array.isArray(parsed.libraries) ? parsed.libraries.map(String) : [],
      errorPatterns: Array.isArray(parsed.errorPatterns) ? parsed.errorPatterns.map(String) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map(String) : [],
    };
  } catch {
    return null;
  }
}

async function findSimilarNote(trigger: string): Promise<{ id: string } | null> {
  return prisma.agentLearningNote.findFirst({
    where: {
      trigger: { equals: trigger, mode: "insensitive" },
      status: { not: "DEPRECATED" },
    },
    select: { id: true },
  });
}

/**
 * Record that the given notes helped produce a successful generation.
 * Increments helpCount and recalculates confidence.
 */
export async function recordSuccess(noteIds: string[]): Promise<void> {
  if (noteIds.length === 0) return;

  try {
    await prisma.agentLearningNote.updateMany({
      where: { id: { in: noteIds } },
      data: { helpCount: { increment: 1 } },
    });

    await batchRecalculateConfidence(noteIds);
  } catch (err) {
    logger.warn("Failed to record success for notes", { error: err });
  }
}

/**
 * Record that the given notes were applied but the generation still failed.
 * Increments failCount and recalculates confidence.
 */
export async function recordFailure(noteIds: string[]): Promise<void> {
  if (noteIds.length === 0) return;

  try {
    await prisma.agentLearningNote.updateMany({
      where: { id: { in: noteIds } },
      data: { failCount: { increment: 1 } },
    });

    await batchRecalculateConfidence(noteIds);
  } catch (err) {
    logger.warn("Failed to record failure for notes", { error: err });
  }
}

/**
 * Batch recalculate confidence scores for multiple notes at once.
 * Replaces per-note recalculateConfidence to eliminate N+1 queries.
 * Uses: 1 findMany + 1 $transaction instead of N findUnique + N update.
 */
async function batchRecalculateConfidence(noteIds: string[]): Promise<void> {
  if (noteIds.length === 0) return;

  const notes = await prisma.agentLearningNote.findMany({
    where: { id: { in: noteIds } },
  });

  if (notes.length === 0) return;

  const updates = notes.map((note) => {
    const alpha = 1;
    const beta = 1;
    const score = (note.helpCount + alpha) / (note.helpCount + note.failCount + alpha + beta);

    let status = note.status;

    // Promote CANDIDATE → ACTIVE after 3+ helps with >0.6 confidence
    if (status === "CANDIDATE" && note.helpCount >= 3 && score > 0.6) {
      status = "ACTIVE";
    }

    // Demote to DEPRECATED if confidence drops below 0.3
    if (score < 0.3 && note.helpCount + note.failCount >= 5) {
      status = "DEPRECATED";
    }

    return prisma.agentLearningNote.update({
      where: { id: note.id },
      data: { confidenceScore: score, status },
    });
  });

  await prisma.$transaction(updates);
}

/**
 * Record a full generation attempt for observability and metrics.
 */
export async function recordGenerationAttempt(params: {
  slug: string;
  success: boolean;
  iterations: number;
  totalDurationMs: number;
  notesApplied: string[];
  errors: Array<{ error: string; iteration: number; fixed: boolean }>;
  model: string;
  inputTokens: number;
  outputTokens: number;
  cachedTokens?: number;
}): Promise<void> {
  try {
    await prisma.generationAttempt.create({
      data: {
        slug: params.slug,
        success: params.success,
        iterations: params.iterations,
        totalDurationMs: params.totalDurationMs,
        notesApplied: params.notesApplied,
        errors: params.errors,
        model: params.model,
        inputTokens: params.inputTokens,
        outputTokens: params.outputTokens,
        cachedTokens: params.cachedTokens ?? 0,
      },
    });
  } catch (err) {
    logger.warn("Failed to record generation attempt", { error: err });
  }
}
