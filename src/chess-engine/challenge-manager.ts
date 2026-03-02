interface ChessChallenge {
  id: string;
  senderId: string;
  receiverId: string;
  status: string;
  timeControl: string;
  senderColor: string | null;
  gameId: string | null;
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";
const CHALLENGE_EXPIRY_MS = 5 * 60 * 1000;

export async function sendChallenge(
  senderId: string,
  receiverId: string,
  timeControl?: string,
  senderColor?: string,
): Promise<ChessChallenge> {
  if (senderId === receiverId) {
    throw new Error("Cannot challenge yourself");
  }
  const prisma = (await import("@/lib/prisma")).default;
  return prisma.chessChallenge.create({
    data: {
      senderId,
      receiverId,
      timeControl: (timeControl ?? "BLITZ_5") as import("@/generated/prisma").ChessTimeControl,
      senderColor: senderColor ?? null,
      expiresAt: new Date(Date.now() + CHALLENGE_EXPIRY_MS),
    },
  });
}

export async function acceptChallenge(
  challengeId: string,
  playerId: string,
): Promise<{ challenge: ChessChallenge; gameId: string }> {
  const prisma = (await import("@/lib/prisma")).default;
  const challenge = await prisma.chessChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new Error("Challenge not found");
  }
  if (challenge.receiverId !== playerId) {
    throw new Error("Not authorized to accept this challenge");
  }
  if (challenge.status !== "PENDING") {
    throw new Error("Challenge is no longer pending");
  }

  let whitePlayerId: string;
  let blackPlayerId: string;

  if (challenge.senderColor === "white") {
    whitePlayerId = challenge.senderId;
    blackPlayerId = challenge.receiverId;
  } else if (challenge.senderColor === "black") {
    whitePlayerId = challenge.receiverId;
    blackPlayerId = challenge.senderId;
  } else {
    if (Math.random() < 0.5) {
      whitePlayerId = challenge.senderId;
      blackPlayerId = challenge.receiverId;
    } else {
      whitePlayerId = challenge.receiverId;
      blackPlayerId = challenge.senderId;
    }
  }

  const timeControlMs = (await import("./types")).TIME_CONTROL_MS[challenge.timeControl] ?? 300_000;
  const game = await prisma.chessGame.create({
    data: {
      whitePlayerId,
      blackPlayerId,
      status: "WAITING",
      fen: INITIAL_FEN,
      timeControl: challenge.timeControl as import("@/generated/prisma").ChessTimeControl,
      whiteTimeMs: timeControlMs,
      blackTimeMs: timeControlMs,
    },
  });

  const updatedChallenge = await prisma.chessChallenge.update({
    where: { id: challengeId },
    data: {
      status: "ACCEPTED",
      gameId: game.id,
    },
  });

  return { challenge: updatedChallenge, gameId: game.id };
}

export async function declineChallenge(
  challengeId: string,
  playerId: string,
): Promise<ChessChallenge> {
  const prisma = (await import("@/lib/prisma")).default;
  const challenge = await prisma.chessChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new Error("Challenge not found");
  }
  if (challenge.receiverId !== playerId) {
    throw new Error("Not authorized to decline this challenge");
  }

  return prisma.chessChallenge.update({
    where: { id: challengeId },
    data: { status: "DECLINED" },
  });
}

export async function cancelChallenge(
  challengeId: string,
  playerId: string,
): Promise<ChessChallenge> {
  const prisma = (await import("@/lib/prisma")).default;
  const challenge = await prisma.chessChallenge.findUnique({
    where: { id: challengeId },
  });

  if (!challenge) {
    throw new Error("Challenge not found");
  }
  if (challenge.senderId !== playerId) {
    throw new Error("Not authorized to cancel this challenge");
  }

  return prisma.chessChallenge.update({
    where: { id: challengeId },
    data: { status: "CANCELLED" },
  });
}

export async function listChallenges(playerId: string, status?: string): Promise<ChessChallenge[]> {
  const prisma = (await import("@/lib/prisma")).default;

  const where: Record<string, unknown> = {
    OR: [{ senderId: playerId }, { receiverId: playerId }],
  };

  if (status) {
    where.status = status;
  }

  return prisma.chessChallenge.findMany({
    where,
    select: {
      id: true,
      senderId: true,
      receiverId: true,
      status: true,
      timeControl: true,
      senderColor: true,
      gameId: true,
      expiresAt: true,
      createdAt: true,
      updatedAt: true,
    },
  });
}

export async function expireStaleChallenges(): Promise<number> {
  const prisma = (await import("@/lib/prisma")).default;
  const result = await prisma.chessChallenge.updateMany({
    where: {
      status: "PENDING",
      expiresAt: { lt: new Date() },
    },
    data: { status: "EXPIRED" },
  });
  return result.count;
}
