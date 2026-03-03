import { beforeEach, describe, expect, it, vi } from "vitest";

const mockChallengeManager = vi.hoisted(() => ({
  sendChallenge: vi.fn(),
  acceptChallenge: vi.fn(),
  declineChallenge: vi.fn(),
  cancelChallenge: vi.fn(),
  listChallenges: vi.fn(),
}));

vi.mock("@/lib/chess/challenge-manager", () => mockChallengeManager);

import { createMockRegistry, getText } from "../__test-utils__";
import { registerChessChallengeTools } from "./chess-challenge";

describe("chess-challenge tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    registry = createMockRegistry();
    registerChessChallengeTools(registry, userId);
  });

  it("should register 5 chess challenge tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("chess_send_challenge")).toBe(true);
    expect(registry.handlers.has("chess_accept_challenge")).toBe(true);
    expect(registry.handlers.has("chess_decline_challenge")).toBe(true);
    expect(registry.handlers.has("chess_cancel_challenge")).toBe(true);
    expect(registry.handlers.has("chess_list_challenges")).toBe(true);
  });

  describe("chess_send_challenge", () => {
    it("should send a challenge", async () => {
      mockChallengeManager.sendChallenge.mockResolvedValue({
        id: "chal-1",
        expiresAt: new Date("2025-06-01T00:05:00Z"),
      });
      const handler = registry.handlers.get("chess_send_challenge")!;
      const result = await handler({
        sender_id: "p1",
        receiver_id: "p2",
        time_control: "RAPID_10",
      });
      const text = getText(result);
      expect(text).toContain("Challenge Sent");
      expect(text).toContain("chal-1");
      expect(text).toContain("RAPID_10");
    });
  });

  describe("chess_accept_challenge", () => {
    it("should accept a challenge", async () => {
      mockChallengeManager.acceptChallenge.mockResolvedValue({
        challenge: { id: "chal-1" },
        gameId: "game-1",
      });
      const handler = registry.handlers.get("chess_accept_challenge")!;
      const result = await handler({
        challenge_id: "chal-1",
        player_id: "p2",
      });
      const text = getText(result);
      expect(text).toContain("Challenge Accepted");
      expect(text).toContain("game-1");
    });
  });

  describe("chess_decline_challenge", () => {
    it("should decline a challenge", async () => {
      mockChallengeManager.declineChallenge.mockResolvedValue({
        id: "chal-1",
        status: "DECLINED",
      });
      const handler = registry.handlers.get("chess_decline_challenge")!;
      const result = await handler({
        challenge_id: "chal-1",
        player_id: "p2",
      });
      expect(getText(result)).toContain("Challenge Declined");
    });
  });

  describe("chess_cancel_challenge", () => {
    it("should cancel a challenge", async () => {
      mockChallengeManager.cancelChallenge.mockResolvedValue({
        id: "chal-1",
        status: "CANCELLED",
      });
      const handler = registry.handlers.get("chess_cancel_challenge")!;
      const result = await handler({
        challenge_id: "chal-1",
        player_id: "p1",
      });
      expect(getText(result)).toContain("Challenge Cancelled");
    });
  });

  describe("chess_list_challenges", () => {
    it("should list challenges", async () => {
      mockChallengeManager.listChallenges.mockResolvedValue([
        {
          id: "chal-1",
          status: "PENDING",
          senderId: "p1",
          receiverId: "p2",
          timeControl: "BLITZ_5",
        },
      ]);
      const handler = registry.handlers.get("chess_list_challenges")!;
      const result = await handler({ player_id: "p1" });
      const text = getText(result);
      expect(text).toContain("Challenges (1)");
      expect(text).toContain("chal-1");
    });

    it("should handle no challenges", async () => {
      mockChallengeManager.listChallenges.mockResolvedValue([]);
      const handler = registry.handlers.get("chess_list_challenges")!;
      const result = await handler({ player_id: "p1" });
      expect(getText(result)).toContain("No challenges found");
    });
  });
});
