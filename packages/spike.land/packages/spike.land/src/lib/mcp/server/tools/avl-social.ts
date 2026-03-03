/**
 * AVL Social MCP Tools
 *
 * Social and leaderboard features for the beUniq profiling system.
 * Builds on AVL profile tree data to surface uniqueness rankings,
 * shareable results, profile comparisons, and personality insights.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const LeaderboardSchema = z.object({
  limit: z
    .number()
    .min(5)
    .max(50)
    .optional()
    .default(10)
    .describe("Number of entries to return (5–50, default 10)."),
  sort_by: z
    .enum(["depth", "speed", "questions_answered"])
    .optional()
    .default("depth")
    .describe(
      "Sort criterion: 'depth' (uniqueness depth in tree), 'speed' (fastest to profile), 'questions_answered'.",
    ),
});

const ShareResultSchema = z.object({
  format: z
    .enum(["text", "card", "link"])
    .optional()
    .default("text")
    .describe(
      "Output format: 'text' (plain summary), 'card' (rich formatted card), 'link' (shareable URL).",
    ),
});

const CompareSchema = z.object({
  other_user_id: z
    .string()
    .min(1)
    .describe("User ID of the other player to compare against."),
});

const InsightsSchema = z.object({});

// ---------------------------------------------------------------------------
// Types for Prisma result shapes (avoids `unknown` loss of information)
// ---------------------------------------------------------------------------

interface AnswerStep {
  question: string;
  answer: boolean;
  questionTags: string[];
}

interface ProfileRow {
  userId: string;
  user: { name: string | null; email: string | null; };
  leafNodeId: string;
  answerPath: AnswerStep[];
  derivedTags: string[];
  completedAt: Date;
  createdAt: Date;
}

interface LeaderboardEntry {
  rank: number;
  displayName: string;
  uniquenessDepth: number;
  totalQuestions: number;
  dateAchieved: string;
}

// ---------------------------------------------------------------------------
// Pure helper functions
// ---------------------------------------------------------------------------

function leafDepth(leafNodeId: string): number {
  // Node IDs encode depth via their path length: "leaf-3-2-1" -> 3 separators -> depth 3
  const parts = leafNodeId.split("-");
  return parts.length > 1 ? parts.length - 1 : 1;
}

function resolveDisplayName(row: ProfileRow): string {
  return row.user.name ?? row.user.email?.split("@")[0] ?? `user_${row.userId.slice(0, 6)}`;
}

function tagConfidence(tags: string[], answerPath: AnswerStep[]): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const step of answerPath) {
    for (const tag of step.questionTags) {
      counts[tag] = (counts[tag] ?? 0) + (step.answer ? 1 : 0);
    }
  }
  const total = answerPath.length || 1;
  const result: Record<string, number> = {};
  for (const tag of tags) {
    result[tag] = Math.round(((counts[tag] ?? 0) / total) * 100);
  }
  return result;
}

function buildShareText(
  depth: number,
  tags: string[],
  totalQuestions: number,
): string {
  return (
    `I am uniquely me at depth ${depth} on the beUniq tree!\n\n`
    + `Personality tags: ${tags.join(", ") || "none"}\n`
    + `Questions answered: ${totalQuestions}\n\n`
    + `Discover your uniqueness at spike.land/beuniq`
  );
}

function buildShareCard(
  name: string,
  depth: number,
  tags: string[],
  totalQuestions: number,
): string {
  return (
    `╔══════════════════════════════════════╗\n`
    + `║         beUniq Profile Card          ║\n`
    + `╠══════════════════════════════════════╣\n`
    + `║  Player:    ${name.padEnd(25)}║\n`
    + `║  Depth:     ${String(depth).padEnd(25)}║\n`
    + `║  Questions: ${String(totalQuestions).padEnd(25)}║\n`
    + `║  Tags:      ${(tags.slice(0, 3).join(", ") || "none").padEnd(25)}║\n`
    + `╚══════════════════════════════════════╝\n`
    + `spike.land/beuniq`
  );
}

function buildShareLink(uid: string, depth: number): string {
  return `https://spike.land/beuniq/profile/${uid}?depth=${depth}`;
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------

export function registerAvlSocialTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // --------------------------------------------------------------------
  // profile_get_leaderboard
  // --------------------------------------------------------------------
  registry.register({
    name: "profile_get_leaderboard",
    description:
      "Get a ranked leaderboard of the most unique beUniq players, ordered by depth in the AVL profile tree.",
    category: "avl-social",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: LeaderboardSchema.shape,
    handler: async (
      args: z.infer<typeof LeaderboardSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("profile_get_leaderboard", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        // Fetch profiles with user info; cap at 200 to avoid full table scan.
        const rawProfiles = await prisma.avlUserProfile.findMany({
          include: { user: { select: { name: true, email: true } } },
          take: 200,
        });

        const profiles = rawProfiles.map(p => ({
          userId: p.userId,
          user: p.user as { name: string | null; email: string | null; },
          leafNodeId: p.leafNodeId,
          answerPath: p.answerPath as unknown as AnswerStep[],
          derivedTags: p.derivedTags,
          completedAt: p.completedAt,
          createdAt: (p as unknown as { createdAt: Date; }).createdAt,
        }));

        const enriched = profiles.map(p => ({
          depth: leafDepth(p.leafNodeId),
          questions: p.answerPath.length,
          completedAt: p.completedAt,
          name: resolveDisplayName(p),
        }));

        if (args.sort_by === "speed") {
          enriched.sort((a, b) => a.questions - b.questions);
        } else if (args.sort_by === "questions_answered") {
          enriched.sort((a, b) => b.questions - a.questions);
        } else {
          enriched.sort((a, b) => b.depth - a.depth || b.questions - a.questions);
        }

        const entries: LeaderboardEntry[] = enriched
          .slice(0, args.limit)
          .map((e, i) => ({
            rank: i + 1,
            displayName: e.name,
            uniquenessDepth: e.depth,
            totalQuestions: e.questions,
            dateAchieved: e.completedAt.toISOString().split("T")[0] ?? "",
          }));

        if (entries.length === 0) {
          return textResult(
            "**beUniq Leaderboard**\n\nNo completed profiles yet. Be the first!",
          );
        }

        const header = `**beUniq Leaderboard** (sorted by: ${args.sort_by})\n\n`
          + `| Rank | Player | Depth | Questions | Date |\n`
          + `|------|--------|-------|-----------|------|\n`;

        const rows = entries
          .map(e =>
            `| ${e.rank} | ${e.displayName} | ${e.uniquenessDepth} | ${e.totalQuestions} | ${e.dateAchieved} |`
          )
          .join("\n");

        return textResult(header + rows);
      }),
  });

  // --------------------------------------------------------------------
  // profile_share_result
  // --------------------------------------------------------------------
  registry.register({
    name: "profile_share_result",
    description:
      "Generate a shareable representation of your beUniq uniqueness result as text, a visual card, or a link.",
    category: "avl-social",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: ShareResultSchema.shape,
    handler: async (
      args: z.infer<typeof ShareResultSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("profile_share_result", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const rawProfile = await prisma.avlUserProfile.findUnique({
          where: { userId },
          include: { user: { select: { name: true, email: true } } },
        });

        if (!rawProfile) {
          return textResult(
            "**No Completed Profile**\n\nComplete your profile first with `profile_start`.",
          );
        }

        const profile: ProfileRow = {
          userId: rawProfile.userId,
          user: rawProfile.user as { name: string | null; email: string | null; },
          leafNodeId: rawProfile.leafNodeId,
          answerPath: rawProfile.answerPath as unknown as AnswerStep[],
          derivedTags: rawProfile.derivedTags,
          completedAt: rawProfile.completedAt,
          createdAt: (rawProfile as unknown as { createdAt: Date; }).createdAt,
        };

        const depth = leafDepth(profile.leafNodeId);
        const name = resolveDisplayName(profile);
        const totalQuestions = profile.answerPath.length;
        const tags = profile.derivedTags;

        if (args.format === "link") {
          return textResult(
            `**Share Your Profile**\n\n${buildShareLink(userId, depth)}`,
          );
        }

        if (args.format === "card") {
          return textResult(
            `**beUniq Profile Card**\n\n\`\`\`\n${
              buildShareCard(name, depth, tags, totalQuestions)
            }\n\`\`\``,
          );
        }

        return textResult(
          `**Share Your Result**\n\n${buildShareText(depth, tags, totalQuestions)}`,
        );
      }),
  });

  // --------------------------------------------------------------------
  // profile_compare
  // --------------------------------------------------------------------
  registry.register({
    name: "profile_compare",
    description:
      "Compare your AVL profile path with another player to find common answers, divergence point, and personality overlap.",
    category: "avl-social",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: CompareSchema.shape,
    handler: async (
      args: z.infer<typeof CompareSchema>,
    ): Promise<CallToolResult> =>
      safeToolCall("profile_compare", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const [rawMine, rawOther] = await Promise.all([
          prisma.avlUserProfile.findUnique({
            where: { userId },
            include: { user: { select: { name: true, email: true } } },
          }),
          prisma.avlUserProfile.findUnique({
            where: { userId: args.other_user_id },
            include: { user: { select: { name: true, email: true } } },
          }),
        ]);

        if (!rawMine) {
          return textResult(
            "**No Profile**\n\nYou have not completed profiling yet. Use `profile_start`.",
          );
        }

        if (!rawOther) {
          return textResult(
            `**Other Player Not Found**\n\nNo completed profile for user \`${args.other_user_id}\`.`,
          );
        }

        const toRow = (r: typeof rawMine): ProfileRow => ({
          userId: r.userId,
          user: r.user as { name: string | null; email: string | null; },
          leafNodeId: r.leafNodeId,
          answerPath: r.answerPath as unknown as AnswerStep[],
          derivedTags: r.derivedTags,
          completedAt: r.completedAt,
          createdAt: (r as unknown as { createdAt: Date; }).createdAt,
        });

        const myProfile = toRow(rawMine);
        const otherProfile = toRow(rawOther);

        const myPath = myProfile.answerPath;
        const theirPath = otherProfile.answerPath;
        const minLen = Math.min(myPath.length, theirPath.length);

        let commonCount = 0;
        let divergenceIndex = minLen;

        for (let i = 0; i < minLen; i++) {
          if (myPath[i]!.answer === theirPath[i]!.answer) {
            commonCount++;
          } else {
            divergenceIndex = i;
            break;
          }
        }

        const myTags = new Set(myProfile.derivedTags);
        const theirTags = new Set(otherProfile.derivedTags);
        const sharedTags = [...myTags].filter(t => theirTags.has(t));
        const totalUniqueTags = new Set([...myTags, ...theirTags]).size;
        const overlapPct = totalUniqueTags > 0
          ? Math.round((sharedTags.length / totalUniqueTags) * 100)
          : 0;

        const divergenceQuestion = divergenceIndex < minLen
          ? myPath[divergenceIndex]!.question
          : "Paths are identical through all shared questions";

        const otherName = resolveDisplayName(otherProfile);

        return textResult(
          `**Profile Comparison**\n\n`
            + `**Comparing with:** ${otherName}\n\n`
            + `| Metric | Value |\n`
            + `|--------|-------|\n`
            + `| Common answers | ${commonCount} |\n`
            + `| Divergence at question | ${divergenceIndex + 1} |\n`
            + `| Personality overlap | ${overlapPct}% |\n`
            + `| Shared tags | ${sharedTags.join(", ") || "none"} |\n\n`
            + `**Divergence point:** "${divergenceQuestion}"`,
        );
      }),
  });

  // --------------------------------------------------------------------
  // profile_get_insights
  // --------------------------------------------------------------------
  registry.register({
    name: "profile_get_insights",
    description:
      "Get personality insights derived from your beUniq answer pattern: dominant traits, tag confidence scores, rare combinations, and a fun uniqueness fact.",
    category: "avl-social",
    tier: "free",
    alwaysEnabled: true,
    inputSchema: InsightsSchema.shape,
    handler: async (): Promise<CallToolResult> =>
      safeToolCall("profile_get_insights", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const rawProfile = await prisma.avlUserProfile.findUnique({
          where: { userId },
        });

        if (!rawProfile) {
          return textResult(
            "**No Profile**\n\nComplete profiling first with `profile_start`.",
          );
        }

        const tags = rawProfile.derivedTags;
        const answerPath = rawProfile.answerPath as unknown as AnswerStep[];
        const confidence = tagConfidence(tags, answerPath);

        const sorted = [...tags].sort(
          (a, b) => (confidence[b] ?? 0) - (confidence[a] ?? 0),
        );
        const dominant = sorted.slice(0, 3);
        const rare = sorted.slice(-2).filter(t => (confidence[t] ?? 0) < 40);

        const depth = leafDepth(rawProfile.leafNodeId);
        const totalUsers = await prisma.avlUserProfile.count();
        const rarity = totalUsers > 0 ? `1 in ${totalUsers}` : "uniquely you";

        const confidenceLines = sorted
          .map(t => `- **${t}**: ${confidence[t] ?? 0}% confidence`)
          .join("\n");

        return textResult(
          `**Personality Insights**\n\n`
            + `**Dominant Traits:** ${dominant.join(", ") || "none"}\n\n`
            + `**Tag Confidence Scores:**\n${confidenceLines || "No tags yet"}\n\n`
            + `**Rare Combinations:** ${rare.join(", ") || "none identified"}\n\n`
            + `**Fun Fact:** You sit at depth ${depth} in the beUniq tree. `
            + `Your exact personality path is ${rarity} among all profiled players.`,
        );
      }),
  });
}
