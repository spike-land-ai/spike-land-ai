/**
 * Chat SSE stream parsing utilities.
 *
 * Pure functions extracted from the useChatStream hook
 * for testability and reuse.
 */

export interface ChatSSEEvent {
  type: "text" | "error";
  text?: string;
  error?: string;
}

/** Parse a single SSE data line into a ChatSSEEvent */
export function parseChatSSE(dataLine: string): ChatSSEEvent | null {
  if (!dataLine.startsWith("data: ")) return null;
  try {
    const event = JSON.parse(dataLine.slice(6)) as {
      type: string;
      text?: string;
      error?: string;
    };
    if (event.type === "text" && event.text) {
      return { type: "text", text: event.text };
    }
    if (event.type === "error") {
      return { type: "error", error: event.error || "Stream error" };
    }
    return null;
  } catch {
    return null;
  }
}

/** Buffer SSE chunks and yield complete events */
export function splitSSEBuffer(buffer: string): {
  events: string[];
  remainder: string;
} {
  const parts = buffer.split("\n\n");
  const remainder = parts.pop() || "";
  return { events: parts, remainder };
}
