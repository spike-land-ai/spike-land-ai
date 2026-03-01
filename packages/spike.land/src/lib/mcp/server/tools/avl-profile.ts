/**
 * AVL Profile Tree MCP Tools
 *
 * User profiling via binary yes/no questions organized in an AVL tree.
 * Each leaf holds one user; collisions trigger AI-generated differentiating questions.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool, workspaceTool } from "../tool-builder/procedures.js";

export function registerAvlProfileTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("profile_start", "Begin user profiling. Returns the first yes/no question, or the existing profile if already profiled.", {
                tree_name: z
                    .string()
                    .optional()
                    .default("default")
                    .describe("Name of the profile tree (default: 'default')."),
            })
            .meta({ category: "avl-profile", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

                const { startTraversal } = await import("@/lib/avl-profile/traversal");
                const result = await startTraversal(userId, args.tree_name);

                if (result.status === "ALREADY_PROFILED" && result.profile) {
                    return textResult(
                        `**Already Profiled**\n\n`
                        + `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n`
                        + `**Leaf Node:** ${result.profile.leafNodeId}\n`
                        + `**Answers:** ${result.profile.answerPath.length} questions answered`,
                    );
                }

                if (result.status === "ASSIGNED" && result.profile) {
                    return textResult(
                        `**Profile Created** (first user in tree)\n\n`
                        + `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n`
                        + `**Leaf Node:** ${result.profile.leafNodeId}`,
                    );
                }

                return textResult(
                    `**Profiling Started**\n\n`
                    + `**Session ID:** ${result.sessionId}\n`
                    + `**Question:** ${result.question}\n`
                    + `**Tags:** ${result.questionTags?.join(", ") || "none"}\n\n`
                    + `Answer with \`profile_answer\` (yes = true, no = false).`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("profile_continue", "Continue profiling for a returning user. If the tree has grown since their last visit, returns a new question. Otherwise returns their existing profile.", {
                tree_name: z
                    .string()
                    .optional()
                    .default("default")
                    .describe("Name of the profile tree (default: 'default')."),
            })
            .meta({ category: "avl-profile", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

                const { continueTraversal } = await import(
                    "@/lib/avl-profile/traversal"
                );
                const result = await continueTraversal(userId, args.tree_name);

                if (result.status === "ALREADY_PROFILED" && result.profile) {
                    return textResult(
                        `**Already Profiled** (Round ${result.round ?? 0})\n\n`
                        + `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n`
                        + `**Leaf Node:** ${result.profile.leafNodeId}\n`
                        + `**Answers:** ${result.profile.answerPath.length} questions answered`,
                    );
                }

                if (result.status === "ASSIGNED" && result.profile) {
                    return textResult(
                        `**Profile Created** (first user in tree)\n\n`
                        + `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n`
                        + `**Leaf Node:** ${result.profile.leafNodeId}`,
                    );
                }

                return textResult(
                    `**New Questions Available** (Round ${result.round ?? 0})\n\n`
                    + `**Session ID:** ${result.sessionId}\n`
                    + `**Question:** ${result.question}\n`
                    + `**Tags:** ${result.questionTags?.join(", ") || "none"}\n\n`
                    + `Answer with \`profile_answer\` (yes = true, no = false).`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("profile_answer", "Answer yes/no to the current profiling question. Returns the next question or final profile assignment.", {
                session_id: z.string().min(1).describe("Active traversal session ID."),
                answer: z.boolean().describe(
                    "Yes (true) or No (false) to the current question.",
                ),
            })
            .meta({ category: "avl-profile", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

                const { answerQuestion } = await import("@/lib/avl-profile/traversal");
                const result = await answerQuestion(
                    userId,
                    args.session_id,
                    args.answer,
                );

                if (result.status === "ASSIGNED" && result.profile) {
                    return textResult(
                        `**Profile Assigned**\n\n`
                        + `**Tags:** ${result.profile.derivedTags.join(", ") || "none"}\n`
                        + `**Leaf Node:** ${result.profile.leafNodeId}\n`
                        + `**Answers:** ${result.profile.answerPath.length} questions answered\n`
                        + `**Round:** ${result.round ?? 0}`,
                    );
                }

                if (result.status === "COLLISION") {
                    return textResult(
                        `**Collision Detected**\n\n`
                        + `**Session ID:** ${result.sessionId}\n`
                        + `**Node ID:** ${result.nodeId}\n\n`
                        + `Another user occupies this leaf. Use \`profile_generate_question\` to resolve the collision.`,
                    );
                }

                return textResult(
                    `**Next Question**\n\n`
                    + `**Session ID:** ${result.sessionId}\n`
                    + `**Question:** ${result.question}\n`
                    + `**Tags:** ${result.questionTags?.join(", ") || "none"}\n\n`
                    + `Answer with \`profile_answer\` (yes = true, no = false).`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("profile_get", "Get the current user's AVL profile including leaf assignment, answer path, and derived tags.", {})
            .meta({ category: "avl-profile", tier: "free" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                const { getUserProfile } = await import("@/lib/avl-profile/traversal");
                const profile = await getUserProfile(userId);

                if (!profile) {
                    return textResult(
                        "**No Profile Found**\n\nUse `profile_start` to begin profiling.",
                    );
                }

                const answersFormatted = profile.answerPath
                    .map(
                        a =>
                            `- ${a.question} → **${a.answer ? "Yes" : "No"}** (tags: ${a.questionTags.join(", ")
                            })`,
                    )
                    .join("\n");

                return textResult(
                    `**User Profile**\n\n`
                    + `**Tags:** ${profile.derivedTags.join(", ") || "none"}\n`
                    + `**Leaf Node:** ${profile.leafNodeId}\n`
                    + `**Tree:** ${profile.treeId}\n\n`
                    + `**Round:** ${profile.profileRound ?? 0}\n\n`
                    + `**Answer Path:**\n${answersFormatted || "No answers recorded"}`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("profile_tree_stats", "Get statistics about the AVL profile tree: node count, user count, depth, balance.", {
                tree_name: z
                    .string()
                    .optional()
                    .default("default")
                    .describe("Name of the profile tree (default: 'default')."),
            })
            .meta({ category: "avl-profile", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

                const { getTreeStats } = await import(
                    "@/lib/avl-profile/tree-manager"
                );
                const stats = await getTreeStats(args.tree_name);

                return textResult(
                    `**AVL Profile Tree: ${stats.name}**\n\n`
                    + `| Metric | Value |\n`
                    + `|--------|-------|\n`
                    + `| Total Nodes | ${stats.nodeCount} |\n`
                    + `| Internal Nodes | ${stats.internalNodes} |\n`
                    + `| Leaf Nodes | ${stats.leafNodes} |\n`
                    + `| Occupied Leaves | ${stats.occupiedLeaves} |\n`
                    + `| Empty Leaves | ${stats.emptyLeaves} |\n`
                    + `| Users | ${stats.userCount} |\n`
                    + `| Max Depth | ${stats.maxDepth} |`,
                );
            })
    );

    registry.registerBuilt(
        workspaceTool(userId)
            .tool("profile_generate_question", "Admin tool: generate a differentiating question for collision resolution.", {
                used_questions: z
                    .array(z.string())
                    .optional()
                    .default([])
                    .describe("List of already-used question strings to avoid duplicates."),
                context_hint: z
                    .string()
                    .optional()
                    .describe("Optional context hint for better question generation."),
            })
            .meta({ category: "avl-profile", tier: "workspace" })
            .handler(async ({ input, ctx: _ctx }) => {
                const args = input;

                const { generateDifferentiatingQuestion } = await import(
                    "@/lib/avl-profile/question-generator"
                );
                const question = await generateDifferentiatingQuestion(
                    [],
                    args.used_questions,
                    args.context_hint,
                );

                return textResult(
                    `**Generated Question**\n\n`
                    + `**Question:** ${question.question}\n`
                    + `**Tags:** ${question.tags.join(", ")}`,
                );
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("profile_reset", "Remove the current user's profile from the AVL tree, freeing their leaf node for re-profiling.", {})
            .meta({ category: "avl-profile", tier: "free" })
            .handler(async ({ input: _input, ctx: _ctx }) => {
                const { resetUserProfile } = await import(
                    "@/lib/avl-profile/traversal"
                );
                await resetUserProfile(userId);

                return textResult(
                    "**Profile Reset**\n\nYour profile has been removed. Use `profile_start` to begin re-profiling.",
                );
            })
    );
}
