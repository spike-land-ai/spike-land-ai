/**
 * Shared SSE event protocol for the agentic chat loop.
 *
 * Used by both the server (to emit events) and the client (to parse them).
 */

export type AgentSSEEvent =
  | { type: "text_delta"; text: string; }
  | {
    type: "tool_call_start";
    id: string;
    name: string;
    serverName: string;
    input: Record<string, unknown>;
  }
  | { type: "tool_call_end"; id: string; result: string; isError: boolean; }
  | { type: "turn_start"; turn: number; maxTurns: number; }
  | { type: "turn_end"; }
  | {
    type: "done";
    usage?: { input_tokens: number; output_tokens: number; };
  }
  | { type: "error"; message: string; };

/** Encode an event as an SSE `data:` line. */
export function encodeSSE(event: AgentSSEEvent): string {
  return `data: ${JSON.stringify(event)}\n\n`;
}

/** Parse a single SSE `data:` line back into an event, or null if invalid. */
export function parseSSE(line: string): AgentSSEEvent | null {
  const prefix = "data: ";
  if (!line.startsWith(prefix)) return null;
  try {
    return JSON.parse(line.slice(prefix.length)) as AgentSSEEvent;
  } catch {
    return null;
  }
}

/** Split an SSE buffer into complete events and a remainder. */
export function splitSSEBuffer(buffer: string): {
  events: string[];
  remainder: string;
} {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() || "";
  return { events: parts, remainder };
}
