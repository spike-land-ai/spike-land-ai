/**
 * Arena Generator
 *
 * Thin wrapper around the existing agent loop for arena submissions.
 * Uses the user's prompt directly as the user message, tracks status
 * in the ArenaSubmission model, and publishes events for SSE streaming.
 */

import { callClaude, extractCodeFromResponse } from "@/lib/create/agent-client";
import { updateCodespace } from "@/lib/create/codespace-service";
import {
  buildFixSystemPrompt,
  buildFixUserPrompt,
} from "@/lib/create/agent-prompts";
import {
  isUnrecoverableError,
  parseTranspileError,
} from "@/lib/create/error-parser";
import { cleanCode } from "@/lib/create/content-generator";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import {
  publishArenaEvent,
  setSubmissionState,
  setSubmissionWorking,
} from "./redis";

const MAX_ITERATIONS = 3;
const GEN_MAX_TOKENS = 32768;
const FIX_MAX_TOKENS = 32768;

/**
 * Run the arena generation pipeline for a submission.
 * Updates ArenaSubmission status at each phase and publishes SSE events.
 */
export async function arenaGenerateFromPrompt(
  submissionId: string,
): Promise<void> {
  const submission = await prisma.arenaSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: {
      id: true,
      prompt: true,
      systemPrompt: true,
      challengeId: true,
      challenge: { select: { title: true, category: true } },
    },
  });

  const codespaceId = `arena-${submissionId.slice(0, 12)}`;
  const componentUrl = process.env.SPIKE_LAND_COMPONENT_URL
    ?? "https://testing.spike.land";
  const codespaceUrl = `${componentUrl}/live/${codespaceId}/`;
  const startTime = Date.now();
  let totalInputTokens = 0;
  let totalOutputTokens = 0;
  let totalCachedTokens = 0;
  const errors: Array<{ error: string; iteration: number; fixed: boolean; }> = [];

  try {
    await setSubmissionWorking(submissionId, true);

    // === GENERATING ===
    await updateSubmissionStatus(submissionId, "GENERATING");
    await publishArenaEvent(submissionId, {
      type: "phase_update",
      data: { phase: "GENERATING", message: "Generating code from prompt..." },
    });

    const systemPrompt = submission.systemPrompt
      || `You are an expert React developer. Generate a complete, working React component based on the user's prompt. The component must use a default export. Use only React and standard CSS (inline styles or CSS-in-JS). Do not use external libraries unless specified. The code must be a single file that compiles with esbuild.\n\nChallenge: ${submission.challenge.title}\nCategory: ${submission.challenge.category}`;

    const genResponse = await callClaude({
      systemPrompt,
      userPrompt: submission.prompt,
      model: "opus",
      maxTokens: GEN_MAX_TOKENS,
      temperature: 0.5,
    });

    totalInputTokens += genResponse.inputTokens;
    totalOutputTokens += genResponse.outputTokens;
    totalCachedTokens += genResponse.cacheReadTokens;

    const code = extractCodeFromResponse(genResponse.text);
    if (!code) {
      throw new Error("Failed to extract code from Claude response");
    }

    let currentCode = cleanCode(code);

    await publishArenaEvent(submissionId, {
      type: "code_generated",
      data: { codePreview: currentCode.slice(0, 200) },
    });

    // === TRANSPILE + FIX LOOP ===
    let iteration = 0;
    let transpileSuccess = false;

    while (iteration < MAX_ITERATIONS) {
      await updateSubmissionStatus(submissionId, "TRANSPILING");
      await publishArenaEvent(submissionId, {
        type: "phase_update",
        data: {
          phase: "TRANSPILING",
          message: `Transpiling (attempt ${iteration + 1}/${MAX_ITERATIONS})...`,
          iteration,
        },
      });

      const result = await updateCodespace(codespaceId, currentCode);

      if (result.success) {
        transpileSuccess = true;
        await publishArenaEvent(submissionId, {
          type: "transpile_success",
          data: { codespaceUrl, iteration },
        });
        break;
      }

      // Transpile failed
      const errorMsg = result.error || "Unknown transpilation error";
      const structuredError = parseTranspileError(errorMsg);
      errors.push({ error: errorMsg, iteration, fixed: false });

      await publishArenaEvent(submissionId, {
        type: "error_detected",
        data: { error: structuredError.message, iteration },
      });

      if (isUnrecoverableError(structuredError, errors)) {
        break;
      }

      // Try to fix
      const fixSystem = buildFixSystemPrompt("arena", []);
      const fixUser = buildFixUserPrompt(currentCode, errorMsg, errors, {
        type: structuredError.type,
        library: structuredError.library,
      });

      const fixResponse = await callClaude({
        systemPrompt: fixSystem.full,
        userPrompt: fixUser,
        model: "sonnet",
        maxTokens: FIX_MAX_TOKENS,
        temperature: 0.2,
      });

      totalInputTokens += fixResponse.inputTokens;
      totalOutputTokens += fixResponse.outputTokens;
      totalCachedTokens += fixResponse.cacheReadTokens;

      const fixedCode = extractCodeFromResponse(fixResponse.text);
      if (fixedCode) {
        currentCode = cleanCode(fixedCode);
        errors[errors.length - 1]!.fixed = true;
        await publishArenaEvent(submissionId, {
          type: "error_fixed",
          data: { iteration },
        });
      }

      iteration++;
    }

    // === UPDATE SUBMISSION ===
    const finalStatus = transpileSuccess ? "REVIEWING" : "FAILED";

    await prisma.arenaSubmission.update({
      where: { id: submissionId },
      data: {
        status: finalStatus,
        generatedCode: currentCode,
        codespaceId,
        codespaceUrl: transpileSuccess ? codespaceUrl : null,
        transpileSuccess,
        iterations: iteration,
        model: "opus",
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedTokens: totalCachedTokens,
        totalDurationMs: Date.now() - startTime,
        errors: JSON.parse(JSON.stringify(errors)),
      },
    });

    await setSubmissionState(submissionId, finalStatus);

    if (transpileSuccess) {
      await publishArenaEvent(submissionId, {
        type: "phase_update",
        data: { phase: "REVIEWING", message: "Ready for review!" },
      });
    } else {
      await publishArenaEvent(submissionId, {
        type: "failed",
        data: { message: "Failed to transpile after all attempts", errors },
      });
    }
  } catch (error) {
    const rawMessage = error instanceof Error ? error.message : "Unknown error";
    // Sanitize: strip tokens/credentials from error messages
    const message = rawMessage.replace(/Bearer\s+\S+/gi, "Bearer [REDACTED]")
      .replace(/sk-[a-zA-Z0-9_-]+/g, "[REDACTED]");
    const isAuth = error && typeof error === "object" && "status" in error
      && (error as { status: number; }).status === 401;
    const errorType = isAuth ? "auth_error" : "generation_error";

    logger.error("Arena generation failed", {
      submissionId,
      error: message,
      errorType,
      durationMs: Date.now() - startTime,
    });

    await prisma.arenaSubmission.update({
      where: { id: submissionId },
      data: {
        status: "FAILED",
        iterations: 0,
        inputTokens: totalInputTokens,
        outputTokens: totalOutputTokens,
        cachedTokens: totalCachedTokens,
        totalDurationMs: Date.now() - startTime,
        errors: JSON.parse(
          JSON.stringify([{ error: message, iteration: 0, fixed: false }]),
        ),
      },
    });

    await setSubmissionState(submissionId, "FAILED");
    await publishArenaEvent(submissionId, {
      type: "failed",
      data: { message, errorType },
    });
  } finally {
    await setSubmissionWorking(submissionId, false);
  }
}

async function updateSubmissionStatus(
  submissionId: string,
  status: "GENERATING" | "TRANSPILING" | "REVIEWING" | "FAILED",
): Promise<void> {
  await prisma.arenaSubmission.update({
    where: { id: submissionId },
    data: { status },
  });
  await setSubmissionState(submissionId, status);
}
