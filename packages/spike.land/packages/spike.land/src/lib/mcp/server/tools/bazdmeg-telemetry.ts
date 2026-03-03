/**
 * BAZDMEG+ Skill Usage Telemetry MCP Tools
 *
 * Track skill invocations within workflow sessions and surface insights.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import { logger } from "@/lib/logger";

export function registerBazdmegTelemetryTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // bazdmeg_skill_invoke
  const InvokeSchema = z.object({
    skillName: z.string().describe("Name of the skill being invoked"),
    sessionId: z.string().optional().describe("Workflow session ID to link to"),
    agentId: z.string().optional().describe("Agent identifier"),
    category: z.string().optional().describe(
      "Skill category (process, implementation, etc.)",
    ),
  });

  registry.register({
    name: "bazdmeg_skill_invoke",
    description: "Record a skill invocation. Returns event ID for use with bazdmeg_skill_complete.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: InvokeSchema.shape,
    handler: async ({
      skillName,
      sessionId,
      agentId,
      category,
    }: z.infer<typeof InvokeSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_skill_invoke", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const event = await prisma.skillUsageEvent.create({
          data: {
            userId,
            skillName,
            sessionId,
            agentId,
            category,
            outcome: "in_progress",
          },
        });

        return textResult(
          `**Skill Invocation Recorded**\n\n`
            + `- **Event ID:** ${event.id}\n`
            + `- **Skill:** ${skillName}\n`
            + (sessionId ? `- **Session:** ${sessionId}\n` : "")
            + `\nCall \`bazdmeg_skill_complete\` with this event ID when done.`,
        );
      }),
  });

  // bazdmeg_skill_complete
  const CompleteSchema = z.object({
    eventId: z.string().describe("Event ID from bazdmeg_skill_invoke"),
    outcome: z
      .enum(["success", "failure", "skipped"])
      .describe("Skill outcome"),
    durationMs: z.number().int().optional().describe(
      "Duration in milliseconds",
    ),
  });

  registry.register({
    name: "bazdmeg_skill_complete",
    description:
      "Record skill completion with outcome. Updates the event created by bazdmeg_skill_invoke.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: CompleteSchema.shape,
    handler: async ({
      eventId,
      outcome,
      durationMs,
    }: z.infer<typeof CompleteSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_skill_complete", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const event = await prisma.skillUsageEvent.findUnique({
          where: { id: eventId },
        });

        if (!event) {
          return textResult(`Skill event not found: ${eventId}`);
        }

        const computedDuration = durationMs
          ?? (Date.now() - event.createdAt.getTime());

        await prisma.skillUsageEvent.update({
          where: { id: eventId },
          data: { outcome, durationMs: computedDuration },
        });

        return textResult(
          `**Skill Completed**\n\n`
            + `- **Skill:** ${event.skillName}\n`
            + `- **Outcome:** ${outcome}\n`
            + `- **Duration:** ${Math.round(computedDuration / 1000)}s`,
        );
      }),
  });

  // bazdmeg_telemetry_insights
  const InsightsSchema = z.object({
    sessionId: z.string().optional().describe("Scope to a specific session"),
    days: z
      .number()
      .int()
      .min(1)
      .max(365)
      .optional()
      .describe("Lookback period in days (default 30)"),
  });

  registry.register({
    name: "bazdmeg_telemetry_insights",
    description:
      "Aggregated telemetry: most used skills, avg time per phase, pass/fail rates. Auto-creates memory entries for detected patterns.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: InsightsSchema.shape,
    handler: async ({
      sessionId,
      days,
    }: z.infer<typeof InsightsSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_telemetry_insights", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const lookbackDays = days ?? 30;
        const since = new Date(Date.now() - lookbackDays * 86400000);

        // Skill usage aggregation
        const skillWhere = {
          userId,
          createdAt: { gte: since },
          ...(sessionId ? { sessionId } : {}),
        };

        const skillEvents = await prisma.skillUsageEvent.findMany({
          where: skillWhere,
          orderBy: { createdAt: "desc" },
          take: 10000,
        });

        // Count by skill name
        const skillCounts = new Map<
          string,
          { total: number; success: number; failure: number; skipped: number; }
        >();
        for (const e of skillEvents) {
          const existing = skillCounts.get(e.skillName)
            ?? { total: 0, success: 0, failure: 0, skipped: 0 };
          existing.total++;
          if (e.outcome === "success") existing.success++;
          else if (e.outcome === "failure") existing.failure++;
          else if (e.outcome === "skipped") existing.skipped++;
          skillCounts.set(e.skillName, existing);
        }

        // Phase duration aggregation
        const transitionWhere = {
          session: { userId },
          createdAt: { gte: since },
          ...(sessionId ? { sessionId } : {}),
        };

        const transitions = await prisma.workflowTransition.findMany({
          where: transitionWhere,
          take: 10000,
        });

        const phaseDurations = new Map<string, number[]>();
        for (const t of transitions) {
          if (t.durationMs) {
            const existing = phaseDurations.get(t.fromPhase) ?? [];
            existing.push(t.durationMs);
            phaseDurations.set(t.fromPhase, existing);
          }
        }

        // Format output
        let text = `**Telemetry Insights** (last ${lookbackDays} days)\n\n`;

        // Top skills
        const sorted = [...skillCounts.entries()].sort((a, b) => b[1].total - a[1].total).slice(
          0,
          10,
        );
        if (sorted.length > 0) {
          text += `### Most Used Skills\n\n`;
          text += `| Skill | Uses | Success | Fail | Skipped |\n`;
          text += `|-------|------|---------|------|---------|\n`;
          for (const [name, counts] of sorted) {
            text +=
              `| ${name} | ${counts.total} | ${counts.success} | ${counts.failure} | ${counts.skipped} |\n`;
          }
          text += `\n`;
        } else {
          text += `No skill usage events in the last ${lookbackDays} days.\n\n`;
        }

        // Phase durations
        if (phaseDurations.size > 0) {
          text += `### Average Phase Duration\n\n`;
          text += `| Phase | Avg Duration | Samples |\n`;
          text += `|-------|-------------|----------|\n`;
          for (const [phase, durations] of phaseDurations) {
            const avg = durations.reduce((a, b) => a + b, 0) / durations.length;
            text += `| ${phase} | ${Math.round(avg / 1000)}s | ${durations.length} |\n`;
          }
          text += `\n`;
        }

        // Pattern detection + auto-memory
        const memories: string[] = [];

        // Check if TDD is being skipped
        const tddEvents = skillEvents.filter(e =>
          e.skillName.includes("tdd") || e.skillName.includes("test")
        );
        const totalSessions = new Set(
          skillEvents.filter(e => e.sessionId).map(e => e.sessionId),
        ).size;
        const tddSessions = new Set(
          tddEvents.filter(e => e.sessionId).map(e => e.sessionId),
        ).size;
        if (totalSessions >= 5 && tddSessions / totalSessions < 0.4) {
          const insight = `TDD skills used in only ${
            Math.round((tddSessions / totalSessions) * 100)
          }% of sessions (${tddSessions}/${totalSessions})`;
          memories.push(insight);
        }

        // Check for high failure rates
        for (const [name, counts] of skillCounts) {
          if (counts.total >= 3 && counts.failure / counts.total > 0.5) {
            memories.push(
              `Skill "${name}" has a ${
                Math.round((counts.failure / counts.total) * 100)
              }% failure rate`,
            );
          }
        }

        // Auto-create memory entries
        if (memories.length > 0) {
          text += `### Detected Patterns\n\n`;
          const failures: string[] = [];
          for (const m of memories) {
            text += `- ${m}\n`;
            try {
              await prisma.bazdmegMemory.create({
                data: {
                  insight: m,
                  sourceQuestion: "bazdmeg_telemetry_insights auto-detection",
                  tags: ["telemetry", "auto-detected"],
                  confidence: 0.7,
                },
              });
            } catch (err) {
              failures.push(m);
              logger.error(
                "[bazdmeg_telemetry_insights] Failed to save memory:",
                err,
              );
            }
          }
          if (failures.length > 0) {
            text +=
              `\n_Failed to save ${failures.length} of ${memories.length} pattern(s) to memory._\n`;
          } else {
            text += `\n_Patterns saved to BAZDMEG memory._\n`;
          }
        }

        return textResult(text);
      }),
  });
}
