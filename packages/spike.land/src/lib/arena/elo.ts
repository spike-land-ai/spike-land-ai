/**
 * Arena ELO System
 *
 * Standard K=32 ELO rating system for competitive prompt ranking.
 */

import prisma from "@/lib/prisma";

const K_FACTOR = 32;
const DEFAULT_ELO = 1200;

/**
 * Calculate expected score using ELO formula.
 * Returns value between 0 and 1.
 */
export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

/**
 * Calculate ELO change for a single match.
 * @param playerElo - Current player rating
 * @param opponentElo - Current opponent rating
 * @param won - 1 for win, 0 for loss, 0.5 for draw
 * @returns Integer ELO change (positive or negative)
 */
export function calculateEloChange(playerElo: number, opponentElo: number, won: number): number {
  const expected = expectedScore(playerElo, opponentElo);
  return Math.round(K_FACTOR * (won - expected));
}

/**
 * Update ELO after a submission is scored.
 * Compares the submission's review score against the average score
 * of other scored submissions in the same challenge.
 */
export async function updateEloAfterScoring(
  submissionId: string,
): Promise<{ newElo: number; eloChange: number }> {
  const submission = await prisma.arenaSubmission.findUniqueOrThrow({
    where: { id: submissionId },
    select: { userId: true, challengeId: true, reviewScore: true },
  });

  if (submission.reviewScore === null) {
    throw new Error("Submission has no review score");
  }

  // Get other scored submissions in same challenge
  const peers = await prisma.arenaSubmission.findMany({
    where: {
      challengeId: submission.challengeId,
      status: "SCORED",
      id: { not: submissionId },
      reviewScore: { not: null },
    },
    select: { reviewScore: true, userId: true },
  });

  // Get or create player's ELO
  const playerElo = await prisma.arenaElo.upsert({
    where: { userId: submission.userId },
    create: {
      userId: submission.userId,
      elo: DEFAULT_ELO,
      bestElo: DEFAULT_ELO,
    },
    update: {},
  });

  if (peers.length === 0) {
    // First submission in challenge - small win against default
    const change = calculateEloChange(playerElo.elo, DEFAULT_ELO, 1);
    const newElo = playerElo.elo + change;

    await prisma.arenaElo.update({
      where: { userId: submission.userId },
      data: {
        elo: newElo,
        wins: { increment: 1 },
        streak: playerElo.streak > 0 ? playerElo.streak + 1 : 1,
        bestElo: Math.max(newElo, playerElo.bestElo),
      },
    });

    await prisma.arenaSubmission.update({
      where: { id: submissionId },
      data: { eloChange: change },
    });

    return { newElo, eloChange: change };
  }

  // Compare against average peer score
  const avgPeerScore = peers.reduce((sum, p) => sum + (p.reviewScore ?? 0), 0) / peers.length;

  // Determine outcome: win if above average, loss if below, draw if close
  const diff = submission.reviewScore - avgPeerScore;
  const outcome = diff > 0.1 ? 1 : diff < -0.1 ? 0 : 0.5;

  // Use average peer ELO as opponent rating
  const peerUserIds = peers.map((p) => p.userId);
  const peerElos = await prisma.arenaElo.findMany({
    where: { userId: { in: peerUserIds } },
    select: { elo: true },
  });
  const avgPeerElo =
    peerElos.length > 0
      ? peerElos.reduce((sum, e) => sum + e.elo, 0) / peerElos.length
      : DEFAULT_ELO;

  const change = calculateEloChange(playerElo.elo, avgPeerElo, outcome);
  const newElo = playerElo.elo + change;

  const isWin = outcome === 1;
  const isLoss = outcome === 0;

  await prisma.arenaElo.update({
    where: { userId: submission.userId },
    data: {
      elo: newElo,
      ...(isWin ? { wins: { increment: 1 } } : {}),
      ...(isLoss ? { losses: { increment: 1 } } : {}),
      ...(outcome === 0.5 ? { draws: { increment: 1 } } : {}),
      streak: isWin
        ? playerElo.streak > 0
          ? playerElo.streak + 1
          : 1
        : isLoss
          ? playerElo.streak < 0
            ? playerElo.streak - 1
            : -1
          : 0,
      bestElo: Math.max(newElo, playerElo.bestElo),
    },
  });

  await prisma.arenaSubmission.update({
    where: { id: submissionId },
    data: { eloChange: change },
  });

  return { newElo, eloChange: change };
}
