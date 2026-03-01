/**
 * Arena Tools (Server-Side)
 *
 * MCP tools for the AI Prompt Arena — list challenges, submit prompts,
 * review submissions, and check leaderboards.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import prisma from "@/lib/prisma";
import logger from "@/lib/logger";
import { arenaGenerateFromPrompt } from "@/lib/arena/arena-generator";
import { submitReview } from "@/lib/arena/review";
import { freeTool } from "../tool-builder/procedures.js";

export function registerArenaTools(
    registry: ToolRegistry,
    userId: string,
): void {
    // arena_list_challenges
    registry.registerBuilt(
        freeTool(userId)
            .tool("arena_list_challenges", "List open arena challenges for the AI Prompt Arena. Returns challenges with difficulty, category, and submission counts.", {
                status: z
                    .enum(["OPEN", "CLOSED", "ARCHIVED"])
                    .optional()
                    .default("OPEN")
                    .describe("Filter by challenge status"),
                category: z.string().optional().describe("Filter by category"),
                limit: z
                    .number()
                    .min(1)
                    .max(50)
                    .optional()
                    .default(20)
                    .describe("Maximum results"),
            })
            .meta({ category: "arena", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    status,
                    category,
                    limit,
                } = input;

                try {
                    const where: Record<string, unknown> = { status };
                    if (category) where.category = category;

                    const challenges = await prisma.arenaChallenge.findMany({
                        where,
                        orderBy: { createdAt: "desc" },
                        take: limit,
                        include: {
                            _count: { select: { submissions: true } },
                        },
                    });

                    if (challenges.length === 0) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `No ${status.toLowerCase()} challenges found${category ? ` in category "${category}"` : ""
                                        }.`,
                                },
                            ],
                        };
                    }

                    let text = `**${challenges.length} Arena Challenge(s):**\n\n`;
                    for (const c of challenges) {
                        text += `### ${c.title}\n`;
                        text += `- **ID:** \`${c.id}\`\n`;
                        text += `- **Category:** ${c.category} | **Difficulty:** ${c.difficulty}\n`;
                        text += `- **Submissions:** ${c._count.submissions}\n`;
                        text += `- **Description:** ${c.description.slice(0, 200)}${c.description.length > 200 ? "..." : ""
                            }\n\n`;
                    }

                    return { content: [{ type: "text", text }] };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [
                            { type: "text", text: `Error listing challenges: ${msg}` },
                        ],
                        isError: true,
                    };
                }
            })
    );

    // arena_get_challenge_details
    registry.registerBuilt(
        freeTool(userId)
            .tool("arena_get_challenge_details", "Get full details of an arena challenge including submissions and review status.", {
                challenge_id: z.string().min(1).describe("The challenge ID"),
            })
            .meta({ category: "arena", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    challenge_id,
                } = input;

                try {
                    const challenge = await prisma.arenaChallenge.findUnique({
                        where: { id: challenge_id },
                        include: {
                            createdBy: { select: { name: true } },
                            _count: { select: { submissions: true } },
                            submissions: {
                                orderBy: { reviewScore: "desc" },
                                take: 10,
                                select: {
                                    id: true,
                                    status: true,
                                    codespaceUrl: true,
                                    reviewScore: true,
                                    eloChange: true,
                                    iterations: true,
                                    createdAt: true,
                                    user: { select: { name: true } },
                                    _count: { select: { reviews: true } },
                                },
                            },
                        },
                    });

                    if (!challenge) {
                        return {
                            content: [
                                { type: "text", text: `Challenge "${challenge_id}" not found.` },
                            ],
                            isError: true,
                        };
                    }

                    let text = `# ${challenge.title}\n\n`;
                    text +=
                        `**Status:** ${challenge.status} | **Difficulty:** ${challenge.difficulty} | **Category:** ${challenge.category}\n`;
                    text += `**Created by:** ${challenge.createdBy.name || "Unknown"}\n`;
                    text += `**Total submissions:** ${challenge._count.submissions}\n\n`;
                    text += `## Description\n${challenge.description}\n\n`;

                    if (challenge.submissions.length > 0) {
                        text += `## Top Submissions\n\n`;
                        for (const s of challenge.submissions) {
                            const score = s.reviewScore !== null
                                ? `Score: ${(s.reviewScore * 100).toFixed(0)}%`
                                : `Status: ${s.status}`;
                            const elo = s.eloChange !== null
                                ? ` | ELO: ${s.eloChange > 0 ? "+" : ""}${s.eloChange}`
                                : "";
                            text += `- **${s.user.name || "Anonymous"}** (${score}${elo}) — \`${s.id}\``;
                            if (s.codespaceUrl) text += ` [Preview](${s.codespaceUrl})`;
                            text += `\n`;
                        }
                    }

                    return { content: [{ type: "text", text }] };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [
                            { type: "text", text: `Error getting challenge: ${msg}` },
                        ],
                        isError: true,
                    };
                }
            })
    );

    // arena_submit_prompt
    registry.registerBuilt(
        freeTool(userId)
            .tool("arena_submit_prompt", "Submit a prompt to an arena challenge. The system will generate code, transpile, and validate it. Returns a submission ID for tracking.", {
                challenge_id: z.string().min(1).describe("The challenge ID"),
                prompt: z
                    .string()
                    .min(10)
                    .max(10000)
                    .describe("The prompt to generate code from"),
                system_prompt: z
                    .string()
                    .max(5000)
                    .optional()
                    .describe("Optional custom system prompt"),
            })
            .meta({ category: "arena", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    challenge_id,
                    prompt,
                    system_prompt,
                } = input;

                try {
                    // Verify challenge is open
                    const challenge = await prisma.arenaChallenge.findUnique({
                        where: { id: challenge_id },
                        select: { id: true, status: true, title: true },
                    });

                    if (!challenge) {
                        return {
                            content: [
                                { type: "text", text: `Challenge "${challenge_id}" not found.` },
                            ],
                            isError: true,
                        };
                    }

                    if (challenge.status !== "OPEN") {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: `Challenge "${challenge.title}" is ${challenge.status.toLowerCase()}.`,
                                },
                            ],
                            isError: true,
                        };
                    }

                    // Create submission
                    const submission = await prisma.arenaSubmission.create({
                        data: {
                            challengeId: challenge_id,
                            userId,
                            prompt,
                            systemPrompt: system_prompt ?? null,
                            status: "PROMPTED",
                        },
                    });

                    // Kick off generation async
                    arenaGenerateFromPrompt(submission.id).catch(err => {
                        logger.error(`Arena generation failed for ${submission.id}`, {
                            error: err,
                        });
                    });

                    return {
                        content: [
                            {
                                type: "text",
                                text:
                                    `**Submission created!**\n\n- **ID:** \`${submission.id}\`\n- **Challenge:** ${challenge.title}\n- **Status:** Generation starting...\n\nThe code is being generated and will be transpiled automatically. Use \`arena_get_challenge_details\` to check progress.`,
                            },
                        ],
                    };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [
                            { type: "text", text: `Error submitting prompt: ${msg}` },
                        ],
                        isError: true,
                    };
                }
            })
    );

    // arena_review_submission
    registry.registerBuilt(
        freeTool(userId)
            .tool("arena_review_submission", "Review an arena submission. Report bugs, score quality (0-1), and approve/reject. Two reviews trigger automatic scoring.", {
                submission_id: z.string().min(1).describe("The submission ID to review"),
                bugs: z
                    .array(
                        z.object({
                            description: z.string().describe("Bug description"),
                            severity: z
                                .enum(["low", "medium", "high", "critical"])
                                .describe("Bug severity"),
                            line: z.number().optional().describe("Line number if applicable"),
                        }),
                    )
                    .default([])
                    .describe("List of bugs found"),
                score: z.number().min(0).max(1).describe("Quality score from 0 to 1"),
                approved: z.boolean().describe("Whether to approve the submission"),
                comment: z.string().max(2000).optional().describe("Review comment"),
            })
            .meta({ category: "arena", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    submission_id,
                    bugs,
                    score,
                    approved,
                    comment,
                } = input;

                try {
                    const result = await submitReview({
                        submissionId: submission_id,
                        reviewerId: userId,
                        bugs: bugs as any,
                        score,
                        approved,
                        ...(comment !== undefined ? { comment } : {}),
                    });

                    let text = `**Review submitted!**\n\n`;
                    text += `- **Review ID:** \`${result.reviewId}\`\n`;
                    text += `- **Score:** ${(score * 100).toFixed(0)}%\n`;
                    text += `- **Approved:** ${approved ? "Yes" : "No"}\n`;
                    text += `- **Bugs reported:** ${bugs.length}\n`;

                    if (result.scoringTriggered) {
                        text += `\n**Scoring triggered!** Two reviews reached — ELO has been updated.`;
                    }

                    return { content: [{ type: "text", text }] };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [
                            { type: "text", text: `Error submitting review: ${msg}` },
                        ],
                        isError: true,
                    };
                }
            })
    );

    // arena_get_leaderboard
    registry.registerBuilt(
        freeTool(userId)
            .tool("arena_get_leaderboard", "Get the arena ELO leaderboard showing top-ranked prompt engineers.", {
                limit: z
                    .number()
                    .min(1)
                    .max(50)
                    .optional()
                    .default(20)
                    .describe("Number of entries to return"),
            })
            .meta({ category: "arena", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const {
                    limit,
                } = input;

                try {
                    const entries = await prisma.arenaElo.findMany({
                        orderBy: { elo: "desc" },
                        take: limit,
                        include: {
                            user: { select: { name: true } },
                        },
                    });

                    if (entries.length === 0) {
                        return {
                            content: [
                                {
                                    type: "text",
                                    text: "No leaderboard entries yet. Submit prompts to challenges to start ranking!",
                                },
                            ],
                        };
                    }

                    let text = `**Arena Leaderboard (Top ${entries.length})**\n\n`;
                    text += `| Rank | Player | ELO | W/L/D | Streak | Best |\n`;
                    text += `|------|--------|-----|-------|--------|------|\n`;

                    for (let i = 0; i < entries.length; i++) {
                        const e = entries[i]!;
                        const name = e.user.name || "Anonymous";
                        const streak = e.streak > 0
                            ? `+${e.streak}`
                            : e.streak < 0
                                ? `${e.streak}`
                                : "0";
                        text += `| ${i + 1
                            } | ${name} | ${e.elo} | ${e.wins}/${e.losses}/${e.draws} | ${streak} | ${e.bestElo} |\n`;
                    }

                    return { content: [{ type: "text", text }] };
                } catch (error) {
                    const msg = error instanceof Error ? error.message : "Unknown error";
                    return {
                        content: [
                            { type: "text", text: `Error getting leaderboard: ${msg}` },
                        ],
                        isError: true,
                    };
                }
            })
    );
}
