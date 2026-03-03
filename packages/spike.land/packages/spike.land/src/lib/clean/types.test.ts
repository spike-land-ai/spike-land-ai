import { describe, expect, it } from "vitest";

import { SessionState } from "./types";

describe("SessionState enum", () => {
  it("has IDLE state", () => {
    expect(SessionState.IDLE).toBe("IDLE");
  });

  it("has SCANNING state", () => {
    expect(SessionState.SCANNING).toBe("SCANNING");
  });

  it("has ANALYZING state", () => {
    expect(SessionState.ANALYZING).toBe("ANALYZING");
  });

  it("has TASK_ACTIVE state", () => {
    expect(SessionState.TASK_ACTIVE).toBe("TASK_ACTIVE");
  });

  it("has VERIFY state", () => {
    expect(SessionState.VERIFY).toBe("VERIFY");
  });

  it("has COMPLETE state", () => {
    expect(SessionState.COMPLETE).toBe("COMPLETE");
  });

  it("has exactly 6 states", () => {
    const values = Object.values(SessionState);
    expect(values).toHaveLength(6);
  });
});
