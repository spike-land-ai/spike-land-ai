import { CreatedAppStatus } from "@prisma/client";
import {
  callClaude,
  extractCodeFromResponse,
  isAuthError,
  parseGenerationResponse,
} from "./agent-client";
import {
  batchExtractAndSaveNotes,
  recordFailure,
  recordGenerationAttempt,
  recordSuccess,
  retrieveNotesForError,
  retrieveRelevantNotes,
} from "./agent-memory";
import {
  buildAgentSystemPrompt,
  buildAgentUserPrompt,
  buildFixSystemPrompt,
  buildFixUserPrompt,
  type LearningNote,
} from "./agent-prompts";
import { generateCodespaceId, updateCodespace } from "./codespace-service";
import { cleanCode } from "./content-generator";
import {
  markAsGenerating,
  updateAppContent,
  updateAppStatus,
} from "./content-service";
import { isUnrecoverableError, parseTranspileError } from "./error-parser";
import { runAutoReview } from "./auto-reviewer";
import { runAiReview } from "./ai-reviewer";
import type { StreamEvent } from "./types";
import logger from "@/lib/logger";

/** Maximum total tokens (input + output) per generation to prevent runaway costs. */
const TOKEN_BUDGET_MAX = 150_000;
/** Maximum fix iterations, clamped regardless of env var. */
const MAX_ITERATIONS_CAP = 5;
/** Max tokens for Sonnet fix calls — must be enough to output a full component. */
const FIX_MAX_TOKENS = 32768;

/**
 * Flat max_tokens for all generations.
 * JSON-escaped code roughly doubles token usage, so 32k is the minimum
 * to avoid truncation of complex components.
 */
const GEN_MAX_TOKENS = 32768;

/** Determine generation max_tokens based on matched skills for the topic. */
function getAdaptiveMaxTokens(_topic: string): number {
  // Flat budget — JSON-encoding of code eats ~2x tokens, so even "simple"
  // apps need a generous budget to avoid mid-response truncation.
  return GEN_MAX_TOKENS;
}

interface AgentContext {
  slug: string;
  path: string[];
  codespaceId: string;
  codespaceUrl: string;
  iteration: number;
  maxIterations: number;
  currentCode: string | null;
  title: string;
  description: string;
  relatedApps: string[];
  errors: Array<{ error: string; iteration: number; fixed: boolean; }>;
  /** Error/fix pairs collected for batch note extraction at the end. */
  errorFixPairs: Array<
    { error: string; code: string; fixedCode: string | null; fixed: boolean; }
  >;
  /** IDs of notes retrieved for this generation (for metrics). */
  notesRetrieved: string[];
  notes: LearningNote[];
  /** The generation model chosen based on topic complexity. */
  generationModel: "opus" | "sonnet";
  startTime: number;
  totalInputTokens: number;
  totalOutputTokens: number;
  totalCachedTokens: number;
}

/**
 * Core agent loop: Generate → Transpile → Verify → Fix → Learn.
 *
 * Yields StreamEvent objects for SSE streaming to the client.
 * Uses Claude Sonnet for initial generation, Sonnet for fixes,
 * and Haiku for learning note extraction.
 */
export async function* agentGenerateApp(
  slug: string,
  path: string[],
  userId: string | undefined,
  imageUrls?: string[],
): AsyncGenerator<StreamEvent> {
  const codespaceId = generateCodespaceId(slug);
  const componentUrl = process.env.SPIKE_LAND_COMPONENT_URL
    ?? "https://testing.spike.land";
  const codespaceUrl = `${componentUrl}/live/${codespaceId}/`;
  const maxIterations = Math.min(
    parseInt(process.env.AGENT_MAX_ITERATIONS || "3", 10),
    MAX_ITERATIONS_CAP,
  );

  const topic = path.join("/");
  // Switched to sonnet to significantly improve generation speed
  const generationModel = "sonnet";
  const adaptiveMaxTokens = getAdaptiveMaxTokens(topic);

  const ctx: AgentContext = {
    slug,
    path,
    codespaceId,
    codespaceUrl,
    iteration: 0,
    maxIterations,
    currentCode: null,
    title: path[path.length - 1]?.replace(/-/g, " ") || "New App",
    description: "Generating app...",
    relatedApps: [],
    errors: [],
    errorFixPairs: [],
    notesRetrieved: [],
    notes: [],
    generationModel,
    startTime: Date.now(),
    totalInputTokens: 0,
    totalOutputTokens: 0,
    totalCachedTokens: 0,
  };

  try {
    // === INIT: Mark as generating in DB ===
    yield { type: "status", message: "Initializing app generation..." };
    await markAsGenerating(
      slug,
      path,
      ctx.title,
      ctx.description,
      codespaceId,
      codespaceUrl,
      `Agent loop: ${slug}`,
      userId,
    );

    // === PLANNING: Retrieve notes and build prompts ===
    yield {
      type: "phase",
      phase: "PLANNING",
      message: "Assembling context and learning notes...",
    };
    ctx.notes = await retrieveRelevantNotes(path);
    ctx.notesRetrieved = ctx.notes.map(n => n.id);

    const systemPrompt = buildAgentSystemPrompt(topic, ctx.notes);
    const userPrompt = buildAgentUserPrompt(path, imageUrls);

    // === GENERATING: Call Claude (model chosen by topic complexity) ===
    yield {
      type: "phase",
      phase: "GENERATING",
      message: `Generating application with Claude ${
        ctx.generationModel === "opus" ? "Opus" : "Sonnet"
      }...`,
    };

    const genResponse = await callClaude({
      systemPrompt: systemPrompt.full,
      stablePrefix: systemPrompt.stablePrefix,
      dynamicSuffix: systemPrompt.dynamicSuffix || undefined,
      userPrompt,
      model: ctx.generationModel,
      maxTokens: adaptiveMaxTokens,
      temperature: 0.5,
    });

    ctx.totalInputTokens += genResponse.inputTokens;
    ctx.totalOutputTokens += genResponse.outputTokens;
    ctx.totalCachedTokens += genResponse.cacheReadTokens;

    // Token budget check
    if (ctx.totalInputTokens + ctx.totalOutputTokens > TOKEN_BUDGET_MAX) {
      throw new Error(
        `Token budget exceeded (${
          ctx.totalInputTokens + ctx.totalOutputTokens
        }/${TOKEN_BUDGET_MAX})`,
      );
    }

    // Truncation detection — if Claude hit max_tokens the JSON response is
    // cut off and the extracted code will be incomplete.
    if (genResponse.truncated) {
      logger.warn("Generation response was truncated (hit max_tokens)", {
        outputTokens: genResponse.outputTokens,
        maxTokens: adaptiveMaxTokens,
        slug,
      });
    }

    // Parse structured response
    const parsed = parseGenerationResponse(genResponse.text, slug);
    if (!parsed?.code) {
      throw new Error("Failed to generate valid code from Claude");
    }

    // Validate code completeness — incomplete code (e.g. truncated response)
    // will fail transpilation with cryptic esbuild errors
    if (!parsed.code.includes("export default")) {
      logger.warn("Generated code missing 'export default', likely truncated", {
        slug,
        codeLength: parsed.code.length,
        truncated: genResponse.truncated,
      });
      throw new Error(
        "Generated code is incomplete (missing export default). Response may have been truncated.",
      );
    }

    ctx.currentCode = cleanCode(parsed.code);
    ctx.title = parsed.title;
    ctx.description = parsed.description;
    ctx.relatedApps = parsed.relatedApps;

    yield {
      type: "code_generated",
      codePreview: ctx.currentCode.slice(0, 200),
    };

    // === TRANSPILE + FIX LOOP ===
    while (ctx.iteration < ctx.maxIterations) {
      yield {
        type: "phase",
        phase: "TRANSPILING",
        message: `Transpiling (attempt ${ctx.iteration + 1}/${ctx.maxIterations})...`,
        iteration: ctx.iteration,
      };

      const result = await updateCodespace(codespaceId, ctx.currentCode!);

      if (result.success) {
        // === TRANSPILE SUCCEEDED: Run review gates ===

        // Batch learning: extract notes from error/fix pairs on success too
        if (ctx.errorFixPairs.length > 0) {
          batchExtractAndSaveNotes(ctx.errorFixPairs, path).catch(err => {
            logger.warn("Batch note extraction failed", { error: err });
          });
        }

        // Attribution-gated confidence: only credit notes on fix success (iteration > 0),
        // and only notes relevant to the errors that were actually fixed.
        if (ctx.iteration > 0) {
          const fixedErrors = ctx.errors.filter(e => e.fixed);
          const relevantNoteIds = getRelevantNoteIds(ctx.notes, fixedErrors);
          if (relevantNoteIds.length > 0) {
            await recordSuccess(relevantNoteIds);
          }
        }

        // Update content in DB before reviews
        await updateAppContent(slug, ctx.title, ctx.description);

        // === AUTO_REVIEW gate ===
        yield { type: "review_started", phase: "AUTO_REVIEW" as const };
        yield {
          type: "phase",
          phase: "AUTO_REVIEW" as const,
          message: "Running automated review (transpile/bundle/health)...",
        };
        await updateAppStatus(slug, CreatedAppStatus.AUTO_REVIEW);

        const autoResult = await runAutoReview(codespaceId, ctx.currentCode!);

        yield {
          type: "review_complete",
          phase: "AUTO_REVIEW" as const,
          approved: autoResult.passed,
          score: autoResult.score,
          feedback: autoResult.passed
            ? undefined
            : Object.values(autoResult.checks)
              .filter(c => !c.passed)
              .map(c => `${c.name}: ${c.error}`)
              .join("; "),
        };

        if (!autoResult.passed) {
          logger.warn("Auto-review failed", {
            slug,
            checks: autoResult.checks,
          });
          // Continue to next iteration (the while loop will handle retry/failure)
          ctx.iteration++;
          continue;
        }

        // === AI_REVIEW gate ===
        yield { type: "review_started", phase: "AI_REVIEW" as const };
        yield {
          type: "phase",
          phase: "AI_REVIEW" as const,
          message: "Running AI code review (quality/a11y/responsive)...",
        };
        await updateAppStatus(slug, CreatedAppStatus.AI_REVIEW);

        // We need the app ID for creating AppReview records
        const appRecord = await import("./content-service").then(m => m.getCreatedApp(slug));
        const appId = appRecord?.id ?? slug;

        const aiResult = await runAiReview(
          appId,
          codespaceId,
          ctx.currentCode!,
        );

        yield {
          type: "review_complete",
          phase: "AI_REVIEW" as const,
          approved: aiResult.passed,
          score: aiResult.averageScore,
          feedback: aiResult.passed ? undefined : aiResult.feedback,
        };

        if (!aiResult.passed) {
          logger.warn("AI review failed", {
            slug,
            feedback: aiResult.feedback,
          });
          // Continue to next iteration for retry
          ctx.iteration++;
          continue;
        }

        // === Both reviews passed: PUBLISH ===
        yield {
          type: "phase",
          phase: "PUBLISHED",
          message: "App published successfully!",
        };

        await updateAppStatus(
          slug,
          CreatedAppStatus.PUBLISHED,
          ctx.relatedApps,
        );

        // Record metrics (fire-and-forget)
        recordGenerationAttempt({
          slug,
          success: true,
          iterations: ctx.iteration,
          totalDurationMs: Date.now() - ctx.startTime,
          notesApplied: ctx.notesRetrieved,
          errors: ctx.errors,
          model: ctx.generationModel,
          inputTokens: ctx.totalInputTokens,
          outputTokens: ctx.totalOutputTokens,
          cachedTokens: ctx.totalCachedTokens,
        }).catch(err => logger.error("[agent-loop] Failed to record generation attempt:", err));

        yield {
          type: "complete",
          slug,
          url: codespaceUrl,
          title: ctx.title,
          description: ctx.description,
          relatedApps: ctx.relatedApps,
        };
        return;
      }

      // === TRANSPILE FAILED ===
      const errorMsg = result.error || "Unknown transpilation error";
      const structuredError = parseTranspileError(errorMsg);

      yield {
        type: "error_detected",
        error: errorMsg.slice(0, 200),
        iteration: ctx.iteration,
      };

      ctx.errors.push({
        error: errorMsg,
        iteration: ctx.iteration,
        fixed: false,
      });

      // === EARLY TERMINATION: Check if error is unrecoverable ===
      if (isUnrecoverableError(structuredError, ctx.errors)) {
        logger.info("Early termination: unrecoverable error detected", {
          type: structuredError.type,
          severity: structuredError.severity,
          iteration: ctx.iteration,
        });
        yield {
          type: "phase",
          phase: "FIXING",
          message: `${structuredError.severity} error — cannot auto-fix (${structuredError.type})`,
          iteration: ctx.iteration,
        };
        break;
      }

      // === FIXING: Ask Claude Sonnet to fix the error ===
      yield {
        type: "phase",
        phase: "FIXING",
        message: `Fixing ${structuredError.type} error (attempt ${ctx.iteration + 1})...`,
        iteration: ctx.iteration,
      };

      // Retrieve error-specific notes for more targeted fix prompts
      const errorNotes = await retrieveNotesForError(errorMsg);
      const mergedNotes = mergeNotes(ctx.notes, errorNotes);

      const fixSystemPrompt = buildFixSystemPrompt(topic, mergedNotes);
      const fixUserPrompt = buildFixUserPrompt(
        ctx.currentCode!,
        errorMsg,
        ctx.errors.map(e => ({ error: e.error, iteration: e.iteration })),
        {
          type: structuredError.type,
          library: structuredError.library,
          lineNumber: structuredError.lineNumber,
          suggestion: structuredError.suggestion,
        },
      );

      const codeBeforeFix = ctx.currentCode!;

      try {
        const fixResponse = await callClaude({
          systemPrompt: fixSystemPrompt.full,
          stablePrefix: fixSystemPrompt.stablePrefix,
          dynamicSuffix: fixSystemPrompt.dynamicSuffix || undefined,
          userPrompt: fixUserPrompt,
          model: "sonnet",
          maxTokens: FIX_MAX_TOKENS,
          temperature: 0.2,
        });

        ctx.totalInputTokens += fixResponse.inputTokens;
        ctx.totalOutputTokens += fixResponse.outputTokens;
        ctx.totalCachedTokens += fixResponse.cacheReadTokens;

        // Token budget check after fix call
        if (ctx.totalInputTokens + ctx.totalOutputTokens > TOKEN_BUDGET_MAX) {
          logger.warn("Token budget exceeded during fix loop, breaking", {
            total: ctx.totalInputTokens + ctx.totalOutputTokens,
            budget: TOKEN_BUDGET_MAX,
          });
          break;
        }

        const fixedCode = extractCodeFromResponse(fixResponse.text);
        if (fixedCode) {
          ctx.currentCode = cleanCode(fixedCode);
          ctx.errors[ctx.errors.length - 1]!.fixed = true;
          yield { type: "error_fixed", iteration: ctx.iteration };
        }
      } catch (fixError) {
        logger.error("Fix attempt failed", {
          error: fixError,
          iteration: ctx.iteration,
        });
        if (isAuthError(fixError)) {
          throw fixError;
        }
      }

      // === LEARNING: Collect error/fix pair for batch extraction later ===
      const lastError = ctx.errors[ctx.errors.length - 1]!;
      ctx.errorFixPairs.push({
        error: errorMsg,
        code: codeBeforeFix,
        fixedCode: lastError.fixed ? ctx.currentCode : null,
        fixed: lastError.fixed,
      });

      yield {
        type: "learning",
        notePreview: `Learned from: ${structuredError.type} error`,
      };

      ctx.iteration++;
    }

    // === EXHAUSTED ALL ITERATIONS ===
    // Batch learning: extract notes from all error/fix pairs (fire-and-forget)
    if (ctx.errorFixPairs.length > 0) {
      batchExtractAndSaveNotes(ctx.errorFixPairs, path).catch(err => {
        logger.warn("Batch note extraction failed", { error: err });
      });
    }

    // Attribution-gated failure: only penalize notes relevant to encountered errors
    const relevantFailNoteIds = getRelevantNoteIds(ctx.notes, ctx.errors);
    if (relevantFailNoteIds.length > 0) {
      await recordFailure(relevantFailNoteIds);
    }

    recordGenerationAttempt({
      slug,
      success: false,
      iterations: ctx.iteration,
      totalDurationMs: Date.now() - ctx.startTime,
      notesApplied: ctx.notesRetrieved,
      errors: ctx.errors,
      model: ctx.generationModel,
      inputTokens: ctx.totalInputTokens,
      outputTokens: ctx.totalOutputTokens,
      cachedTokens: ctx.totalCachedTokens,
    }).catch(err => logger.error("[agent-loop] Failed to record generation attempt:", err));

    try {
      await updateAppStatus(slug, CreatedAppStatus.FAILED);
    } catch (err) {
      logger.error("[agent-loop] Failed to update app status to FAILED:", err);
    }

    yield {
      type: "error",
      message: `Failed after ${ctx.maxIterations} fix attempts`,
      codespaceUrl,
      generatedCode: ctx.currentCode ?? undefined,
    };
  } catch (error) {
    logger.error(`Agent loop failed for ${slug}:`, { error });

    // Don't mark as FAILED — caller may retry with a different provider (Gemini fallback)

    // Record the failed attempt (fire-and-forget)
    recordGenerationAttempt({
      slug,
      success: false,
      iterations: ctx.iteration,
      totalDurationMs: Date.now() - ctx.startTime,
      notesApplied: ctx.notesRetrieved,
      errors: [
        ...ctx.errors,
        {
          error: error instanceof Error ? error.message : "Unknown",
          iteration: ctx.iteration,
          fixed: false,
        },
      ],
      model: ctx.generationModel,
      inputTokens: ctx.totalInputTokens,
      outputTokens: ctx.totalOutputTokens,
      cachedTokens: ctx.totalCachedTokens,
    }).catch(err => logger.error("[agent-loop] Failed to record generation attempt:", err));

    // Propagate to caller for fallback handling
    throw error;
  }
}

/**
 * Merge two note arrays, deduplicating by ID.
 * Error-specific notes are appended after general notes.
 */
function mergeNotes(
  generalNotes: LearningNote[],
  errorNotes: LearningNote[],
): LearningNote[] {
  const seenIds = new Set(generalNotes.map(n => n.id));
  const merged = [...generalNotes];
  for (const note of errorNotes) {
    if (!seenIds.has(note.id)) {
      seenIds.add(note.id);
      merged.push(note);
    }
  }
  return merged;
}

/**
 * Find note IDs relevant to the given errors based on overlapping errorPatterns or libraries.
 * Used for attribution-gated confidence updates.
 */
function getRelevantNoteIds(
  notes: LearningNote[],
  errors: Array<{ error: string; iteration: number; fixed?: boolean; }>,
): string[] {
  if (notes.length === 0 || errors.length === 0) return [];

  // We need the full note data — retrieve from the original notes which have
  // id/trigger/lesson/confidenceScore. For pattern matching we check if any
  // error substring appears in the note's trigger or lesson.
  const errorTexts = errors.map(e => e.error.toLowerCase());

  return notes
    .filter(note => {
      const triggerLower = note.trigger.toLowerCase();
      const lessonLower = note.lesson.toLowerCase();
      return errorTexts.some(
        errText =>
          errText.includes(triggerLower)
          || triggerLower.includes(errText.slice(0, 50)),
      ) || errorTexts.some(
        errText => lessonLower.includes(errText.slice(0, 50)),
      );
    })
    .map(n => n.id);
}
