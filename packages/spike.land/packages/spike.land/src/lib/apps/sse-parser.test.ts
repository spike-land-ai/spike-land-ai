import { describe, expect, it } from "vitest";
import { parseSSEEvent } from "./sse-parser";
import type { SSEEventType } from "./sse-parser";

describe("parseSSEEvent", () => {
  it("parses a valid message event", () => {
    const event = parseSSEEvent(
      JSON.stringify({ type: "message", data: { id: "msg-1", role: "USER" } }),
    );
    expect(event).toEqual({
      type: "message",
      data: { id: "msg-1", role: "USER" },
    });
  });

  it("parses a status event", () => {
    const event = parseSSEEvent(
      JSON.stringify({ type: "status", data: { status: "LIVE" } }),
    );
    expect(event).toEqual({
      type: "status",
      data: { status: "LIVE" },
    });
  });

  it("parses agent_working event", () => {
    const event = parseSSEEvent(
      JSON.stringify({ type: "agent_working", data: { isWorking: true } }),
    );
    expect(event).toEqual({
      type: "agent_working",
      data: { isWorking: true },
    });
  });

  it("parses code_updated event", () => {
    const event = parseSSEEvent(
      JSON.stringify({ type: "code_updated", data: {} }),
    );
    expect(event).toEqual({ type: "code_updated", data: {} });
  });

  it("parses sync_in_progress event", () => {
    const event = parseSSEEvent(
      JSON.stringify({ type: "sync_in_progress", data: { isSyncing: true } }),
    );
    expect(event).toEqual({
      type: "sync_in_progress",
      data: { isSyncing: true },
    });
  });

  it("returns null for malformed JSON", () => {
    expect(parseSSEEvent("not-json")).toBeNull();
  });

  it("returns null for unknown event type", () => {
    expect(
      parseSSEEvent(JSON.stringify({ type: "unknown_type", data: {} })),
    ).toBeNull();
  });

  it("returns null for missing type field", () => {
    expect(parseSSEEvent(JSON.stringify({ data: {} }))).toBeNull();
  });

  it("returns null for missing data field", () => {
    expect(parseSSEEvent(JSON.stringify({ type: "message" }))).toBeNull();
  });

  it("accepts all valid SSE event types", () => {
    const validTypes: SSEEventType[] = [
      "message",
      "status",
      "agent_working",
      "code_updated",
      "sync_in_progress",
    ];
    for (const type of validTypes) {
      const result = parseSSEEvent(JSON.stringify({ type, data: {} }));
      expect(result).not.toBeNull();
      expect(result!.type).toBe(type);
    }
  });
});
