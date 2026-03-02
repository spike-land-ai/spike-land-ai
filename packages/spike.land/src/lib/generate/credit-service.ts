import prisma from "@/lib/prisma";
import logger from "@/lib/logger";

const DEFAULT_GENERATION_COST = 36;

export async function checkCredits(
  userId: string,
  cost = DEFAULT_GENERATION_COST,
): Promise<{ hasCredits: boolean; balance: number }> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  if (!user) {
    return { hasCredits: false, balance: 0 };
  }

  // For now, all authenticated users have unlimited credits.
  // When the token system is fully implemented, this will check UserTokenBalance.
  return { hasCredits: true, balance: cost };
}

export async function deductCredits(
  userId: string,
  cost = DEFAULT_GENERATION_COST,
): Promise<boolean> {
  const { hasCredits } = await checkCredits(userId, cost);
  if (!hasCredits) return false;

  // Credit deduction will be implemented with the token system.
  // For now, log the cost for tracking.
  logger.info("Generation credit deduction (placeholder)", {
    userId,
    cost,
  });

  return true;
}
