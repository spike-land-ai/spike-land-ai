import { getGeminiClient } from "@/lib/ai/gemini-client";
import logger from "@/lib/logger";

const FRIENDLY_ERROR_MESSAGE =
  "I'm having a bit of trouble right now. Please try again in a moment.";

interface CreateGeminiChatStreamParams {
  question: string;
  systemPrompt: string;
  maxTokens?: number;
  onComplete?: (fullAnswer: string) => void;
}

/**
 * Creates a ReadableStream that streams Gemini chat responses as SSE events.
 *
 * Emits events in the same format consumed by `useChatStream`:
 * - `{type: "text", text: "chunk"}` per text chunk
 * - `{type: "done", usage: {model: "gemini-3-flash-preview"}}` on completion
 * - `{type: "error", error: "friendly message"}` on any failure
 */
export function createGeminiChatStream(params: CreateGeminiChatStreamParams): ReadableStream {
  const { question, systemPrompt, maxTokens = 512, onComplete } = params;
  let cancelled = false;

  return new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder();
      let fullAnswer = "";

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

      const safeClose = () => {
        if (cancelled) return;
        try {
          controller.close();
        } catch {
          /* already closed */
        }
      };

      try {
        const ai = await getGeminiClient();

        const response = await ai.models.generateContentStream({
          model: "gemini-3-flash-preview",
          contents: [
            {
              role: "user",
              parts: [{ text: question }],
            },
          ],
          config: {
            systemInstruction: systemPrompt,
            maxOutputTokens: maxTokens,
            temperature: 0.7,
          },
        });

        for await (const chunk of response) {
          if (cancelled) return;
          const text = chunk.candidates?.[0]?.content?.parts?.[0]?.text;
          if (text) {
            fullAnswer += text;
            const data = JSON.stringify({ type: "text", text });
            if (!safeEnqueue(encoder.encode(`data: ${data}\n\n`))) return;
          }
        }

        if (cancelled) return;
        const doneData = JSON.stringify({
          type: "done",
          usage: { model: "gemini-3-flash-preview" },
        });
        safeEnqueue(encoder.encode(`data: ${doneData}\n\n`));
        safeClose();
      } catch (error) {
        if (cancelled) return;
        const msg = error instanceof Error ? error.message : String(error);
        if (/aborted|cancel|ECONNRESET/i.test(msg)) {
          logger.debug("[Gemini stream] Client disconnected, ending gracefully");
          return;
        }
        logger.error("Gemini chat stream error", { error: msg });
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
          onComplete(fullAnswer);
        } catch (cbError) {
          logger.error("Gemini chat onComplete callback error", {
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
