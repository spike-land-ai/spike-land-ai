import { describe, expect, it } from "vitest";
import { parseChatSSE, splitSSEBuffer } from "./chat-stream";

describe("parseChatSSE", () => {
  it("should parse a valid text event", () => {
    const result = parseChatSSE('data: {"type":"text","text":"Hello"}');
    expect(result).toEqual({ type: "text", text: "Hello" });
  });

  it("should parse an error event", () => {
    const result = parseChatSSE('data: {"type":"error","error":"Something failed"}');
    expect(result).toEqual({ type: "error", error: "Something failed" });
  });

  it("should use default error message when error field is missing", () => {
    const result = parseChatSSE('data: {"type":"error"}');
    expect(result).toEqual({ type: "error", error: "Stream error" });
  });

  it("should return null for missing data: prefix", () => {
    const result = parseChatSSE('{"type":"text","text":"Hello"}');
    expect(result).toBeNull();
  });

  it("should return null for malformed JSON", () => {
    const result = parseChatSSE("data: {not valid json}");
    expect(result).toBeNull();
  });

  it("should return null for unknown event type", () => {
    const result = parseChatSSE('data: {"type":"unknown"}');
    expect(result).toBeNull();
  });

  it("should return null for text event with empty text", () => {
    const result = parseChatSSE('data: {"type":"text","text":""}');
    expect(result).toBeNull();
  });

  it("should return null for text event without text field", () => {
    const result = parseChatSSE('data: {"type":"text"}');
    expect(result).toBeNull();
  });
});

describe("splitSSEBuffer", () => {
  it("should split a buffer with multiple events", () => {
    const buffer = 'data: {"type":"text","text":"A"}\n\ndata: {"type":"text","text":"B"}\n\n';
    const result = splitSSEBuffer(buffer);
    expect(result.events).toEqual([
      'data: {"type":"text","text":"A"}',
      'data: {"type":"text","text":"B"}',
    ]);
    expect(result.remainder).toBe("");
  });

  it("should handle a buffer with remainder (incomplete event)", () => {
    const buffer = 'data: {"type":"text","text":"A"}\n\ndata: {"type":"te';
    const result = splitSSEBuffer(buffer);
    expect(result.events).toEqual(['data: {"type":"text","text":"A"}']);
    expect(result.remainder).toBe('data: {"type":"te');
  });

  it("should return empty events for a buffer with no complete events", () => {
    const buffer = 'data: {"type":"text","text":"partial';
    const result = splitSSEBuffer(buffer);
    expect(result.events).toEqual([]);
    expect(result.remainder).toBe('data: {"type":"text","text":"partial');
  });

  it("should handle empty buffer", () => {
    const result = splitSSEBuffer("");
    expect(result.events).toEqual([]);
    expect(result.remainder).toBe("");
  });
});
