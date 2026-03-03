import { describe, expect, it } from "vitest";

import type { ActionInput, ActionOutput, WorkflowActionType } from "./action-types";

describe("WorkflowActionType", () => {
  it("includes expected action types", () => {
    const types: WorkflowActionType[] = [
      "post_to_platform",
      "send_notification",
      "call_ai_agent",
      "update_record",
      "conditional",
      "http_request",
      "transform_data",
      "parallel_execution",
      "loop",
    ];
    expect(types).toHaveLength(9);
  });
});

describe("ActionInput", () => {
  it("allows arbitrary string keys", () => {
    const input: ActionInput = { foo: "bar", count: 42 };
    expect(input.foo).toBe("bar");
  });
});

describe("ActionOutput", () => {
  it("requires success field", () => {
    const output: ActionOutput = { success: true };
    expect(output.success).toBe(true);
  });

  it("allows optional error field", () => {
    const output: ActionOutput = { success: false, error: "Something failed" };
    expect(output.error).toBe("Something failed");
  });
});
