/**
 * Project Arbor MCP Tools
 *
 * Business-planning tools for turning the Arbor thesis into a pilot,
 * risk register, and audience-specific narrative.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../../lazy-imports/types";
import { freeTool, jsonResult } from "../../lazy-imports/procedures-index.ts";
import type { DrizzleDB } from "../../db/db/db-index.ts";

const ARBOR_MARKET = "3-4B under-resourced smartphone users";
const ARBOR_THESIS =
  "Monetizing latent global human capital by converting physical, educational, and legal constraints into immediate economic leverage.";
const ARBOR_NET_OUTPUT =
  "Transforms under-resourced smartphone users from passive digital consumers into active, legally protected economic producers.";

const ARBOR_CONNECTIVITY_LABELS = {
  offline_first: "offline-first peer-to-peer distribution",
  intermittent: "intermittent connectivity with local-first sync",
  always_online: "reliable connectivity with optional offline fallback",
} as const;

const ARBOR_RISK_LEVEL_SCORE = {
  low: 1,
  medium: 2,
  high: 3,
} as const;

const ARBOR_CONNECTIVITY_RISK_SCORE = {
  always_online: 1,
  intermittent: 2,
  offline_first: 3,
} as const;

export type ArborAudience = "investor" | "operator" | "policy" | "partner";
export type ArborPitchAudience = "investor" | "grant" | "pilot_partner" | "operator";
export type ArborPitchFormat = "one_liner" | "thirty_second" | "memo";
export type ArborPillarKey =
  | "asset_synthesis"
  | "economic_pipeline"
  | "legal_automation"
  | "infrastructure_bypass";
export type ArborConnectivityProfile = keyof typeof ARBOR_CONNECTIVITY_LABELS;
export type ArborRiskLevel = keyof typeof ARBOR_RISK_LEVEL_SCORE;
export type ArborPartnerModel = "independent" | "co_op" | "ngo" | "municipality" | "school";
export type ArborPilotGoal =
  | "income_generation"
  | "asset_creation"
  | "business_formalization"
  | "offline_distribution";

export interface ArborPillarDefinition {
  key: ArborPillarKey;
  name: string;
  value: string;
  mechanism: string;
  outcome: string;
  defaultMetric: string;
}

export interface ArborBrief {
  audience: ArborAudience;
  market: string;
  thesis: string;
  headline: string;
  netOutput: string;
  pillars: ArborPillarDefinition[];
}

export interface ArborOpportunityPathway {
  pillarKey: ArborPillarKey;
  pillarName: string;
  leveragePoint: string;
  intervention: string;
  expectedOutput: string;
  proofMetric: string;
}

export interface ArborOpportunityMap {
  regionContext: string;
  targetUser: string;
  connectivityProfile: ArborConnectivityProfile;
  summary: string;
  prioritizedPillars: ArborPillarKey[];
  recommendedWedge: ArborPillarKey;
  pathways: ArborOpportunityPathway[];
}

export interface ArborPilotPhase {
  name: string;
  days: string;
  objective: string;
  outputs: string[];
}

export interface ArborPilotMetric {
  name: string;
  target: string;
  whyItMatters: string;
}

export interface ArborPilotPlan {
  region: string;
  targetUser: string;
  pilotGoal: ArborPilotGoal;
  partnerModel: ArborPartnerModel;
  timeHorizonDays: number;
  summary: string;
  phases: ArborPilotPhase[];
  successMetrics: ArborPilotMetric[];
  minimumProductSurface: string[];
  guardrails: string[];
}

export interface ArborRiskItem {
  risk: string;
  severity: "low" | "medium" | "high" | "critical";
  why: string;
  mitigation: string;
  owner: string;
}

export interface ArborRiskRegister {
  summary: string;
  riskProfile: {
    enforcementRisk: ArborRiskLevel;
    connectivityProfile: ArborConnectivityProfile;
    paymentReliability: ArborRiskLevel;
    identityRequirements: ArborRiskLevel;
    partnerModel: ArborPartnerModel;
  };
  risks: ArborRiskItem[];
  guardrails: string[];
}

export interface ArborPitch {
  audience: ArborPitchAudience;
  format: ArborPitchFormat;
  headline: string;
  pitch: string;
  supportPoints: string[];
  ask: string;
}

const ARBOR_PILLARS: ArborPillarDefinition[] = [
  {
    key: "asset_synthesis",
    name: "Asset Synthesis",
    value:
      "Converts zero-cost local materials and raw environments into physical capital or infrastructure.",
    mechanism: "Environmental scanning paired with bespoke build blueprints.",
    outcome: "Generates wealth from immediate surroundings without outside capital.",
    defaultMetric: "First finished asset or infrastructure prototype built from local inputs.",
  },
  {
    key: "economic_pipeline",
    name: "Economic Pipeline",
    value: "Connects context-aware upskilling to escrowed work and global micro-gig demand.",
    mechanism: "Skill activation, proof-of-work portfolios, and protected market access.",
    outcome:
      "Raises earning power above local wage ceilings while cutting out predatory middlemen.",
    defaultMetric: "Median time to first paid task and repeat paid work.",
  },
  {
    key: "legal_automation",
    name: "Legal Automation",
    value: "Automates contracts, business registration, and localized defensive paperwork.",
    mechanism: "Localized legal templates, rights packs, and compliance checklists.",
    outcome: "Protects fragile gains from seizure, coercion, or informal extraction.",
    defaultMetric: "Number of producers operating with receipts, contracts, or registration packs.",
  },
  {
    key: "infrastructure_bypass",
    name: "Infrastructure Bypass",
    value: "Distributes the system through offline-capable peer-to-peer networking.",
    mechanism: "Local-first sync, mesh exchange, and censorship-resistant delivery paths.",
    outcome:
      "Keeps distribution costs near zero and preserves resilience under failure or censorship.",
    defaultMetric: "Number of sessions completed despite poor or absent connectivity.",
  },
];

function normalizeItems(items: string[] | undefined): string[] {
  if (!items) return [];

  const seen = new Set<string>();
  const normalized: string[] = [];

  for (const item of items) {
    const trimmed = item.trim();
    if (!trimmed) continue;

    const key = trimmed.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    normalized.push(trimmed);
  }

  return normalized;
}

function listOrFallback(items: string[], fallback: string): string {
  return items.length > 0 ? items.join(", ") : fallback;
}

function containsKeyword(items: string[], keywords: string[]): boolean {
  if (items.length === 0) return false;
  const haystack = items.join(" ").toLowerCase();
  return keywords.some((keyword) => haystack.includes(keyword));
}

function partnerSupport(partnerModel: ArborPartnerModel): string {
  switch (partnerModel) {
    case "co_op":
      return "Use the co-op as the trust anchor for intake, dispute resolution, and shared payout records.";
    case "ngo":
      return "Use the NGO as the local compliance and operator-training partner.";
    case "municipality":
      return "Use the municipality to legitimize permits, distribution points, and public-facing documentation.";
    case "school":
      return "Use the school as the training and credentialing anchor for first-cohort onboarding.";
    case "independent":
    default:
      return "Add a lightweight local anchor before scale so enforcement and trust risk do not sit on individuals alone.";
  }
}

function scoreToSeverity(score: number): ArborRiskItem["severity"] {
  if (score <= 1) return "low";
  if (score === 2) return "medium";
  if (score === 3) return "high";
  return "critical";
}

function invertRisk(level: ArborRiskLevel): number {
  return 4 - ARBOR_RISK_LEVEL_SCORE[level];
}

function buildDaysLabel(startDay: number, endDay: number): string {
  return `${startDay}-${endDay}`;
}

export function buildArborBrief(
  audience: ArborAudience = "operator",
  focus: ArborPillarKey[] = [],
): ArborBrief {
  const selectedPillars =
    focus.length > 0 ? ARBOR_PILLARS.filter((pillar) => focus.includes(pillar.key)) : ARBOR_PILLARS;

  const headlineByAudience: Record<ArborAudience, string> = {
    investor:
      "Project Arbor builds an economic operating system that turns local constraints into defensible, compounding production capacity.",
    operator:
      "Project Arbor gives under-resourced smartphone users a practical path from local inputs to protected income.",
    policy:
      "Project Arbor formalizes gray-market productivity without requiring top-down infrastructure first.",
    partner:
      "Project Arbor packages local assets, income access, legal protection, and offline distribution into a pilotable field system.",
  };

  return {
    audience,
    market: ARBOR_MARKET,
    thesis: ARBOR_THESIS,
    headline: headlineByAudience[audience],
    netOutput: ARBOR_NET_OUTPUT,
    pillars: selectedPillars,
  };
}

export function mapArborContext(input: {
  regionContext: string;
  targetUser: string;
  localAssets?: string[];
  constraints?: string[];
  currentSkills?: string[];
  connectivityProfile?: ArborConnectivityProfile;
}): ArborOpportunityMap {
  const localAssets = normalizeItems(input.localAssets);
  const constraints = normalizeItems(input.constraints);
  const currentSkills = normalizeItems(input.currentSkills);
  const connectivityProfile = input.connectivityProfile ?? "intermittent";

  const assetText = listOrFallback(
    localAssets,
    "locally available materials, overlooked waste streams, and surrounding physical inputs",
  );
  const constraintText = listOrFallback(
    constraints,
    "capital scarcity, weak infrastructure, fragmented trust, and wage compression",
  );
  const skillText = listOrFallback(
    currentSkills,
    "smartphone coordination, repair work, local trade, and service execution",
  );

  const pathways: ArborOpportunityPathway[] = [
    {
      pillarKey: "asset_synthesis",
      pillarName: "Asset Synthesis",
      leveragePoint: `Turn ${assetText} into productive capital for ${input.targetUser}.`,
      intervention:
        "Scan the environment, identify low-cost build opportunities, and produce constrained blueprints for repair, resale, or micro-infrastructure.",
      expectedOutput:
        "A first wave of tangible assets that improve earning power or reduce operating costs immediately.",
      proofMetric: "Count of usable prototypes built from local inputs.",
    },
    {
      pillarKey: "economic_pipeline",
      pillarName: "Economic Pipeline",
      leveragePoint: `Package ${skillText} into escrow-protected work and market-facing offers.`,
      intervention:
        "Map existing skills to quick-win paid tasks, attach lightweight training, and route the work through trusted payment and escrow flows.",
      expectedOutput:
        "Faster first income and higher repeat earnings than local informal channels.",
      proofMetric: "Median days to first paid task and number of repeat paid tasks.",
    },
    {
      pillarKey: "legal_automation",
      pillarName: "Legal Automation",
      leveragePoint: `Reduce the downside of operating inside ${constraintText}.`,
      intervention:
        "Generate localized contracts, receipt templates, registration checklists, and defensive documentation before value starts accumulating.",
      expectedOutput:
        "Economic activity becomes harder to confiscate, misclassify, or exploit informally.",
      proofMetric: "Share of participants operating with a usable documentation pack.",
    },
    {
      pillarKey: "infrastructure_bypass",
      pillarName: "Infrastructure Bypass",
      leveragePoint: `Deliver the workflow through ${ARBOR_CONNECTIVITY_LABELS[connectivityProfile]}.`,
      intervention:
        "Run onboarding, task routing, and handoff through local-first content bundles so the system survives outages, censorship, and thin data budgets.",
      expectedOutput:
        "The operating loop keeps running even when connectivity, platforms, or state infrastructure fail.",
      proofMetric: "Number of successful sessions completed under low-connectivity conditions.",
    },
  ];

  const assetScore =
    (localAssets.length > 0 ? 2 : 0) +
    (containsKeyword(localAssets, ["waste", "scrap", "wood", "metal", "plastic", "land"]) ? 1 : 0);
  const economicScore =
    (currentSkills.length > 0 ? 2 : 0) +
    (containsKeyword(constraints, ["wage", "income", "job", "market", "middlemen"]) ? 1 : 0);
  const legalScore =
    (containsKeyword(constraints, [
      "legal",
      "permit",
      "police",
      "seizure",
      "contract",
      "registration",
    ])
      ? 2
      : 0) + (containsKeyword(constraints, ["informal", "gray market", "id", "license"]) ? 1 : 0);
  const infrastructureScore =
    (ARBOR_CONNECTIVITY_RISK_SCORE[connectivityProfile] >= 2 ? 2 : 0) +
    (containsKeyword(constraints, ["internet", "data", "network", "censorship", "connectivity"])
      ? 2
      : 0);

  const prioritizedPillars = [
    { key: "asset_synthesis", score: assetScore },
    { key: "economic_pipeline", score: economicScore },
    { key: "legal_automation", score: legalScore },
    { key: "infrastructure_bypass", score: infrastructureScore },
  ]
    .sort((left, right) => right.score - left.score)
    .map((entry) => entry.key) as ArborPillarKey[];

  const recommendedWedge = prioritizedPillars[0] ?? "economic_pipeline";

  return {
    regionContext: input.regionContext,
    targetUser: input.targetUser,
    connectivityProfile,
    summary:
      `Mapped Arbor's four leverage pathways for ${input.targetUser} in ${input.regionContext}. ` +
      `Recommended first wedge: ${recommendedWedge.replaceAll("_", " ")}.`,
    prioritizedPillars,
    recommendedWedge,
    pathways,
  };
}

export function planArborPilot(input: {
  region: string;
  targetUser: string;
  pilotGoal: ArborPilotGoal;
  partnerModel: ArborPartnerModel;
  timeHorizonDays?: number;
  localAssets?: string[];
}): ArborPilotPlan {
  const localAssets = normalizeItems(input.localAssets);
  const timeHorizonDays = Math.max(14, Math.min(input.timeHorizonDays ?? 45, 180));
  const phaseOneEnd = Math.max(5, Math.floor(timeHorizonDays * 0.3));
  const phaseTwoEnd = Math.max(phaseOneEnd + 5, Math.floor(timeHorizonDays * 0.75));

  const commonOutputs = [
    "Operator playbook",
    "Participant ledger",
    "Escrow and payout checklist",
    "Legal documentation pack",
  ];

  const phases: ArborPilotPhase[] = [
    {
      name: "Discover",
      days: buildDaysLabel(1, phaseOneEnd),
      objective:
        "Recruit the first cohort, validate the local asset base, and narrow the initial monetization loop.",
      outputs: [
        `Target cohort definition for ${input.targetUser}`,
        `Field inventory of ${listOrFallback(localAssets, "priority local inputs")}`,
        "Pilot operator checklist",
      ],
    },
    {
      name: "Activate",
      days: buildDaysLabel(phaseOneEnd + 1, phaseTwoEnd),
      objective:
        "Run the first asset-to-income cycles, capture proof-of-work, and tighten the operator workflow.",
      outputs: [
        "First paid tasks completed",
        "First asset or service artifacts documented",
        ...commonOutputs.slice(0, 2),
      ],
    },
    {
      name: "Formalize",
      days: buildDaysLabel(phaseTwoEnd + 1, timeHorizonDays),
      objective:
        "Lock in legal protection, repeatable distribution, and a scale/no-scale decision with evidence.",
      outputs: [
        ...commonOutputs.slice(2),
        "Go / no-go scale recommendation",
        `Partner operating memo for ${input.partnerModel.replace("_", " ")}`,
      ],
    },
  ];

  const goalMetrics: Record<ArborPilotGoal, ArborPilotMetric[]> = {
    income_generation: [
      {
        name: "producers_with_first_payment",
        target: "60% of cohort earns once during pilot",
        whyItMatters: "Validates the market-access wedge instead of just training activity.",
      },
      {
        name: "median_days_to_first_income",
        target: "Under 14 days",
        whyItMatters: "Speed matters for trust and retention when users are resource-constrained.",
      },
      {
        name: "repeat_paid_tasks",
        target: "30% of cohort completes 2+ paid tasks",
        whyItMatters: "Repeat work is the difference between a gimmick and a viable pipeline.",
      },
    ],
    asset_creation: [
      {
        name: "usable_assets_created",
        target: "At least 1 usable asset per 3 participants",
        whyItMatters: "Shows local inputs can be converted into productive capital quickly.",
      },
      {
        name: "input_cost_delta",
        target: "80%+ of inputs sourced locally at near-zero cost",
        whyItMatters: "Arbor only works if outside capital is not the bottleneck.",
      },
      {
        name: "asset_to_income_conversion",
        target: "50% of created assets generate or save money within pilot window",
        whyItMatters: "Physical output must connect back to economic leverage.",
      },
    ],
    business_formalization: [
      {
        name: "documentation_pack_completion",
        target: "75% of cohort receives usable contracts / receipts / registration checklist",
        whyItMatters: "Protection must happen before value accumulates.",
      },
      {
        name: "micro_business_setups",
        target: "25% of cohort starts a formal or semi-formal operating entity",
        whyItMatters: "This measures whether Arbor actually formalizes economic activity.",
      },
      {
        name: "resolved_disputes_with_docs",
        target: "100% of disputes handled with written evidence",
        whyItMatters: "Legal automation is only real if it changes outcomes under stress.",
      },
    ],
    offline_distribution: [
      {
        name: "offline_sessions_completed",
        target: "90% of sessions complete without needing persistent connectivity",
        whyItMatters: "The distribution moat fails if the app still depends on ideal internet.",
      },
      {
        name: "peer_sync_nodes",
        target: "At least 3 local relay points or operator devices",
        whyItMatters: "Redundant distribution is required for resilience.",
      },
      {
        name: "connectivity_failure_recovery",
        target: "Recovery under 24 hours after outage",
        whyItMatters: "Operational continuity is the core infrastructure-bypass claim.",
      },
    ],
  };

  return {
    region: input.region,
    targetUser: input.targetUser,
    pilotGoal: input.pilotGoal,
    partnerModel: input.partnerModel,
    timeHorizonDays,
    summary:
      `Built a ${timeHorizonDays}-day Arbor pilot for ${input.targetUser} in ${input.region}. ` +
      `Primary goal: ${input.pilotGoal.replaceAll("_", " ")}.`,
    phases,
    successMetrics: goalMetrics[input.pilotGoal],
    minimumProductSurface: [
      "context_mapping",
      "escrowed_workflow",
      "operator_ledger",
      "legal_document_pack",
      "offline_sync",
    ],
    guardrails: [
      "Start with one monetization loop and one cohort. Do not stack multiple wedges on day one.",
      partnerSupport(input.partnerModel),
      "Do not let users create valuable assets or complete paid work before the documentation path exists.",
    ],
  };
}

export function buildArborRiskRegister(input: {
  jurisdictionSummary: string;
  enforcementRisk: ArborRiskLevel;
  connectivityProfile: ArborConnectivityProfile;
  paymentReliability: ArborRiskLevel;
  identityRequirements: ArborRiskLevel;
  partnerModel: ArborPartnerModel;
  sensitiveActivities?: string[];
}): ArborRiskRegister {
  const sensitiveActivities = normalizeItems(input.sensitiveActivities);
  const sensitiveScore = sensitiveActivities.length > 0 ? 1 : 0;

  const risks: ArborRiskItem[] = [
    {
      risk: "Asset seizure or local shutdown",
      severity: scoreToSeverity(ARBOR_RISK_LEVEL_SCORE[input.enforcementRisk] + sensitiveScore),
      why: "As soon as Arbor helps users create visible value, local authorities or informal power brokers may try to capture it.",
      mitigation:
        "Front-load defensive paperwork, keep ownership trails, and route launch through a trusted local anchor where possible.",
      owner: "Local operator + legal operations",
    },
    {
      risk: "Worker exploitation or middleman capture",
      severity: scoreToSeverity(Math.max(2, ARBOR_RISK_LEVEL_SCORE[input.enforcementRisk])),
      why: "A new market-access layer attracts actors who want to skim payouts, misprice work, or lock in dependency.",
      mitigation:
        "Use escrowed payouts, transparent rate cards, and proof-of-work records tied to the producer rather than the intermediary.",
      owner: "Marketplace operations",
    },
    {
      risk: "Payment leakage or failed settlement",
      severity: scoreToSeverity(invertRisk(input.paymentReliability) + 1),
      why: "If workers cannot get paid reliably, the trust loop collapses immediately.",
      mitigation:
        "Support redundant payout paths, hold funds in escrow until delivery proof exists, and maintain a manual exception queue.",
      owner: "Payments operations",
    },
    {
      risk: "Identity or registration exclusion",
      severity: scoreToSeverity(ARBOR_RISK_LEVEL_SCORE[input.identityRequirements]),
      why: "The people Arbor targets often fail rigid KYC, permit, or business-registration requirements even when they can do the work.",
      mitigation:
        "Offer progressive formalization: receipts first, lightweight business packs second, and full registration only when revenue justifies it.",
      owner: "Compliance operations",
    },
    {
      risk: "Connectivity failure during core workflow",
      severity: scoreToSeverity(ARBOR_CONNECTIVITY_RISK_SCORE[input.connectivityProfile]),
      why: "Task delivery, training, and proof collection will fail if the workflow assumes stable internet.",
      mitigation:
        "Bundle tasks locally, keep local ledgers, and sync opportunistically instead of making the network a prerequisite.",
      owner: "Product and field ops",
    },
    {
      risk: "Distribution censorship or platform dependency",
      severity: scoreToSeverity(
        Math.max(
          ARBOR_RISK_LEVEL_SCORE[input.enforcementRisk],
          ARBOR_CONNECTIVITY_RISK_SCORE[input.connectivityProfile],
        ),
      ),
      why: "A centralized distribution path can be blocked by platform policy, infrastructure failure, or state pressure.",
      mitigation:
        "Keep peer-to-peer distribution and local operator relays as first-class paths, not backup features.",
      owner: "Distribution operations",
    },
  ];

  const criticalCount = risks.filter((risk) => risk.severity === "critical").length;

  return {
    summary:
      `Generated Arbor risk register for ${input.jurisdictionSummary}. ` +
      `${criticalCount} critical risk(s) require active mitigation.`,
    riskProfile: {
      enforcementRisk: input.enforcementRisk,
      connectivityProfile: input.connectivityProfile,
      paymentReliability: input.paymentReliability,
      identityRequirements: input.identityRequirements,
      partnerModel: input.partnerModel,
    },
    risks,
    guardrails: [
      partnerSupport(input.partnerModel),
      sensitiveActivities.length > 0
        ? `Treat these activities as sensitive from day one: ${sensitiveActivities.join(", ")}.`
        : "Keep the initial pilot narrowly scoped so enforcement and reputational exposure stay bounded.",
      "Do not scale a region until payout reliability, documentation, and offline recovery are all proven in the field.",
    ],
  };
}

export function buildArborPitch(input: {
  audience: ArborPitchAudience;
  format: ArborPitchFormat;
  region?: string;
  targetUser?: string;
  ask?: string;
}): ArborPitch {
  const regionClause = input.region ? ` in ${input.region}` : "";
  const targetUser = input.targetUser ?? "under-resourced smartphone users";

  const headlineByAudience: Record<ArborPitchAudience, string> = {
    investor: "A production system for the invisible global workforce",
    grant: "A resilience and income platform for under-resourced producers",
    pilot_partner:
      "A field-operable system for turning local constraints into protected livelihoods",
    operator:
      "One practical operating model for asset creation, income access, and legal protection",
  };

  const askByAudience: Record<ArborPitchAudience, string> = {
    investor:
      "Back a field pilot that proves first income, first asset creation, and repeatable protection loops.",
    grant: "Fund a measured pilot with clear income, protection, and formalization outcomes.",
    pilot_partner:
      "Provide local distribution, operator support, and context so the pilot can prove real unit economics.",
    operator: "Pick one cohort, one revenue loop, and one region to validate this quarter.",
  };

  const oneLiner = `Project Arbor turns ${targetUser}${regionClause} into legally protected producers by helping them create assets from local inputs, access global income, and keep operating when infrastructure fails.`;

  const thirtySecond =
    `Project Arbor is an economic operating system for ${targetUser}${regionClause}. ` +
    `It converts local materials into productive capital, routes labor into escrow-protected market access, and automates the documentation needed to defend fragile gains. ` +
    `The result is not more content consumption. It is protected production under real-world constraints.`;

  const memo =
    `${thirtySecond} Arbor matters because the constraint is not human capacity. ` +
    `It is missing leverage: capital, market access, legal cover, and resilient distribution. ` +
    `Arbor compresses those layers into one deployable field model.`;

  const pitchByFormat: Record<ArborPitchFormat, string> = {
    one_liner: oneLiner,
    thirty_second: thirtySecond,
    memo,
  };

  return {
    audience: input.audience,
    format: input.format,
    headline: headlineByAudience[input.audience],
    pitch: pitchByFormat[input.format],
    supportPoints: [
      "Asset synthesis creates tangible value without outside capital injection.",
      "Escrowed market access turns latent labor into immediate income opportunities.",
      "Legal automation protects gains before they can be extracted or seized.",
      "Offline-first distribution keeps the system operating under failure, censorship, or weak connectivity.",
    ],
    ask: input.ask?.trim() || askByAudience[input.audience],
  };
}

export function registerArborTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  registry.registerBuilt(
    t
      .tool(
        "arbor_get_brief",
        "Return the Project Arbor thesis, market, and value pillars for a specific audience.",
        {
          audience: z
            .enum(["investor", "operator", "policy", "partner"])
            .optional()
            .describe("Audience to optimize the framing for."),
          focus: z
            .array(
              z.enum([
                "asset_synthesis",
                "economic_pipeline",
                "legal_automation",
                "infrastructure_bypass",
              ]),
            )
            .max(4)
            .optional()
            .describe("Optional subset of Arbor pillars to emphasize."),
        },
      )
      .meta({ category: "arbor", tier: "free" })
      .handler(async ({ input }) => {
        const brief = buildArborBrief(input.audience ?? "operator", input.focus ?? []);
        return jsonResult(brief.headline, brief);
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "arbor_map_context",
        "Map a local operating context into Arbor's four leverage pathways and recommend the best starting wedge.",
        {
          region_context: z
            .string()
            .min(1)
            .max(160)
            .describe("Short description of the region or environment."),
          target_user: z.string().min(1).max(120).describe("Who Arbor is serving in this context."),
          local_assets: z
            .array(z.string().min(1).max(80))
            .max(10)
            .optional()
            .describe("Zero-cost or low-cost local materials and environmental inputs."),
          constraints: z
            .array(z.string().min(1).max(100))
            .max(10)
            .optional()
            .describe("Economic, legal, or infrastructure constraints shaping the rollout."),
          current_skills: z
            .array(z.string().min(1).max(80))
            .max(10)
            .optional()
            .describe("Existing skills that can be monetized quickly."),
          connectivity_profile: z
            .enum(["offline_first", "intermittent", "always_online"])
            .optional()
            .describe("How reliable the network environment is for the intended users."),
        },
      )
      .meta({ category: "arbor", tier: "free" })
      .handler(async ({ input }) => {
        const mapped = mapArborContext({
          regionContext: input.region_context,
          targetUser: input.target_user,
          ...(input.local_assets !== undefined ? { localAssets: input.local_assets } : {}),
          ...(input.constraints !== undefined ? { constraints: input.constraints } : {}),
          ...(input.current_skills !== undefined ? { currentSkills: input.current_skills } : {}),
          ...(input.connectivity_profile !== undefined
            ? { connectivityProfile: input.connectivity_profile }
            : {}),
        });

        return jsonResult(mapped.summary, mapped);
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "arbor_plan_pilot",
        "Design a constrained Arbor pilot with phases, metrics, required product surface, and rollout guardrails.",
        {
          region: z.string().min(1).max(160).describe("Region for the pilot."),
          target_user: z.string().min(1).max(120).describe("Who the pilot is designed for."),
          pilot_goal: z
            .enum([
              "income_generation",
              "asset_creation",
              "business_formalization",
              "offline_distribution",
            ])
            .describe("Primary outcome the pilot must prove."),
          partner_model: z
            .enum(["independent", "co_op", "ngo", "municipality", "school"])
            .describe("Local partner structure that will carry the rollout."),
          time_horizon_days: z
            .number()
            .int()
            .min(14)
            .max(180)
            .optional()
            .describe("Pilot duration in days. Defaults to 45."),
          local_assets: z
            .array(z.string().min(1).max(80))
            .max(10)
            .optional()
            .describe("Specific local inputs or materials the pilot will start from."),
        },
      )
      .meta({ category: "arbor", tier: "free" })
      .handler(async ({ input }) => {
        const plan = planArborPilot({
          region: input.region,
          targetUser: input.target_user,
          pilotGoal: input.pilot_goal,
          partnerModel: input.partner_model,
          ...(input.time_horizon_days !== undefined
            ? { timeHorizonDays: input.time_horizon_days }
            : {}),
          ...(input.local_assets !== undefined ? { localAssets: input.local_assets } : {}),
        });

        return jsonResult(plan.summary, plan);
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "arbor_assess_risk",
        "Build a Project Arbor risk register covering enforcement, payments, identity, connectivity, and distribution pressure.",
        {
          jurisdiction_summary: z
            .string()
            .min(1)
            .max(160)
            .describe("Short description of the legal and operating environment."),
          enforcement_risk: z
            .enum(["low", "medium", "high"])
            .describe("Likelihood of enforcement pressure, seizure, or interference."),
          connectivity_profile: z
            .enum(["offline_first", "intermittent", "always_online"])
            .describe("Network reliability in the intended deployment environment."),
          payment_reliability: z
            .enum(["low", "medium", "high"])
            .describe("How reliable payouts and settlement rails are in practice."),
          identity_requirements: z
            .enum(["low", "medium", "high"])
            .describe("How restrictive KYC, permit, or registration requirements are."),
          partner_model: z
            .enum(["independent", "co_op", "ngo", "municipality", "school"])
            .describe("Local partner structure that will own or support the rollout."),
          sensitive_activities: z
            .array(z.string().min(1).max(80))
            .max(10)
            .optional()
            .describe("Optional activities likely to attract added scrutiny."),
        },
      )
      .meta({ category: "arbor", tier: "free" })
      .handler(async ({ input }) => {
        const riskRegister = buildArborRiskRegister({
          jurisdictionSummary: input.jurisdiction_summary,
          enforcementRisk: input.enforcement_risk,
          connectivityProfile: input.connectivity_profile,
          paymentReliability: input.payment_reliability,
          identityRequirements: input.identity_requirements,
          partnerModel: input.partner_model,
          ...(input.sensitive_activities !== undefined
            ? { sensitiveActivities: input.sensitive_activities }
            : {}),
        });

        return jsonResult(riskRegister.summary, riskRegister);
      }),
  );

  registry.registerBuilt(
    t
      .tool(
        "arbor_write_pitch",
        "Generate a concise Project Arbor pitch for investors, grantmakers, pilot partners, or operators.",
        {
          audience: z
            .enum(["investor", "grant", "pilot_partner", "operator"])
            .describe("Who the pitch is for."),
          format: z
            .enum(["one_liner", "thirty_second", "memo"])
            .describe("How long and detailed the pitch should be."),
          region: z
            .string()
            .min(1)
            .max(120)
            .optional()
            .describe("Optional region to localize the narrative."),
          target_user: z
            .string()
            .min(1)
            .max(120)
            .optional()
            .describe("Optional target user segment to anchor the narrative."),
          ask: z
            .string()
            .min(1)
            .max(240)
            .optional()
            .describe("Optional explicit ask or next step to end on."),
        },
      )
      .meta({ category: "arbor", tier: "free" })
      .handler(async ({ input }) => {
        const pitch = buildArborPitch({
          audience: input.audience,
          format: input.format,
          ...(input.region !== undefined ? { region: input.region } : {}),
          ...(input.target_user !== undefined ? { targetUser: input.target_user } : {}),
          ...(input.ask !== undefined ? { ask: input.ask } : {}),
        });

        return jsonResult(pitch.pitch, pitch);
      }),
  );
}
