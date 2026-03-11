import { describe, expect, it, beforeEach } from "vitest";
import { TokenTracker } from "../../../../src/cli/spike-cli/core-logic/chat/token-tracker.js";

describe("TokenTracker", () => {
  let tracker: TokenTracker;

  beforeEach(() => {
    tracker = new TokenTracker(200000);
  });

  it("starts with zero usage", () => {
    expect(tracker.currentContextUsage).toBe(0);
    expect(tracker.totalOutputTokens).toBe(0);
    expect(tracker.turnCount).toBe(0);
    expect(tracker.contextHealth).toBe("green");
    expect(tracker.shouldSummarize).toBe(false);
  });

  it("records turns and tracks usage", () => {
    tracker.recordTurn({ input_tokens: 1000, output_tokens: 500 });
    expect(tracker.currentContextUsage).toBe(1000);
    expect(tracker.totalOutputTokens).toBe(500);
    expect(tracker.turnCount).toBe(1);

    tracker.recordTurn({ input_tokens: 2000, output_tokens: 300 });
    expect(tracker.currentContextUsage).toBe(2000);
    expect(tracker.totalOutputTokens).toBe(800);
    expect(tracker.turnCount).toBe(2);
  });

  it("reports green health at low utilization", () => {
    tracker.recordTurn({ input_tokens: 50000, output_tokens: 100 });
    expect(tracker.contextHealth).toBe("green");
    expect(tracker.shouldSummarize).toBe(false);
  });

  it("reports yellow health at 70-89%", () => {
    tracker.recordTurn({ input_tokens: 150000, output_tokens: 100 });
    expect(tracker.contextHealth).toBe("yellow");
    expect(tracker.shouldSummarize).toBe(false);
  });

  it("reports red health at 90%+ and shouldSummarize", () => {
    tracker.recordTurn({ input_tokens: 180000, output_tokens: 100 });
    expect(tracker.contextHealth).toBe("red");
    expect(tracker.shouldSummarize).toBe(true);
  });

  it("handles exact boundary at 70%", () => {
    tracker.recordTurn({ input_tokens: 140000, output_tokens: 100 });
    expect(tracker.contextHealth).toBe("yellow");
  });

  it("handles exact boundary at 90%", () => {
    tracker.recordTurn({ input_tokens: 180000, output_tokens: 100 });
    expect(tracker.contextHealth).toBe("red");
  });

  it("resets all state", () => {
    tracker.recordTurn({ input_tokens: 180000, output_tokens: 500 });
    expect(tracker.turnCount).toBe(1);
    tracker.reset();
    expect(tracker.turnCount).toBe(0);
    expect(tracker.currentContextUsage).toBe(0);
    expect(tracker.totalOutputTokens).toBe(0);
    expect(tracker.contextHealth).toBe("green");
  });

  it("calculates contextUtilization", () => {
    tracker.recordTurn({ input_tokens: 100000, output_tokens: 100 });
    expect(tracker.contextUtilization).toBe(0.5);
  });

  it("formatSummary returns readable string", () => {
    tracker.recordTurn({ input_tokens: 5000, output_tokens: 1000 });
    const summary = tracker.formatSummary();
    expect(summary).toContain("5,000");
    expect(summary).toContain("200,000");
    expect(summary).toContain("Turns: 1");
    expect(summary).toContain("●");
  });

  it("getTurns returns all recorded turns", () => {
    tracker.recordTurn({ input_tokens: 1000, output_tokens: 100 });
    tracker.recordTurn({ input_tokens: 2000, output_tokens: 200 });
    const turns = tracker.getTurns();
    expect(turns).toHaveLength(2);
    expect(turns[0]?.turn).toBe(1);
    expect(turns[1]?.turn).toBe(2);
  });

  it("handles cache token fields", () => {
    tracker.recordTurn({
      input_tokens: 5000,
      output_tokens: 500,
      cache_creation_input_tokens: 1000,
      cache_read_input_tokens: 2000,
    });
    expect(tracker.currentContextUsage).toBe(5000);
    const turns = tracker.getTurns();
    expect(turns[0]?.usage.cache_creation_input_tokens).toBe(1000);
  });

  it("uses custom context limit", () => {
    const smallTracker = new TokenTracker(10000);
    smallTracker.recordTurn({ input_tokens: 9000, output_tokens: 100 });
    expect(smallTracker.contextHealth).toBe("red");
    expect(smallTracker.shouldSummarize).toBe(true);
  });

  it("totalInputTokens sums across all turns", () => {
    tracker.recordTurn({ input_tokens: 1000, output_tokens: 100 });
    tracker.recordTurn({ input_tokens: 2000, output_tokens: 200 });
    expect(tracker.totalInputTokens).toBe(3000);
  });
});
