/**
 * SSE event parser for the app messages stream.
 * Extracted from the EventSource handler in the app workspace page.
 */

export type SSEEventType =
  | "message"
  | "status"
  | "agent_working"
  | "code_updated"
  | "sync_in_progress";

const VALID_SSE_TYPES = new Set<string>([
  "message",
  "status",
  "agent_working",
  "code_updated",
  "sync_in_progress",
]);

export interface SSEEvent {
  type: SSEEventType;
  data: Record<string, unknown>;
}

export function parseSSEEvent(eventData: string): SSEEvent | null {
  try {
    const parsed = JSON.parse(eventData);
    if (
      typeof parsed !== "object" ||
      parsed === null ||
      typeof parsed.type !== "string" ||
      !VALID_SSE_TYPES.has(parsed.type) ||
      typeof parsed.data !== "object" ||
      parsed.data === null
    ) {
      return null;
    }
    return { type: parsed.type as SSEEventType, data: parsed.data };
  } catch {
    return null;
  }
}
