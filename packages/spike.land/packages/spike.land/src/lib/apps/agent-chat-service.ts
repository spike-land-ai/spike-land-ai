import { broadcastCodeUpdated } from "@/app/api/apps/[id]/messages/stream/route";
import { logger } from "@/lib/errors/structured-logger";
import { agentEnv } from "@/lib/claude-agent/agent-env";
import {
  CODESPACE_SYSTEM_PROMPT,
  getSystemPromptWithCode,
} from "@/lib/claude-agent/prompts/codespace-system";
import {
  CODESPACE_TOOL_NAMES,
  createCodespaceServer,
} from "@/lib/claude-agent/tools/codespace-tools";
import { getOrCreateSession } from "@/lib/codespace";
import prisma from "@/lib/prisma";
import { tryCatch } from "@/lib/try-catch";
import {
  enqueueMessage,
  getCodeHash,
  setAgentWorking,
  setCodeHash,
} from "@/lib/upstash/client";
import { query } from "@anthropic-ai/claude-agent-sdk";
import { z } from "zod";

export const USE_QUEUE_MODE = process.env.AGENT_USE_QUEUE === "true";

export interface ContentPart {
  type: "text" | "tool_use";
  text?: string;
  name?: string;
}

export function emitStage(
  controller: ReadableStreamDefaultController,
  stage: string,
  tool?: string,
) {
  const data = JSON.stringify({
    type: "stage",
    stage,
    ...(tool && { tool }),
  });
  controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
}

export async function processAgentChatQueue(id: string, userMessageId: string) {
  logger.info("[agent/chat] Queue mode enabled, enqueueing message", {
    messageId: userMessageId,
    route: "/api/apps/agent/chat",
  });

  await enqueueMessage(id, userMessageId);
  await setAgentWorking(id, true);

  const queuedStream = new ReadableStream({
    start(controller) {
      const connectData = JSON.stringify({
        type: "stage",
        stage: "initialize",
      });
      controller.enqueue(new TextEncoder().encode(`data: ${connectData}\n\n`));

      const statusData = JSON.stringify({
        type: "status",
        content: "Message queued for processing. Agent will respond shortly...",
      });
      controller.enqueue(new TextEncoder().encode(`data: ${statusData}\n\n`));

      const processData = JSON.stringify({
        type: "stage",
        stage: "processing",
      });
      controller.enqueue(new TextEncoder().encode(`data: ${processData}\n\n`));

      controller.close();
    },
  });

  return new Response(queuedStream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

export async function processAgentChatDirect(
  id: string,
  app: { codespaceId: string; },
  content: string,
) {
  const codespaceServer = createCodespaceServer(app.codespaceId);
  let currentCode = "";
  const { data: codespaceSession, error: sessionError } = await tryCatch(
    getOrCreateSession(app.codespaceId),
  );

  if (!sessionError && codespaceSession?.code) {
    currentCode = codespaceSession.code;
  }

  let codeUnchanged = false;
  if (currentCode) {
    const crypto = await import("crypto");
    const currentHash = crypto.createHash("sha256").update(currentCode).digest(
      "hex",
    );
    const previousHash = await getCodeHash(id);

    if (previousHash && previousHash === currentHash) {
      codeUnchanged = true;
      logger.debug(
        "[agent/chat] Code unchanged since last message, optimizing token usage",
        { appId: id },
      );
    } else {
      await setCodeHash(id, currentHash);
    }
  }

  logger.info("[agent/chat] Starting agent query", {
    appId: id,
    codespaceId: app.codespaceId,
    codeLength: currentCode.length,
    codeUnchanged,
    route: "/api/apps/agent/chat",
  });

  const systemPrompt = currentCode && !codeUnchanged
    ? getSystemPromptWithCode(currentCode)
    : CODESPACE_SYSTEM_PROMPT
      + (codeUnchanged
        ? "\n\nNote: Code is unchanged since your last response. Use read_code if you need to see it."
        : "");

  const stream = new ReadableStream({
    async start(controller) {
      try {
        emitStage(controller, "initialize");

        const result = query({
          prompt: content,
          options: {
            mcpServers: {
              codespace: codespaceServer,
            },
            allowedTools: CODESPACE_TOOL_NAMES,
            tools: [],
            permissionMode: "dontAsk",
            persistSession: false,
            systemPrompt,
            env: await agentEnv(),
          },
        });

        let finalResponse = "";
        let processingEmitted = false;

        for await (const message of result) {
          if (!processingEmitted) {
            emitStage(controller, "processing");
            processingEmitted = true;
          }
          logger.debug("[agent/chat] Message type", {
            messageType: message.type,
          });

          if (message.type === "assistant") {
            const assistantMessage = message as {
              message?: { content?: ContentPart[]; };
            };
            const betaMessage = assistantMessage.message;
            const contentArray = betaMessage?.content || [];

            const textParts = contentArray.filter(c => c.type === "text");
            const text = textParts.map(c => c.text || "").join("");
            if (text) {
              finalResponse += text;
              const data = JSON.stringify({ type: "chunk", content: text });
              controller.enqueue(new TextEncoder().encode(`data: ${data}\n\n`));
            }

            const toolUseParts = contentArray.filter(c => c.type === "tool_use");
            for (const toolUse of toolUseParts) {
              const toolName = toolUse.name || "";
              emitStage(controller, "executing_tool", toolName || "tool");
              const statusData = JSON.stringify({
                type: "status",
                content: `Executing ${toolName || "tool"}...`,
              });
              controller.enqueue(
                new TextEncoder().encode(`data: ${statusData}\n\n`),
              );
            }
          }

          if (message.type === "result") {
            logger.info("[agent/chat] Query completed", {
              subtype: message.subtype,
            });
            if (message.subtype !== "success") {
              const resultMsg = message as { errors?: string[]; };
              const errData = JSON.stringify({
                type: "error",
                content: resultMsg.errors?.join(", ") || "Unknown error",
              });
              controller.enqueue(
                new TextEncoder().encode(`data: ${errData}\n\n`),
              );
            }
          }
        }

        let agentMessageId: string | undefined;
        if (finalResponse) {
          const agentMessageResult = await tryCatch(
            prisma.appMessage.create({
              data: {
                appId: id,
                role: "AGENT",
                content: finalResponse,
              },
            }),
          );
          if (agentMessageResult.data) {
            agentMessageId = agentMessageResult.data.id;
          }

          const isDefaultName = app.codespaceId
            && app.codespaceId.includes("-");
          if (isDefaultName) {
            generateAppDetails(id, finalResponse, content).catch(e => {
              logger.error(
                "[agent/chat] Background generateAppDetails failed",
                e instanceof Error ? e : undefined,
                { appId: id },
              );
            });
          }
        }

        emitStage(controller, "validating");

        const { data: verifySession } = await tryCatch(
          getOrCreateSession(app.codespaceId!),
        );

        if (verifySession && verifySession.code !== currentCode) {
          logger.info(
            "[agent/chat] Code was updated, broadcasting to SSE clients",
            { appId: id },
          );

          const crypto = await import("crypto");
          const hash = crypto.createHash("sha256").update(verifySession.code)
            .digest("hex");

          await tryCatch(
            prisma.appCodeVersion.create({
              data: {
                appId: id,
                messageId: agentMessageId,
                code: verifySession.code,
                hash,
              },
            }),
          );
          logger.info("[agent/chat] Created code version snapshot", {
            appId: id,
          });

          await setCodeHash(id, hash);
          broadcastCodeUpdated(id);
        } else if (verifySession) {
          logger.debug("[agent/chat] Agent completed but code unchanged", {
            appId: id,
          });
        }

        emitStage(controller, "complete");
        controller.close();
      } catch (error) {
        logger.error(
          "[agent/chat] Streaming error",
          error instanceof Error ? error : undefined,
          { appId: id },
        );
        emitStage(controller, "error");
        const errData = JSON.stringify({
          type: "error",
          content: error instanceof Error ? error.message : "Unknown error",
        });
        controller.enqueue(new TextEncoder().encode(`data: ${errData}\n\n`));
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
    },
  });
}

/**
 * High-level orchestration function to stream the agent chat.
 * Checks MCP agent status, persists the user message if needed,
 * and routes to either queue mode or direct mode.
 */
export async function streamAgentChat(
  id: string,
  app: { codespaceId: string; },
  content: string,
): Promise<Response> {
  const { isMcpAgentActive } = await import("@/lib/upstash/client");

  // Check if an external MCP agent is active for this app
  const mcpActive = await isMcpAgentActive(id);
  if (mcpActive) {
    const mcpStream = new ReadableStream({
      start(controller) {
        const statusData = JSON.stringify({
          type: "status",
          content:
            "An external agent is handling this app. Your message will be picked up shortly.",
        });
        controller.enqueue(new TextEncoder().encode(`data: ${statusData}\n\n`));
        controller.close();
      },
    });

    return new Response(mcpStream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        "Connection": "keep-alive",
      },
    });
  }

  const { data: recentMessage } = await tryCatch(
    prisma.appMessage.findFirst({
      where: { appId: id, role: "USER", content },
      orderBy: { createdAt: "desc" },
    }),
  );

  const isRecent = recentMessage
    && (Date.now() - new Date(recentMessage.createdAt).getTime()) < 30000;

  const { data: userMessage, error: messageError } = isRecent
    ? { data: recentMessage, error: null }
    : await tryCatch(
      prisma.appMessage.create({
        data: { appId: id, role: "USER", content },
      }),
    );

  if (messageError || !userMessage) {
    logger.error(
      "[agent/chat] Failed to create user message",
      messageError instanceof Error ? messageError : undefined,
      { route: "/api/apps/agent/chat" },
    );
    return Response.json({ error: "Failed to create message" }, {
      status: 500,
    });
  }

  if (USE_QUEUE_MODE) {
    return processAgentChatQueue(id, userMessage.id);
  }

  return processAgentChatDirect(id, { codespaceId: app.codespaceId }, content);
}

export async function generateAppDetails(
  appId: string,
  agentResponse: string,
  userPrompt: string,
) {
  const startTime = Date.now();
  const logContext = { appId, operation: "generateAppDetails" };

  try {
    const namingPrompt = `
      Based on the following conversation, generate a short, creative name (max 3-4 words) and a brief description (max 20 words) for the application being built.
      
      User: "${userPrompt.substring(0, 500)}..."
      Agent: "${agentResponse.substring(0, 500)}..."
      
      Return ONLY a JSON object with keys "name" and "description". Do not include markdown formatting.
    `;

    const result = await query({
      prompt: namingPrompt,
      options: {
        systemPrompt:
          "You are a helpful assistant that generates names and descriptions for software applications.",
        env: await agentEnv(),
      },
    });

    let jsonStr = "";
    for await (const message of result) {
      if (message.type === "assistant") {
        const assistantMessage = message as {
          message?: { content?: ContentPart[]; };
        };
        const betaMessage = assistantMessage.message;
        const text = betaMessage?.content?.filter(c => c.type === "text").map(c => c.text).join("")
          || "";
        jsonStr += text;
      }
    }

    jsonStr = jsonStr.replace(/```json/g, "").replace(/```/g, "").trim();

    const appDetailsSchema = z.object({
      name: z.string().min(1).max(50),
      description: z.string().min(1).max(200),
    });

    const parsed = appDetailsSchema.safeParse(JSON.parse(jsonStr));

    if (parsed.success) {
      await prisma.app.update({
        where: { id: appId },
        data: {
          name: parsed.data.name,
          description: parsed.data.description,
        },
      });
      const durationMs = Date.now() - startTime;
      logger.info("[agent/chat] generateAppDetails success", {
        ...logContext,
        durationMs,
        name: parsed.data.name,
      });
    } else {
      const durationMs = Date.now() - startTime;
      logger.warn("[agent/chat] generateAppDetails validation failed", {
        ...logContext,
        durationMs,
        error: parsed.error.message,
      });
    }
  } catch (e) {
    const durationMs = Date.now() - startTime;
    logger.error(
      "[agent/chat] generateAppDetails error",
      e instanceof Error ? e : undefined,
      { ...logContext, durationMs },
    );
  }
}
