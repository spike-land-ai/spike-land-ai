/**
 * Brand Brain MCP Tools
 *
 * Brand profile management, content scoring, policy checks,
 * content rewriting, and guardrail enforcement.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { resolveWorkspace, safeToolCall, textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures";

export function registerBrandBrainTools(
    registry: ToolRegistry,
    userId: string,
): void {
    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_score_content", "Score content against brand vocabulary and guardrails. Returns a score (0-100) with violations.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                content: z.string().min(1).describe(
                    "Content text to score against brand guidelines.",
                ),
                platform: z.string().optional().describe(
                    "Target platform for scoring context.",
                ),
            })
            .meta({ category: "brand-brain", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("brand_score_content", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const profile = await ctx.prisma.brandProfile.findUnique({
                        where: { workspaceId: workspace.id },
                        include: {
                            vocabulary: true,
                            guardrails: { where: { isActive: true } },
                        },
                    });
                    if (!profile) {
                        return textResult(
                            "**Error: NOT_FOUND**\nNo brand profile found for this workspace.\n**Retryable:** false",
                        );
                    }
                    const contentLower = args.content.toLowerCase();
                    const violations: Array<{ term: string; type: string; }> = [];

                    for (const vocab of profile.vocabulary) {
                        if (
                            vocab.type === "BANNED"
                            && contentLower.includes(vocab.term.toLowerCase())
                        ) {
                            violations.push({ term: vocab.term, type: "BANNED_TERM" });
                        }
                    }

                    for (const guardrail of profile.guardrails) {
                        if (guardrail.type === "PROHIBITED_TOPIC") {
                            const keywords = (guardrail.ruleConfig as Record<string, unknown>)
                                ?.keywords;
                            if (Array.isArray(keywords)) {
                                for (const kw of keywords) {
                                    if (
                                        typeof kw === "string"
                                        && contentLower.includes(kw.toLowerCase())
                                    ) {
                                        violations.push({
                                            term: kw,
                                            type: `GUARDRAIL:${guardrail.name}`,
                                        });
                                    }
                                }
                            }
                        }
                    }

                    const score = Math.max(0, 100 - violations.length * 15);
                    let text = `**Brand Score: ${score}/100**\n\n`;
                    if (args.platform) text += `**Platform:** ${args.platform}\n`;
                    text += `**Violations:** ${violations.length}\n\n`;
                    if (violations.length > 0) {
                        text += `| Term | Type |\n|------|------|\n`;
                        for (const v of violations) {
                            text += `| ${v.term} | ${v.type} |\n`;
                        }
                    } else {
                        text += "Content passes all brand checks.";
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_rewrite_content", "Submit content for brand-aligned rewriting. Creates a rewrite job.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                content: z.string().min(1).describe("Content text to rewrite."),
                platform: z.string().optional().default("GENERAL").describe(
                    "Target platform (default: GENERAL).",
                ),
                character_limit: z.number().optional().describe(
                    "Maximum character count for rewrite.",
                ),
            })
            .meta({ category: "brand-brain", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("brand_rewrite_content", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const profile = await ctx.prisma.brandProfile.findUnique({
                        where: { workspaceId: workspace.id },
                        select: { id: true },
                    });
                    if (!profile) {
                        return textResult(
                            "**Error: NOT_FOUND**\nNo brand profile found for this workspace.\n**Retryable:** false",
                        );
                    }
                    const rewrite = await ctx.prisma.contentRewrite.create({
                        data: {
                            workspaceId: workspace.id,
                            createdById: userId,
                            brandProfileId: profile.id,
                            originalContent: args.content,
                            platform: (args.platform ?? "GENERAL") as
                                | "TWITTER"
                                | "LINKEDIN"
                                | "INSTAGRAM"
                                | "FACEBOOK"
                                | "GENERAL",
                            characterLimit: args.character_limit ?? null,
                            status: "PENDING",
                        },
                    });
                    return textResult(
                        `**Rewrite Submitted**\n\n`
                        + `**ID:** \`${rewrite.id}\`\n`
                        + `**Status:** PENDING\n`
                        + `**Platform:** ${args.platform ?? "GENERAL"}\n`
                        + `**Character Limit:** ${args.character_limit ?? "None"}`,
                    );
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_get_profile", "Get the brand profile for a workspace including guardrails and vocabulary stats.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
            })
            .meta({ category: "brand-brain", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("brand_get_profile", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const profile = await ctx.prisma.brandProfile.findUnique({
                        where: { workspaceId: workspace.id },
                        include: {
                            guardrails: true,
                            vocabulary: true,
                        },
                    });
                    if (!profile) {
                        return textResult(
                            "**Error: NOT_FOUND**\nNo brand profile found for this workspace.\n**Retryable:** false",
                        );
                    }
                    let text = `**Brand Profile**\n\n`;
                    text += `**Name:** ${profile.name ?? "Unnamed"}\n`;
                    text += `**Mission:** ${profile.mission ?? "(none)"}\n`;
                    text += `**Values:** ${profile.values ?? "(none)"}\n`;
                    text += `**Tone:** ${profile.toneDescriptors ?? "(none)"}\n`;
                    text += `**Guardrails:** ${profile.guardrails.length}\n`;
                    text += `**Vocabulary Terms:** ${profile.vocabulary.length}\n`;
                    const bannedCount = profile.vocabulary.filter(v => v.type === "BANNED").length;
                    const preferredCount = profile.vocabulary.filter(v => v.type === "PREFERRED").length;
                    text += `  - Banned: ${bannedCount}\n`;
                    text += `  - Preferred: ${preferredCount}\n`;
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_check_policy", "Check content against active policy rules. Returns PASSED, PASSED_WITH_WARNINGS, or FAILED.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                content: z.string().min(1).describe(
                    "Content text to check against policies.",
                ),
                content_type: z.string().optional().default("POST").describe(
                    "Content type (default: POST).",
                ),
                platform: z.string().optional().describe("Target platform for context."),
            })
            .meta({ category: "brand-brain", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("brand_check_policy", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const rules = await ctx.prisma.policyRule.findMany({
                        where: { workspaceId: workspace.id, isActive: true },
                    });
                    if (rules.length === 0) {
                        return textResult(
                            "**Policy Check: PASSED**\n\nNo active policy rules configured.",
                        );
                    }
                    const contentLower = args.content.toLowerCase();
                    const violations: Array<
                        { rule: string; severity: string; matched: string; }
                    > = [];

                    for (const rule of rules) {
                        if (rule.ruleType === "KEYWORD_MATCH") {
                            const keywords = (rule.conditions as Record<string, unknown>)
                                ?.keywords;
                            if (Array.isArray(keywords)) {
                                for (const kw of keywords) {
                                    if (
                                        typeof kw === "string"
                                        && contentLower.includes(kw.toLowerCase())
                                    ) {
                                        violations.push({
                                            rule: rule.name,
                                            severity: rule.severity,
                                            matched: kw,
                                        });
                                    }
                                }
                            }
                        }
                    }

                    const hasCritical = violations.some(v =>
                        v.severity === "CRITICAL" || v.severity === "HIGH"
                    );
                    const result = violations.length === 0
                        ? "PASSED"
                        : hasCritical
                            ? "FAILED"
                            : "PASSED_WITH_WARNINGS";

                    const check = await ctx.prisma.policyCheck.create({
                        data: {
                            workspaceId: workspace.id,
                            contentText: args.content,
                            contentType: (args.content_type ?? "POST") as
                                | "POST"
                                | "AD"
                                | "COMMENT"
                                | "MESSAGE"
                                | "BIO"
                                | "STORY",
                            platform: (args.platform ?? null) as
                                | "TWITTER"
                                | "LINKEDIN"
                                | "FACEBOOK"
                                | "INSTAGRAM"
                                | "TIKTOK"
                                | "YOUTUBE"
                                | "DISCORD"
                                | "SNAPCHAT"
                                | "PINTEREST"
                                | null,
                            overallResult: result as
                                | "PASSED"
                                | "PASSED_WITH_WARNINGS"
                                | "FAILED",
                            failedRules: violations.length,
                            checkedById: userId,
                        },
                    });

                    if (violations.length > 0) {
                        for (const v of violations) {
                            const matchedRule = rules.find(r => r.name === v.rule);
                            if (matchedRule) {
                                await ctx.prisma.policyViolation.create({
                                    data: {
                                        checkId: check.id,
                                        workspaceId: workspace.id,
                                        ruleId: matchedRule.id,
                                        severity: v.severity as
                                            | "INFO"
                                            | "WARNING"
                                            | "ERROR"
                                            | "CRITICAL",
                                        message: `Matched keyword: ${v.matched}`,
                                        matchedContent: v.matched,
                                    },
                                });
                            }
                        }
                    }

                    let text = `**Policy Check: ${result}**\n\n`;
                    text += `**Check ID:** \`${check.id}\`\n`;
                    text += `**Content Type:** ${args.content_type ?? "POST"}\n`;
                    text += `**Violations:** ${violations.length}\n\n`;
                    if (violations.length > 0) {
                        text += `| Rule | Severity | Matched |\n|------|----------|---------|\n`;
                        for (const v of violations) {
                            text += `| ${v.rule} | ${v.severity} | ${v.matched} |\n`;
                        }
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_list_violations", "List recent policy violations for a workspace with optional severity filter.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
                severity: z.string().optional().describe(
                    "Filter by severity: LOW, MEDIUM, HIGH, CRITICAL.",
                ),
                limit: z.number().optional().default(20).describe(
                    "Max entries to return (default 20).",
                ),
            })
            .meta({ category: "brand-brain", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("brand_list_violations", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const where: Record<string, unknown> = { workspaceId: workspace.id };
                    if (args.severity) where.severity = args.severity;
                    const violations = await ctx.prisma.policyViolation.findMany({
                        where,
                        orderBy: { createdAt: "desc" },
                        take: args.limit ?? 20,
                        include: {
                            rule: { select: { name: true } },
                            check: { select: { contentType: true } },
                        },
                    });
                    if (violations.length === 0) {
                        return textResult("**Policy Violations**\n\nNo violations found.");
                    }
                    let text = `**Policy Violations** (${violations.length})\n\n`;
                    for (const v of violations) {
                        text += `- **${v.rule?.name ?? "unknown"}** (${v.severity})\n`;
                        text += `  Type: ${v.check?.contentType ?? "N/A"} | Message: ${v.message}\n`;
                        text += `  Matched: \`${v.matchedContent ?? "N/A"
                            }\` | At: ${v.createdAt.toISOString()}\n\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_get_guardrails", "List active brand guardrails for a workspace.", {
                workspace_slug: z.string().min(1).describe("Workspace slug."),
            })
            .meta({ category: "brand-brain", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("brand_get_guardrails", async () => {
                    const workspace = await resolveWorkspace(userId, args.workspace_slug);
                    const profile = await ctx.prisma.brandProfile.findUnique({
                        where: { workspaceId: workspace.id },
                        select: { id: true },
                    });
                    if (!profile) {
                        return textResult(
                            "**Error: NOT_FOUND**\nNo brand profile found for this workspace.\n**Retryable:** false",
                        );
                    }
                    const guardrails = await ctx.prisma.brandGuardrail.findMany({
                        where: { brandProfileId: profile.id, isActive: true },
                    });
                    if (guardrails.length === 0) {
                        return textResult(
                            "**Brand Guardrails**\n\nNo active guardrails found.",
                        );
                    }
                    let text = `**Brand Guardrails** (${guardrails.length})\n\n`;
                    for (const g of guardrails) {
                        text += `- **${g.name}** (${g.type})\n`;
                        text += `  Severity: ${g.severity} | ${g.description ?? "No description"}\n\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );

    registry.registerBuilt(
        freeTool(userId)
            .tool("analyze_brand_voice", "Analyze brand voice characteristics: tone, personality, vocabulary, and guardrails for a workspace.", {
                workspace_slug: z.string().optional().describe(
                    "Workspace slug (uses default workspace if omitted).",
                ),
            })
            .meta({ category: "brand-brain", tier: "free" })
            .handler(async ({ input, ctx }) => {
                const args = input;
                return safeToolCall("analyze_brand_voice", async () => {
                    const slug = args.workspace_slug;
                    const workspace = slug
                        ? await resolveWorkspace(userId, slug)
                        : await (async () => {
                            const ws = await ctx.prisma.workspace.findFirst({
                                where: { members: { some: { userId } } },
                            });
                            if (!ws) throw new Error("No workspace found for user.");
                            return ws;
                        })();
                    const profile = await ctx.prisma.brandProfile.findUnique({
                        where: { workspaceId: workspace.id },
                        include: {
                            guardrails: { where: { isActive: true } },
                            vocabulary: true,
                        },
                    });
                    if (!profile) {
                        return textResult(
                            "**Error: NOT_FOUND**\nNo brand profile found.\n**Retryable:** false",
                        );
                    }
                    const banned = profile.vocabulary.filter(v => v.type === "BANNED");
                    const preferred = profile.vocabulary.filter(v => v.type === "PREFERRED");
                    let text = `**Brand Voice Analysis**\n\n`;
                    text += `**Name:** ${profile.name ?? "Unnamed"}\n`;
                    text += `**Mission:** ${profile.mission ?? "(none)"}\n`;
                    text += `**Values:** ${profile.values ?? "(none)"}\n`;
                    text += `**Tone:** ${profile.toneDescriptors ?? "(none)"}\n\n`;
                    text += `**Vocabulary**\n`;
                    text += `- Preferred terms (${preferred.length}): ${preferred.slice(0, 10).map(v => v.term).join(", ") || "(none)"
                        }\n`;
                    text += `- Banned terms (${banned.length}): ${banned.slice(0, 10).map(v => v.term).join(", ") || "(none)"
                        }\n\n`;
                    text += `**Active Guardrails (${profile.guardrails.length})**\n`;
                    for (const g of profile.guardrails.slice(0, 5)) {
                        text += `- ${g.name} (${g.severity}): ${g.description ?? "No description"}\n`;
                    }
                    return textResult(text);
                }, { timeoutMs: 30_000 });
            })
    );
}
