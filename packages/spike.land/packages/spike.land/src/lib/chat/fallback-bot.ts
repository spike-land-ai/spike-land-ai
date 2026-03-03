/**
 * Fallback bot for when AI tokens are unavailable.
 *
 * Provides scripted responses and saves user messages as DirectMessages
 * so no feedback is lost even when the AI service is down.
 */

import { type AgentSSEEvent, encodeSSE } from "./agent-sse-protocol";
import type { AgentLoopStreamOptions } from "./agent-loop-server";
import logger from "@/lib/logger";

type Intent = "bug" | "feedback" | "message" | "help" | "general";

const BUG_KEYWORDS = /\b(bug|broken|error|crash|fail|not working|doesn't work|issue)\b/i;
const FEEDBACK_KEYWORDS =
  /\b(feedback|suggestion|suggest|improve|wish|would be nice|feature request)\b/i;
const MESSAGE_KEYWORDS = /\b(message|contact|tell|reach|talk to|dm|email)\b/i;
const HELP_KEYWORDS = /\b(help|how do|how to|where|guide|tutorial|getting started)\b/i;

export function detectIntent(text: string): Intent {
  if (BUG_KEYWORDS.test(text)) return "bug";
  if (FEEDBACK_KEYWORDS.test(text)) return "feedback";
  if (MESSAGE_KEYWORDS.test(text)) return "message";
  if (HELP_KEYWORDS.test(text)) return "help";
  return "general";
}

const RESPONSES: Record<Intent, string> = {
  bug: `**Thanks for reporting this!** I've saved your message and it will be reviewed by the team.

In the meantime, you can also:
- Check [existing issues](https://github.com/spike-land-ai/spike.land/issues) to see if this is already known
- Include steps to reproduce if you haven't already

We'll get back to you as soon as possible.`,

  feedback:
    `**Thank you for your feedback!** Your suggestion has been saved and will be reviewed by the team.

We appreciate you taking the time to help improve spike.land!`,

  message: `**Message received!** Your message has been delivered to the spike.land team.

We'll get back to you as soon as possible.`,

  help: `**Welcome to spike.land!** Here are some quick links:

- **Home**: [spike.land](https://spike.land) - AI-powered development platform
- **Code Editor**: [spike.land/create](https://spike.land/create) - Build and publish apps
- **App Store**: [spike.land/store](https://spike.land/store) - Browse community apps
- **Blog**: [spike.land/blog](https://spike.land/blog) - Latest updates

If you have a specific question, feel free to leave a message and we'll follow up!`,

  general: `**Thanks for reaching out!** I've saved your message for the spike.land team.

Our AI assistant is currently offline, but a human will review your message and respond soon.

In the meantime, feel free to explore [spike.land](https://spike.land)!`,
};

/**
 * Save the user's message as a DirectMessage to the site owner.
 */
async function saveMessageAsDM(
  question: string,
  intent: Intent,
  userId?: string,
  sessionId?: string,
  route?: string,
): Promise<void> {
  try {
    const prisma = (await import("@/lib/prisma")).default;

    const owner = await prisma.user.findFirst({
      where: { email: "zoltan@spike.land" },
      select: { id: true },
    });

    if (!owner) {
      logger.warn("Fallback bot: site owner not found, cannot save DM");
      return;
    }

    await prisma.directMessage.create({
      data: {
        fromUserId: userId && !userId.startsWith("session:") ? userId : null,
        fromSessionId: sessionId || null,
        toUserId: owner.id,
        subject: `[${intent.toUpperCase()}] Chat message from ${route || "/"}`,
        message: question,
        priority: intent === "bug" ? "HIGH" : "MEDIUM",
      },
    });
  } catch (err) {
    logger.error("Fallback bot: failed to save DM", {
      error: err instanceof Error ? err.message : String(err),
    });
  }
}

/**
 * Create an SSE stream with a scripted bot response.
 * Uses the same protocol as the real agent loop so the UI works unchanged.
 */
export function createFallbackBotStream(
  options: Pick<
    AgentLoopStreamOptions,
    "question" | "sessionId" | "promptContext"
  >,
): ReadableStream<Uint8Array> {
  const { question, sessionId, promptContext } = options;
  const encoder = new TextEncoder();
  let cancelled = false;

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const emit = (event: AgentSSEEvent) => {
        if (cancelled) return;
        try {
          controller.enqueue(encoder.encode(encodeSSE(event)));
        } catch {
          cancelled = true;
        }
      };

      try {
        const intent = detectIntent(question);
        const response = RESPONSES[intent];

        // Emit response as text_delta (simulates streaming)
        emit({ type: "text_delta", text: response });

        // Save the message in the background
        await saveMessageAsDM(
          question,
          intent,
          promptContext.userName ? undefined : undefined,
          sessionId,
          promptContext.route,
        );

        emit({ type: "done" });
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        logger.error("Fallback bot error", { error: message });
        emit({
          type: "error",
          message: "Unable to process your message right now.",
        });
      } finally {
        if (!cancelled) {
          try {
            controller.close();
          } catch {
            // Already closed
          }
        }
      }
    },
    cancel() {
      cancelled = true;
    },
  });
}
