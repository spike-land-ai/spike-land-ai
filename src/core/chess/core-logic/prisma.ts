// Prisma types stub — chess-engine does not have a generated Prisma client.
// These types mirror the Prisma schema enums used across game-manager,
// player-manager, and challenge-manager.

export type ChessTimeControl =
  | "BULLET_1"
  | "BULLET_2"
  | "BLITZ_3"
  | "BLITZ_5"
  | "RAPID_10"
  | "RAPID_15"
  | "CLASSICAL_30"
  | "UNLIMITED";

export type ChessGameStatus =
  | "WAITING"
  | "ACTIVE"
  | "CHECK"
  | "CHECKMATE"
  | "STALEMATE"
  | "DRAW"
  | "RESIGNED"
  | "EXPIRED";

// ---- Stub implementation ----
// Throws at runtime making misconfiguration explicit rather than silently
// returning empty data.

const notConfigured = (model: string, method: string) => (): never => {
  throw new Error(
    `prisma.${model}.${method}() called but no PrismaClient is configured. ` +
      "Inject a real client via the host application.",
  );
};

const makeStub = (model: string) => new Proxy({}, {
  get: (_, method) => notConfigured(model, String(method))
});

const prismaStub: any = new Proxy({}, {
  get: (_, model) => makeStub(String(model))
});

export default prismaStub;
