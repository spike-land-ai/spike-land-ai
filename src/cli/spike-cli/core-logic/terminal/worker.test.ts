import { describe, expect, it } from "vitest";
import { isResumablePendingTurn } from "./worker";
import type { PendingTurnSnapshot } from "./types";

function buildPendingTurn(status: PendingTurnSnapshot["status"]): PendingTurnSnapshot {
  return {
    id: "turn-1",
    userInput: "hello",
    status,
    assistantText: "partial",
    toolCalls: [],
    startedAt: "2026-03-12T10:00:00.000Z",
    lastUpdatedAt: "2026-03-12T10:00:01.000Z",
  };
}

describe("isResumablePendingTurn", () => {
  it("rejects empty pending turn snapshots", () => {
    expect(isResumablePendingTurn(null)).toBe(false);
    expect(isResumablePendingTurn(undefined)).toBe(false);
  });

  it("rejects completed and failed turns", () => {
    expect(isResumablePendingTurn(buildPendingTurn("completed"))).toBe(false);
    expect(isResumablePendingTurn(buildPendingTurn("failed"))).toBe(false);
  });

  it("accepts genuinely in-flight turns", () => {
    expect(isResumablePendingTurn(buildPendingTurn("requesting-model"))).toBe(true);
    expect(isResumablePendingTurn(buildPendingTurn("streaming"))).toBe(true);
    expect(isResumablePendingTurn(buildPendingTurn("awaiting-next-turn"))).toBe(true);
  });
});
