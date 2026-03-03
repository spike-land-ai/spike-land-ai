import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  chessPlayer: {
    create: vi.fn(),
    findUnique: vi.fn(),
    findMany: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  },
  $executeRaw: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import {
  createPlayer,
  deletePlayer,
  getPlayer,
  getPlayersByUser,
  getPlayerStats,
  listOnlinePlayers,
  setPlayerOnline,
  updatePlayer,
  updatePlayerElo,
} from "./player-manager";

describe("player-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("createPlayer creates with correct data", async () => {
    const expected = { id: "p1", userId: "u1", name: "Alice", avatar: null };
    mockPrisma.chessPlayer.create.mockResolvedValue(expected);

    const result = await createPlayer("u1", "Alice");

    expect(mockPrisma.chessPlayer.create).toHaveBeenCalledWith({
      data: { userId: "u1", name: "Alice" },
    });
    expect(result).toEqual(expected);
  });

  it("createPlayer includes avatar when provided", async () => {
    const expected = {
      id: "p1",
      userId: "u1",
      name: "Alice",
      avatar: "cat.png",
    };
    mockPrisma.chessPlayer.create.mockResolvedValue(expected);

    const result = await createPlayer("u1", "Alice", "cat.png");

    expect(mockPrisma.chessPlayer.create).toHaveBeenCalledWith({
      data: { userId: "u1", name: "Alice", avatar: "cat.png" },
    });
    expect(result).toEqual(expected);
  });

  it("getPlayer returns player when found", async () => {
    const player = { id: "p1", userId: "u1", name: "Alice" };
    mockPrisma.chessPlayer.findUnique.mockResolvedValue(player);

    const result = await getPlayer("p1");

    expect(mockPrisma.chessPlayer.findUnique).toHaveBeenCalledWith({
      where: { id: "p1" },
    });
    expect(result).toEqual(player);
  });

  it("getPlayer returns null when not found", async () => {
    mockPrisma.chessPlayer.findUnique.mockResolvedValue(null);

    const result = await getPlayer("nonexistent");

    expect(result).toBeNull();
  });

  it("getPlayersByUser returns all profiles for a user", async () => {
    const players = [
      { id: "p1", userId: "u1", name: "Alice" },
      { id: "p2", userId: "u1", name: "Bob" },
    ];
    mockPrisma.chessPlayer.findMany.mockResolvedValue(players);

    const result = await getPlayersByUser("u1");

    expect(mockPrisma.chessPlayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { userId: "u1" } }),
    );
    expect(result).toHaveLength(2);
  });

  it("updatePlayer uses atomic where clause with userId", async () => {
    mockPrisma.chessPlayer.update.mockResolvedValue({
      id: "p1",
      userId: "u1",
      name: "NewName",
    });

    const result = await updatePlayer("p1", "u1", { name: "NewName" });

    expect(mockPrisma.chessPlayer.update).toHaveBeenCalledWith({
      where: { id: "p1", userId: "u1" },
      data: { name: "NewName" },
    });
    expect(result.name).toBe("NewName");
  });

  it("updatePlayer throws if not owner (Prisma record not found)", async () => {
    mockPrisma.chessPlayer.update.mockRejectedValue(
      new Error("Record not found"),
    );

    await expect(updatePlayer("p1", "u1", { name: "Hacked" })).rejects.toThrow(
      "Not authorized to update this player",
    );
  });

  it("deletePlayer uses atomic where clause with userId", async () => {
    mockPrisma.chessPlayer.delete.mockResolvedValue({ id: "p1" });

    await deletePlayer("p1", "u1");

    expect(mockPrisma.chessPlayer.delete).toHaveBeenCalledWith({
      where: { id: "p1", userId: "u1" },
    });
  });

  it("deletePlayer throws if not owner (Prisma record not found)", async () => {
    mockPrisma.chessPlayer.delete.mockRejectedValue(
      new Error("Record not found"),
    );

    await expect(deletePlayer("p1", "u1")).rejects.toThrow(
      "Not authorized to delete this player",
    );
  });

  it("setPlayerOnline updates status and lastSeenAt", async () => {
    mockPrisma.chessPlayer.update.mockResolvedValue({});

    await setPlayerOnline("p1", true);

    expect(mockPrisma.chessPlayer.update).toHaveBeenCalledWith({
      where: { id: "p1" },
      data: {
        isOnline: true,
        lastSeenAt: expect.any(Date),
      },
    });
  });

  it("listOnlinePlayers filters by isOnline=true", async () => {
    const onlinePlayers = [{ id: "p1", isOnline: true }];
    mockPrisma.chessPlayer.findMany.mockResolvedValue(onlinePlayers);

    const result = await listOnlinePlayers();

    expect(mockPrisma.chessPlayer.findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { isOnline: true } }),
    );
    expect(result).toEqual(onlinePlayers);
  });

  it("getPlayerStats calculates winRate correctly", async () => {
    mockPrisma.chessPlayer.findUnique.mockResolvedValue({
      id: "p1",
      elo: 1300,
      bestElo: 1350,
      wins: 7,
      losses: 2,
      draws: 1,
      streak: 3,
    });

    const stats = await getPlayerStats("p1");

    expect(stats.totalGames).toBe(10);
    expect(stats.winRate).toBeCloseTo(0.7);
    expect(stats.elo).toBe(1300);
    expect(stats.bestElo).toBe(1350);
    expect(stats.streak).toBe(3);
  });

  it("getPlayerStats handles zero games (winRate = 0)", async () => {
    mockPrisma.chessPlayer.findUnique.mockResolvedValue({
      id: "p1",
      elo: 1200,
      bestElo: 1200,
      wins: 0,
      losses: 0,
      draws: 0,
      streak: 0,
    });

    const stats = await getPlayerStats("p1");

    expect(stats.totalGames).toBe(0);
    expect(stats.winRate).toBe(0);
  });

  it("updatePlayerElo executes atomic SQL for win", async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1);

    await updatePlayerElo("p1", 1220, "win");

    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  it("updatePlayerElo executes atomic SQL for loss", async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1);

    await updatePlayerElo("p1", 1280, "loss");

    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  it("updatePlayerElo executes atomic SQL for draw", async () => {
    mockPrisma.$executeRaw.mockResolvedValue(1);

    await updatePlayerElo("p1", 1250, "draw");

    expect(mockPrisma.$executeRaw).toHaveBeenCalled();
  });

  it("updatePlayerElo throws when player not found (0 rows affected)", async () => {
    mockPrisma.$executeRaw.mockResolvedValue(0);

    await expect(updatePlayerElo("p1", 1220, "win")).rejects.toThrow(
      "Player not found",
    );
  });
});
