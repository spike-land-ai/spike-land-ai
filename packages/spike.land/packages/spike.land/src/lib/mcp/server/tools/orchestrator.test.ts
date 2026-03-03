import { beforeEach, describe, expect, it, vi } from "vitest";
import { createMockRegistry, getText, isError } from "../__test-utils__";
import { clearPlans, registerOrchestratorTools } from "./orchestrator";

describe("orchestrator tools", () => {
  const userId = "test-user-123";
  let registry: ReturnType<typeof createMockRegistry>;

  beforeEach(() => {
    vi.clearAllMocks();
    clearPlans();
    registry = createMockRegistry();
    registerOrchestratorTools(registry, userId);
  });

  it("should register 5 orchestrator tools", () => {
    expect(registry.register).toHaveBeenCalledTimes(5);
    expect(registry.handlers.has("orchestrator_create_plan")).toBe(true);
    expect(registry.handlers.has("orchestrator_dispatch")).toBe(true);
    expect(registry.handlers.has("orchestrator_status")).toBe(true);
    expect(registry.handlers.has("orchestrator_submit_result")).toBe(true);
    expect(registry.handlers.has("orchestrator_merge")).toBe(true);
  });

  describe("orchestrator_create_plan", () => {
    it("should create a plan with subtasks", async () => {
      const handler = registry.handlers.get("orchestrator_create_plan")!;
      const result = await handler({
        description: "Build feature X",
        subtasks: [
          { description: "Write tests" },
          { description: "Implement code", dependencies: ["subtask-1"] },
        ],
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Plan Created");
      expect(getText(result)).toContain("subtask-1");
      expect(getText(result)).toContain("subtask-2");
      expect(getText(result)).toContain("Write tests");
      expect(getText(result)).toContain("Implement code");
      expect(getText(result)).toContain("depends on: subtask-1");
    });

    it("should create a plan with context", async () => {
      const handler = registry.handlers.get("orchestrator_create_plan")!;
      const result = await handler({
        description: "Refactor module",
        subtasks: [{ description: "Analyze code" }],
        context: "Next.js app",
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Plan Created");
    });

    it("should reject invalid dependency references", async () => {
      const handler = registry.handlers.get("orchestrator_create_plan")!;
      const result = await handler({
        description: "Bad plan",
        subtasks: [
          { description: "Task A", dependencies: ["subtask-99"] },
        ],
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("unknown dependency");
    });
  });

  describe("orchestrator_dispatch", () => {
    it("should dispatch subtasks with no dependencies", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Test dispatch",
        subtasks: [
          { description: "Task A" },
          { description: "Task B", dependencies: ["subtask-1"] },
        ],
      });
      const planId = extractPlanId(getText(createResult));

      const dispatchHandler = registry.handlers.get("orchestrator_dispatch")!;
      const result = await dispatchHandler({ plan_id: planId });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Dispatched 1 subtask(s)");
      expect(getText(result)).toContain("subtask-1");
    });

    it("should not dispatch subtasks with unmet dependencies", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Test deps",
        subtasks: [
          { description: "Task A" },
          { description: "Task B", dependencies: ["subtask-1"] },
        ],
      });
      const planId = extractPlanId(getText(createResult));

      // Dispatch once to move subtask-1 to dispatched
      const dispatchHandler = registry.handlers.get("orchestrator_dispatch")!;
      await dispatchHandler({ plan_id: planId });

      // Dispatch again — subtask-2 still blocked, subtask-1 already dispatched
      const result = await dispatchHandler({ plan_id: planId });
      expect(getText(result)).toContain("No subtasks ready for dispatch");
    });

    it("should return error for non-existent plan", async () => {
      const handler = registry.handlers.get("orchestrator_dispatch")!;
      const result = await handler({ plan_id: "nonexistent" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });
  });

  describe("orchestrator_status", () => {
    it("should show plan and subtask statuses", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Status test",
        subtasks: [
          { description: "Task A" },
          { description: "Task B" },
        ],
      });
      const planId = extractPlanId(getText(createResult));

      const statusHandler = registry.handlers.get("orchestrator_status")!;
      const result = await statusHandler({ plan_id: planId });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Plan Status: pending");
      expect(getText(result)).toContain("subtask-1");
      expect(getText(result)).toContain("subtask-2");
      expect(getText(result)).toContain("[pending]");
    });

    it("should return error for non-existent plan", async () => {
      const handler = registry.handlers.get("orchestrator_status")!;
      const result = await handler({ plan_id: "missing" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });
  });

  describe("orchestrator_submit_result", () => {
    it("should update subtask with result", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Submit test",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const result = await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "Task A done successfully",
      });

      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Subtask Updated");
      expect(getText(result)).toContain("completed");
      expect(getText(result)).toContain("Task A done successfully");
    });

    it("should auto-complete plan when all subtasks complete", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Auto-complete test",
        subtasks: [{ description: "Only task" }],
      });
      const planId = extractPlanId(getText(createResult));

      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const result = await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "Done",
      });

      expect(getText(result)).toContain("Plan Status:** completed");
    });

    it("should auto-fail plan when any subtask fails", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Fail test",
        subtasks: [
          { description: "Task A" },
          { description: "Task B" },
        ],
      });
      const planId = extractPlanId(getText(createResult));

      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const result = await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "failed",
        result: "",
        error: "Something broke",
      });

      expect(getText(result)).toContain("Plan Status:** failed");
      expect(getText(result)).toContain("Something broke");
    });

    it("should return error for non-existent subtask", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Missing subtask",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const result = await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-99",
        status: "completed",
        result: "Done",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });

    it("should return error for non-existent plan", async () => {
      const handler = registry.handlers.get("orchestrator_submit_result")!;
      const result = await handler({
        plan_id: "missing",
        subtask_id: "subtask-1",
        status: "completed",
        result: "Done",
      });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });
  });

  describe("orchestrator_merge", () => {
    it("should merge completed subtask results in dependency order", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Merge test",
        subtasks: [
          { description: "Task A" },
          { description: "Task B", dependencies: ["subtask-1"] },
        ],
      });
      const planId = extractPlanId(getText(createResult));

      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "Result A",
      });
      await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-2",
        status: "completed",
        result: "Result B",
      });

      const mergeHandler = registry.handlers.get("orchestrator_merge")!;
      const result = await mergeHandler({ plan_id: planId });

      expect(isError(result)).toBe(false);
      const text = getText(result);
      expect(text).toContain("Merged Output");
      expect(text).toContain("Result A");
      expect(text).toContain("Result B");
      // A should appear before B due to dependency order
      expect(text.indexOf("Result A")).toBeLessThan(text.indexOf("Result B"));
    });

    it("should reject merge on incomplete plan", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Incomplete merge",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      const mergeHandler = registry.handlers.get("orchestrator_merge")!;
      const result = await mergeHandler({ plan_id: planId });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not completed");
    });

    it("should return error for non-existent plan", async () => {
      const handler = registry.handlers.get("orchestrator_merge")!;
      const result = await handler({ plan_id: "missing" });

      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("not found");
    });
  });

  describe("authorization checks", () => {
    it("should reject dispatch for plan owned by different user", async () => {
      // Create a plan with original userId
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Auth test",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      // Register tools with a different user
      const otherRegistry = createMockRegistry();
      registerOrchestratorTools(otherRegistry, "other-user");

      const dispatchHandler = otherRegistry.handlers.get(
        "orchestrator_dispatch",
      )!;
      const result = await dispatchHandler({ plan_id: planId });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Unauthorized");
    });

    it("should reject status for plan owned by different user", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Auth test",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      const otherRegistry = createMockRegistry();
      registerOrchestratorTools(otherRegistry, "other-user");

      const statusHandler = otherRegistry.handlers.get("orchestrator_status")!;
      const result = await statusHandler({ plan_id: planId });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Unauthorized");
    });

    it("should reject submit for plan owned by different user", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Auth test",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      const otherRegistry = createMockRegistry();
      registerOrchestratorTools(otherRegistry, "other-user");

      const submitHandler = otherRegistry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const result = await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "Done",
      });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Unauthorized");
    });

    it("should reject merge for plan owned by different user", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const createResult = await createHandler({
        description: "Auth test",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      const otherRegistry = createMockRegistry();
      registerOrchestratorTools(otherRegistry, "other-user");

      const mergeHandler = otherRegistry.handlers.get("orchestrator_merge")!;
      const result = await mergeHandler({ plan_id: planId });
      expect(isError(result)).toBe(true);
      expect(getText(result)).toContain("Unauthorized");
    });
  });

  describe("orchestrator_status - edge cases", () => {
    it("should display result and error in status", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const statusHandler = registry.handlers.get("orchestrator_status")!;

      const createResult = await createHandler({
        description: "Status detail test",
        subtasks: [
          { description: "Task A" },
          { description: "Task B" },
        ],
      });
      const planId = extractPlanId(getText(createResult));

      // Complete one, fail another
      await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "Success result text",
      });
      await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-2",
        status: "failed",
        result: "",
        error: "Something broke",
      });

      const result = await statusHandler({ plan_id: planId });
      const text = getText(result);
      expect(text).toContain("Result: Success result text");
      expect(text).toContain("Error: Something broke");
    });

    it("should truncate long results in status display", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const statusHandler = registry.handlers.get("orchestrator_status")!;

      const createResult = await createHandler({
        description: "Long result test",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      const longResult = "x".repeat(150);
      await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: longResult,
      });

      const result = await statusHandler({ plan_id: planId });
      const text = getText(result);
      expect(text).toContain("...");
    });

    it("should display completedAt when plan is completed", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const statusHandler = registry.handlers.get("orchestrator_status")!;

      const createResult = await createHandler({
        description: "Completed plan",
        subtasks: [{ description: "Only task" }],
      });
      const planId = extractPlanId(getText(createResult));

      await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "Done",
      });

      const result = await statusHandler({ plan_id: planId });
      const text = getText(result);
      expect(text).toContain("Completed:");
    });
  });

  describe("orchestrator_submit_result - edge cases", () => {
    it("should truncate long result in submit response", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;

      const createResult = await createHandler({
        description: "Long submit test",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      const longResult = "y".repeat(250);
      const result = await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: longResult,
      });
      const text = getText(result);
      expect(text).toContain("...");
    });

    it("should set plan to in_progress when submitting to a pending plan", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const statusHandler = registry.handlers.get("orchestrator_status")!;

      const createResult = await createHandler({
        description: "Pending to in_progress",
        subtasks: [
          { description: "Task A" },
          { description: "Task B" },
        ],
      });
      const planId = extractPlanId(getText(createResult));

      // Submit one subtask as completed (plan should go from pending to in_progress)
      await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "Done",
      });

      const result = await statusHandler({ plan_id: planId });
      expect(getText(result)).toContain("in_progress");
    });
  });

  describe("orchestrator_merge - edge cases", () => {
    it("should handle subtask with no result in merge", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const mergeHandler = registry.handlers.get("orchestrator_merge")!;

      const createResult = await createHandler({
        description: "Empty result merge",
        subtasks: [{ description: "Task A" }],
      });
      const planId = extractPlanId(getText(createResult));

      await submitHandler({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "",
      });

      const result = await mergeHandler({ plan_id: planId });
      expect(isError(result)).toBe(false);
      expect(getText(result)).toContain("Merged Output");
    });

    it("should merge subtasks in topological order with diamond dependency", async () => {
      const createHandler = registry.handlers.get("orchestrator_create_plan")!;
      const submitHandler = registry.handlers.get(
        "orchestrator_submit_result",
      )!;
      const mergeHandler = registry.handlers.get("orchestrator_merge")!;

      // Diamond: A -> B, A -> C, B+C -> D
      const createResult = await createHandler({
        description: "Diamond merge",
        subtasks: [
          { description: "Root" },
          { description: "Left", dependencies: ["subtask-1"] },
          { description: "Right", dependencies: ["subtask-1"] },
          { description: "Join", dependencies: ["subtask-2", "subtask-3"] },
        ],
      });
      const planId = extractPlanId(getText(createResult));

      for (let i = 1; i <= 4; i++) {
        await submitHandler({
          plan_id: planId,
          subtask_id: `subtask-${i}`,
          status: "completed",
          result: `Result-${i}`,
        });
      }

      const result = await mergeHandler({ plan_id: planId });
      expect(isError(result)).toBe(false);
      const text = getText(result);
      // Root must appear before Left, Right, and Join
      expect(text.indexOf("Result-1")).toBeLessThan(text.indexOf("Result-4"));
      // Both Left and Right must appear before Join
      expect(text.indexOf("Result-2")).toBeLessThan(text.indexOf("Result-4"));
      expect(text.indexOf("Result-3")).toBeLessThan(text.indexOf("Result-4"));
    });
  });

  describe("full lifecycle", () => {
    it("should handle a 3-subtask dependency chain end-to-end", async () => {
      const create = registry.handlers.get("orchestrator_create_plan")!;
      const dispatch = registry.handlers.get("orchestrator_dispatch")!;
      const submit = registry.handlers.get("orchestrator_submit_result")!;
      const status = registry.handlers.get("orchestrator_status")!;
      const merge = registry.handlers.get("orchestrator_merge")!;

      // 1. Create plan: A -> B -> C
      const createResult = await create({
        description: "Full lifecycle test",
        subtasks: [
          { description: "Step A" },
          { description: "Step B", dependencies: ["subtask-1"] },
          { description: "Step C", dependencies: ["subtask-2"] },
        ],
      });
      const planId = extractPlanId(getText(createResult));
      expect(getText(createResult)).toContain("Subtasks:** 3");

      // 2. Dispatch — only A should be ready
      const dispatch1 = await dispatch({ plan_id: planId });
      expect(getText(dispatch1)).toContain("Dispatched 1 subtask(s)");
      expect(getText(dispatch1)).toContain("subtask-1");

      // 3. Submit result for A
      const submitA = await submit({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "A is done",
      });
      expect(getText(submitA)).toContain("completed");
      expect(getText(submitA)).toContain("in_progress");

      // 4. Dispatch — B should now be ready
      const dispatch2 = await dispatch({ plan_id: planId });
      expect(getText(dispatch2)).toContain("Dispatched 1 subtask(s)");
      expect(getText(dispatch2)).toContain("subtask-2");

      // 5. Submit result for B
      const submitB = await submit({
        plan_id: planId,
        subtask_id: "subtask-2",
        status: "completed",
        result: "B is done",
      });
      expect(getText(submitB)).toContain("completed");

      // 6. Dispatch — C should now be ready
      const dispatch3 = await dispatch({ plan_id: planId });
      expect(getText(dispatch3)).toContain("Dispatched 1 subtask(s)");
      expect(getText(dispatch3)).toContain("subtask-3");

      // 7. Submit result for C — plan should auto-complete
      const submitC = await submit({
        plan_id: planId,
        subtask_id: "subtask-3",
        status: "completed",
        result: "C is done",
      });
      expect(getText(submitC)).toContain("Plan Status:** completed");

      // 8. Check status
      const statusResult = await status({ plan_id: planId });
      expect(getText(statusResult)).toContain("Plan Status: completed");

      // 9. Merge — all results in order A, B, C
      const mergeResult = await merge({ plan_id: planId });
      const mergedText = getText(mergeResult);
      expect(mergedText).toContain("A is done");
      expect(mergedText).toContain("B is done");
      expect(mergedText).toContain("C is done");
      expect(mergedText.indexOf("A is done")).toBeLessThan(
        mergedText.indexOf("B is done"),
      );
      expect(mergedText.indexOf("B is done")).toBeLessThan(
        mergedText.indexOf("C is done"),
      );
    });

    it("should handle parallel subtasks with shared dependency", async () => {
      const create = registry.handlers.get("orchestrator_create_plan")!;
      const dispatch = registry.handlers.get("orchestrator_dispatch")!;
      const submit = registry.handlers.get("orchestrator_submit_result")!;
      const merge = registry.handlers.get("orchestrator_merge")!;

      // A -> B (depends on A), A -> C (depends on A), D (depends on B and C)
      const createResult = await create({
        description: "Parallel test",
        subtasks: [
          { description: "Base task" },
          { description: "Branch 1", dependencies: ["subtask-1"] },
          { description: "Branch 2", dependencies: ["subtask-1"] },
          {
            description: "Final merge",
            dependencies: ["subtask-2", "subtask-3"],
          },
        ],
      });
      const planId = extractPlanId(getText(createResult));

      // Dispatch — only subtask-1 (base)
      const d1 = await dispatch({ plan_id: planId });
      expect(getText(d1)).toContain("Dispatched 1 subtask(s)");

      // Complete subtask-1
      await submit({
        plan_id: planId,
        subtask_id: "subtask-1",
        status: "completed",
        result: "Base done",
      });

      // Dispatch — subtask-2 and subtask-3 should both be ready
      const d2 = await dispatch({ plan_id: planId });
      expect(getText(d2)).toContain("Dispatched 2 subtask(s)");

      // Complete both branches
      await submit({
        plan_id: planId,
        subtask_id: "subtask-2",
        status: "completed",
        result: "Branch 1 done",
      });
      await submit({
        plan_id: planId,
        subtask_id: "subtask-3",
        status: "completed",
        result: "Branch 2 done",
      });

      // Dispatch — subtask-4 should be ready
      const d3 = await dispatch({ plan_id: planId });
      expect(getText(d3)).toContain("Dispatched 1 subtask(s)");
      expect(getText(d3)).toContain("subtask-4");

      // Complete final
      await submit({
        plan_id: planId,
        subtask_id: "subtask-4",
        status: "completed",
        result: "All merged",
      });

      // Merge
      const mergeResult = await merge({ plan_id: planId });
      expect(getText(mergeResult)).toContain("Base done");
      expect(getText(mergeResult)).toContain("All merged");
    });
  });
});

/** Extract plan ID from the create_plan result text. */
function extractPlanId(text: string): string {
  const match = text.match(/Plan ID:\*\* `([^`]+)`/);
  if (!match?.[1]) throw new Error("Could not extract plan ID from text");
  return match[1];
}
