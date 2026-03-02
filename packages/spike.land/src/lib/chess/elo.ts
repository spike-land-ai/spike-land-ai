import type { EloUpdate, GameResult } from "./types";

export function expectedScore(playerElo: number, opponentElo: number): number {
  return 1 / (1 + Math.pow(10, (opponentElo - playerElo) / 400));
}

export function getKFactor(elo: number, gamesPlayed: number): number {
  if (elo > 2400) return 16;
  if (gamesPlayed < 30) return 40;
  return 32;
}

export function calculateEloChange(
  whiteElo: number,
  blackElo: number,
  result: GameResult,
  whiteGames: number = 30,
  blackGames: number = 30,
): EloUpdate {
  const whiteExpected = expectedScore(whiteElo, blackElo);
  const blackExpected = expectedScore(blackElo, whiteElo);

  let whiteActual: number;
  let blackActual: number;

  switch (result) {
    case "white":
      whiteActual = 1.0;
      blackActual = 0.0;
      break;
    case "black":
      whiteActual = 0.0;
      blackActual = 1.0;
      break;
    case "draw":
      whiteActual = 0.5;
      blackActual = 0.5;
      break;
  }

  const whiteK = getKFactor(whiteElo, whiteGames);
  const blackK = getKFactor(blackElo, blackGames);

  const whiteChange = Math.round(whiteK * (whiteActual - whiteExpected));
  const blackChange = Math.round(blackK * (blackActual - blackExpected));

  return {
    whiteNewElo: whiteElo + whiteChange,
    blackNewElo: blackElo + blackChange,
    whiteChange,
    blackChange,
  };
}
