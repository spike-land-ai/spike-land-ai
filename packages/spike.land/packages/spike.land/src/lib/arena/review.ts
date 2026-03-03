/**
 * Arena Review System
 *
 * Handles submission reviews and the two-approval scoring workflow.
 */

import prisma from "@/lib/prisma";
import { updateEloAfterScoring } from "./elo";
import { publishArenaEvent } from "./redis";
import type { ArenaBug } from "./types";

const APPROVAL_THRESHOLD = 2;

/**
 * Submit a review for an arena submission.
 */
export async function submitReview(params: {
  submissionId: string;
  reviewerId: string;
  bugs: ArenaBug[];
  score: number;
  approved: boolean;
  comment?: string;
}): Promise<{ reviewId: string; scoringTriggered: boolean; }> {
  const { submissionId, reviewerId, bugs, score, approved, comment } = params;

  // Verify submission exists and is in REVIEWING status
  const submission = await prisma.arenaSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { status: true, userId: true },
  });

  if (submission.status !== "REVIEWING") {
    throw new Error(
      `Submission is not in REVIEWING status (current: ${submission.status})`,
    );
  }

  if (submission.userId === reviewerId) {
    throw new Error("Cannot review your own submission");
  }

  // Check if reviewer already reviewed this submission
  const existingReview = await prisma.arenaReview.findFirst({
    where: { submissionId, reviewerId },
  });

  if (existingReview) {
    throw new Error("Already reviewed this submission");
  }

  // Create the review
  const review = await prisma.arenaReview.create({
    data: {
      submissionId,
      reviewerId,
      bugs: JSON.parse(JSON.stringify(bugs)),
      score: Math.max(0, Math.min(1, score)),
      approved,
      comment,
    },
  });

  await publishArenaEvent(submissionId, {
    type: "review_complete",
    data: { reviewId: review.id, approved, score },
  });

  // Check if we've reached the approval threshold
  const scoringTriggered = await checkApprovalThreshold(submissionId);

  return { reviewId: review.id, scoringTriggered };
}

/**
 * Check if a submission has enough reviews to be scored.
 * Returns true if scoring was triggered.
 */
export async function checkApprovalThreshold(
  submissionId: string,
): Promise<boolean> {
  const reviewCount = await prisma.arenaReview.count({
    where: { submissionId },
  });

  if (reviewCount >= APPROVAL_THRESHOLD) {
    await scoreSubmission(submissionId);
    return true;
  }

  return false;
}

/**
 * Score a submission based on its reviews and update ELO.
 */
export async function scoreSubmission(submissionId: string): Promise<void> {
  const reviews = await prisma.arenaReview.findMany({
    where: { submissionId },
    select: { score: true, approved: true },
  });

  if (reviews.length === 0) {
    throw new Error("No reviews found for submission");
  }

  // Average review scores
  const avgScore = reviews.reduce((sum, r) => sum + r.score, 0)
    / reviews.length;

  // Update submission status and score
  await prisma.arenaSubmission.update({
    where: { id: submissionId },
    data: {
      status: "SCORED",
      reviewScore: avgScore,
    },
  });

  // Update ELO
  const { newElo, eloChange } = await updateEloAfterScoring(submissionId);

  await publishArenaEvent(submissionId, {
    type: "scored",
    data: { reviewScore: avgScore, eloChange, newElo },
  });
}
