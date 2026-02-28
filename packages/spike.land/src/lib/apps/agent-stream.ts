/**
 * Agent streaming response parser.
 * Extracted from processMessageWithAgent in the app workspace page.
 */

export interface AgentStreamEvent {
  type: "chunk" | "stage" | "status" | "error";
  content?: string;
  stage?: string;
  tool?: string;
}

const VALID_STREAM_TYPES = new Set<string>([
  "chunk",
  "stage",
  "status",
  "error",
]);

export function parseAgentStreamLine(line: string): AgentStreamEvent | null {
  if (!line.startsWith("data: ")) return null;

  try {
    const data = JSON.parse(line.substring(6));
    if (
      typeof data !== "object"
      || data === null
      || typeof data.type !== "string"
      || !VALID_STREAM_TYPES.has(data.type)
    ) {
      return null;
    }

    const event: AgentStreamEvent = { type: data.type };
    if (typeof data.content === "string") event.content = data.content;
    if (typeof data.stage === "string") event.stage = data.stage;
    if (typeof data.tool === "string") event.tool = data.tool;
    return event;
  } catch {
    return null;
  }
}

export async function* streamAgentResponse(
  appId: string,
  content: string,
  imageIds?: string[],
  signal?: AbortSignal,
): AsyncGenerator<AgentStreamEvent> {
  const body: Record<string, unknown> = {
    content: content || "[Image attached]",
  };
  if (imageIds?.length) body.imageIds = imageIds;

  const response = await fetch(`/api/apps/${appId}/agent/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    ...(signal !== undefined ? { signal } : {}),
  });

  if (!response.ok) throw new Error("Failed to send message to agent");

  const reader = response.body?.getReader();
  if (!reader) throw new Error("No reader available");

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        const event = parseAgentStreamLine(line);
        if (event) yield event;
      }
    }

    // Process any remaining buffer
    if (buffer.trim()) {
      const event = parseAgentStreamLine(buffer);
      if (event) yield event;
    }
  } finally {
    reader.releaseLock();
  }
}
