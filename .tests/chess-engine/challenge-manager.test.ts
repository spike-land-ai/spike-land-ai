import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPrisma = vi.hoisted(() => ({
  chessChallenge: {
    create: vi.fn(),
    findUnique: vi.fn(),
    update: vi.fn(),
    findMany: vi.fn(),
    updateMany: vi.fn(),
  },
  chessGame: {
    create: vi.fn(),
  },
}));

vi.mock("@/lib/prisma", () => ({ default: mockPrisma }));

import {
  acceptChallenge,
  cancelChallenge,
  declineChallenge,
  expireStaleChallenges,
  listChallenges,
  sendChallenge,
} from "../../src/core/chess/core-logic/challenge-manager.js";

describe("challenge-manager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("sendChallenge creates with correct data and expiresAt", async () => {
    const challenge = {
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
      status: "PENDING",
      timeControl: "BLITZ_5",
    };
    mockPrisma.chessChallenge.create.mockResolvedValue(challenge);

    const now = Date.now();
    const result = await sendChallenge("p1", "p2", "BLITZ_5", "white");

    expect(mockPrisma.chessChallenge.create).toHaveBeenCalledWith({
      data: {
        senderId: "p1",
        receiverId: "p2",
        timeControl: "BLITZ_5",
        senderColor: "white",
        expiresAt: expect.any(Date),
      },
    });

    const callArgs = mockPrisma.chessChallenge.create.mock.calls[0]![0];
    const expiresAt = callArgs.data.expiresAt.getTime();
    expect(expiresAt).toBeGreaterThanOrEqual(now + 5 * 60 * 1000 - 1000);
    expect(expiresAt).toBeLessThanOrEqual(now + 5 * 60 * 1000 + 1000);
    expect(result).toEqual(challenge);
  });

  it("sendChallenge works without timeControl and senderColor", async () => {
    mockPrisma.chessChallenge.create.mockResolvedValue({});
    await sendChallenge("p1", "p2");
    expect(mockPrisma.chessChallenge.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        timeControl: "BLITZ_5",
        senderColor: null,
      }),
    });
  });

  it("acceptChallenge rejects if not found", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue(null);
    await expect(acceptChallenge("c1", "p1")).rejects.toThrow("Challenge not found");
  });

  it("declineChallenge rejects if not found", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue(null);
    await expect(declineChallenge("c1", "p1")).rejects.toThrow("Challenge not found");
  });

  it("cancelChallenge rejects if not found", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue(null);
    await expect(cancelChallenge("c1", "p1")).rejects.toThrow("Challenge not found");
  });

  it("sendChallenge rejects self-challenge", async () => {
    await expect(sendChallenge("p1", "p1")).rejects.toThrow("Cannot challenge yourself");
    expect(mockPrisma.chessChallenge.create).not.toHaveBeenCalled();
  });

  it("acceptChallenge updates status and creates game", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
      status: "PENDING",
      senderColor: "white",
      timeControl: "BLITZ_5",
    });
    mockPrisma.chessGame.create.mockResolvedValue({ id: "g1" });
    mockPrisma.chessChallenge.update.mockResolvedValue({
      id: "c1",
      status: "ACCEPTED",
      gameId: "g1",
    });

    const result = await acceptChallenge("c1", "p2");

    expect(result.gameId).toBe("g1");
    expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        status: "WAITING",
        fen: "rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1",
        timeControl: "BLITZ_5",
      }),
    });
    expect(mockPrisma.chessChallenge.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "ACCEPTED", gameId: "g1" },
    });
  });

  it("acceptChallenge rejects if not receiver", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
      status: "PENDING",
    });

    await expect(acceptChallenge("c1", "p3")).rejects.toThrow(
      "Not authorized to accept this challenge",
    );
  });

  it("acceptChallenge rejects if not PENDING status", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
      status: "DECLINED",
    });

    await expect(acceptChallenge("c1", "p2")).rejects.toThrow("Challenge is no longer pending");
  });

  it("declineChallenge updates status to DECLINED", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
    });
    mockPrisma.chessChallenge.update.mockResolvedValue({
      id: "c1",
      status: "DECLINED",
    });

    const result = await declineChallenge("c1", "p2");

    expect(mockPrisma.chessChallenge.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "DECLINED" },
    });
    expect(result.status).toBe("DECLINED");
  });

  it("declineChallenge rejects if not receiver", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
    });

    await expect(declineChallenge("c1", "p1")).rejects.toThrow(
      "Not authorized to decline this challenge",
    );
  });

  it("cancelChallenge updates status to CANCELLED", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
    });
    mockPrisma.chessChallenge.update.mockResolvedValue({
      id: "c1",
      status: "CANCELLED",
    });

    const result = await cancelChallenge("c1", "p1");

    expect(mockPrisma.chessChallenge.update).toHaveBeenCalledWith({
      where: { id: "c1" },
      data: { status: "CANCELLED" },
    });
    expect(result.status).toBe("CANCELLED");
  });

  it("cancelChallenge rejects if not sender", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
    });

    await expect(cancelChallenge("c1", "p2")).rejects.toThrow(
      "Not authorized to cancel this challenge",
    );
  });

  it("listChallenges returns challenges for player", async () => {
    const challenges = [
      { id: "c1", senderId: "p1", receiverId: "p2" },
      { id: "c2", senderId: "p3", receiverId: "p1" },
    ];
    mockPrisma.chessChallenge.findMany.mockResolvedValue(challenges);

    const result = await listChallenges("p1");

    expect(mockPrisma.chessChallenge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ senderId: "p1" }, { receiverId: "p1" }],
        },
      }),
    );
    expect(result).toHaveLength(2);
  });

  it("listChallenges filters by status", async () => {
    mockPrisma.chessChallenge.findMany.mockResolvedValue([]);

    await listChallenges("p1", "PENDING");

    expect(mockPrisma.chessChallenge.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          OR: [{ senderId: "p1" }, { receiverId: "p1" }],
          status: "PENDING",
        },
      }),
    );
  });

  it("expireStaleChallenges updates expired challenges", async () => {
    mockPrisma.chessChallenge.updateMany.mockResolvedValue({ count: 3 });

    const result = await expireStaleChallenges();

    expect(mockPrisma.chessChallenge.updateMany).toHaveBeenCalledWith({
      where: {
        status: "PENDING",
        expiresAt: { lt: expect.any(Date) },
      },
      data: { status: "EXPIRED" },
    });
    expect(result).toBe(3);
  });

  it("acceptChallenge with senderColor 'white' assigns sender as white", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
      status: "PENDING",
      senderColor: "white",
      timeControl: "RAPID_10",
    });
    mockPrisma.chessGame.create.mockResolvedValue({ id: "g1" });
    mockPrisma.chessChallenge.update.mockResolvedValue({
      id: "c1",
      status: "ACCEPTED",
      gameId: "g1",
    });

    await acceptChallenge("c1", "p2");

    expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        whitePlayerId: "p1",
        blackPlayerId: "p2",
      }),
    });
  });

  it("acceptChallenge with senderColor 'black' assigns sender as black", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
      status: "PENDING",
      senderColor: "black",
      timeControl: "RAPID_10",
    });
    mockPrisma.chessGame.create.mockResolvedValue({ id: "g1" });
    mockPrisma.chessChallenge.update.mockResolvedValue({
      id: "c1",
      status: "ACCEPTED",
      gameId: "g1",
    });

    await acceptChallenge("c1", "p2");

    expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        whitePlayerId: "p2",
        blackPlayerId: "p1",
      }),
    });
  });

  it("acceptChallenge with no senderColor picks randomly", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
      status: "PENDING",
      senderColor: null,
      timeControl: "BLITZ_5",
    });
    mockPrisma.chessGame.create.mockResolvedValue({ id: "g1" });
    mockPrisma.chessChallenge.update.mockResolvedValue({
      id: "c1",
      status: "ACCEPTED",
      gameId: "g1",
    });

    // Mock Math.random to return a deterministic value
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.3);

    await acceptChallenge("c1", "p2");

    // With Math.random() = 0.3 (< 0.5), sender should be white
    expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        whitePlayerId: "p1",
        blackPlayerId: "p2",
      }),
    });

    randomSpy.mockRestore();
  });

  it("acceptChallenge with no senderColor picks randomly (other branch)", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
      status: "PENDING",
      senderColor: null,
      timeControl: "BLITZ_5",
    });
    mockPrisma.chessGame.create.mockResolvedValue({ id: "g1" });
    mockPrisma.chessChallenge.update.mockResolvedValue({
      id: "c1",
      status: "ACCEPTED",
      gameId: "g1",
    });

    // Mock Math.random to return a deterministic value
    const randomSpy = vi.spyOn(Math, "random").mockReturnValue(0.7);

    await acceptChallenge("c1", "p2");

    // With Math.random() = 0.7 (>= 0.5), receiver should be white
    expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        whitePlayerId: "p2",
        blackPlayerId: "p1",
      }),
    });

    randomSpy.mockRestore();
  });

  it("acceptChallenge handles unknown time control", async () => {
    mockPrisma.chessChallenge.findUnique.mockResolvedValue({
      id: "c1",
      senderId: "p1",
      receiverId: "p2",
      status: "PENDING",
      senderColor: "white",
      timeControl: "UNKNOWN",
    });
    mockPrisma.chessGame.create.mockResolvedValue({ id: "g1" });
    mockPrisma.chessChallenge.update.mockResolvedValue({});

    await acceptChallenge("c1", "p2");

    expect(mockPrisma.chessGame.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        whiteTimeMs: 300_000, // Default fallback
        blackTimeMs: 300_000,
      }),
    });
  });
});
