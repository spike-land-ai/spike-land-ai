/**
 * beUniq — Standalone MCP Tool Definitions
 *
 * User profiling via AVL tree binary questions, social features,
 * leaderboards, profile sharing, comparison, and personality insights.
 * 11 tools total.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ServerContext, StandaloneToolDefinition } from "../shared/types";
import { safeToolCall, textResult } from "../shared/tool-helpers";

// ─── AVL Profile Tools ──────────────────────────────────────────────────────

const profileStart: StandaloneToolDefinition = {
  name: "profile_start",
  description:
    "Begin user profiling. Returns the first yes/no question, or the existing profile if already profiled.",
  category: "avl-profile",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {
    tree_name: z
      .string()
      .optional()
      .default("default")
      .describe("Name of the profile tree (default: 'default')."),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { tree_name } = input as { tree_name?: string };
    return safeToolCall("profile_start", async () => {
      const { startTraversal } = await import("@/lib/avl-profile/traversal");
      const result = await startTraversal(ctx.userId, tree_name ?? "default");

      if (result.status === "ALREADY_PROFILED" && result.profile) {
        return textResult(
          `**Already Profiled**\n\n` +
            `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n` +
            `**Leaf Node:** ${result.profile.leafNodeId}\n` +
            `**Answers:** ${result.profile.answerPath.length} questions answered`,
        );
      }

      if (result.status === "ASSIGNED" && result.profile) {
        return textResult(
          `**Profile Created** (first user in tree)\n\n` +
            `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n` +
            `**Leaf Node:** ${result.profile.leafNodeId}`,
        );
      }

      return textResult(
        `**Profiling Started**\n\n` +
          `**Session ID:** ${result.sessionId}\n` +
          `**Question:** ${result.question}\n` +
          `**Tags:** ${result.questionTags?.join(", ") || "none"}\n\n` +
          `Answer with \`profile_answer\` (yes = true, no = false).`,
      );
    });
  },
};

const profileContinue: StandaloneToolDefinition = {
  name: "profile_continue",
  description:
    "Continue profiling for a returning user. If the tree has grown since their last visit, returns a new question. Otherwise returns their existing profile.",
  category: "avl-profile",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {
    tree_name: z
      .string()
      .optional()
      .default("default")
      .describe("Name of the profile tree (default: 'default')."),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { tree_name } = input as { tree_name?: string };
    return safeToolCall("profile_continue", async () => {
      const { continueTraversal } = await import("@/lib/avl-profile/traversal");
      const result = await continueTraversal(ctx.userId, tree_name ?? "default");

      if (result.status === "ALREADY_PROFILED" && result.profile) {
        return textResult(
          `**Already Profiled** (Round ${result.round ?? 0})\n\n` +
            `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n` +
            `**Leaf Node:** ${result.profile.leafNodeId}\n` +
            `**Answers:** ${result.profile.answerPath.length} questions answered`,
        );
      }

      if (result.status === "ASSIGNED" && result.profile) {
        return textResult(
          `**Profile Created** (first user in tree)\n\n` +
            `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n` +
            `**Leaf Node:** ${result.profile.leafNodeId}`,
        );
      }

      return textResult(
        `**New Questions Available** (Round ${result.round ?? 0})\n\n` +
          `**Session ID:** ${result.sessionId}\n` +
          `**Question:** ${result.question}\n` +
          `**Tags:** ${result.questionTags?.join(", ") || "none"}\n\n` +
          `Answer with \`profile_answer\` (yes = true, no = false).`,
      );
    });
  },
};

const profileAnswer: StandaloneToolDefinition = {
  name: "profile_answer",
  description:
    "Answer yes/no to the current profiling question. Returns the next question or final profile assignment.",
  category: "avl-profile",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {
    session_id: z.string().min(1).describe("Active traversal session ID."),
    answer: z.boolean().describe("Yes (true) or No (false) to the current question."),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { session_id, answer } = input as { session_id: string; answer: boolean };
    return safeToolCall("profile_answer", async () => {
      const { answerQuestion } = await import("@/lib/avl-profile/traversal");
      const result = await answerQuestion(ctx.userId, session_id, answer);

      if (result.status === "ASSIGNED" && result.profile) {
        return textResult(
          `**Profile Assigned**\n\n` +
            `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n` +
            `**Leaf Node:** ${result.profile.leafNodeId}\n` +
            `**Answers:** ${result.profile.answerPath.length} questions answered\n` +
            `**Round:** ${result.round ?? 0}`,
        );
      }

      if (result.status === "COLLISION") {
        return textResult(
          `**Collision Detected**\n\n` +
            `**Session ID:** ${result.sessionId}\n` +
            `**Node ID:** ${result.nodeId}\n\n` +
            `Another user occupies this leaf. Use \`profile_generate_question\` to resolve the collision.`,
        );
      }

      return textResult(
        `**Next Question**\n\n` +
          `**Session ID:** ${result.sessionId}\n` +
          `**Question:** ${result.question}\n` +
          `**Tags:** ${result.questionTags?.join(", ") || "none"}\n\n` +
          `Answer with \`profile_answer\` (yes = true, no = false).`,
      );
    });
  },
};

const profileGet: StandaloneToolDefinition = {
  name: "profile_get",
  description:
    "Get the current user's AVL profile including leaf assignment, answer path, and derived tags.",
  category: "avl-profile",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {},
  handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> => {
    return safeToolCall("profile_get", async () => {
      const { getUserProfile } = await import("@/lib/avl-profile/traversal");
      const profile = await getUserProfile(ctx.userId);

      if (!profile) {
        return textResult("**No Profile Found**\n\nUse `profile_start` to begin profiling.");
      }

      const answersFormatted = profile.answerPath
        .map(
          (a: { question: string; answer: boolean; questionTags: string[] }) =>
            `- ${a.question} → **${a.answer ? "Yes" : "No"}** (tags: ${a.questionTags.join(", ")})`,
        )
        .join("\n");

      return textResult(
        `**User Profile**\n\n` +
          `**Tags:** ${profile.derivedTags.join(", ") || "none"}\n` +
          `**Leaf Node:** ${profile.leafNodeId}\n` +
          `**Tree:** ${profile.treeId}\n\n` +
          `**Round:** ${profile.profileRound ?? 0}\n\n` +
          `**Answer Path:**\n${answersFormatted || "No answers recorded"}`,
      );
    });
  },
};

const profileTreeStats: StandaloneToolDefinition = {
  name: "profile_tree_stats",
  description: "Get statistics about the AVL profile tree: node count, user count, depth, balance.",
  category: "avl-profile",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {
    tree_name: z
      .string()
      .optional()
      .default("default")
      .describe("Name of the profile tree (default: 'default')."),
  },
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { tree_name } = input as { tree_name?: string };
    return safeToolCall("profile_tree_stats", async () => {
      const { getTreeStats } = await import("@/lib/avl-profile/tree-manager");
      const stats = await getTreeStats(tree_name ?? "default");

      return textResult(
        `**AVL Profile Tree: ${stats.name}**\n\n` +
          `| Metric | Value |\n` +
          `|--------|-------|\n` +
          `| Total Nodes | ${stats.nodeCount} |\n` +
          `| Internal Nodes | ${stats.internalNodes} |\n` +
          `| Leaf Nodes | ${stats.leafNodes} |\n` +
          `| Occupied Leaves | ${stats.occupiedLeaves} |\n` +
          `| Empty Leaves | ${stats.emptyLeaves} |\n` +
          `| Users | ${stats.userCount} |\n` +
          `| Max Depth | ${stats.maxDepth} |`,
      );
    });
  },
};

const profileGenerateQuestion: StandaloneToolDefinition = {
  name: "profile_generate_question",
  description: "Admin tool: generate a differentiating question for collision resolution.",
  category: "avl-profile",
  tier: "workspace",
  inputSchema: {
    used_questions: z
      .array(z.string())
      .optional()
      .default([])
      .describe("List of already-used question strings to avoid duplicates."),
    context_hint: z
      .string()
      .optional()
      .describe("Optional context hint for better question generation."),
  },
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { used_questions, context_hint } = input as {
      used_questions?: string[];
      context_hint?: string;
    };
    return safeToolCall("profile_generate_question", async () => {
      const { generateDifferentiatingQuestion } = await import(
        "@/lib/avl-profile/question-generator"
      );
      const question = await generateDifferentiatingQuestion(
        [],
        used_questions ?? [],
        context_hint,
      );

      return textResult(
        `**Generated Question**\n\n` +
          `**Question:** ${question.question}\n` +
          `**Tags:** ${question.tags.join(", ")}`,
      );
    });
  },
};

const profileReset: StandaloneToolDefinition = {
  name: "profile_reset",
  description:
    "Remove the current user's profile from the AVL tree, freeing their leaf node for re-profiling.",
  category: "avl-profile",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {},
  handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> => {
    return safeToolCall("profile_reset", async () => {
      const { resetUserProfile } = await import("@/lib/avl-profile/traversal");
      await resetUserProfile(ctx.userId);

      return textResult(
        "**Profile Reset**\n\nYour profile has been removed. Use `profile_start` to begin re-profiling.",
      );
    });
  },
};

// ─── AVL Social Tools ───────────────────────────────────────────────────────

interface AnswerStep {
  question: string;
  answer: boolean;
  questionTags: string[];
}

interface ProfileRow {
  userId: string;
  user: { name: string | null; email: string | null };
  leafNodeId: string;
  answerPath: AnswerStep[];
  derivedTags: string[];
  completedAt: Date;
  createdAt: Date;
}

function leafDepth(leafNodeId: string): number {
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

const profileGetLeaderboard: StandaloneToolDefinition = {
  name: "profile_get_leaderboard",
  description:
    "Get a ranked leaderboard of the most unique beUniq players, ordered by depth in the AVL profile tree.",
  category: "avl-social",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {
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
  },
  handler: async (input: never, _ctx: ServerContext): Promise<CallToolResult> => {
    const { limit = 10, sort_by = "depth" } = input as {
      limit?: number;
      sort_by?: "depth" | "speed" | "questions_answered";
    };
    return safeToolCall("profile_get_leaderboard", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const rawProfiles = await prisma.avlUserProfile.findMany({
        include: { user: { select: { name: true, email: true } } },
        take: 200,
      });

      const profiles = rawProfiles.map((p) => ({
        userId: p.userId,
        user: p.user as { name: string | null; email: string | null },
        leafNodeId: p.leafNodeId,
        answerPath: p.answerPath as unknown as AnswerStep[],
        derivedTags: p.derivedTags,
        completedAt: p.completedAt,
        createdAt: (p as unknown as { createdAt: Date }).createdAt,
      }));

      const enriched = profiles.map((p) => ({
        depth: leafDepth(p.leafNodeId),
        questions: p.answerPath.length,
        completedAt: p.completedAt,
        name: resolveDisplayName(p),
      }));

      if (sort_by === "speed") {
        enriched.sort((a, b) => a.questions - b.questions);
      } else if (sort_by === "questions_answered") {
        enriched.sort((a, b) => b.questions - a.questions);
      } else {
        enriched.sort((a, b) => b.depth - a.depth || b.questions - a.questions);
      }

      const entries = enriched.slice(0, limit).map((e, i) => ({
        rank: i + 1,
        displayName: e.name,
        uniquenessDepth: e.depth,
        totalQuestions: e.questions,
        dateAchieved: e.completedAt.toISOString().split("T")[0] ?? "",
      }));

      if (entries.length === 0) {
        return textResult("**beUniq Leaderboard**\n\nNo completed profiles yet. Be the first!");
      }

      const header =
        `**beUniq Leaderboard** (sorted by: ${sort_by})\n\n` +
        `| Rank | Player | Depth | Questions | Date |\n` +
        `|------|--------|-------|-----------|------|\n`;

      const rows = entries
        .map(
          (e) =>
            `| ${e.rank} | ${e.displayName} | ${e.uniquenessDepth} | ${e.totalQuestions} | ${e.dateAchieved} |`,
        )
        .join("\n");

      return textResult(header + rows);
    });
  },
};

const profileShareResult: StandaloneToolDefinition = {
  name: "profile_share_result",
  description:
    "Generate a shareable representation of your beUniq uniqueness result as text, a visual card, or a link.",
  category: "avl-social",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {
    format: z
      .enum(["text", "card", "link"])
      .optional()
      .default("text")
      .describe(
        "Output format: 'text' (plain summary), 'card' (rich formatted card), 'link' (shareable URL).",
      ),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { format = "text" } = input as { format?: "text" | "card" | "link" };
    return safeToolCall("profile_share_result", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const rawProfile = await prisma.avlUserProfile.findUnique({
        where: { userId: ctx.userId },
        include: { user: { select: { name: true, email: true } } },
      });

      if (!rawProfile) {
        return textResult(
          "**No Completed Profile**\n\nComplete your profile first with `profile_start`.",
        );
      }

      const profile: ProfileRow = {
        userId: rawProfile.userId,
        user: rawProfile.user as { name: string | null; email: string | null },
        leafNodeId: rawProfile.leafNodeId,
        answerPath: rawProfile.answerPath as unknown as AnswerStep[],
        derivedTags: rawProfile.derivedTags,
        completedAt: rawProfile.completedAt,
        createdAt: (rawProfile as unknown as { createdAt: Date }).createdAt,
      };

      const depth = leafDepth(profile.leafNodeId);
      const name = resolveDisplayName(profile);
      const totalQuestions = profile.answerPath.length;
      const tags = profile.derivedTags;

      if (format === "link") {
        return textResult(
          `**Share Your Profile**\n\nhttps://spike.land/beuniq/profile/${ctx.userId}?depth=${depth}`,
        );
      }

      if (format === "card") {
        const card =
          `\u2554\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2557\n` +
          `\u2551         beUniq Profile Card          \u2551\n` +
          `\u2560\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2563\n` +
          `\u2551  Player:    ${name.padEnd(25)}\u2551\n` +
          `\u2551  Depth:     ${String(depth).padEnd(25)}\u2551\n` +
          `\u2551  Questions: ${String(totalQuestions).padEnd(25)}\u2551\n` +
          `\u2551  Tags:      ${(tags.slice(0, 3).join(", ") || "none").padEnd(25)}\u2551\n` +
          `\u255a\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u255d\n` +
          `spike.land/beuniq`;
        return textResult(`**beUniq Profile Card**\n\n\`\`\`\n${card}\n\`\`\``);
      }

      return textResult(
        `**Share Your Result**\n\n` +
          `I am uniquely me at depth ${depth} on the beUniq tree!\n\n` +
          `Personality tags: ${tags.join(", ") || "none"}\n` +
          `Questions answered: ${totalQuestions}\n\n` +
          `Discover your uniqueness at spike.land/beuniq`,
      );
    });
  },
};

const profileCompare: StandaloneToolDefinition = {
  name: "profile_compare",
  description:
    "Compare your AVL profile path with another player to find common answers, divergence point, and personality overlap.",
  category: "avl-social",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {
    other_user_id: z.string().min(1).describe("User ID of the other player to compare against."),
  },
  handler: async (input: never, ctx: ServerContext): Promise<CallToolResult> => {
    const { other_user_id } = input as { other_user_id: string };
    return safeToolCall("profile_compare", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const [rawMine, rawOther] = await Promise.all([
        prisma.avlUserProfile.findUnique({
          where: { userId: ctx.userId },
          include: { user: { select: { name: true, email: true } } },
        }),
        prisma.avlUserProfile.findUnique({
          where: { userId: other_user_id },
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
          `**Other Player Not Found**\n\nNo completed profile for user \`${other_user_id}\`.`,
        );
      }

      const toRow = (r: NonNullable<typeof rawMine>): ProfileRow => ({
        userId: r.userId,
        user: r.user as { name: string | null; email: string | null },
        leafNodeId: r.leafNodeId,
        answerPath: r.answerPath as unknown as AnswerStep[],
        derivedTags: r.derivedTags,
        completedAt: r.completedAt,
        createdAt: (r as unknown as { createdAt: Date }).createdAt,
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
      const sharedTags = [...myTags].filter((t) => theirTags.has(t));
      const totalUniqueTags = new Set([...myTags, ...theirTags]).size;
      const overlapPct =
        totalUniqueTags > 0 ? Math.round((sharedTags.length / totalUniqueTags) * 100) : 0;

      const divergenceQuestion =
        divergenceIndex < minLen
          ? myPath[divergenceIndex]!.question
          : "Paths are identical through all shared questions";

      const otherName = resolveDisplayName(otherProfile);

      return textResult(
        `**Profile Comparison**\n\n` +
          `**Comparing with:** ${otherName}\n\n` +
          `| Metric | Value |\n` +
          `|--------|-------|\n` +
          `| Common answers | ${commonCount} |\n` +
          `| Divergence at question | ${divergenceIndex + 1} |\n` +
          `| Personality overlap | ${overlapPct}% |\n` +
          `| Shared tags | ${sharedTags.join(", ") || "none"} |\n\n` +
          `**Divergence point:** "${divergenceQuestion}"`,
      );
    });
  },
};

const profileGetInsights: StandaloneToolDefinition = {
  name: "profile_get_insights",
  description:
    "Get personality insights derived from your beUniq answer pattern: dominant traits, tag confidence scores, rare combinations, and a fun uniqueness fact.",
  category: "avl-social",
  tier: "free",
  alwaysEnabled: true,
  inputSchema: {},
  handler: async (_input: never, ctx: ServerContext): Promise<CallToolResult> => {
    return safeToolCall("profile_get_insights", async () => {
      const prisma = (await import("@/lib/prisma")).default;

      const rawProfile = await prisma.avlUserProfile.findUnique({
        where: { userId: ctx.userId },
      });

      if (!rawProfile) {
        return textResult("**No Profile**\n\nComplete profiling first with `profile_start`.");
      }

      const tags = rawProfile.derivedTags;
      const answerPath = rawProfile.answerPath as unknown as AnswerStep[];
      const confidence = tagConfidence(tags, answerPath);

      const sorted = [...tags].sort((a, b) => (confidence[b] ?? 0) - (confidence[a] ?? 0));
      const dominant = sorted.slice(0, 3);
      const rare = sorted.slice(-2).filter((t) => (confidence[t] ?? 0) < 40);

      const depth = leafDepth(rawProfile.leafNodeId);
      const totalUsers = await prisma.avlUserProfile.count();
      const rarity = totalUsers > 0 ? `1 in ${totalUsers}` : "uniquely you";

      const confidenceLines = sorted
        .map((t) => `- **${t}**: ${confidence[t] ?? 0}% confidence`)
        .join("\n");

      return textResult(
        `**Personality Insights**\n\n` +
          `**Dominant Traits:** ${dominant.join(", ") || "none"}\n\n` +
          `**Tag Confidence Scores:**\n${confidenceLines || "No tags yet"}\n\n` +
          `**Rare Combinations:** ${rare.join(", ") || "none identified"}\n\n` +
          `**Fun Fact:** You sit at depth ${depth} in the beUniq tree. ` +
          `Your exact personality path is ${rarity} among all profiled players.`,
      );
    });
  },
};

// ─── Export ──────────────────────────────────────────────────────────────────

export const beUniqTools: StandaloneToolDefinition[] = [
  // AVL Profile (7)
  profileStart,
  profileContinue,
  profileAnswer,
  profileGet,
  profileTreeStats,
  profileGenerateQuestion,
  profileReset,
  // AVL Social (4)
  profileGetLeaderboard,
  profileShareResult,
  profileCompare,
  profileGetInsights,
];
