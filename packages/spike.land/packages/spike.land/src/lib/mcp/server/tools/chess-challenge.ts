/**
 * Chess Challenge MCP Tools
 *
 * Send, accept, decline, and manage chess challenges between players.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const SendChallengeSchema = z.object({
  sender_id: z.string().min(1).describe("Your chess player profile ID."),
  receiver_id: z.string().min(1).describe(
    "Opponent's chess player profile ID.",
  ),
  time_control: z
    .enum([
      "BULLET_1",
      "BULLET_2",
      "BLITZ_3",
      "BLITZ_5",
      "RAPID_10",
      "RAPID_15",
      "CLASSICAL_30",
      "UNLIMITED",
    ])
    .optional()
    .default("BLITZ_5")
    .describe("Time control (default BLITZ_5)."),
  sender_color: z
    .enum(["white", "black"])
    .optional()
    .describe("Preferred color. Omit for random assignment."),
});

const AcceptChallengeSchema = z.object({
  challenge_id: z.string().min(1).describe("ID of the challenge to accept."),
  player_id: z.string().min(1).describe(
    "Your chess player profile ID (must be receiver).",
  ),
});

const DeclineChallengeSchema = z.object({
  challenge_id: z.string().min(1).describe("ID of the challenge to decline."),
  player_id: z.string().min(1).describe(
    "Your chess player profile ID (must be receiver).",
  ),
});

const CancelChallengeSchema = z.object({
  challenge_id: z.string().min(1).describe("ID of the challenge to cancel."),
  player_id: z.string().min(1).describe(
    "Your chess player profile ID (must be sender).",
  ),
});

const ListChallengesSchema = z.object({
  player_id: z.string().min(1).describe("Your chess player profile ID."),
  status: z.string().optional().describe(
    "Filter by status: PENDING, ACCEPTED, etc.",
  ),
});

export function registerChessChallengeTools(
  registry: ToolRegistry,
  _userId: string,
): void {
  registry.register({
    name: "chess_send_challenge",
    description:
      "Send a challenge to another player with optional time control and color preference.",
    category: "chess-challenge",
    tier: "free",
    inputSchema: SendChallengeSchema.shape,
    handler: async (
      args: z.infer<typeof SendChallengeSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_send_challenge", async () => {
        const { sendChallenge } = await import(
          "@/lib/chess/challenge-manager"
        );
        const challenge = await sendChallenge(
          args.sender_id,
          args.receiver_id,
          args.time_control,
          args.sender_color,
        );
        return textResult(
          `**Challenge Sent**\n\n`
            + `**ID:** ${challenge.id}\n`
            + `**Time Control:** ${args.time_control}\n`
            + `**Expires:** ${challenge.expiresAt}`,
        );
      }),
  });

  registry.register({
    name: "chess_accept_challenge",
    description: "Accept an incoming chess challenge and start the game.",
    category: "chess-challenge",
    tier: "free",
    inputSchema: AcceptChallengeSchema.shape,
    handler: async (
      args: z.infer<typeof AcceptChallengeSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_accept_challenge", async () => {
        const { acceptChallenge } = await import(
          "@/lib/chess/challenge-manager"
        );
        const { challenge, gameId } = await acceptChallenge(
          args.challenge_id,
          args.player_id,
        );
        return textResult(
          `**Challenge Accepted**\n\n`
            + `**Challenge ID:** ${challenge.id}\n`
            + `**Game ID:** ${gameId}\n`
            + `**Status:** Game is starting!`,
        );
      }),
  });

  registry.register({
    name: "chess_decline_challenge",
    description: "Decline an incoming chess challenge.",
    category: "chess-challenge",
    tier: "free",
    inputSchema: DeclineChallengeSchema.shape,
    handler: async (
      args: z.infer<typeof DeclineChallengeSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_decline_challenge", async () => {
        const { declineChallenge } = await import(
          "@/lib/chess/challenge-manager"
        );
        await declineChallenge(args.challenge_id, args.player_id);
        return textResult(
          `**Challenge Declined**\n\nChallenge ${args.challenge_id} has been declined.`,
        );
      }),
  });

  registry.register({
    name: "chess_cancel_challenge",
    description: "Cancel a challenge you sent.",
    category: "chess-challenge",
    tier: "free",
    inputSchema: CancelChallengeSchema.shape,
    handler: async (
      args: z.infer<typeof CancelChallengeSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_cancel_challenge", async () => {
        const { cancelChallenge } = await import(
          "@/lib/chess/challenge-manager"
        );
        await cancelChallenge(args.challenge_id, args.player_id);
        return textResult(
          `**Challenge Cancelled**\n\nChallenge ${args.challenge_id} has been cancelled.`,
        );
      }),
  });

  registry.register({
    name: "chess_list_challenges",
    description: "List your pending chess challenges.",
    category: "chess-challenge",
    tier: "free",
    annotations: { readOnlyHint: true },
    inputSchema: ListChallengesSchema.shape,
    handler: async (
      args: z.infer<typeof ListChallengesSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("chess_list_challenges", async () => {
        const { listChallenges } = await import(
          "@/lib/chess/challenge-manager"
        );
        const challenges = await listChallenges(
          args.player_id,
          args.status,
        );
        if (challenges.length === 0) {
          return textResult("**No challenges found.**");
        }
        const lines = challenges.map(
          (c: {
            id: string;
            status: string;
            senderId: string;
            receiverId: string;
            timeControl: string;
          }) =>
            `- **${c.id}** — ${c.status} (${c.timeControl}) sender: ${c.senderId}, receiver: ${c.receiverId}`,
        );
        return textResult(
          `**Challenges (${challenges.length})**\n\n${lines.join("\n")}`,
        );
      }),
  });
}
