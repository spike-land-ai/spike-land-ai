import { GeneratedRouteStatus } from "@prisma/client";
import { classifyInput } from "@/lib/create/slug-classifier";
import { agentGenerateApp } from "@/lib/create/agent-loop";
import { generateCodespaceId, getCodespaceUrl } from "@/lib/create/codespace-service";
import logger from "@/lib/logger";
import { getOrCreateRoute, incrementAttempts, updateRouteStatus } from "./route-cache";
import { reviewCode, runReviewConsensus } from "./reviewer";
import { settleReviewElo } from "./elo-tracker";
import { createGenerationTicket, updateTicketStatus } from "./ticket-service";
import { deductCredits } from "./credit-service";
import { reviewPlan } from "./reviewer";
import type { GenerationEvent, PipelineContext, PipelinePhase } from "./types";
import prisma from "@/lib/prisma";

const MAX_PLAN_RETRIES = 2;

/**
 * Main generation pipeline. Yields GenerationEvent objects for SSE streaming.
 * Orchestrates: classify -> plan review -> code generation -> transpile -> code review -> publish.
 */
export async function* generateRoute(
  slug: string,
  originalUrl: string,
  userId: string | undefined,
): AsyncGenerator<GenerationEvent> {
  const startTime = Date.now();

  const ctx: PipelineContext = {
    slug,
    originalUrl,
    path: slug.split("/"),
    routeId: "",
    userId,
    category: null,
    planJson: null,
    generatedCode: null,
    codespaceId: null,
    codespaceUrl: null,
    githubIssueNumber: null,
    attempts: 0,
    startTime,
  };

  try {
    // === Phase 0: Initialize route in DB ===
    const route = await getOrCreateRoute(slug, originalUrl, userId);
    ctx.routeId = route.id;

    // If already published, just emit complete
    if (route.status === GeneratedRouteStatus.PUBLISHED && route.codespaceUrl) {
      yield {
        type: "complete",
        slug,
        codespaceUrl: route.codespaceUrl,
        title: route.title ?? slug,
        description: route.description ?? "",
      };
      return;
    }

    // If already generating, emit status
    if (route.status !== GeneratedRouteStatus.NEW && route.status !== GeneratedRouteStatus.FAILED) {
      yield {
        type: "status",
        phase: route.status as PipelinePhase,
        message: "Generation already in progress",
      };
      return;
    }

    // Deduct credits
    if (userId) {
      const deducted = await deductCredits(userId);
      if (!deducted) {
        yield { type: "error", message: "Insufficient credits", phase: "NEW" };
        return;
      }
    }

    // === Phase 1: PLANNING ===
    yield {
      type: "status",
      phase: "PLANNING",
      message: "Classifying input...",
    };
    await updateRouteStatus(slug, GeneratedRouteStatus.PLANNING);

    let classification: {
      slug: string;
      category: string;
      status: string;
    } | null = null;
    try {
      classification = await classifyInput(slug.replace(/-/g, " ").replace(/\//g, " "));
    } catch {
      logger.warn("Classification failed, proceeding without category", {
        slug,
      });
    }

    if (classification?.status === "blocked") {
      yield {
        type: "error",
        message: "This content cannot be generated",
        phase: "PLANNING",
      };
      await updateRouteStatus(slug, GeneratedRouteStatus.FAILED, {
        lastError: "Content blocked by classifier",
      });
      return;
    }

    ctx.category = classification?.category ?? null;
    const plan: Record<string, unknown> = {
      slug,
      path: ctx.path,
      category: ctx.category,
      originalUrl,
      intent: `Generate a React application for: ${slug.replace(/-/g, " ").replace(/\//g, " ")}`,
    };
    ctx.planJson = plan;

    await updateRouteStatus(slug, GeneratedRouteStatus.PLANNING, {
      category: ctx.category,
      planJson: plan as Record<string, string | string[] | null>,
    });

    yield { type: "plan_ready", plan };

    // === Phase 2: PLAN_REVIEW ===
    yield {
      type: "status",
      phase: "PLAN_REVIEW",
      message: "Reviewing plan...",
    };
    await updateRouteStatus(slug, GeneratedRouteStatus.PLAN_REVIEW);

    let planApproved = false;
    let planRetries = 0;

    while (!planApproved && planRetries < MAX_PLAN_RETRIES) {
      const { results: planReviews, approved } = await runReviewConsensus(async (reviewer) => {
        const result = await reviewPlan(plan, reviewer);
        // Patch routeId into reviews that were created with empty routeId
        if (result.reviewerAgentId) {
          await prisma.routeReview.updateMany({
            where: {
              reviewerAgentId: result.reviewerAgentId,
              routeId: "",
            },
            data: { routeId: ctx.routeId },
          });
        }
        return result;
      });

      yield {
        type: "review_complete",
        phase: "PLAN_REVIEW",
        results: planReviews,
        approved,
      };

      if (approved) {
        planApproved = true;
      } else {
        planRetries++;
        if (planRetries < MAX_PLAN_RETRIES) {
          yield {
            type: "status",
            phase: "PLAN_REVIEW",
            message: `Plan rejected, retrying (${planRetries}/${MAX_PLAN_RETRIES})...`,
          };
        }
      }
    }

    if (!planApproved) {
      yield {
        type: "error",
        message: "Plan rejected after maximum retries",
        phase: "PLAN_REVIEW",
      };
      await updateRouteStatus(slug, GeneratedRouteStatus.FAILED, {
        lastError: "Plan rejected by reviewers",
      });
      return;
    }

    // === Create tickets ===
    const tickets = await createGenerationTicket(slug, originalUrl, ctx.category);
    ctx.githubIssueNumber = tickets.githubIssueNumber;
    await updateRouteStatus(slug, GeneratedRouteStatus.PLAN_REVIEW, {
      githubIssueNumber: tickets.githubIssueNumber,
    });

    // === Phase 3 & 4: CODING + TRANSPILING (via agent-loop) ===
    yield { type: "status", phase: "CODING", message: "Generating code..." };
    await updateRouteStatus(slug, GeneratedRouteStatus.CODING);
    await incrementAttempts(slug);

    let generationSucceeded = false;
    let finalTitle = slug.split("/").pop()?.replace(/-/g, " ") ?? "Generated App";
    let finalDescription = "Generated application";
    let finalCodespaceUrl = "";
    let finalCodespaceId = "";

    const phaseMap: Record<string, PipelinePhase> = {
      PLANNING: "CODING",
      GENERATING: "CODING",
      TRANSPILING: "TRANSPILING",
      FIXING: "TRANSPILING",
      PUBLISHED: "CODE_REVIEW",
    };

    for await (const event of agentGenerateApp(slug, ctx.path, userId)) {
      if (event.type === "phase") {
        const mappedPhase = phaseMap[event.phase] ?? "CODING";
        yield {
          type: "status",
          phase: mappedPhase,
          message: event.message,
        };
      } else if (event.type === "code_generated") {
        yield { type: "code_generated", codePreview: event.codePreview };
      } else if (event.type === "complete") {
        generationSucceeded = true;
        finalTitle = event.title;
        finalDescription = event.description;
        finalCodespaceUrl = event.url;
        finalCodespaceId = generateCodespaceId(slug);
      } else if (event.type === "error") {
        yield {
          type: "status",
          phase: "TRANSPILING",
          message: event.message,
        };
      }
    }

    // Settle plan review ELOs based on transpile outcome
    const planReviews = await prisma.routeReview.findMany({
      where: {
        routeId: ctx.routeId,
        phase: "PLAN_REVIEW",
        eloSettled: false,
      },
    });
    for (const review of planReviews) {
      await settleReviewElo(review.id, generationSucceeded).catch((err) => {
        logger.warn("ELO settlement failed", {
          reviewId: review.id,
          error: err,
        });
      });
    }

    if (!generationSucceeded) {
      yield {
        type: "error",
        message: "Code generation failed",
        phase: "CODING",
      };
      await updateRouteStatus(slug, GeneratedRouteStatus.FAILED, {
        lastError: "Agent loop failed to produce working code",
      });
      await updateTicketStatus(ctx.githubIssueNumber, "FAILED");
      return;
    }

    // === Phase 5: CODE_REVIEW ===
    yield {
      type: "status",
      phase: "CODE_REVIEW",
      message: "Reviewing generated code...",
    };
    await updateRouteStatus(slug, GeneratedRouteStatus.CODE_REVIEW);

    const createdApp = await prisma.createdApp.findUnique({
      where: { slug },
      select: { codespaceId: true },
    });

    if (createdApp) {
      const session = await prisma.codespaceSession.findFirst({
        where: { codeSpace: createdApp.codespaceId },
        select: { code: true },
      });

      if (session?.code) {
        const { results: codeReviews, approved: codeApproved } = await runReviewConsensus(
          async (reviewer) => reviewCode(session.code, reviewer, ctx.routeId),
        );

        yield {
          type: "review_complete",
          phase: "CODE_REVIEW",
          results: codeReviews,
          approved: codeApproved,
        };

        if (!codeApproved) {
          logger.warn("Code review rejected but transpile succeeded, publishing anyway", { slug });
        }
      }
    }

    // === Phase 6: PUBLISHED ===
    const generationTimeMs = Date.now() - startTime;

    await updateRouteStatus(slug, GeneratedRouteStatus.PUBLISHED, {
      title: finalTitle,
      description: finalDescription,
      codespaceId: finalCodespaceId,
      codespaceUrl: finalCodespaceUrl,
      generationTimeMs,
    });

    await updateTicketStatus(
      ctx.githubIssueNumber,
      "PUBLISHED",
      `Published in ${Math.round(generationTimeMs / 1000)}s`,
    );

    yield {
      type: "complete",
      slug,
      codespaceUrl: finalCodespaceUrl || getCodespaceUrl(finalCodespaceId),
      title: finalTitle,
      description: finalDescription,
    };
  } catch (error) {
    logger.error("Pipeline failed", {
      slug,
      error: error instanceof Error ? error.message : String(error),
    });

    try {
      await updateRouteStatus(slug, GeneratedRouteStatus.FAILED, {
        lastError: error instanceof Error ? error.message : "Unknown error",
      });
      await updateTicketStatus(ctx.githubIssueNumber, "FAILED");
    } catch {
      // Ignore DB errors during error handling
    }

    yield {
      type: "error",
      message: error instanceof Error ? error.message : "Pipeline failed",
      phase: "FAILED",
    };
  }
}
