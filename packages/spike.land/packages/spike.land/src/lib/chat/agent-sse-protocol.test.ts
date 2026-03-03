import { describe, expect, it } from "vitest";
import {
  type AgentSSEEvent,
  encodeSSE,
  parseSSE,
  splitSSEBuffer,
} from "./agent-sse-protocol";

describe("agent-sse-protocol", () => {
  describe("encodeSSE", () => {
    it("encodes a text_delta event", () => {
      const event: AgentSSEEvent = { type: "text_delta", text: "hello" };
      const result = encodeSSE(event);
      expect(result).toBe("data: {\"type\":\"text_delta\",\"text\":\"hello\"}\n\n");
    });

    it("encodes a tool_call_start event", () => {
      const event: AgentSSEEvent = {
        type: "tool_call_start",
        id: "tc1",
        name: "github__search",
        serverName: "github",
        input: { query: "test" },
      };
      const result = encodeSSE(event);
      expect(result).toContain("\"type\":\"tool_call_start\"");
      expect(result).toContain("\"id\":\"tc1\"");
      expect(result).toContain("\"serverName\":\"github\"");
      expect(result.startsWith("data: ")).toBe(true);
      expect(result.endsWith("\n\n")).toBe(true);
    });

    it("encodes a done event", () => {
      const event: AgentSSEEvent = {
        type: "done",
        usage: { input_tokens: 100, output_tokens: 50 },
      };
      const result = encodeSSE(event);
      expect(result).toContain("\"input_tokens\":100");
    });

    it("encodes an error event", () => {
      const event: AgentSSEEvent = { type: "error", message: "oops" };
      expect(encodeSSE(event)).toContain("\"message\":\"oops\"");
    });
  });

  describe("parseSSE", () => {
    it("parses a valid data line", () => {
      const event = parseSSE("data: {\"type\":\"text_delta\",\"text\":\"hi\"}");
      expect(event).toEqual({ type: "text_delta", text: "hi" });
    });

    it("returns null for non-data lines", () => {
      expect(parseSSE("event: message")).toBeNull();
      expect(parseSSE("")).toBeNull();
      expect(parseSSE("random text")).toBeNull();
    });

    it("returns null for invalid JSON", () => {
      expect(parseSSE("data: {invalid json}")).toBeNull();
    });

    it("roundtrips with encodeSSE", () => {
      const events: AgentSSEEvent[] = [
        { type: "text_delta", text: "hello world" },
        {
          type: "tool_call_start",
          id: "x",
          name: "t",
          serverName: "s",
          input: {},
        },
        { type: "tool_call_end", id: "x", result: "done", isError: false },
        { type: "turn_start", turn: 1, maxTurns: 10 },
        { type: "turn_end" },
        { type: "done", usage: { input_tokens: 10, output_tokens: 20 } },
        { type: "error", message: "fail" },
      ];

      for (const event of events) {
        const encoded = encodeSSE(event).trim();
        const parsed = parseSSE(encoded);
        expect(parsed).toEqual(event);
      }
    });
  });

  describe("splitSSEBuffer", () => {
    it("splits complete events from buffer", () => {
      const buffer =
        "data: {\"type\":\"text_delta\",\"text\":\"a\"}\n\ndata: {\"type\":\"text_delta\",\"text\":\"b\"}\n\n";
      const { events, remainder } = splitSSEBuffer(buffer);
      expect(events).toHaveLength(2);
      expect(remainder).toBe("");
    });

    it("preserves incomplete events as remainder", () => {
      const buffer = "data: {\"type\":\"text_delta\",\"text\":\"a\"}\n\ndata: {\"type\":\"text_d";
      const { events, remainder } = splitSSEBuffer(buffer);
      expect(events).toHaveLength(1);
      expect(remainder).toBe("data: {\"type\":\"text_d");
    });

    it("handles empty buffer", () => {
      const { events, remainder } = splitSSEBuffer("");
      expect(events).toHaveLength(0);
      expect(remainder).toBe("");
    });
  });
});
