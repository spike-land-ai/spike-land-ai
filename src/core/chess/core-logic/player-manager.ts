interface ChessPlayer {
  id: string;
  userId: string;
  name: string;
  avatar: string | null;
  elo: number;
  bestElo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  soundEnabled: boolean;
  isOnline: boolean;
  lastSeenAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface PlayerStats {
  elo: number;
  bestElo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
  totalGames: number;
  winRate: number;
}

export async function createPlayer(
  userId: string,
  name: string,
  avatar?: string,
): Promise<ChessPlayer> {
  const prisma = (await import("@/generated/prisma")).default;
  return prisma.chessPlayer.create({
    data: {
      userId,
      name,
      ...(avatar !== undefined && { avatar }),
    },
  });
}

export async function getPlayer(playerId: string): Promise<ChessPlayer | null> {
  const prisma = (await import("@/generated/prisma")).default;
  return prisma.chessPlayer.findUnique({ where: { id: playerId } });
}

export async function getPlayersByUser(userId: string): Promise<ChessPlayer[]> {
  const prisma = (await import("@/generated/prisma")).default;
  return prisma.chessPlayer.findMany({
    where: { userId },
    select: {
      id: true,
      userId: true,
      name: true,
      avatar: true,
      elo: true,
      bestElo: true,
      wins: true,
      losses: true,
      draws: true,
      streak: true,
      soundEnabled: true,
      isOnline: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function updatePlayer(
  playerId: string,
  userId: string,
  data: { name?: string; avatar?: string; soundEnabled?: boolean },
): Promise<ChessPlayer> {
  const prisma = (await import("@/generated/prisma")).default;
  try {
    return await prisma.chessPlayer.update({
      where: { id: playerId, userId },
      data,
    });
  } catch {
    throw new Error("Not authorized to update this player");
  }
}

export async function deletePlayer(playerId: string, userId: string): Promise<void> {
  const prisma = (await import("@/generated/prisma")).default;
  try {
    await prisma.chessPlayer.delete({ where: { id: playerId, userId } });
  } catch {
    throw new Error("Not authorized to delete this player");
  }
}

export async function setPlayerOnline(playerId: string, isOnline: boolean): Promise<void> {
  const prisma = (await import("@/generated/prisma")).default;
  await prisma.chessPlayer.update({
    where: { id: playerId },
    data: {
      isOnline,
      lastSeenAt: new Date(),
    },
  });
}

export async function listOnlinePlayers(): Promise<ChessPlayer[]> {
  const prisma = (await import("@/generated/prisma")).default;
  return prisma.chessPlayer.findMany({
    where: { isOnline: true },
    select: {
      id: true,
      userId: true,
      name: true,
      avatar: true,
      elo: true,
      bestElo: true,
      wins: true,
      losses: true,
      draws: true,
      streak: true,
      soundEnabled: true,
      isOnline: true,
      lastSeenAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function getPlayerStats(playerId: string): Promise<PlayerStats> {
  const prisma = (await import("@/generated/prisma")).default;
  const player = await prisma.chessPlayer.findUnique({
    where: { id: playerId },
  });
  if (!player) {
    throw new Error("Player not found");
  }
  const totalGames = player.wins + player.losses + player.draws;
  const winRate = totalGames > 0 ? player.wins / totalGames : 0;
  return {
    elo: player.elo,
    bestElo: player.bestElo,
    wins: player.wins,
    losses: player.losses,
    draws: player.draws,
    streak: player.streak,
    totalGames,
    winRate,
  };
}

export async function updatePlayerElo(
  playerId: string,
  newElo: number,
  result: "win" | "loss" | "draw",
): Promise<void> {
  const prisma = (await import("@/generated/prisma")).default;

  const winIncrement = result === "win" ? 1 : 0;
  const lossIncrement = result === "loss" ? 1 : 0;
  const drawIncrement = result === "draw" ? 1 : 0;

  const count = await prisma.$executeRaw`
    UPDATE "ChessPlayer"
    SET
      elo = ${newElo},
      "bestElo" = GREATEST("bestElo", ${newElo}),
      wins = wins + ${winIncrement},
      losses = losses + ${lossIncrement},
      draws = draws + ${drawIncrement},
      streak = CASE
        WHEN ${result} = 'win' THEN CASE WHEN streak > 0 THEN streak + 1 ELSE 1 END
        WHEN ${result} = 'loss' THEN CASE WHEN streak < 0 THEN streak - 1 ELSE -1 END
        ELSE 0
      END,
      "updatedAt" = NOW()
    WHERE id = ${playerId}
  `;
  if (count === 0) {
    throw new Error("Player not found");
  }
}
