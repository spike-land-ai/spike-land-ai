import { withClaudeClient } from "@/lib/ai/claude-client";
import logger from "@/lib/logger";

const FRIENDLY_ERROR_MESSAGE =
  "I'm having a bit of trouble right now. Please try again in a moment.";

/**
 * Returns true if the error indicates the client disconnected (aborted the request).
 */
function isAbortError(error: unknown): boolean {
  if (error instanceof Error) {
    const msg = error.message.toLowerCase();
    return msg.includes("aborted") || msg.includes("cancel");
  }
  return false;
}

interface CreateClaudeChatStreamParams {
  question: string;
  systemPrompt: string;
  maxTokens?: number;
  onComplete?: (fullAnswer: string, usage: { input_tokens: number; output_tokens: number }) => void;
}

/**
 * Creates a ReadableStream that streams Claude chat responses as SSE events.
 *
 * Uses withClaudeClient for automatic multi-token fallback on 401 errors.
 * Client disconnections (aborted/cancelled) are handled gracefully.
 */
export function createClaudeChatStream(params: CreateClaudeChatStreamParams): ReadableStream {
  const { question, systemPrompt, maxTokens = 512, onComplete } = params;
  let cancelled = false;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullAnswer = "";
      let usage = { input_tokens: 0, output_tokens: 0 };

      /** Safely enqueue data; returns false if the stream was cancelled. */
      const safeEnqueue = (chunk: Uint8Array): boolean => {
        if (cancelled) return false;
        try {
          controller.enqueue(chunk);
          return true;
        } catch {
          cancelled = true;
          return false;
        }
      };

      /** Safely close the controller. */
      const safeClose = () => {
        if (cancelled) return;
        try {
          controller.close();
        } catch {
          // Already closed or cancelled
        }
      };

      try {
        await withClaudeClient(async (anthropic) => {
          const messageStream = anthropic.messages.stream({
            model: "claude-haiku-4-5-20251001",
            max_tokens: maxTokens,
            system: systemPrompt,
            messages: [{ role: "user", content: question }],
          });

          try {
            for await (const event of messageStream) {
              if (cancelled) return;

              if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
                fullAnswer += event.delta.text;
                const data = JSON.stringify({
                  type: "text",
                  text: event.delta.text,
                });
                if (!safeEnqueue(encoder.encode(`data: ${data}\n\n`))) return;
              }
            }
          } catch (streamError) {
            if (cancelled || isAbortError(streamError)) {
              cancelled = true;
              return;
            }
            throw streamError;
          }

          if (cancelled) return;

          const finalMessage = await messageStream.finalMessage();
          usage = {
            input_tokens: finalMessage.usage.input_tokens,
            output_tokens: finalMessage.usage.output_tokens,
          };
        });

        if (cancelled) return;
        const doneData = JSON.stringify({ type: "done", usage });
        safeEnqueue(encoder.encode(`data: ${doneData}\n\n`));
        safeClose();
      } catch (error) {
        if (cancelled || isAbortError(error)) {
          logger.debug("[Claude stream] Client disconnected, ending gracefully");
          return;
        }

        logger.error("Claude chat stream error (all tokens exhausted)", {
          error: error instanceof Error ? error.message : String(error),
        });
        const errData = JSON.stringify({
          type: "error",
          error: FRIENDLY_ERROR_MESSAGE,
        });
        safeEnqueue(encoder.encode(`data: ${errData}\n\n`));
        safeClose();
        return;
      }

      if (onComplete && !cancelled) {
        try {
          onComplete(fullAnswer, usage);
        } catch (cbError) {
          logger.error("Claude chat onComplete callback error", {
            error: cbError instanceof Error ? cbError.message : String(cbError),
          });
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });
}
