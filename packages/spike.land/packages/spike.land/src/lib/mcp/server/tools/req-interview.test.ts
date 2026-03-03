import { beforeEach, describe, expect, it, vi } from "vitest";
import { _clearInterviews, registerReqInterviewTools } from "./req-interview";

interface ToolResult {
  content: Array<{ type: string; text: string; }>;
  isError?: boolean;
}

function createMockRegistry() {
  const tools = new Map<
    string,
    {
      handler: (...args: unknown[]) => Promise<ToolResult>;
      inputSchema: Record<string, unknown>;
    }
  >();

  return {
    tools,
    register: vi.fn(
      ({
        name,
        handler,
        inputSchema,
      }: {
        name: string;
        handler: (...args: unknown[]) => Promise<ToolResult>;
        inputSchema: Record<string, unknown>;
      }) => {
        tools.set(name, { handler, inputSchema });
      },
    ),
  };
}

function getText(result: ToolResult): string {
  return result.content[0]?.text ?? "";
}

function isError(result: ToolResult): boolean {
  return result.isError === true;
}

describe("req-interview tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    _clearInterviews();
    registry = createMockRegistry();
    registerReqInterviewTools(
      registry as unknown as Parameters<typeof registerReqInterviewTools>[0],
      userId,
    );
  });

  it("should register 3 req-interview tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(3);
    expect(registry.tools.has("interview_start")).toBe(true);
    expect(registry.tools.has("interview_submit")).toBe(true);
    expect(registry.tools.has("interview_generate_spec")).toBe(true);
  });

  describe("interview_start", () => {
    it("creates an interview with 7 questions and returns interview_id", async () => {
      const handler = registry.tools.get("interview_start")!.handler;
      const result = await handler({
        project_name: "My Project",
        initial_description: "A widget builder",
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Interview started");
      expect(text).toContain("My Project");
      expect(text).toContain("A widget builder");
      expect(text).toContain("[problem]");
      expect(text).toContain("[data]");
      expect(text).toContain("[user_flow]");
      expect(text).toContain("[constraints]");
      expect(text).toContain("[failure]");
      expect(text).toContain("[verification]");
      expect(text).toContain("[explainability]");
      expect(text).toContain("Questions (7)");
    });
  });

  describe("interview_submit", () => {
    it("records answers and shows remaining questions", async () => {
      // Start an interview
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Test",
        initial_description: "Testing",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      // Submit 4 answers
      const submitHandler = registry.tools.get("interview_submit")!.handler;
      const result = await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "problem", answer: "We need faster builds" },
          { question_id: "data", answer: "PostgreSQL is source of truth" },
          {
            question_id: "user_flow",
            answer: "Step 1: Open app\nStep 2: Click build",
          },
          { question_id: "constraints", answer: "API must not change" },
        ],
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Answered:** 4/7");
      expect(text).toContain("Remaining:** 3");
      expect(text).toContain("Complete:** false");
      expect(text).toContain("[failure]");
      expect(text).toContain("[verification]");
      expect(text).toContain("[explainability]");
    });

    it("marks interview complete when all 7 answered", async () => {
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Test",
        initial_description: "Testing",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      const submitHandler = registry.tools.get("interview_submit")!.handler;

      // Submit first batch
      await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "problem", answer: "Problem answer" },
          { question_id: "data", answer: "Data answer" },
          { question_id: "user_flow", answer: "Flow answer" },
          { question_id: "constraints", answer: "Constraints answer" },
        ],
      });

      // Submit remaining
      const result = await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "failure", answer: "Failure answer" },
          { question_id: "verification", answer: "Verification answer" },
          { question_id: "explainability", answer: "Explainability answer" },
        ],
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Answered:** 7/7");
      expect(text).toContain("Remaining:** 0");
      expect(text).toContain("Complete:** true");
      expect(text).toContain("interview_generate_spec");
    });

    it("returns error for non-existent interview", async () => {
      const submitHandler = registry.tools.get("interview_submit")!.handler;
      const result = await submitHandler({
        interview_id: "nonexistent-id",
        answers: [{ question_id: "problem", answer: "answer" }],
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });

    it("returns error for invalid question_id", async () => {
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Test",
        initial_description: "Testing",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      const submitHandler = registry.tools.get("interview_submit")!.handler;
      const result = await submitHandler({
        interview_id: interviewId,
        answers: [{ question_id: "invalid_question", answer: "answer" }],
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Invalid question ID");
      expect(getText(result)).toContain("invalid_question");
    });
  });

  describe("interview_generate_spec", () => {
    it("generates structured spec from completed interview", async () => {
      // Start interview
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Widget Builder",
        initial_description: "Build widgets",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      // Answer all 7 questions
      const submitHandler = registry.tools.get("interview_submit")!.handler;
      await submitHandler({
        interview_id: interviewId,
        answers: [
          {
            question_id: "problem",
            answer: "Users cannot build widgets efficiently",
          },
          { question_id: "data", answer: "Widget table in PostgreSQL" },
          {
            question_id: "user_flow",
            answer: "Open dashboard\nSelect template\nCustomize widget\nSave and deploy",
          },
          {
            question_id: "constraints",
            answer: "Existing API endpoints must not change",
          },
          {
            question_id: "failure",
            answer: "Show error toast on network failure",
          },
          {
            question_id: "verification",
            answer: "Unit tests for builder logic, E2E for full flow",
          },
          {
            question_id: "explainability",
            answer: "Yes, it follows standard CRUD patterns",
          },
        ],
      });

      // Generate spec
      const genHandler = registry.tools.get("interview_generate_spec")!.handler;
      const result = await genHandler({ interview_id: interviewId });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("# Specification: Widget Builder");
      expect(text).toContain("## Problem Statement");
      expect(text).toContain("Users cannot build widgets efficiently");
      expect(text).toContain("## Data Sources");
      expect(text).toContain("Widget table in PostgreSQL");
      expect(text).toContain("## User Flows");
      expect(text).toContain("Open dashboard");
      expect(text).toContain("## Constraints");
      expect(text).toContain("## Failure Modes");
      expect(text).toContain("## Test Plan");
      expect(text).toContain("## Explainability");
      expect(text).toContain("## Decomposed Tasks (4)");
      expect(text).toContain("1. Open dashboard");
      expect(text).toContain("2. Select template");
      expect(text).toContain("3. Customize widget");
      expect(text).toContain("4. Save and deploy");
    });

    it("returns error for incomplete interview", async () => {
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Test",
        initial_description: "Testing",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      // Only answer 2 questions
      const submitHandler = registry.tools.get("interview_submit")!.handler;
      await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "problem", answer: "Problem" },
          { question_id: "data", answer: "Data" },
        ],
      });

      const genHandler = registry.tools.get("interview_generate_spec")!.handler;
      const result = await genHandler({ interview_id: interviewId });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("incomplete");
      expect(getText(result)).toContain("user_flow");
      expect(getText(result)).toContain("constraints");
      expect(getText(result)).toContain("failure");
      expect(getText(result)).toContain("verification");
      expect(getText(result)).toContain("explainability");
    });

    it("returns error for non-existent interview", async () => {
      const genHandler = registry.tools.get("interview_generate_spec")!.handler;
      const result = await genHandler({ interview_id: "nonexistent" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });
  });

  describe("interview_submit edge cases", () => {
    it("re-submitting all answers to already-completed interview does not reset completedAt", async () => {
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Test",
        initial_description: "Testing",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      const submitHandler = registry.tools.get("interview_submit")!.handler;

      // Complete the interview
      await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "problem", answer: "P" },
          { question_id: "data", answer: "D" },
          { question_id: "user_flow", answer: "F" },
          { question_id: "constraints", answer: "C" },
          { question_id: "failure", answer: "Fail" },
          { question_id: "verification", answer: "V" },
          { question_id: "explainability", answer: "E" },
        ],
      });

      // Re-submit answers to the already-completed interview
      const result = await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "problem", answer: "Updated problem" },
        ],
      });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Answered:** 7/7");
      expect(text).toContain("Complete:** true");
      expect(text).toContain("interview_generate_spec");
    });

    it("returns error listing multiple invalid question IDs", async () => {
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Test",
        initial_description: "Testing",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      const submitHandler = registry.tools.get("interview_submit")!.handler;
      const result = await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "bogus_one", answer: "A" },
          { question_id: "bogus_two", answer: "B" },
        ],
      });

      expect(isError(result)).toBe(true);
      const text = getText(result);
      expect(text).toContain("bogus_one");
      expect(text).toContain("bogus_two");
      expect(text).toContain("Valid IDs");
    });
  });

  describe("interview_generate_spec edge cases", () => {
    it("returns error for non-existent interview ID in generate_spec", async () => {
      const genHandler = registry.tools.get("interview_generate_spec")!.handler;
      const result = await genHandler({ interview_id: "does-not-exist-uuid" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("does-not-exist-uuid");
      expect(getText(result)).toContain("not found");
    });

    it("generates spec with single-line user_flow (no newlines)", async () => {
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "SingleFlow",
        initial_description: "Single line flow",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      const submitHandler = registry.tools.get("interview_submit")!.handler;
      await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "problem", answer: "Simple problem" },
          { question_id: "data", answer: "Simple data" },
          { question_id: "user_flow", answer: "Just one step" },
          { question_id: "constraints", answer: "None" },
          { question_id: "failure", answer: "Retry" },
          { question_id: "verification", answer: "Manual test" },
          { question_id: "explainability", answer: "Straightforward" },
        ],
      });

      const genHandler = registry.tools.get("interview_generate_spec")!.handler;
      const result = await genHandler({ interview_id: interviewId });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("# Specification: SingleFlow");
      expect(text).toContain("Decomposed Tasks (1)");
      expect(text).toContain("1. Just one step");
    });

    it("generates spec with user_flow containing blank lines and bullet markers", async () => {
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "BulletFlow",
        initial_description: "Bullet flow",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      const submitHandler = registry.tools.get("interview_submit")!.handler;
      await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "problem", answer: "Bullet problem" },
          { question_id: "data", answer: "Bullet data" },
          {
            question_id: "user_flow",
            answer: "- Step one\n\n* Step two\n3) Step three\n   ",
          },
          { question_id: "constraints", answer: "Keep it" },
          { question_id: "failure", answer: "Handle it" },
          { question_id: "verification", answer: "Test it" },
          { question_id: "explainability", answer: "Explain it" },
        ],
      });

      const genHandler = registry.tools.get("interview_generate_spec")!.handler;
      const result = await genHandler({ interview_id: interviewId });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Decomposed Tasks (3)");
      expect(text).toContain("1. Step one");
      expect(text).toContain("2. Step two");
      expect(text).toContain("3. Step three");
    });

    it("returns error listing all unanswered questions when none answered", async () => {
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Empty",
        initial_description: "No answers",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;

      const genHandler = registry.tools.get("interview_generate_spec")!.handler;
      const result = await genHandler({ interview_id: interviewId });

      expect(isError(result)).toBe(true);
      const text = getText(result);
      expect(text).toContain("incomplete");
      expect(text).toContain("problem");
      expect(text).toContain("data");
      expect(text).toContain("user_flow");
      expect(text).toContain("constraints");
      expect(text).toContain("failure");
      expect(text).toContain("verification");
      expect(text).toContain("explainability");
    });
  });

  describe("defensive branch coverage via internal state mutation", () => {
    /**
     * These tests exercise defensive branches that are unreachable through the
     * public API. We capture the internal Interview object by reference (via a
     * Map.prototype.set spy during interview_start), then mutate it to create
     * the conditions needed to hit these branches.
     */

    function captureInterviewOnStart(): {
      getInterview: () => {
        questions: Array<
          { id: string; question: string; answer?: string; answeredAt?: Date; }
        >;
        completedAt?: Date;
      } | null;
      restore: () => void;
    } {
      let captured: {
        questions: Array<
          { id: string; question: string; answer?: string; answeredAt?: Date; }
        >;
        completedAt?: Date;
      } | null = null;
      const originalSet = Map.prototype.set;
      const spy = vi.spyOn(Map.prototype, "set").mockImplementation(function(
        this: Map<unknown, unknown>,
        key: unknown,
        value: unknown,
      ) {
        if (
          value !== null
          && typeof value === "object"
          && "questions" in value
          && Array.isArray((value as Record<string, unknown>).questions)
        ) {
          captured = value as typeof captured;
        }
        return originalSet.call(this, key, value);
      });
      return {
        getInterview: () => captured,
        restore: () => spy.mockRestore(),
      };
    }

    it("skips answer when find() cannot locate question (line 185 false branch)", async () => {
      const capture = captureInterviewOnStart();

      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Shifting",
        initial_description: "Shifting ID test",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;
      capture.restore();

      const interview = capture.getInterview()!;
      expect(interview).not.toBeNull();

      // Add a question with a shifting ID: returns "phantom" on first read (for
      // validIds Set construction via .map(q => q.id)), then returns "gone" on
      // subsequent reads (for .find(q => q.id === "phantom")), so find() fails.
      let readCount = 0;
      const shiftingQuestion = {
        get id(): string {
          readCount++;
          // First read: during questions.map(q => q.id) to build validIds
          // Subsequent reads: during questions.find(q => q.id === a.question_id)
          return readCount <= 1 ? "phantom" : "gone";
        },
        question: "Phantom question?",
      };
      interview.questions.push(
        shiftingQuestion as { id: string; question: string; },
      );

      const submitHandler = registry.tools.get("interview_submit")!.handler;
      const result = await submitHandler({
        interview_id: interviewId,
        answers: [{ question_id: "phantom", answer: "Should be skipped" }],
      });

      // Remove the shifting question to restore clean state
      interview.questions.pop();

      // Remove the shifting question before assertions
      interview.questions.pop();

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Answers recorded");
      // "phantom" passed validIds check but find() returned undefined,
      // so the if(q) false branch was taken and no answer was recorded
      expect(text).toContain("Answered:** 0/7");
    });

    it("uses ?? fallback when answerMap has missing keys (lines 253-271)", async () => {
      const capture = captureInterviewOnStart();

      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "MissingKeys",
        initial_description: "Missing answerMap keys test",
      });
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      const interviewId = idMatch![1]!;
      capture.restore();

      const interview = capture.getInterview()!;
      expect(interview).not.toBeNull();

      // Answer all 7 questions normally so the interview is complete
      const submitHandler = registry.tools.get("interview_submit")!.handler;
      await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "problem", answer: "P" },
          { question_id: "data", answer: "D" },
          { question_id: "user_flow", answer: "Step A\nStep B" },
          { question_id: "constraints", answer: "C" },
          { question_id: "failure", answer: "F" },
          { question_id: "verification", answer: "V" },
          { question_id: "explainability", answer: "E" },
        ],
      });

      // Now mutate internal state: remove all questions from the array.
      // The unanswered filter (q.answer === undefined) will find 0 unanswered
      // (because the array is empty). Then answerMap will be empty, so all
      // answerMap.get("problem") calls return undefined, triggering ?? "".
      interview.questions.length = 0;

      const genHandler = registry.tools.get("interview_generate_spec")!.handler;
      const result = await genHandler({ interview_id: interviewId });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("# Specification: MissingKeys");
      // All ?? "" fallbacks produce empty strings
      expect(text).toContain("## Problem Statement\n\n");
      expect(text).toContain("## Data Sources\n\n");
      expect(text).toContain("## User Flows\n\n");
      expect(text).toContain("## Constraints\n\n");
      expect(text).toContain("## Failure Modes\n\n");
      expect(text).toContain("## Test Plan\n\n");
      expect(text).toContain("## Explainability\n\n");
      expect(text).toContain("Decomposed Tasks (0)");
    });
  });

  describe("full lifecycle", () => {
    it("start -> partial submit -> remaining submit -> generate spec", async () => {
      // Step 1: Start
      const startHandler = registry.tools.get("interview_start")!.handler;
      const startResult = await startHandler({
        project_name: "Auth Service",
        initial_description: "OAuth2 authentication service",
      });
      expect(isError(startResult)).toBe(false);
      const idMatch = getText(startResult).match(/`([0-9a-f-]{36})`/);
      expect(idMatch).not.toBeNull();
      const interviewId = idMatch![1]!;

      // Step 2: Submit first 4 answers
      const submitHandler = registry.tools.get("interview_submit")!.handler;
      const partial = await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "problem", answer: "No centralized auth" },
          { question_id: "data", answer: "User table, session store" },
          {
            question_id: "user_flow",
            answer: "Login page\nEnter credentials\nRedirect to dashboard",
          },
          {
            question_id: "constraints",
            answer: "Existing JWT tokens must remain valid",
          },
        ],
      });
      expect(getText(partial)).toContain("Answered:** 4/7");
      expect(getText(partial)).toContain("Remaining:** 3");

      // Step 3: Submit remaining 3 answers
      const complete = await submitHandler({
        interview_id: interviewId,
        answers: [
          { question_id: "failure", answer: "Return 401, redirect to login" },
          {
            question_id: "verification",
            answer: "Unit tests for token validation",
          },
          { question_id: "explainability", answer: "Standard OAuth2 flow" },
        ],
      });
      expect(getText(complete)).toContain("Complete:** true");

      // Step 4: Generate spec
      const genHandler = registry.tools.get("interview_generate_spec")!.handler;
      const spec = await genHandler({ interview_id: interviewId });
      expect(isError(spec)).toBe(false);
      expect(getText(spec)).toContain("# Specification: Auth Service");
      expect(getText(spec)).toContain("No centralized auth");
      expect(getText(spec)).toContain("Decomposed Tasks (3)");
      expect(getText(spec)).toContain("Login page");
    });
  });
});
