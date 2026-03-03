import { describe, expect, it } from "vitest";

import { getStepHandler, registerStepHandler } from "./step-registry";

describe("step-registry", () => {
  it("registers and retrieves a handler", () => {
    const handler = async () => ({ output: { ok: true } });
    registerStepHandler("test_action", handler);
    expect(getStepHandler("test_action")).toBe(handler);
  });

  it("returns undefined for unregistered handler", () => {
    expect(getStepHandler("nonexistent_action")).toBeUndefined();
  });

  it("overwrites a previously registered handler", () => {
    const handler1 = async () => ({ output: { v: 1 } });
    const handler2 = async () => ({ output: { v: 2 } });
    registerStepHandler("overwrite_test", handler1);
    registerStepHandler("overwrite_test", handler2);
    expect(getStepHandler("overwrite_test")).toBe(handler2);
  });
});
