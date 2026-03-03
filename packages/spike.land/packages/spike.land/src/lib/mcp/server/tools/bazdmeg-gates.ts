/**
 * BAZDMEG+ Superpowers Quality Gates MCP Tools
 *
 * Cloud-enforced gates that check whether the superpowers workflow was followed.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import { logger } from "@/lib/logger";

type GateStatus = "GREEN" | "YELLOW" | "RED";

interface GateResult {
  name: string;
  status: GateStatus;
  detail: string;
}

function statusEmoji(status: GateStatus): string {
  switch (status) {
    case "GREEN":
      return "[GREEN]";
    case "YELLOW":
      return "[YELLOW]";
    case "RED":
      return "[RED]";
  }
}

export function registerBazdmegGatesTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // bazdmeg_superpowers_gate_check
  const GateCheckSchema = z.object({
    sessionId: z.string().describe("Workflow session ID to check gates for"),
  });

  registry.register({
    name: "bazdmeg_superpowers_gate_check",
    description:
      "Check 5 superpowers workflow gates for a session: brainstorming, planning, TDD, review, verification. Returns each gate as GREEN/YELLOW/RED.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: GateCheckSchema.shape,
    handler: async ({
      sessionId,
    }: z.infer<typeof GateCheckSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_superpowers_gate_check", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const session = await prisma.superpowersSession.findFirst({
          where: { id: sessionId, userId },
        });

        if (!session) {
          return textResult(`Session not found: ${sessionId}`);
        }

        const transitions = await prisma.workflowTransition.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
        });

        const skillEvents = await prisma.skillUsageEvent.findMany({
          where: { sessionId },
          orderBy: { createdAt: "asc" },
        });

        const gates: GateResult[] = [];

        // Gate 1: Brainstorming Gate
        const brainstormSkills = skillEvents.filter(
          e => e.skillName.includes("brainstorm"),
        );
        const hadBrainstormingPhase = transitions.some(
          t => t.fromPhase === "BRAINSTORMING",
        ) || session.currentPhase === "BRAINSTORMING";

        if (brainstormSkills.length > 0) {
          gates.push({
            name: "Brainstorming",
            status: "GREEN",
            detail: `Brainstorming skill invoked (${brainstormSkills.length}x)`,
          });
        } else if (hadBrainstormingPhase) {
          gates.push({
            name: "Brainstorming",
            status: "YELLOW",
            detail: "Brainstorming phase recorded but skill not explicitly invoked",
          });
        } else {
          gates.push({
            name: "Brainstorming",
            status: "RED",
            detail: "No brainstorming skill or phase found before planning",
          });
        }

        // Gate 2: Planning Gate
        const planSkills = skillEvents.filter(
          e => e.skillName.includes("plan") || e.skillName.includes("design"),
        );
        const hadPlanningPhase = transitions.some(
          t => t.fromPhase === "PLANNING" || t.toPhase === "PLANNING",
        );

        if (planSkills.length > 0 && hadPlanningPhase) {
          gates.push({
            name: "Planning",
            status: "GREEN",
            detail: `Planning phase + skill invoked (${planSkills.length}x)`,
          });
        } else if (hadPlanningPhase) {
          gates.push({
            name: "Planning",
            status: "YELLOW",
            detail: "Planning phase recorded but no planning skill invoked",
          });
        } else {
          gates.push({
            name: "Planning",
            status: "RED",
            detail: "No planning phase or skill found before implementation",
          });
        }

        // Gate 3: TDD Gate
        const tddSkills = skillEvents.filter(
          e =>
            e.skillName.includes("tdd")
            || e.skillName.includes("test")
            || e.skillName.includes("red-green"),
        );
        const hadImplementing = transitions.some(
          t => t.fromPhase === "IMPLEMENTING" || t.toPhase === "IMPLEMENTING",
        );

        if (tddSkills.length > 0) {
          const successTdd = tddSkills.filter(e => e.outcome === "success");
          gates.push({
            name: "TDD",
            status: successTdd.length > 0 ? "GREEN" : "YELLOW",
            detail:
              `TDD/test skills invoked (${tddSkills.length}x, ${successTdd.length} successful)`,
          });
        } else if (hadImplementing) {
          gates.push({
            name: "TDD",
            status: "RED",
            detail: "Implementation phase found but no TDD/test skills invoked",
          });
        } else {
          gates.push({
            name: "TDD",
            status: "YELLOW",
            detail: "No implementation phase yet — TDD gate not applicable",
          });
        }

        // Gate 4: Review Gate
        const reviewSkills = skillEvents.filter(
          e =>
            e.skillName.includes("review")
            || e.skillName.includes("code-review"),
        );
        const hadReviewing = transitions.some(
          t => t.fromPhase === "REVIEWING" || t.toPhase === "REVIEWING",
        );

        if (reviewSkills.length > 0) {
          gates.push({
            name: "Review",
            status: "GREEN",
            detail: `Review skill invoked (${reviewSkills.length}x)`,
          });
        } else if (hadReviewing) {
          gates.push({
            name: "Review",
            status: "YELLOW",
            detail: "Review phase recorded but no review skill invoked",
          });
        } else {
          gates.push({
            name: "Review",
            status: "RED",
            detail: "No review phase or skill found",
          });
        }

        // Gate 5: Verification Gate
        const verifySkills = skillEvents.filter(
          e =>
            e.skillName.includes("verification")
            || e.skillName.includes("verify")
            || e.skillName.includes("finishing"),
        );

        if (verifySkills.length > 0) {
          const successVerify = verifySkills.filter(e => e.outcome === "success");
          gates.push({
            name: "Verification",
            status: successVerify.length > 0 ? "GREEN" : "YELLOW",
            detail:
              `Verification skills invoked (${verifySkills.length}x, ${successVerify.length} successful)`,
          });
        } else {
          gates.push({
            name: "Verification",
            status: "RED",
            detail: "No verification skill invoked before completion",
          });
        }

        // Save gate results atomically (replace previous check results)
        await prisma.$transaction(async tx => {
          await tx.gateCheckResult.deleteMany({
            where: { sessionId },
          });
          for (const gate of gates) {
            await tx.gateCheckResult.create({
              data: {
                sessionId,
                gateName: gate.name,
                status: gate.status,
                detail: gate.detail,
              },
            });
          }
        });

        // Format output (same format as existing bazdmeg_quality_gates)
        const overallStatus: GateStatus = gates.some(g => g.status === "RED")
          ? "RED"
          : gates.some(g => g.status === "YELLOW")
          ? "YELLOW"
          : "GREEN";

        let text = `**Superpowers Workflow Gates** ${statusEmoji(overallStatus)}\n\n`;
        text += `| Gate | Status | Detail |\n`;
        text += `|------|--------|--------|\n`;
        for (const gate of gates) {
          text += `| ${gate.name} | ${statusEmoji(gate.status)} | ${gate.detail} |\n`;
        }

        text += `\n**Overall: ${overallStatus}**`;
        if (overallStatus === "RED") {
          text += ` — Workflow gaps must be addressed before claiming completion.`;
        } else if (overallStatus === "YELLOW") {
          text += ` — Minor gaps noted. Proceed with caution.`;
        } else {
          text += ` — All workflow gates passing. Safe to proceed.`;
        }

        return textResult(text);
      }),
  });

  // bazdmeg_superpowers_gate_override
  const OverrideSchema = z.object({
    sessionId: z.string().describe("Session ID"),
    gateName: z.string().describe(
      "Gate name to override (Brainstorming, Planning, TDD, Review, Verification)",
    ),
    reason: z.string().describe("Reason for override"),
  });

  registry.register({
    name: "bazdmeg_superpowers_gate_override",
    description:
      "Admin override for a specific workflow gate. Marks it as GREEN with the given reason.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: OverrideSchema.shape,
    handler: async ({
      sessionId,
      gateName,
      reason,
    }: z.infer<typeof OverrideSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_superpowers_gate_override", async () => {
        const { isAdminByUserId } = await import("@/lib/auth/admin-middleware");
        const isAdmin = await isAdminByUserId(userId);
        if (!isAdmin) {
          return textResult(
            "**Forbidden:** Only admins can override workflow gates.",
          );
        }

        const prisma = (await import("@/lib/prisma")).default;

        const session = await prisma.superpowersSession.findFirst({
          where: { id: sessionId },
        });

        if (!session) {
          return textResult(`Session not found: ${sessionId}`);
        }

        // Log cross-user admin override for security audit
        if (session.userId !== userId) {
          logger.warn(
            `[SECURITY] Admin ${userId} overriding gates for session ${sessionId} (owner: ${session.userId})`,
          );
        }

        const validGates = [
          "Brainstorming",
          "Planning",
          "TDD",
          "Review",
          "Verification",
        ];
        if (!validGates.includes(gateName)) {
          return textResult(
            `Invalid gate name: ${gateName}. Valid gates: ${validGates.join(", ")}`,
          );
        }

        await prisma.gateCheckResult.create({
          data: {
            sessionId,
            gateName,
            status: "GREEN",
            detail: `Admin override by ${userId}: ${reason}`,
          },
        });

        return textResult(
          `**Gate Override Applied**\n\n`
            + `Gate "${gateName}" overridden to GREEN.\n`
            + `Reason: ${reason}`,
        );
      }),
  });
}
