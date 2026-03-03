/**
 * Requirements Interview MCP Tools
 *
 * Entry point of the BAZDMEG workflow. Guides users through 7 structured
 * requirements questions and generates a specification from the answers.
 */

import { z } from "zod";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ToolRegistry } from "../tool-registry";
import { safeToolCall, textResult } from "./tool-helpers";
import { randomUUID } from "node:crypto";

/* ------------------------------------------------------------------ */
/*  Data structures                                                    */
/* ------------------------------------------------------------------ */

interface InterviewQuestion {
  id: string;
  question: string;
  answer?: string;
  answeredAt?: Date;
}

interface Interview {
  id: string;
  userId: string;
  projectName: string;
  description: string;
  questions: InterviewQuestion[];
  createdAt: Date;
  completedAt?: Date;
}

interface StructuredSpec {
  projectName: string;
  problemStatement: string;
  dataSources: string;
  userFlows: string;
  constraints: string;
  failureModes: string;
  testPlan: string;
  explainability: string;
  decomposedTasks: string[];
}

const BAZDMEG_QUESTIONS: ReadonlyArray<{ id: string; question: string; }> = [
  {
    id: "problem",
    question:
      "What problem are we solving? State the problem in your own words, not the ticket's words.",
  },
  {
    id: "data",
    question:
      "What data already exists? What is the server-side source of truth? What APIs exist? What state is already managed?",
  },
  {
    id: "user_flow",
    question:
      "What is the user flow? Walk through every step the user takes, including edge cases and error states.",
  },
  {
    id: "constraints",
    question:
      "What should NOT change? Identify existing behavior, contracts, or interfaces that must be preserved.",
  },
  {
    id: "failure",
    question:
      "What happens on failure? Network errors, invalid input, race conditions, missing data.",
  },
  {
    id: "verification",
    question:
      "How will we verify it works? Name the specific tests: unit, E2E, agent-based. What constitutes 'done'?",
  },
  {
    id: "explainability",
    question: "Can you explain this approach to a teammate? If not, stop and learn more.",
  },
];

/* ------------------------------------------------------------------ */
/*  In-memory store                                                    */
/* ------------------------------------------------------------------ */

const interviews = new Map<string, Interview>();

/** Exported for testing — allows clearing state between tests. */
export function _clearInterviews(): void {
  interviews.clear();
}

/* ------------------------------------------------------------------ */
/*  Schemas                                                            */
/* ------------------------------------------------------------------ */

const InterviewStartSchema = z.object({
  project_name: z.string().min(1).describe(
    "Name of the project being specified.",
  ),
  initial_description: z.string().min(1).describe(
    "Brief description of what the project should accomplish.",
  ),
});

const AnswerItem = z.object({
  question_id: z.string().min(1).describe(
    "The question ID to answer (e.g. 'problem', 'data').",
  ),
  answer: z.string().min(1).describe("The answer text."),
});

const InterviewSubmitSchema = z.object({
  interview_id: z.string().min(1).describe("ID of the interview session."),
  answers: z.array(AnswerItem).min(1).describe("Array of answers to submit."),
});

const InterviewGenerateSpecSchema = z.object({
  interview_id: z.string().min(1).describe(
    "ID of the completed interview session.",
  ),
});

/* ------------------------------------------------------------------ */
/*  Registration                                                       */
/* ------------------------------------------------------------------ */

export function registerReqInterviewTools(
  registry: ToolRegistry,
  userId: string,
): void {
  // ── interview_start ────────────────────────────────────────────
  registry.register({
    name: "interview_start",
    description:
      "Start a BAZDMEG requirements interview session. Creates an interview with 7 structured questions that must be answered before a specification can be generated.",
    category: "orchestration",
    tier: "free",
    inputSchema: InterviewStartSchema.shape,
    handler: async ({
      project_name,
      initial_description,
    }: z.infer<typeof InterviewStartSchema>): Promise<CallToolResult> =>
      safeToolCall("interview_start", async () => {
        const id = randomUUID();
        const questions: InterviewQuestion[] = BAZDMEG_QUESTIONS.map(q => ({
          id: q.id,
          question: q.question,
        }));

        const interview: Interview = {
          id,
          userId,
          projectName: project_name,
          description: initial_description,
          questions,
          createdAt: new Date(),
        };

        interviews.set(id, interview);

        const questionList = questions
          .map((q, i) => `${i + 1}. **[${q.id}]** ${q.question}`)
          .join("\n");

        return textResult(
          `**Interview started**\n\n`
            + `- **Interview ID:** \`${id}\`\n`
            + `- **Project:** ${project_name}\n`
            + `- **Description:** ${initial_description}\n\n`
            + `## Questions (7)\n\n${questionList}\n\n`
            + `Use \`interview_submit\` with the interview ID and an array of \`{question_id, answer}\` objects to answer.`,
        );
      }, { userId }),
  });

  // ── interview_submit ───────────────────────────────────────────
  registry.register({
    name: "interview_submit",
    description:
      "Submit answers to BAZDMEG interview questions. You may answer one or several questions at a time.",
    category: "orchestration",
    tier: "free",
    inputSchema: InterviewSubmitSchema.shape,
    handler: async ({
      interview_id,
      answers,
    }: z.infer<typeof InterviewSubmitSchema>): Promise<CallToolResult> =>
      safeToolCall("interview_submit", async () => {
        const interview = interviews.get(interview_id);
        if (!interview) {
          return {
            content: [{
              type: "text",
              text: `Interview "${interview_id}" not found.`,
            }],
            isError: true,
          };
        }

        const validIds = new Set(interview.questions.map(q => q.id));
        const invalidIds = answers
          .map(a => a.question_id)
          .filter(qid => !validIds.has(qid));

        if (invalidIds.length > 0) {
          return {
            content: [
              {
                type: "text",
                text: `Invalid question ID(s): ${invalidIds.join(", ")}. Valid IDs: ${
                  [...validIds].join(", ")
                }`,
              },
            ],
            isError: true,
          };
        }

        const now = new Date();
        for (const a of answers) {
          const q = interview.questions.find(q => q.id === a.question_id);
          if (q) {
            q.answer = a.answer;
            q.answeredAt = now;
          }
        }

        const answered = interview.questions.filter(q => q.answer !== undefined);
        const remaining = interview.questions.filter(q => q.answer === undefined);
        const isComplete = remaining.length === 0;

        if (isComplete && !interview.completedAt) {
          interview.completedAt = new Date();
        }

        let text = `**Answers recorded**\n\n`
          + `- **Answered:** ${answered.length}/7\n`
          + `- **Remaining:** ${remaining.length}\n`
          + `- **Complete:** ${isComplete}\n`;

        if (remaining.length > 0) {
          text += `\n## Remaining questions\n\n`;
          for (const q of remaining) {
            text += `- **[${q.id}]** ${q.question}\n`;
          }
        } else {
          text +=
            `\nAll questions answered! Use \`interview_generate_spec\` to generate the specification.`;
        }

        return textResult(text);
      }, { userId }),
  });

  // ── interview_generate_spec ────────────────────────────────────
  registry.register({
    name: "interview_generate_spec",
    description:
      "Generate a structured specification from a completed BAZDMEG interview. All 7 questions must be answered first.",
    category: "orchestration",
    tier: "free",
    inputSchema: InterviewGenerateSpecSchema.shape,
    handler: async ({
      interview_id,
    }: z.infer<typeof InterviewGenerateSpecSchema>): Promise<CallToolResult> =>
      safeToolCall("interview_generate_spec", async () => {
        const interview = interviews.get(interview_id);
        if (!interview) {
          return {
            content: [{
              type: "text",
              text: `Interview "${interview_id}" not found.`,
            }],
            isError: true,
          };
        }

        const unanswered = interview.questions.filter(q => q.answer === undefined);
        if (unanswered.length > 0) {
          const missing = unanswered.map(q => q.id).join(", ");
          return {
            content: [
              {
                type: "text",
                text:
                  `Interview is incomplete. Unanswered questions: ${missing}. Answer all 7 questions before generating a spec.`,
              },
            ],
            isError: true,
          };
        }

        const answerMap = new Map(
          interview.questions.map(q => [q.id, q.answer ?? ""]),
        );

        // Decompose tasks by splitting user_flow answer into steps
        const userFlowAnswer = answerMap.get("user_flow") ?? "";
        const decomposedTasks = userFlowAnswer
          .split("\n")
          .map(line => line.replace(/^[-*\d.)\s]+/, "").trim())
          .filter(line => line.length > 0);

        const spec: StructuredSpec = {
          projectName: interview.projectName,
          problemStatement: answerMap.get("problem") ?? "",
          dataSources: answerMap.get("data") ?? "",
          userFlows: userFlowAnswer,
          constraints: answerMap.get("constraints") ?? "",
          failureModes: answerMap.get("failure") ?? "",
          testPlan: answerMap.get("verification") ?? "",
          explainability: answerMap.get("explainability") ?? "",
          decomposedTasks,
        };

        let text = `# Specification: ${spec.projectName}\n\n`;
        text += `## Problem Statement\n${spec.problemStatement}\n\n`;
        text += `## Data Sources\n${spec.dataSources}\n\n`;
        text += `## User Flows\n${spec.userFlows}\n\n`;
        text += `## Constraints\n${spec.constraints}\n\n`;
        text += `## Failure Modes\n${spec.failureModes}\n\n`;
        text += `## Test Plan\n${spec.testPlan}\n\n`;
        text += `## Explainability\n${spec.explainability}\n\n`;
        text += `## Decomposed Tasks (${decomposedTasks.length})\n`;
        for (let i = 0; i < decomposedTasks.length; i++) {
          text += `${i + 1}. ${decomposedTasks[i]}\n`;
        }

        return textResult(text);
      }, { userId }),
  });
}
