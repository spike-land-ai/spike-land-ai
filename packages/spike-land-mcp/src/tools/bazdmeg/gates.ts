/**
 * BAZDMEG+ Superpowers Quality Gates MCP Tools (CF Workers)
 *
 * Cloud-enforced gates that check whether the superpowers workflow was followed.
 * Ported from spike.land Prisma to Drizzle ORM + D1.
 *
 * Note: superpowersSession, workflowTransition, and gateCheckResult tables
 * are not yet in the D1 schema. These tools proxy to spike.land API.
 */

import { z } from "zod";
import type { ToolRegistryAdapter } from "../types";
import { freeTool } from "../../procedures/index";
import { textResult, safeToolCall, apiRequest } from "../tool-helpers";
import type { DrizzleDB } from "../../db/index";

export function registerBazdmegGatesTools(
  registry: ToolRegistryAdapter,
  userId: string,
  db: DrizzleDB,
): void {
  const t = freeTool(userId, db);

  // bazdmeg_superpowers_gate_check
  registry.registerBuilt(
    t
      .tool(
        "bazdmeg_superpowers_gate_check",
        "Check 5 superpowers workflow gates for a session: brainstorming, planning, TDD, review, verification. Returns each gate as GREEN/YELLOW/RED.",
        {
          sessionId: z.string().describe("Workflow session ID to check gates for"),
        },
      )
      .meta({ category: "bazdmeg", tier: "workspace" })
      .handler(async ({ input }) => {
        return safeToolCall("bazdmeg_superpowers_gate_check", async () => {
          const result = await apiRequest<{
            gates: Array<{ name: string; status: string; detail: string }>;
            overallStatus: string;
          }>(`/api/bazdmeg/gates/check`, {
            method: "POST",
            body: JSON.stringify({ sessionId: input.sessionId }),
          });

          const statusLabel = (status: string): string => {
            switch (status) {
              case "GREEN":
                return "[GREEN]";
              case "YELLOW":
                return "[YELLOW]";
              case "RED":
                return "[RED]";
              default:
                return `[${status}]`;
            }
          };

          let text = `**Superpowers Workflow Gates** ${statusLabel(result.overallStatus)}\n\n`;
          text += `| Gate | Status | Detail |\n`;
          text += `|------|--------|--------|\n`;
          for (const gate of result.gates) {
            text += `| ${gate.name} | ${statusLabel(gate.status)} | ${gate.detail} |\n`;
          }

          text += `\n**Overall: ${result.overallStatus}**`;
          if (result.overallStatus === "RED") {
            text += ` — Workflow gaps must be addressed before claiming completion.`;
          } else if (result.overallStatus === "YELLOW") {
            text += ` — Minor gaps noted. Proceed with caution.`;
          } else {
            text += ` — All workflow gates passing. Safe to proceed.`;
          }

          return textResult(text);
        });
      }),
  );

  // bazdmeg_superpowers_gate_override
  registry.registerBuilt(
    t
      .tool(
        "bazdmeg_superpowers_gate_override",
        "Admin override for a specific workflow gate. Marks it as GREEN with the given reason.",
        {
          sessionId: z.string().describe("Session ID"),
          gateName: z
            .string()
            .describe("Gate name to override (Brainstorming, Planning, TDD, Review, Verification)"),
          reason: z.string().describe("Reason for override"),
        },
      )
      .meta({ category: "bazdmeg", tier: "workspace" })
      .handler(async ({ input }) => {
        return safeToolCall("bazdmeg_superpowers_gate_override", async () => {
          await apiRequest(`/api/bazdmeg/gates/override`, {
            method: "POST",
            body: JSON.stringify({
              sessionId: input.sessionId,
              gateName: input.gateName,
              reason: input.reason,
            }),
          });

          return textResult(
            `**Gate Override Applied**\n\n` +
              `Gate "${input.gateName}" overridden to GREEN.\n` +
              `Reason: ${input.reason}`,
          );
        });
      }),
  );
}
