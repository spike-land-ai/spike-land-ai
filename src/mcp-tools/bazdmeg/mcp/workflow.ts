/**
 * Workflow Tools
 *
 * MCP tools for checkpoint operations: session bootstrap, planning interview (MCQ), pre-PR check.
 */

import type { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { createZodTool, textResult } from "@spike-land-ai/mcp-server-base";
import { PlanningInterviewSchema, PrePRCheckSchema, SessionBootstrapSchema } from "../core-logic/types.js";
import { getWorkspace } from "../node-sys/workspace-state.js";
import {
  countChanges,
  formatGateResults,
  getBuiltinRules,
  getChangedFiles,
  runGates,
} from "../core-logic/engine.js";

// ── MCQ Interview Types ─────────────────────────────────────────────────────

interface InterviewQuestion {
  conceptIndex: number;
  variantIndex: number;
  question: string;
  options: [string, string, string, string];
  correctIndex: number;
}

interface InterviewRound {
  roundNumber: number;
  questions: [InterviewQuestion, InterviewQuestion, InterviewQuestion];
}

interface InterviewConceptState {
  name: string;
  correctCount: number;
  attempts: number;
  mastered: boolean;
  answerHistory: Map<number, number>;
}

interface InterviewConflict {
  concept: string;
  round: number;
  detail: string;
}

interface InterviewSession {
  id: string;
  packageName: string;
  taskDescription: string;
  concepts: Array<{
    name: string;
    variants: Array<{
      question: string;
      options: [string, string, string, string];
      correctIndex: number;
    }>;
  }>;
  conceptStates: InterviewConceptState[];
  currentRound: InterviewRound;
  roundNumber: number;
  conflicts: InterviewConflict[];
  completed: boolean;
  result: "PASSED" | "FAILED_LOW_SCORE" | "FAILED_CONTRADICTIONS" | null;
}

const interviewSessions = new Map<string, InterviewSession>();

// Exported for testing
export function clearInterviewSessions(): void {
  interviewSessions.clear();
}

export function getInterviewSession(id: string): InterviewSession | undefined {
  return interviewSessions.get(id);
}

// ── Question Bank ───────────────────────────────────────────────────────────

function buildQuestionBank(): InterviewSession["concepts"] {
  return [
    {
      name: "file_awareness",
      variants: [
        {
          question: "Which files will this task modify?",
          options: [
            "Only test files — the implementation already exists",
            "Source files in the package's src/ directory and corresponding tests",
            "Configuration files at the monorepo root only",
            "Random files across multiple unrelated packages",
          ],
          correctIndex: 1,
        },
        {
          question: "What test files are relevant to this change?",
          options: [
            "No tests are needed for this type of change",
            "Only E2E tests in a separate repository",
            "Unit test files co-located with the source files being modified",
            "Tests in completely unrelated packages",
          ],
          correctIndex: 2,
        },
        {
          question: "Which config files need changes for this task?",
          options: [
            "Every tsconfig.json in the monorepo",
            "Only the root package.json regardless of scope",
            "Config files within the affected package, if the change touches build/test configuration",
            "No config files ever need changes",
          ],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "test_strategy",
      variants: [
        {
          question: "What type of tests verify this change?",
          options: [
            "Manual testing in the browser is sufficient",
            "Unit tests for business logic plus integration tests for wiring",
            "Only snapshot tests to catch regressions",
            "No tests — TypeScript's type system catches all bugs",
          ],
          correctIndex: 1,
        },
        {
          question: "How would you test the failure case?",
          options: [
            "Failure cases do not need testing",
            "Only test the happy path and assume failures are handled",
            "Write tests that simulate errors and verify error handling behavior",
            "Rely on try/catch blocks to prove correctness",
          ],
          correctIndex: 2,
        },
        {
          question: "What mocking strategy is needed?",
          options: [
            "Mock everything including the code under test",
            "Never use mocks — only real implementations",
            "Mock external dependencies and side effects while keeping core logic real",
            "Copy production data into test fixtures verbatim",
          ],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "edge_cases",
      variants: [
        {
          question: "What happens with empty input?",
          options: [
            "Empty input is impossible in production",
            "The function should throw an unhandled exception",
            "Return a sensible default or validation error without crashing",
            "Silently return undefined and let the caller deal with it",
          ],
          correctIndex: 2,
        },
        {
          question: "What if the service is unavailable?",
          options: [
            "Services are always available — no need to handle this",
            "Crash immediately so the user knows something is wrong",
            "Implement retry with backoff and surface a clear error to the caller",
            "Cache the last successful response and use it forever",
          ],
          correctIndex: 2,
        },
        {
          question: "What about concurrent requests?",
          options: [
            "Concurrent requests never happen in practice",
            "Add global locks to serialize all operations",
            "Identify shared mutable state and protect it with appropriate concurrency controls",
            "Ignore concurrency — JavaScript is single-threaded so there are no issues",
          ],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "dependency_chain",
      variants: [
        {
          question: "Which internal packages are affected by this change?",
          options: [
            "Only the package being directly modified and its downstream consumers",
            "All packages in the monorepo need rebuilding",
            "Internal packages are independent — changes never propagate",
            "Only packages listed in the root package.json",
          ],
          correctIndex: 0,
        },
        {
          question: "What external deps are involved?",
          options: [
            "External dependencies are irrelevant to the change",
            "Every dependency in node_modules needs auditing",
            "The specific external libraries used by the modified code paths",
            "Only devDependencies matter, not runtime dependencies",
          ],
          correctIndex: 2,
        },
        {
          question: "What build order matters for this change?",
          options: [
            "Build order does not matter — everything can build in parallel",
            "Build the root package first, then leaf packages",
            "Build dependencies before dependents following the dependency graph",
            "Build alphabetically by package name",
          ],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "failure_modes",
      variants: [
        {
          question: "What could cause a runtime error in this change?",
          options: [
            "Nothing — TypeScript eliminates all runtime errors",
            "Invalid input data, missing environment variables, or network failures",
            "Only syntax errors which the compiler already catches",
            "Runtime errors only happen in JavaScript, not TypeScript",
          ],
          correctIndex: 1,
        },
        {
          question: "How would you handle a partial failure?",
          options: [
            "Partial failures cannot happen — operations are atomic",
            "Ignore the failure and continue processing",
            "Roll back completed steps, log the error, and return a clear failure status",
            "Retry the entire operation indefinitely until it succeeds",
          ],
          correctIndex: 2,
        },
        {
          question: "What rollback strategy applies to this change?",
          options: [
            "No rollback needed — the change is always safe to deploy",
            "Delete the branch and start over from scratch",
            "The change should be backward-compatible; if not, plan a migration path",
            "Rollback is impossible once deployed",
          ],
          correctIndex: 2,
        },
      ],
    },
    {
      name: "verification",
      variants: [
        {
          question: "How do you prove the change works?",
          options: [
            "If it compiles, it works",
            "Run the full test suite and verify all assertions pass with the new behavior",
            "Deploy to production and monitor for errors",
            "Ask a teammate to review the diff — that is sufficient verification",
          ],
          correctIndex: 1,
        },
        {
          question: "What command verifies success?",
          options: [
            "git status — if there are changes, it worked",
            "npm run build — a successful build means the feature works",
            "npm test — the test suite validates behavior, not just compilation",
            "npm install — if dependencies resolve, the code is correct",
          ],
          correctIndex: 2,
        },
        {
          question: "What metrics would you monitor after this change?",
          options: [
            "No monitoring needed for code changes",
            "Only CPU and memory usage on the server",
            "Error rates, response times, and feature-specific success/failure counts",
            "Git commit count as a proxy for progress",
          ],
          correctIndex: 2,
        },
      ],
    },
  ];
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateSessionId(): string {
  const chars = "abcdefghijklmnopqrstuvwxyz0123456789";
  let id = "pi_";
  for (let i = 0; i < 12; i++) {
    id += chars[Math.floor(Math.random() * chars.length)];
  }
  return id;
}

function selectRoundQuestions(session: InterviewSession): InterviewRound {
  const unmastered = session.conceptStates
    .map((s, i) => ({ state: s, index: i }))
    .filter((s) => !s.state.mastered);

  // Round-robin: pick each unmastered concept at most once in first pass
  const selected: Array<{ conceptIndex: number; variantIndex: number }> = [];
  const roundOffset = session.roundNumber;

  for (let i = 0; i < Math.min(3, unmastered.length); i++) {
    const pickIdx = (roundOffset + i) % unmastered.length;
    const pick = unmastered[pickIdx]!;
    const concept = session.concepts[pick.index]!;
    const variantIndex = pick.state.attempts % concept.variants.length;
    selected.push({ conceptIndex: pick.index, variantIndex });
  }

  // If fewer than 3 unmastered, cycle and pick different variants
  while (selected.length < 3 && unmastered.length > 0) {

    const pickIdx = selected.length % unmastered.length;
    const pick = unmastered[pickIdx]!;
    const concept = session.concepts[pick.index]!;
    const variantIndex = (pick.state.attempts + selected.length) % concept.variants.length;
    selected.push({ conceptIndex: pick.index, variantIndex });
  }

  const questions = selected.map((s) => {
    const concept = session.concepts[s.conceptIndex]!;
    const variant = concept.variants[s.variantIndex]!;
    return {
      conceptIndex: s.conceptIndex,
      variantIndex: s.variantIndex,
      question: variant.question,
      options: variant.options,
      correctIndex: variant.correctIndex,
    } satisfies InterviewQuestion;
  }) as [InterviewQuestion, InterviewQuestion, InterviewQuestion];

  return {
    roundNumber: session.roundNumber,
    questions,
  };
}

function formatMCQsForResponse(round: InterviewRound, session: InterviewSession): string {
  const lines: string[] = [
    `## Planning Interview — Round ${round.roundNumber + 1}`,
    `**Session**: \`${session.id}\``,
    `**Task**: ${session.taskDescription}`,
    `**Package**: ${session.packageName}`,
    "",
  ];

  const masteredCount = session.conceptStates.filter((s) => s.mastered).length;
  lines.push(`**Progress**: ${masteredCount}/6 concepts mastered`);
  lines.push("");

  round.questions.forEach((q, i) => {
    const conceptName = session.concepts[q.conceptIndex]!.name;
    lines.push(`### Q${i + 1} [${conceptName}]`);
    lines.push(`${q.question}`);
    lines.push("");
    q.options.forEach((opt, j) => {
      lines.push(`  ${j}. ${opt}`);
    });
    lines.push("");
  });

  lines.push(`---`);
  lines.push(`Reply with \`answers: [a, b, c]\` where each is 0-3.`);

  return lines.join("\n");
}

// ── Tool Registration ───────────────────────────────────────────────────────

export function registerWorkflowTools(server: McpServer): void {
  // ── bazdmeg_session_bootstrap ────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_session_bootstrap",
    description: "Checkpoint 0: verify branch, git status, workspace readiness",
    schema: SessionBootstrapSchema.shape,
    handler: async (args: z.infer<typeof SessionBootstrapSchema>) => {
      const { packageName, branch } = args;
      const workspace = getWorkspace();

      const checks: string[] = [];

      // Check workspace
      if (workspace) {
        if (workspace.packageName === packageName) {
          checks.push(`[PASS] Workspace active: ${packageName}`);
        } else {
          checks.push(
            `[WARN] Different workspace active: ${workspace.packageName} (expected ${packageName})`,
          );
        }
      } else {
        checks.push(
          `[INFO] No workspace active — call bazdmeg_enter_workspace("${packageName}") to set up isolation`,
        );
      }

      // Branch info
      if (branch) {
        checks.push(`[INFO] Expected branch: ${branch}`);
      }

      // Package exists check
      checks.push(`[INFO] Target package: packages/${packageName}/`);

      return textResult(
        `## Session Bootstrap — ${packageName}\n\n` +
          checks.join("\n") +
          `\n\n### Next Steps\n` +
          `1. Enter workspace: bazdmeg_enter_workspace\n` +
          `2. Get context: bazdmeg_get_context\n` +
          `3. Plan: bazdmeg_planning_interview\n` +
          `4. Code, test, iterate\n` +
          `5. Pre-PR check: bazdmeg_pre_pr_check`,
      );
    },
  });

  // ── bazdmeg_planning_interview (MCQ system) ─────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_planning_interview",
    description: "MCQ verification before coding — tests understanding across 6 concepts",
    schema: PlanningInterviewSchema.shape,
    handler: async (args: z.infer<typeof PlanningInterviewSchema>) => {
      const { taskDescription, packageName, sessionId, answers } = args;

      // ── Follow-up call: evaluate answers ─────────────────────────────
      if (sessionId) {
        const session = interviewSessions.get(sessionId);
        if (!session) {
          return textResult(
            `**ERROR**: Session \`${sessionId}\` not found. Start a new interview with taskDescription.`,
          );
        }

        if (session.completed) {
          return textResult(`**Session already completed**: ${session.result}`);
        }

        if (!answers) {
          return textResult(
            `**ERROR**: answers are required for follow-up calls. Provide \`answers: [a, b, c]\` (0-3).`,
          );
        }

        // Evaluate answers
        const round = session.currentRound;
        let roundCorrect = 0;
        const roundResults: string[] = [];

        for (let i = 0; i < 3; i++) {
          const q = round.questions[i]!;
          const givenAnswer = answers[i]!;
          const isCorrect = givenAnswer === q.correctIndex;
          const conceptState = session.conceptStates[q.conceptIndex]!;
          const conceptName = session.concepts[q.conceptIndex]!.name;

          conceptState.attempts++;

          if (isCorrect) {
            roundCorrect++;

            conceptState.correctCount++;
            conceptState.answerHistory.set(q.variantIndex, givenAnswer);

            // Mastery: 2+ correct across different variants
            if (conceptState.correctCount >= 2 && !conceptState.mastered) {
              conceptState.mastered = true;
            }

            roundResults.push(`  Q${i + 1} [${conceptName}]: CORRECT`);
          } else {
            // Check for conflict: previously answered this variant correctly with a different answer
            const previousAnswer = conceptState.answerHistory.get(q.variantIndex);
            if (previousAnswer !== undefined && previousAnswer === q.correctIndex) {
              // They previously got this right but now gave wrong answer — contradiction
              const correctOption = q.options[q.correctIndex] ?? "unknown";
              const chosenOption = q.options[givenAnswer] ?? "unknown";
              const conflict: InterviewConflict = {
                concept: conceptName,
                round: session.roundNumber,
                detail: `Previously answered "${correctOption}" correctly, now chose "${chosenOption}"`,
              };
              session.conflicts.push(conflict);

              // Reset mastery for this concept
              conceptState.correctCount = 0;
              conceptState.mastered = false;
            }

            conceptState.answerHistory.set(q.variantIndex, givenAnswer);
            const correctOption = q.options[q.correctIndex] ?? "unknown";
            roundResults.push(
              `  Q${
                i + 1
              } [${conceptName}]: WRONG (correct: ${q.correctIndex} — "${correctOption}")`,
            );
          }
        }

        session.roundNumber++;

        // ── Stopping rule: 3+ conflicts ──────────────────────────────
        if (session.conflicts.length >= 3) {
          session.completed = true;
          session.result = "FAILED_CONTRADICTIONS";

          const conflictDetails = session.conflicts
            .map((c, i) => `  ${i + 1}. [${c.concept}] ${c.detail}`)
            .join("\n");

          return textResult(
            `## INTERVIEW FAILED — Too Many Contradictions\n\n` +
              `**${session.conflicts.length} contradictions detected.** Review the codebase before continuing.\n\n` +
              `### Conflicts:\n${conflictDetails}\n\n` +
              `### Round ${session.roundNumber} Results (${roundCorrect}/3):\n${roundResults.join(
                "\n",
              )}`,
          );
        }

        // ── Stopping rule: score < 50% ───────────────────────────────
        if (roundCorrect < 2) {
          session.completed = true;
          session.result = "FAILED_LOW_SCORE";

          return textResult(
            `## INTERVIEW FAILED — Research Before Continuing\n\n` +
              `**Score: ${roundCorrect}/3 (${Math.round(
                (roundCorrect / 3) * 100,
              )}%).** Score too low.\n\n` +
              `### Round ${session.roundNumber} Results:\n${roundResults.join("\n")}\n\n` +
              `Research the codebase and start a new interview.`,
          );
        }

        // ── Check if all mastered ────────────────────────────────────
        const allMastered = session.conceptStates.every((s) => s.mastered);
        if (allMastered) {
          session.completed = true;
          session.result = "PASSED";

          const masteryReport = session.conceptStates
            .map((s) => `  - ${s.name}: ${s.correctCount} correct / ${s.attempts} attempts`)
            .join("\n");

          return textResult(
            `## INTERVIEW PASSED — Proceed to Implementation\n\n` +
              `All 6 concepts mastered.\n\n` +
              `### Round ${session.roundNumber} Results (${roundCorrect}/3):\n${roundResults.join(
                "\n",
              )}\n\n` +
              `### Mastery Report:\n${masteryReport}\n\n` +
              `### Conflicts: ${session.conflicts.length}`,
          );
        }

        // ── Next round ───────────────────────────────────────────────
        const nextRound = selectRoundQuestions(session);
        session.currentRound = nextRound;

        const masteredCount = session.conceptStates.filter((s) => s.mastered).length;

        return textResult(
          `## Round ${session.roundNumber} Results (${roundCorrect}/3)\n\n` +
            roundResults.join("\n") +
            `\n\n**Progress**: ${masteredCount}/6 concepts mastered | Conflicts: ${session.conflicts.length}/3\n\n` +
            `---\n\n` +
            formatMCQsForResponse(nextRound, session),
        );
      }

      // ── First call: create session ─────────────────────────────────
      if (!taskDescription) {
        return textResult(
          `**ERROR**: taskDescription is required for the first call. Provide a description of the task.`,
        );
      }

      const workspace = getWorkspace();
      const activePackage = packageName ?? workspace?.packageName ?? "unknown";
      const id = generateSessionId();
      const concepts = buildQuestionBank();

      const conceptStates: InterviewConceptState[] = concepts.map((c) => ({
        name: c.name,
        correctCount: 0,
        attempts: 0,
        mastered: false,
        answerHistory: new Map(),
      }));

      const session: InterviewSession = {
        id,
        packageName: activePackage,
        taskDescription,
        concepts,
        conceptStates,
        currentRound: {
          roundNumber: 0,
          questions: [] as unknown as [InterviewQuestion, InterviewQuestion, InterviewQuestion],
        },
        roundNumber: 0,
        conflicts: [],
        completed: false,
        result: null,
      };

      const firstRound = selectRoundQuestions(session);
      session.currentRound = firstRound;

      interviewSessions.set(id, session);

      return textResult(formatMCQsForResponse(firstRound, session));
    },
  });

  // ── bazdmeg_pre_pr_check ─────────────────────────────────────────────────
  createZodTool(server, {
    name: "bazdmeg_pre_pr_check",
    description: "Final validation before PR — runs all quality gates and workspace scope check",
    schema: PrePRCheckSchema.shape,
    handler: async (args: z.infer<typeof PrePRCheckSchema>) => {
      const { diff, prTitle, prBody } = args;

      const workspace = getWorkspace();
      const files = getChangedFiles(diff);
      const { additions, deletions } = countChanges(diff);

      const context = {
        diff,
        files,
        additions,
        deletions,
        prTitle,
        prBody,
        claudeMdRules: [],
        allowedPaths: workspace?.allowedPaths,
      };

      const rules = getBuiltinRules();
      const results = runGates(rules, context);
      const formatted = formatGateResults(results);

      const hasRed = results.some((r) => r.status === "RED");

      return textResult(
        formatted +
          `\n\n---\n\n` +
          (hasRed
            ? `**BLOCKED**: Fix RED gates before creating PR.`
            : `**READY**: All critical gates passing. Proceed with PR creation.`),
      );
    },
  });
}
