import type { AgentReviewerElo } from "@prisma/client";
import { calculateEloChange } from "@/lib/arena/elo";
import prisma from "@/lib/prisma";

const DEFAULT_ELO = 1200;
const SOFTMAX_TEMPERATURE = 200;

export async function getOrCreateAgentElo(
  agentId: string,
  agentModel = "haiku",
): Promise<AgentReviewerElo> {
  return prisma.agentReviewerElo.upsert({
    where: { agentId },
    create: {
      agentId,
      agentModel,
      elo: DEFAULT_ELO,
      bestElo: DEFAULT_ELO,
    },
    update: {},
  });
}

/**
 * Select reviewers using softmax-weighted ELO sampling.
 * P(agent_i) = exp(elo_i / temperature) / sum(exp(elo_j / temperature))
 */
export async function selectByElo(count: number): Promise<AgentReviewerElo[]> {
  const agents = await prisma.agentReviewerElo.findMany();

  if (agents.length === 0) {
    return seedDefaultAgents(count);
  }

  if (agents.length <= count) return agents;

  // Softmax selection
  const maxElo = Math.max(...agents.map((a) => a.elo));
  const weights = agents.map((a) => Math.exp((a.elo - maxElo) / SOFTMAX_TEMPERATURE));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  const probs = weights.map((w) => w / totalWeight);

  const selected: AgentReviewerElo[] = [];
  const usedIndices = new Set<number>();

  for (let i = 0; i < count; i++) {
    let rand = Math.random();
    for (let j = 0; j < probs.length; j++) {
      if (usedIndices.has(j)) continue;
      rand -= probs[j]!;
      if (rand <= 0) {
        selected.push(agents[j]!);
        usedIndices.add(j);
        break;
      }
    }
    // Fallback: pick first unused
    if (selected.length <= i) {
      for (let j = 0; j < agents.length; j++) {
        if (!usedIndices.has(j)) {
          selected.push(agents[j]!);
          usedIndices.add(j);
          break;
        }
      }
    }
  }

  return selected;
}

/**
 * Settle ELO after transpile outcome (for plan reviewers).
 * APPROVED + success → +win; APPROVED + failure → +loss.
 */
export async function settleReviewElo(
  reviewId: string,
  transpileSucceeded: boolean,
): Promise<{ eloChange: number; newElo: number }> {
  const review = await prisma.routeReview.findUniqueOrThrow({
    where: { id: reviewId },
  });

  if (review.eloSettled) {
    return { eloChange: review.eloChange ?? 0, newElo: review.eloAtReview };
  }

  const agent = await getOrCreateAgentElo(review.reviewerAgentId);
  const approved = review.decision === "APPROVED";

  // Approved + success → win. Approved + failure → loss.
  // Rejected → neutral (no ELO change; the rejection itself was conservative).
  let outcome: number;
  if (!approved) {
    outcome = transpileSucceeded ? 0 : 0.5; // rejected + succeeded = small loss, rejected + failed = neutral
  } else {
    outcome = transpileSucceeded ? 1 : 0;
  }

  const eloChange = calculateEloChange(agent.elo, DEFAULT_ELO, outcome);
  const newElo = agent.elo + eloChange;
  const isWin = outcome === 1;
  const isLoss = outcome === 0;

  await prisma.$transaction([
    prisma.routeReview.update({
      where: { id: reviewId },
      data: { eloChange, eloSettled: true },
    }),
    prisma.agentReviewerElo.update({
      where: { agentId: review.reviewerAgentId },
      data: {
        elo: newElo,
        ...(isWin ? { wins: { increment: 1 } } : {}),
        ...(isLoss ? { losses: { increment: 1 } } : {}),
        ...(outcome === 0.5 ? { draws: { increment: 1 } } : {}),
        streak: isWin
          ? agent.streak > 0
            ? agent.streak + 1
            : 1
          : isLoss
            ? agent.streak < 0
              ? agent.streak - 1
              : -1
            : 0,
        bestElo: Math.max(newElo, agent.bestElo),
        totalReviews: { increment: 1 },
      },
    }),
  ]);

  return { eloChange, newElo };
}

async function seedDefaultAgents(count: number): Promise<AgentReviewerElo[]> {
  const agents: AgentReviewerElo[] = [];
  for (let i = 0; i < Math.max(count, 4); i++) {
    const agentId = `reviewer-${String(i + 1).padStart(2, "0")}`;
    const agent = await prisma.agentReviewerElo.upsert({
      where: { agentId },
      create: {
        agentId,
        agentModel: "haiku",
        elo: DEFAULT_ELO,
        bestElo: DEFAULT_ELO,
      },
      update: {},
    });
    agents.push(agent);
  }
  return agents.slice(0, count);
}
