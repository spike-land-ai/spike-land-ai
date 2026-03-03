/**
 * Standard Server-Sent Events response headers.
 *
 * Use these when creating SSE streaming responses to avoid
 * repeating the same header definitions across routes.
 */
export const SSE_HEADERS = {
  "Content-Type": "text/event-stream",
  "Cache-Control": "no-cache",
  Connection: "keep-alive",
} as const;
