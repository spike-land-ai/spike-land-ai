import { createGame, getGameState, makeMove } from "./engine";
import { calculateEloChange } from "./elo";
import type { EloUpdate, GameResult, MoveResult } from "./types";
import { TIME_CONTROL_MS } from "./types";

const INITIAL_FEN = "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1";

interface GameRecord {
  id: string;
  whitePlayerId: string;
  blackPlayerId: string | null;
  status: string;
  fen: string;
  pgn: string;
  timeControl: string;
  whiteTimeMs: number;
  blackTimeMs: number;
  winnerId: string | null;
  result: string | null;
  eloChanges: unknown;
  moveCount: number;
  createdAt: Date;
  updatedAt: Date;
  moves?: MoveRecord[];
}

interface MoveRecord {
  id: string;
  gameId: string;
  moveNumber: number;
  san: string;
  from: string;
  to: string;
  fen: string;
  playerId: string;
  timeSpentMs: number | null;
  createdAt: Date;
}

interface PlayerRecord {
  id: string;
  userId: string;
  elo: number;
  bestElo: number;
  wins: number;
  losses: number;
  draws: number;
  streak: number;
}

export async function createGameRecord(
  whitePlayerId: string,
  timeControl: string = "BLITZ_5",
): Promise<{ id: string }> {
  const prisma = (await import("@/lib/prisma")).default;
  const timeMs = TIME_CONTROL_MS[timeControl] ?? TIME_CONTROL_MS.BLITZ_5;

  const resolvedTimeMs = timeMs ?? 300_000;
  const game = await prisma.chessGame.create({
    data: {
      whitePlayerId,
      status: "WAITING",
      fen: INITIAL_FEN,
      timeControl: timeControl as import("@/generated/prisma").ChessTimeControl,
      whiteTimeMs: resolvedTimeMs,
      blackTimeMs: resolvedTimeMs,
    },
  });

  return { id: game.id };
}

export async function joinGame(gameId: string, blackPlayerId: string): Promise<{ id: string }> {
  const prisma = (await import("@/lib/prisma")).default;
  const game = await prisma.chessGame.findUnique({ where: { id: gameId } });

  if (!game) {
    throw new Error("Game not found");
  }
  if (game.status !== "WAITING") {
    throw new Error("Game is not waiting for a player");
  }
  if (game.whitePlayerId === blackPlayerId) {
    throw new Error("Cannot join your own game");
  }

  const updated = await prisma.chessGame.update({
    where: { id: gameId },
    data: {
      blackPlayerId,
      status: "ACTIVE",
    },
  });

  return { id: updated.id };
}

export async function makeGameMove(
  gameId: string,
  playerId: string,
  from: string,
  to: string,
  promotion?: string,
): Promise<MoveResult> {
  const prisma = (await import("@/lib/prisma")).default;
  const game = (await prisma.chessGame.findUnique({
    where: { id: gameId },
  })) as GameRecord | null;

  if (!game) {
    throw new Error("Game not found");
  }
  if (game.status !== "ACTIVE") {
    throw new Error("Game is not active");
  }

  const isWhiteTurn = game.moveCount % 2 === 0;
  if (isWhiteTurn && playerId !== game.whitePlayerId) {
    throw new Error("Not your turn");
  }
  if (!isWhiteTurn && playerId !== game.blackPlayerId) {
    throw new Error("Not your turn");
  }

  const chess = createGame(game.fen);
  const moveResult = makeMove(chess, { from, to, promotion });

  if (!moveResult.success) {
    return moveResult;
  }

  const state = getGameState(chess);
  const newMoveCount = game.moveCount + 1;

  type ChessGameStatus = import("@/generated/prisma").ChessGameStatus;
  let newStatus: ChessGameStatus = "ACTIVE" as ChessGameStatus;
  if (state.isCheckmate) {
    newStatus = "CHECKMATE" as ChessGameStatus;
  } else if (state.isStalemate) {
    newStatus = "STALEMATE" as ChessGameStatus;
  } else if (state.isDraw) {
    newStatus = "DRAW" as ChessGameStatus;
  } else if (state.isCheck) {
    newStatus = "CHECK" as ChessGameStatus;
  }

  await prisma.chessMove.create({
    data: {
      gameId,
      moveNumber: newMoveCount,
      san: moveResult.san,
      from: moveResult.from,
      to: moveResult.to,
      fen: moveResult.fen,
      playerId,
    },
  });

  await prisma.chessGame.update({
    where: { id: gameId },
    data: {
      fen: moveResult.fen,
      pgn: state.pgn,
      moveCount: newMoveCount,
      status: newStatus,
    },
  });

  if (state.isGameOver) {
    let result: GameResult;
    let winnerId: string | undefined;

    if (state.isCheckmate) {
      result = isWhiteTurn ? "white" : "black";
      winnerId = playerId;
    } else {
      result = "draw";
    }

    await finalizeGame(gameId, result, winnerId);
  }

  return moveResult;
}

export async function getGame(gameId: string): Promise<GameRecord> {
  const prisma = (await import("@/lib/prisma")).default;
  const game = await prisma.chessGame.findUnique({
    where: { id: gameId },
    include: { moves: true },
  });

  if (!game) {
    throw new Error("Game not found");
  }

  return game as GameRecord;
}

export async function listGames(playerId: string, status?: string): Promise<GameRecord[]> {
  const prisma = (await import("@/lib/prisma")).default;

  const where: Record<string, unknown> = {
    OR: [{ whitePlayerId: playerId }, { blackPlayerId: playerId }],
  };
  if (status) {
    where.status = status;
  }

  return prisma.chessGame.findMany({
    where,
    select: {
      id: true,
      whitePlayerId: true,
      blackPlayerId: true,
      status: true,
      fen: true,
      pgn: true,
      timeControl: true,
      whiteTimeMs: true,
      blackTimeMs: true,
      winnerId: true,
      result: true,
      eloChanges: true,
      moveCount: true,
      createdAt: true,
      updatedAt: true,
    },
  }) as Promise<GameRecord[]>;
}

export async function resignGame(gameId: string, playerId: string): Promise<void> {
  const prisma = (await import("@/lib/prisma")).default;
  const game = (await prisma.chessGame.findUnique({
    where: { id: gameId },
  })) as GameRecord | null;

  if (!game) {
    throw new Error("Game not found");
  }
  if (game.whitePlayerId !== playerId && game.blackPlayerId !== playerId) {
    throw new Error("Player is not in this game");
  }

  const winnerId = playerId === game.whitePlayerId ? game.blackPlayerId : game.whitePlayerId;
  const result: GameResult = playerId === game.whitePlayerId ? "black" : "white";

  await prisma.chessGame.update({
    where: { id: gameId },
    data: { status: "RESIGNED", winnerId },
  });

  await finalizeGame(gameId, result, winnerId ?? undefined);
}

export async function offerDraw(gameId: string, playerId: string): Promise<{ offered: true }> {
  const prisma = (await import("@/lib/prisma")).default;
  const game = (await prisma.chessGame.findUnique({
    where: { id: gameId },
  })) as GameRecord | null;

  if (!game) {
    throw new Error("Game not found");
  }
  if (game.status !== "ACTIVE" && game.status !== "CHECK") {
    throw new Error("Game is not active");
  }
  if (game.whitePlayerId !== playerId && game.blackPlayerId !== playerId) {
    throw new Error("Player is not in this game");
  }

  return { offered: true };
}

export async function acceptDraw(gameId: string, _playerId: string): Promise<void> {
  const prisma = (await import("@/lib/prisma")).default;

  await prisma.chessGame.update({
    where: { id: gameId },
    data: { status: "DRAW" },
  });

  await finalizeGame(gameId, "draw");
}

export async function declineDraw(gameId: string, playerId: string): Promise<{ declined: true }> {
  const prisma = (await import("@/lib/prisma")).default;
  const game = (await prisma.chessGame.findUnique({
    where: { id: gameId },
  })) as GameRecord | null;

  if (!game) {
    throw new Error("Game not found");
  }
  if (game.status !== "ACTIVE" && game.status !== "CHECK") {
    throw new Error("Game is not active");
  }
  if (game.whitePlayerId !== playerId && game.blackPlayerId !== playerId) {
    throw new Error("Player is not in this game");
  }

  return { declined: true };
}

export async function getGameReplay(
  gameId: string,
): Promise<{ moves: MoveRecord[]; pgn: string; result: string | null }> {
  const prisma = (await import("@/lib/prisma")).default;
  const game = (await prisma.chessGame.findUnique({
    where: { id: gameId },
  })) as GameRecord | null;

  if (!game) {
    throw new Error("Game not found");
  }

  const moves = (await prisma.chessMove.findMany({
    where: { gameId },
    orderBy: { moveNumber: "asc" },
  })) as MoveRecord[];

  return {
    moves,
    pgn: game.pgn,
    result: game.result,
  };
}

export async function handleTimeExpiry(gameId: string, playerId: string): Promise<void> {
  const prisma = (await import("@/lib/prisma")).default;
  const game = (await prisma.chessGame.findUnique({
    where: { id: gameId },
  })) as GameRecord | null;

  if (!game) {
    throw new Error("Game not found");
  }

  const winnerId = playerId === game.whitePlayerId ? game.blackPlayerId : game.whitePlayerId;
  const result: GameResult = playerId === game.whitePlayerId ? "black" : "white";

  await prisma.chessGame.update({
    where: { id: gameId },
    data: { status: "RESIGNED", winnerId },
  });

  await finalizeGame(gameId, result, winnerId ?? undefined);
}

export async function finalizeGame(
  gameId: string,
  result: GameResult,
  winnerId?: string,
): Promise<void> {
  const prisma = (await import("@/lib/prisma")).default;
  const game = (await prisma.chessGame.findUnique({
    where: { id: gameId },
  })) as GameRecord | null;

  if (!game || !game.blackPlayerId) {
    return;
  }

  const whitePlayer = (await prisma.chessPlayer.findUnique({
    where: { id: game.whitePlayerId },
  })) as PlayerRecord | null;
  const blackPlayer = (await prisma.chessPlayer.findUnique({
    where: { id: game.blackPlayerId },
  })) as PlayerRecord | null;

  if (!whitePlayer || !blackPlayer) {
    return;
  }

  const eloChanges: EloUpdate = calculateEloChange(whitePlayer.elo, blackPlayer.elo, result);

  await prisma.chessPlayer.update({
    where: { id: whitePlayer.id },
    data: { elo: eloChanges.whiteNewElo },
  });

  await prisma.chessPlayer.update({
    where: { id: blackPlayer.id },
    data: { elo: eloChanges.blackNewElo },
  });

  await prisma.chessGame.update({
    where: { id: gameId },
    data: {
      winnerId: winnerId ?? null,
      result,
      eloChanges: {
        whiteNewElo: eloChanges.whiteNewElo,
        blackNewElo: eloChanges.blackNewElo,
        whiteChange: eloChanges.whiteChange,
        blackChange: eloChanges.blackChange,
      },
    },
  });

  await prisma.notification.create({
    data: {
      userId: whitePlayer.userId,
      workspaceId: gameId,
      type: "CHESS_GAME_RESULT",
      title: "Game Over",
      message: `Game ended: ${result}`,
    },
  });

  await prisma.notification.create({
    data: {
      userId: blackPlayer.userId,
      workspaceId: gameId,
      type: "CHESS_GAME_RESULT",
      title: "Game Over",
      message: `Game ended: ${result}`,
    },
  });
}
