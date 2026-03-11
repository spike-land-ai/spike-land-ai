import { describe, expect, it, vi } from "vitest";
import { ContextManager } from "../../../../src/cli/spike-cli/core-logic/chat/context-manager.js";
import { TokenTracker } from "../../../../src/cli/spike-cli/core-logic/chat/token-tracker.js";
import type { Message } from "../../../../src/cli/spike-cli/ai/client.js";

describe("ContextManager", () => {
  function makeMessages(count: number): Message[] {
    const msgs: Message[] = [];
    for (let i = 0; i < count; i++) {
      msgs.push({
        role: i % 2 === 0 ? "user" : "assistant",
        content: `Message ${i + 1}`,
      });
    }
    return msgs;
  }

  it("does not summarize when context is healthy", async () => {
    const tracker = new TokenTracker(200000);
    tracker.recordTurn({ input_tokens: 50000, output_tokens: 500 });

    const manager = new ContextManager();
    const messages = makeMessages(10);
    const result = await manager.maybeSummarize(messages, tracker);

    expect(result).toBe(false);
    expect(messages).toHaveLength(10);
  });

  it("summarizes when context is at red level", async () => {
    const tracker = new TokenTracker(200000);
    tracker.recordTurn({ input_tokens: 185000, output_tokens: 500 });

    const summarizer = vi.fn().mockResolvedValue("Summary of earlier conversation");
    const manager = new ContextManager({ summarizer, keepRecentMessages: 4 });
    const messages = makeMessages(10);
    const result = await manager.maybeSummarize(messages, tracker);

    expect(result).toBe(true);
    expect(summarizer).toHaveBeenCalled();
    // 2 (summary + ack) + 4 (kept) = 6
    expect(messages).toHaveLength(6);
    expect(typeof messages[0]?.content === "string" && messages[0]?.content).toContain("summary");
  });

  it("does not summarize when too few messages", async () => {
    const tracker = new TokenTracker(200000);
    tracker.recordTurn({ input_tokens: 185000, output_tokens: 500 });

    const manager = new ContextManager({ keepRecentMessages: 4 });
    const messages = makeMessages(4);
    const result = await manager.maybeSummarize(messages, tracker);

    expect(result).toBe(false);
    expect(messages).toHaveLength(4);
  });

  it("keeps the specified number of recent messages", async () => {
    const tracker = new TokenTracker(200000);
    tracker.recordTurn({ input_tokens: 185000, output_tokens: 500 });

    const summarizer = vi.fn().mockResolvedValue("Summary");
    const manager = new ContextManager({ summarizer, keepRecentMessages: 2 });
    const messages = makeMessages(10);

    // Capture last 2 messages before summarization
    const lastTwo = [messages[8], messages[9]];

    await manager.maybeSummarize(messages, tracker);

    // 2 (summary + ack) + 2 (kept) = 4
    expect(messages).toHaveLength(4);
    expect(messages[2]).toEqual(lastTwo[0]);
    expect(messages[3]).toEqual(lastTwo[1]);
  });

  it("uses default summarizer when none provided", async () => {
    const tracker = new TokenTracker(200000);
    tracker.recordTurn({ input_tokens: 185000, output_tokens: 500 });

    const manager = new ContextManager({ keepRecentMessages: 2 });
    const messages = makeMessages(8);
    const result = await manager.maybeSummarize(messages, tracker);

    expect(result).toBe(true);
    // Default summarizer produces text from messages
    const summaryContent = messages[0]?.content as string;
    expect(summaryContent).toContain("summary");
  });
});
