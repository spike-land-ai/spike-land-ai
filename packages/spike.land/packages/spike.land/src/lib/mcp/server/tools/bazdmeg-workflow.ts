/**
 * BAZDMEG+ Workflow Tracking MCP Tools
 *
 * Track superpowers workflow sessions: start, transition, status, list, complete, abandon.
 * Foundation for cloud-powered quality gates and telemetry.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";

const VALID_TRANSITIONS: Record<string, string[]> = {
  BRAINSTORMING: ["PLANNING"],
  PLANNING: ["IMPLEMENTING", "BRAINSTORMING"],
  IMPLEMENTING: ["REVIEWING", "BRAINSTORMING"],
  REVIEWING: ["FINISHING", "IMPLEMENTING", "BRAINSTORMING"],
  FINISHING: ["BRAINSTORMING"],
};

const PHASE_ORDER = [
  "BRAINSTORMING",
  "PLANNING",
  "IMPLEMENTING",
  "REVIEWING",
  "FINISHING",
];

export function registerBazdmegWorkflowTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // bazdmeg_workflow_start
  const StartSchema = z.object({
    projectName: z.string().optional().describe("Project or repo name"),
    branchName: z.string().optional().describe("Git branch name"),
    agentId: z.string().optional().describe("Agent identifier"),
  });

  registry.register({
    name: "bazdmeg_workflow_start",
    description:
      "Start a new superpowers workflow session. Returns session ID for use in subsequent workflow calls.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: StartSchema.shape,
    handler: async ({
      projectName,
      branchName,
      agentId,
    }: z.infer<typeof StartSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_workflow_start", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const session = await prisma.superpowersSession.create({
          data: {
            userId,
            agentId,
            projectName,
            branchName,
            currentPhase: "BRAINSTORMING",
          },
        });

        return textResult(
          `**Workflow Session Started**\n\n`
            + `- **Session ID:** ${session.id}\n`
            + `- **Phase:** BRAINSTORMING\n`
            + (projectName ? `- **Project:** ${projectName}\n` : "")
            + (branchName ? `- **Branch:** ${branchName}\n` : "")
            + `\nUse this session ID for \`bazdmeg_workflow_transition\` calls.`,
        );
      }),
  });

  // bazdmeg_workflow_transition
  const TransitionSchema = z.object({
    sessionId: z.string().describe("Session ID from bazdmeg_workflow_start"),
    toPhase: z
      .enum([
        "BRAINSTORMING",
        "PLANNING",
        "IMPLEMENTING",
        "REVIEWING",
        "FINISHING",
      ])
      .describe("Target workflow phase"),
  });

  registry.register({
    name: "bazdmeg_workflow_transition",
    description:
      "Record a workflow phase transition. Validates phase ordering: brainstorming→planning→implementing→reviewing→finishing. Back-to-brainstorming always allowed.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: TransitionSchema.shape,
    handler: async ({
      sessionId,
      toPhase,
    }: z.infer<typeof TransitionSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_workflow_transition", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const session = await prisma.superpowersSession.findFirst({
          where: { id: sessionId, userId },
        });

        if (!session) {
          return textResult(`Session not found: ${sessionId}`);
        }

        if (
          session.currentPhase === "COMPLETED"
          || session.currentPhase === "ABANDONED"
        ) {
          return textResult(
            `Cannot transition — session is ${session.currentPhase}.`,
          );
        }

        const fromPhase = session.currentPhase;

        // Back-to-brainstorming is always valid (iteration)
        if (toPhase !== "BRAINSTORMING") {
          const allowed = VALID_TRANSITIONS[fromPhase];
          if (!allowed || !allowed.includes(toPhase)) {
            return textResult(
              `**Invalid transition:** ${fromPhase} → ${toPhase}\n\n`
                + `Allowed from ${fromPhase}: ${(allowed ?? []).join(", ")}\n`
                + `Back-to-BRAINSTORMING is always allowed.`,
            );
          }
        }

        // Compute duration from last transition or session start
        const lastTransition = await prisma.workflowTransition.findFirst({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
        });
        const lastTimestamp = lastTransition?.createdAt ?? session.startedAt;
        const durationMs = Date.now() - lastTimestamp.getTime();

        await prisma.workflowTransition.create({
          data: {
            sessionId,
            fromPhase,
            toPhase,
            durationMs,
          },
        });

        await prisma.superpowersSession.update({
          where: { id: sessionId },
          data: { currentPhase: toPhase },
        });

        const fromIdx = PHASE_ORDER.indexOf(fromPhase);
        const toIdx = PHASE_ORDER.indexOf(toPhase);
        const direction = toPhase === "BRAINSTORMING" && fromPhase !== "BRAINSTORMING"
          ? "↩ iteration"
          : toIdx > fromIdx
          ? "→ forward"
          : "→";

        return textResult(
          `**Phase Transition** (${direction})\n\n`
            + `${fromPhase} → **${toPhase}**\n`
            + `Duration in ${fromPhase}: ${Math.round(durationMs / 1000)}s\n`
            + `Session: ${sessionId}`,
        );
      }),
  });

  // bazdmeg_workflow_status
  const StatusSchema = z.object({
    sessionId: z.string().describe("Session ID to check"),
  });

  registry.register({
    name: "bazdmeg_workflow_status",
    description: "Get the current workflow state for a session, including phase history.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: StatusSchema.shape,
    handler: async ({
      sessionId,
    }: z.infer<typeof StatusSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_workflow_status", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const session = await prisma.superpowersSession.findFirst({
          where: { id: sessionId, userId },
          include: {
            transitions: { orderBy: { createdAt: "asc" } },
          },
        });

        if (!session) {
          return textResult(`Session not found: ${sessionId}`);
        }

        let text = `**Workflow Status**\n\n`;
        text += `- **Session:** ${session.id}\n`;
        text += `- **Phase:** ${session.currentPhase}\n`;
        text += `- **Started:** ${session.startedAt.toISOString()}\n`;
        if (session.projectName) {
          text += `- **Project:** ${session.projectName}\n`;
        }
        if (session.branchName) text += `- **Branch:** ${session.branchName}\n`;
        if (session.completedAt) {
          text += `- **Completed:** ${session.completedAt.toISOString()}\n`;
        }

        if (session.transitions.length > 0) {
          text += `\n**Phase History:**\n\n`;
          text += `| # | From | To | Duration |\n`;
          text += `|---|------|----|----------|\n`;
          for (let i = 0; i < session.transitions.length; i++) {
            const t = session.transitions[i]!;
            const dur = t.durationMs
              ? `${Math.round(t.durationMs / 1000)}s`
              : "—";
            text += `| ${i + 1} | ${t.fromPhase} | ${t.toPhase} | ${dur} |\n`;
          }
        } else {
          text += `\nNo transitions yet (still in initial phase).`;
        }

        return textResult(text);
      }),
  });

  // bazdmeg_workflow_list
  const ListSchema = z.object({
    limit: z
      .number()
      .int()
      .min(1)
      .max(50)
      .optional()
      .describe("Max results (default 10)"),
    includeCompleted: z
      .boolean()
      .optional()
      .describe("Include completed/abandoned sessions (default false)"),
  });

  registry.register({
    name: "bazdmeg_workflow_list",
    description: "List active or recent superpowers workflow sessions.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: ListSchema.shape,
    handler: async ({
      limit,
      includeCompleted,
    }: z.infer<typeof ListSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_workflow_list", async () => {
        const prisma = (await import("@/lib/prisma")).default;
        const take = limit ?? 10;

        const where = includeCompleted ? { userId } : {
          userId,
          currentPhase: { notIn: ["COMPLETED" as const, "ABANDONED" as const] },
        };

        const sessions = await prisma.superpowersSession.findMany({
          where,
          orderBy: { startedAt: "desc" },
          take,
        });

        if (sessions.length === 0) {
          return textResult("No active workflow sessions found.");
        }

        let text = `**Workflow Sessions** (${sessions.length})\n\n`;
        text += `| Session | Phase | Project | Started |\n`;
        text += `|---------|-------|---------|---------|\n`;
        for (const s of sessions) {
          const started = s.startedAt.toISOString().slice(0, 16);
          text += `| ${s.id.slice(0, 8)}… | ${s.currentPhase} | ${
            s.projectName ?? "—"
          } | ${started} |\n`;
        }

        return textResult(text);
      }),
  });

  // bazdmeg_workflow_complete
  const CompleteSchema = z.object({
    sessionId: z.string().describe("Session ID to mark complete"),
  });

  registry.register({
    name: "bazdmeg_workflow_complete",
    description: "Mark a workflow session as completed.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: CompleteSchema.shape,
    handler: async ({
      sessionId,
    }: z.infer<typeof CompleteSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_workflow_complete", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const session = await prisma.superpowersSession.findFirst({
          where: { id: sessionId, userId },
        });

        if (!session) {
          return textResult(`Session not found: ${sessionId}`);
        }

        if (session.currentPhase === "COMPLETED") {
          return textResult(`Session already completed.`);
        }

        const fromPhase = session.currentPhase;
        const now = new Date();

        // Compute duration from last transition or session start
        const lastTransition = await prisma.workflowTransition.findFirst({
          where: { sessionId },
          orderBy: { createdAt: "desc" },
        });
        const lastTimestamp = lastTransition?.createdAt ?? session.startedAt;
        const durationMs = now.getTime() - lastTimestamp.getTime();

        await prisma.workflowTransition.create({
          data: {
            sessionId,
            fromPhase,
            toPhase: "COMPLETED",
            durationMs,
          },
        });

        await prisma.superpowersSession.update({
          where: { id: sessionId },
          data: { currentPhase: "COMPLETED", completedAt: now },
        });

        return textResult(
          `**Session Completed**\n\n`
            + `Session ${sessionId} marked as COMPLETED.\n`
            + `Final phase was: ${fromPhase}`,
        );
      }),
  });

  // bazdmeg_workflow_abandon
  const AbandonSchema = z.object({
    sessionId: z.string().describe("Session ID to abandon"),
    reason: z.string().describe("Reason for abandonment"),
  });

  registry.register({
    name: "bazdmeg_workflow_abandon",
    description: "Mark a workflow session as abandoned with a reason.",
    category: "bazdmeg",
    tier: "workspace",
    inputSchema: AbandonSchema.shape,
    handler: async ({
      sessionId,
      reason,
    }: z.infer<typeof AbandonSchema>): Promise<CallToolResult> =>
      safeToolCall("bazdmeg_workflow_abandon", async () => {
        const prisma = (await import("@/lib/prisma")).default;

        const session = await prisma.superpowersSession.findFirst({
          where: { id: sessionId, userId },
        });

        if (!session) {
          return textResult(`Session not found: ${sessionId}`);
        }

        if (session.currentPhase === "ABANDONED") {
          return textResult(`Session already abandoned.`);
        }

        const fromPhase = session.currentPhase;
        const now = new Date();

        await prisma.workflowTransition.create({
          data: {
            sessionId,
            fromPhase,
            toPhase: "ABANDONED",
            metadata: { reason },
          },
        });

        await prisma.superpowersSession.update({
          where: { id: sessionId },
          data: {
            currentPhase: "ABANDONED",
            completedAt: now,
            metadata: { abandonReason: reason },
          },
        });

        return textResult(
          `**Session Abandoned**\n\n`
            + `Session ${sessionId} marked as ABANDONED.\n`
            + `Reason: ${reason}\n`
            + `Last phase was: ${fromPhase}`,
        );
      }),
  });
}
