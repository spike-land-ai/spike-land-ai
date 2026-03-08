/**
 * Audit Questionnaire MCP Tools (CF Workers)
 *
 * Tools for submitting persona audit evaluations, viewing results,
 * and comparing personas across segments.
 */

import { z } from "zod";
import { eq, sql } from "drizzle-orm";
import type { ToolRegistry } from "../../../lazy-imports/registry";
import { freeTool, jsonResult } from "../../../lazy-imports/procedures-index.ts";
import type { DrizzleDB } from "../../db/db-index.ts";
import { personaAuditBatches, personaAuditResults } from "../../db/schema";
import { PERSONAS } from "../../../core-logic/lib/persona-data";

const SEGMENTS: Record<string, string[]> = {
  Developer: [
    "ai-indie",
    "classic-indie",
    "agency-dev",
    "in-house-dev",
    "ml-engineer",
    "ai-hobbyist",
    "enterprise-devops",
    "startup-devops",
  ],
  Business: ["technical-founder", "nontechnical-founder", "growth-leader", "ops-leader"],
  Creator: ["content-creator", "hobbyist-creator", "social-gamer", "solo-explorer"],
};

function getSegment(slug: string): string {
  for (const [segment, slugs] of Object.entries(SEGMENTS)) {
    if (slugs.includes(slug)) return segment;
  }
  return "Unknown";
}

export function registerAuditQuestionnaireTools(
  registry: ToolRegistry,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // audit_submit_evaluation
  registry.registerBuilt(
    t
      .tool(
        "audit_submit_evaluation",
        "Submit an audit evaluation for a single persona within a batch.",
        {
          persona_slug: z.string().describe("Slug of the persona being evaluated"),
          batch_id: z.string().describe("Batch this evaluation belongs to"),
          ux_score: z.number().int().min(1).max(5).describe("UX quality score (1-5)"),
          content_relevance: z
            .number()
            .int()
            .min(1)
            .max(5)
            .describe("Content relevance score (1-5)"),
          cta_compelling: z.number().int().min(1).max(5).describe("CTA effectiveness score (1-5)"),
          recommended_apps_relevant: z
            .number()
            .int()
            .min(1)
            .max(5)
            .describe("App recommendations score (1-5)"),
          would_sign_up: z.boolean().describe("Would this persona sign up?"),
          blockers: z.string().optional().describe("Blocking issues found"),
          highlights: z.string().optional().describe("Positive highlights"),
          accessibility_issues: z.array(z.string()).optional().describe("A11y issues found"),
          broken_links: z.array(z.string()).optional().describe("Broken links found"),
          performance_notes: z.string().optional().describe("Performance observations"),
        },
      )
      .meta({ category: "persona", tier: "free" })
      .handler(async ({ input }) => {
        const resultId = crypto.randomUUID();

        await db.insert(personaAuditResults).values({
          id: resultId,
          batchId: input.batch_id,
          personaSlug: input.persona_slug,
          uxScore: input.ux_score,
          contentRelevance: input.content_relevance,
          ctaCompelling: input.cta_compelling,
          recommendedAppsRelevant: input.recommended_apps_relevant,
          wouldSignUp: input.would_sign_up ? 1 : 0,
          blockers: input.blockers ?? "",
          highlights: input.highlights ?? "",
          accessibilityIssues: JSON.stringify(input.accessibility_issues ?? []),
          brokenLinks: JSON.stringify(input.broken_links ?? []),
          performanceNotes: input.performance_notes ?? "",
          createdAt: Date.now(),
        });

        await db.run(
          sql`UPDATE persona_audit_batches SET completed_count = completed_count + 1, status = CASE WHEN completed_count + 1 >= total_personas THEN 'completed' ELSE 'in_progress' END, completed_at = CASE WHEN completed_count + 1 >= total_personas THEN ${Date.now()} ELSE completed_at END WHERE id = ${input.batch_id}`,
        );

        return jsonResult(
          `Evaluation submitted for persona "${input.persona_slug}" in batch ${input.batch_id}.`,
          { resultId, personaSlug: input.persona_slug, batchId: input.batch_id },
        );
      }),
  );

  // audit_get_results
  registry.registerBuilt(
    t
      .tool(
        "audit_get_results",
        "Get all audit results for a batch, formatted as a markdown table.",
        {
          batch_id: z.string().describe("Batch ID to retrieve results for"),
        },
      )
      .meta({ category: "persona", tier: "free" })
      .handler(async ({ input }) => {
        const batches = await db
          .select()
          .from(personaAuditBatches)
          .where(eq(personaAuditBatches.id, input.batch_id));

        const batch = batches[0];
        if (!batch) {
          return jsonResult(`Batch "${input.batch_id}" not found.`, { error: "not_found" });
        }

        const results = await db
          .select()
          .from(personaAuditResults)
          .where(eq(personaAuditResults.batchId, input.batch_id));

        if (results.length === 0) {
          return jsonResult(`Batch "${input.batch_id}" exists but has no results yet.`, {
            batch,
            results: [],
          });
        }

        const header = "| Persona | UX | Content | CTA | Apps | Sign Up | Blockers |";
        const divider = "|---------|----|---------| ----|------|---------|----------|";
        const rows = results.map((r) => {
          const persona = PERSONAS.find((p) => p.slug === r.personaSlug);
          const name = persona ? persona.name : r.personaSlug;
          const signUp = r.wouldSignUp ? "Yes" : "No";
          const blockers = r.blockers || "-";
          return `| ${name} | ${r.uxScore} | ${r.contentRelevance} | ${r.ctaCompelling} | ${r.recommendedAppsRelevant} | ${signUp} | ${blockers} |`;
        });

        const table = [header, divider, ...rows].join("\n");
        const status = `**Batch status**: ${batch.status} (${batch.completedCount}/${batch.totalPersonas})`;

        return jsonResult(`${status}\n\n${table}`, { batch, resultCount: results.length });
      }),
  );

  // audit_compare_personas
  registry.registerBuilt(
    t
      .tool(
        "audit_compare_personas",
        "Compare persona audit results across segments (Developer, Business, Creator).",
        {
          batch_id: z.string().describe("Batch ID to compare results for"),
        },
      )
      .meta({ category: "persona", tier: "free" })
      .handler(async ({ input }) => {
        const results = await db
          .select()
          .from(personaAuditResults)
          .where(eq(personaAuditResults.batchId, input.batch_id));

        if (results.length === 0) {
          return jsonResult(`No results found for batch "${input.batch_id}".`, {
            error: "no_results",
          });
        }

        // Group by segment
        const segmentScores: Record<
          string,
          { total: number; ux: number; content: number; cta: number; apps: number; signups: number }
        > = {};

        for (const r of results) {
          const seg = getSegment(r.personaSlug);
          if (!segmentScores[seg]) {
            segmentScores[seg] = { total: 0, ux: 0, content: 0, cta: 0, apps: 0, signups: 0 };
          }
          const s = segmentScores[seg];
          s.total++;
          s.ux += r.uxScore;
          s.content += r.contentRelevance;
          s.cta += r.ctaCompelling;
          s.apps += r.recommendedAppsRelevant;
          s.signups += r.wouldSignUp;
        }

        // Segment averages table
        const header = "| Segment | Avg UX | Avg Content | Avg CTA | Avg Apps | Signup % |";
        const divider = "|---------|--------|-------------|---------|----------|----------|";
        const rows = Object.entries(segmentScores).map(([seg, s]) => {
          const avgUx = (s.ux / s.total).toFixed(1);
          const avgContent = (s.content / s.total).toFixed(1);
          const avgCta = (s.cta / s.total).toFixed(1);
          const avgApps = (s.apps / s.total).toFixed(1);
          const signupPct = ((s.signups / s.total) * 100).toFixed(0);
          return `| ${seg} | ${avgUx} | ${avgContent} | ${avgCta} | ${avgApps} | ${signupPct}% |`;
        });

        const segmentTable = [header, divider, ...rows].join("\n");

        // Best/worst personas by average score
        const scored = results.map((r) => {
          const avg =
            (r.uxScore + r.contentRelevance + r.ctaCompelling + r.recommendedAppsRelevant) / 4;
          const persona = PERSONAS.find((p) => p.slug === r.personaSlug);
          return { slug: r.personaSlug, name: persona ? persona.name : r.personaSlug, avg };
        });
        scored.sort((a, b) => b.avg - a.avg);

        const best = scored[0]!;
        const worst = scored[scored.length - 1]!;

        const insights = [
          `**Best performing**: ${best.name} (avg ${best.avg.toFixed(1)})`,
          `**Worst performing**: ${worst.name} (avg ${worst.avg.toFixed(1)})`,
        ].join("\n");

        return jsonResult(
          `## Segment Comparison\n\n${segmentTable}\n\n## Insights\n\n${insights}`,
          { segmentScores, best: best.slug, worst: worst.slug },
        );
      }),
  );
}
