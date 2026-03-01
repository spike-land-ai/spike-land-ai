/**
 * Brand Campaigns MCP Tools
 *
 * Campaign lifecycle management: create, list, get stats, and generate
 * A/B copy variants for marketing campaigns across social platforms.
 *
 * Campaigns are stored as BrandCampaign records keyed to the userId.
 * Since the Prisma schema may not have a Campaign model, we use a
 * JSON-serialised store in the UserPreference table under key
 * "brand_campaigns:<userId>". This keeps the implementation self-contained
 * without requiring a schema migration.
 */

import { z } from "zod";
import type { ToolRegistry } from "../tool-registry";
import { textResult } from "./tool-helpers";
import { freeTool } from "../tool-builder/procedures.js";

/* ── Constants ───────────────────────────────────────────────────────────── */

const PREF_KEY_PREFIX = "brand_campaigns";

const PLATFORMS = [
    "instagram",
    "twitter",
    "facebook",
    "linkedin",
    "tiktok",
    "all",
] as const;

type Platform = typeof PLATFORMS[number];

const STATUSES = ["draft", "active", "paused", "completed"] as const;
type CampaignStatus = typeof STATUSES[number];

const TONES = ["professional", "casual", "urgent", "playful"] as const;
type Tone = typeof TONES[number];

/* ── Internal campaign shape ────────────────────────────────────────────── */

interface Campaign {
    id: string;
    name: string;
    description: string;
    platform: Platform;
    status: CampaignStatus;
    start_date: string | null;
    budget: number | null;
    created_at: string;
    updated_at: string;
}

/* ── Persistence helpers ────────────────────────────────────────────────── */

function prefKey(userId: string): string {
    return `${PREF_KEY_PREFIX}:${userId}`;
}

async function loadCampaigns(userId: string): Promise<Campaign[]> {
    const prisma = (await import("@/lib/prisma")).default;
    const pref = await prisma.userPreference.findUnique({
        where: { userId_key: { userId, key: prefKey(userId) } },
    });
    if (!pref) return [];
    try {
        const parsed = JSON.parse(pref.value as string);
        return Array.isArray(parsed) ? (parsed as Campaign[]) : [];
    } catch {
        return [];
    }
}

async function saveCampaigns(
    userId: string,
    campaigns: Campaign[],
): Promise<void> {
    const prisma = (await import("@/lib/prisma")).default;
    await prisma.userPreference.upsert({
        where: { userId_key: { userId, key: prefKey(userId) } },
        create: { userId, key: prefKey(userId), value: JSON.stringify(campaigns) },
        update: { value: JSON.stringify(campaigns) },
    });
}

function generateId(): string {
    return `cmp_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

/* ── Schemas ────────────────────────────────────────────────────────────── */
/* ── Copy variant generation (deterministic, no external AI call) ─────── */

interface CopyVariant {
    variant: string;
    headline: string;
    body: string;
    cta: string;
}

const TONE_TEMPLATES: Record<
    Tone,
    Array<{ headline: string; body: string; cta: string; }>
> = {
    professional: [
        {
            headline: "Elevate Your Strategy",
            body: "Discover how {name} transforms the way teams work.",
            cta: "Learn More",
        },
        {
            headline: "Results-Driven Solutions",
            body: "{name} delivers measurable outcomes for modern businesses.",
            cta: "Get Started",
        },
        {
            headline: "Industry-Leading Performance",
            body: "Join thousands of professionals who trust {name}.",
            cta: "Request a Demo",
        },
        {
            headline: "Built for Scale",
            body: "{name} grows with your organisation from day one.",
            cta: "Explore Features",
        },
        {
            headline: "Data-Backed Decisions",
            body: "Let {name} turn insights into action.",
            cta: "See the Data",
        },
    ],
    casual: [
        {
            headline: "You're going to love this",
            body: "Seriously — {name} makes everything easier.",
            cta: "Try it free",
        },
        {
            headline: "Finally, something that works",
            body: "{name} just gets it. No fuss, no fluff.",
            cta: "Jump in",
        },
        {
            headline: "Your new favourite thing",
            body: "Everyone's talking about {name} — see what the fuss is about.",
            cta: "Check it out",
        },
        {
            headline: "Less hassle, more done",
            body: "{name} takes care of the boring stuff so you don't have to.",
            cta: "Start today",
        },
        {
            headline: "Pretty cool, right?",
            body: "We built {name} because we were tired of the alternatives.",
            cta: "Give it a go",
        },
    ],
    urgent: [
        {
            headline: "Limited Time Offer",
            body: "{name} is available now — don't miss your window.",
            cta: "Claim Now",
        },
        {
            headline: "Act Before It's Gone",
            body: "Spots for {name} are filling fast. Secure yours today.",
            cta: "Reserve My Spot",
        },
        {
            headline: "Last Chance",
            body: "This offer for {name} expires soon. Move fast.",
            cta: "Get It Now",
        },
        {
            headline: "Don't Miss Out",
            body: "Thousands have already signed up for {name}. Will you?",
            cta: "Join Now",
        },
        {
            headline: "Today Only",
            body: "{name} at this price won't last. Take action.",
            cta: "Grab the Deal",
        },
    ],
    playful: [
        {
            headline: "Spoiler: you'll love it",
            body: "{name} is the plot twist your workflow needed.",
            cta: "Unlock the Fun",
        },
        {
            headline: "Plot twist: work can be fun",
            body: "Meet {name} — the tool that actually sparks joy.",
            cta: "Play Around",
        },
        {
            headline: "Warning: highly addictive",
            body: "{name} makes productivity dangerously enjoyable.",
            cta: "I'm In",
        },
        {
            headline: "Your boss will think you're a genius",
            body: "Let {name} do the heavy lifting while you take the credit.",
            cta: "Start Winning",
        },
        {
            headline: "Level up your game",
            body: "{name} turns everyday tasks into an adventure.",
            cta: "Power Up",
        },
    ],
};

function buildVariants(
    campaign: Campaign,
    count: number,
    tone: Tone,
): CopyVariant[] {
    const templates = TONE_TEMPLATES[tone];
    const variants: CopyVariant[] = [];
    for (let i = 0; i < count; i++) {
        const tpl = templates[i % templates.length]!;
        variants.push({
            variant: String.fromCharCode(65 + i), // A, B, C...
            headline: tpl.headline.replace("{name}", campaign.name),
            body: tpl.body.replace("{name}", campaign.name),
            cta: tpl.cta,
        });
    }
    return variants;
}

/* ── Simulated metrics (deterministic from campaign ID) ──────────────── */

function simulateMetrics(campaignId: string): {
    impressions: number;
    clicks: number;
    engagement_rate: string;
    reach: number;
    cost_per_engagement: string;
} {
    // Seed from campaign ID character codes for deterministic output
    const seed = campaignId.split("").reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
    const impressions = 1000 + (seed % 49000);
    const clicks = Math.floor(impressions * (0.02 + (seed % 8) * 0.01));
    const reach = Math.floor(impressions * 0.8);
    const engagement_rate = (clicks / impressions * 100).toFixed(2);
    const cost_per_engagement = (0.05 + (seed % 20) * 0.05).toFixed(2);
    return { impressions, clicks, engagement_rate, reach, cost_per_engagement };
}

/* ── Registration ───────────────────────────────────────────────────────── */

export function registerBrandCampaignTools(
    registry: ToolRegistry,
    userId: string,
): void {
    /* ─── brand_create_campaign ─────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_create_campaign", "Create a marketing campaign. Stores campaign details including platform, budget, and start date.", {
                name: z.string().min(1).max(120).describe("Campaign name."),
                description: z.string().min(1).max(1000).describe(
                    "Campaign description and goals.",
                ),
                platform: z.enum(PLATFORMS).describe(
                    "Target platform: instagram, twitter, facebook, linkedin, tiktok, or all.",
                ),
                start_date: z.string().optional().describe(
                    "ISO 8601 start date (e.g. 2026-03-01). Optional.",
                ),
                budget: z.number().positive().optional().describe(
                    "Campaign budget in USD. Optional.",
                ),
            })
            .meta({ category: "brand-campaigns", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { name, description, platform, start_date, budget } = input;

                if (start_date !== undefined) {
                    const parsed = Date.parse(start_date);
                    if (isNaN(parsed)) {
                        return textResult(
                            "**Error: VALIDATION_ERROR**\n`start_date` must be a valid ISO 8601 date string (e.g. 2026-03-01).\n**Retryable:** false",
                        );
                    }
                }

                const campaigns = await loadCampaigns(userId);
                const now = new Date().toISOString();
                const campaign: Campaign = {
                    id: generateId(),
                    name,
                    description,
                    platform,
                    status: "draft",
                    start_date: start_date ?? null,
                    budget: budget ?? null,
                    created_at: now,
                    updated_at: now,
                };
                campaigns.push(campaign);
                await saveCampaigns(userId, campaigns);

                return textResult(
                    `**Campaign Created**\n\n`
                    + `**ID:** ${campaign.id}\n`
                    + `**Name:** ${campaign.name}\n`
                    + `**Platform:** ${campaign.platform}\n`
                    + `**Status:** ${campaign.status}\n`
                    + `**Start Date:** ${campaign.start_date ?? "(not set)"}\n`
                    + `**Budget:** ${campaign.budget !== null ? `$${campaign.budget.toFixed(2)}` : "(not set)"
                    }\n`
                    + `**Created:** ${campaign.created_at}`,
                );
            })
    );

    /* ─── brand_list_campaigns ──────────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_list_campaigns", "List all marketing campaigns with optional status and platform filters.", {
                status: z.enum([...STATUSES, "all"] as const).optional().describe(
                    "Filter by status: draft, active, paused, completed, or all. Defaults to all.",
                ),
                platform: z.string().optional().describe(
                    "Filter by platform name. Optional.",
                ),
            })
            .meta({ category: "brand-campaigns", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { status, platform } = input;

                let campaigns = await loadCampaigns(userId);

                if (status && status !== "all") {
                    campaigns = campaigns.filter(c => c.status === status);
                }

                if (platform) {
                    const platformLower = platform.toLowerCase();
                    campaigns = campaigns.filter(
                        c => c.platform === platformLower || c.platform === "all",
                    );
                }

                if (campaigns.length === 0) {
                    return textResult(
                        "**No Campaigns Found**\n\nCreate a campaign with `brand_create_campaign`.",
                    );
                }

                const lines = campaigns.map(c =>
                    `- **${c.name}** (\`${c.id}\`)\n`
                    + `  Platform: ${c.platform} | Status: ${c.status}`
                    + `${c.budget !== null ? ` | Budget: $${c.budget.toFixed(2)}` : ""}`
                    + `${c.start_date ? ` | Starts: ${c.start_date}` : ""}`
                );

                return textResult(
                    `**Campaigns (${campaigns.length})**\n\n${lines.join("\n")}`,
                );
            })
    );

    /* ─── brand_get_campaign_stats ──────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_get_campaign_stats", "Get performance metrics for a campaign: impressions, clicks, engagement rate, reach, and cost per engagement.", {
                campaign_id: z.string().min(1).describe("Campaign ID."),
            })
            .meta({ category: "brand-campaigns", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { campaign_id } = input;

                const campaigns = await loadCampaigns(userId);
                const campaign = campaigns.find(c => c.id === campaign_id);

                if (!campaign) {
                    return textResult(
                        `**Error: NOT_FOUND**\nCampaign \`${campaign_id}\` not found.\n**Retryable:** false`,
                    );
                }

                const metrics = simulateMetrics(campaign_id);

                return textResult(
                    `**Campaign Stats: ${campaign.name}**\n\n`
                    + `**Campaign ID:** ${campaign.id}\n`
                    + `**Platform:** ${campaign.platform}\n`
                    + `**Status:** ${campaign.status}\n\n`
                    + `**Performance Metrics**\n`
                    + `| Metric | Value |\n`
                    + `|--------|-------|\n`
                    + `| Impressions | ${metrics.impressions.toLocaleString()} |\n`
                    + `| Clicks | ${metrics.clicks.toLocaleString()} |\n`
                    + `| Reach | ${metrics.reach.toLocaleString()} |\n`
                    + `| Engagement Rate | ${metrics.engagement_rate}% |\n`
                    + `| Cost per Engagement | $${metrics.cost_per_engagement} |`,
                );
            })
    );

    /* ─── brand_generate_variants ───────────────────────────────────── */

    registry.registerBuilt(
        freeTool(userId)
            .tool("brand_generate_variants", "Generate A/B copy variants for a campaign with headlines and CTAs. Supports 2-5 variants across multiple tones.", {
                campaign_id: z.string().min(1).describe("Campaign ID."),
                variant_count: z.number().int().min(2).max(5).optional().default(3).describe(
                    "Number of A/B variants to generate (2-5, default 3).",
                ),
                tone: z.enum(TONES).optional().describe(
                    "Copywriting tone: professional, casual, urgent, or playful. Optional.",
                ),
            })
            .meta({ category: "brand-campaigns", tier: "free" })
            .handler(async ({ input, ctx: _ctx }) => {
                const { campaign_id, variant_count, tone } = input;

                const campaigns = await loadCampaigns(userId);
                const campaign = campaigns.find(c => c.id === campaign_id);

                if (!campaign) {
                    return textResult(
                        `**Error: NOT_FOUND**\nCampaign \`${campaign_id}\` not found.\n**Retryable:** false`,
                    );
                }

                const resolvedTone: Tone = tone ?? "professional";
                const count = variant_count ?? 3;
                const variants = buildVariants(campaign, count, resolvedTone);

                let text = `**A/B Copy Variants for "${campaign.name}"**\n\n`
                    + `**Tone:** ${resolvedTone} | **Variants:** ${count}\n\n`;

                for (const v of variants) {
                    text += `### Variant ${v.variant}\n`
                        + `**Headline:** ${v.headline}\n`
                        + `**Body:** ${v.body}\n`
                        + `**CTA:** ${v.cta}\n\n`;
                }

                return textResult(text);
            })
    );
}
