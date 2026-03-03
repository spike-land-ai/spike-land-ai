import { SYSTEM_PROMPT } from "./system-prompt.ts";
import { BROWSER_TOOLS, isBrowserTool } from "./browser-tools.ts";
import type { createToolRegistry } from "../tool-registry.ts";
import type { Env } from "../env.d.ts";

interface ChatRequest {
  message: string;
  history?: Array<{ role: string; content: string }>;
}

type ToolRegistry = ReturnType<typeof createToolRegistry>;

export async function handleChatStream(
  request: ChatRequest,
  toolRegistry: ToolRegistry,
  env: Env,
  options: { userGeminiKey?: string; modelName?: string; thinkingBudget?: string } = {},
): Promise<ReadableStream> {
  const { userGeminiKey, modelName, thinkingBudget } = options;
  const encoder = new TextEncoder();

  function sseEvent(data: Record<string, unknown>): Uint8Array {
    return encoder.encode(`data: ${JSON.stringify(data)}\n\n`);
  }

  // Import Gemini SDK
  const { GoogleGenAI } = await import("@google/genai");
  const ai = new GoogleGenAI({
    apiKey: userGeminiKey || env.GEMINI_API_KEY,
  });

  const primaryModel = modelName || "gemini-3-flash-preview";
  const fallbackModel = "gemini-3.1-pro-preview";

  // Prepare tools in the format required by the new SDK
  const functionDeclarations = [
    ...toolRegistry.list().map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as Record<string, unknown>,
    })),
    ...BROWSER_TOOLS.map((t) => ({
      name: t.name,
      description: t.description,
      parameters: t.inputSchema as Record<string, unknown>,
    })),
  ];

  const tools = [{ functionDeclarations }];

  // Prepare history (long term from request)
  // We only include text parts for history to avoid complex multi-part/thought issues
  const history = (request.history || []).map((h) => ({
    role: h.role === "assistant" ? "model" : "user",
    parts: [{ text: h.content }],
  }));

  // Current message
  const contents: Array<{ role: string; parts: Record<string, unknown>[] }> = [
    ...history.map((h) => ({ ...h, parts: h.parts as unknown as Record<string, unknown>[] })),
    { role: "user", parts: [{ text: request.message }] },
  ];

  return new ReadableStream({
    async start(controller) {
      try {
        const currentContents = [...contents];
        let iterations = 0;
        const maxIterations = 10;
        let selectedModel = primaryModel;

        while (iterations < maxIterations) {
          iterations++;

          const budget = thinkingBudget && thinkingBudget !== "off" ? parseInt(thinkingBudget, 10) : undefined;

          let streamResult;
          try {
            streamResult = await ai.models.generateContentStream({
              model: selectedModel,
              contents: currentContents,
              config: {
                systemInstruction: SYSTEM_PROMPT,
                tools,
                thinkingConfig: budget 
                  ? { includeThoughts: true, thinkingBudget: budget } 
                  : (thinkingBudget && thinkingBudget !== "off" ? { includeThoughts: true } : undefined),
              },
            });
          } catch (err: unknown) {
            // Check if we can fallback (503, 429, 404)
            const errorText = err instanceof Error ? err.message : String(err);
            const isRecoverable = errorText.includes("503") || errorText.includes("404") ||
              errorText.includes("UNAVAILABLE") || errorText.includes("not found") ||
              errorText.includes("region") || errorText.includes("not supported") ||
              errorText.includes("429");
            
            if (isRecoverable && selectedModel !== fallbackModel) {
              controller.enqueue(sseEvent({ 
                type: "system_notice", 
                text: `Primary model (${selectedModel}) unavailable. Falling back to ${fallbackModel}...` 
              }));
              selectedModel = fallbackModel;
              iterations--; // Retry this iteration
              continue;
            }
            throw err;
          }

          let hasToolCalls = false;
          const toolResponsesInThisTurn: Record<string, unknown>[] = [];
          const modelPartsInThisTurn: Record<string, unknown>[] = [];
          let _assistantText = "";
          let _thoughts = "";

          for await (const chunk of streamResult) {
            const candidates = chunk.candidates;
            if (!candidates || candidates.length === 0) continue;
            const parts = candidates[0]?.content?.parts;
            if (!parts) continue;

            for (const part of parts) {
              // Store part exactly as received to preserve hidden fields like thought_signature
              modelPartsInThisTurn.push(part as Record<string, unknown>);

              if (part.text) {
                _assistantText += part.text;
                controller.enqueue(sseEvent({ type: "text_delta", text: part.text }));
              } else if (part.thought) {
                if (part.thought) {
                  _thoughts += String(part.thought);
                  controller.enqueue(sseEvent({ type: "thought", text: String(part.thought) }));
                }
              } else if (part.functionCall) {
                const fnName = part.functionCall.name;
                if (!fnName) continue;

                hasToolCalls = true;
                controller.enqueue(
                  sseEvent({
                    type: "tool_call_start",
                    name: fnName,
                    args: part.functionCall.args,
                  }),
                );

                let resultText: string;
                try {
                  if (isBrowserTool(fnName)) {
                    const requestId = `br-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
                    controller.enqueue(
                      sseEvent({
                        type: "browser_command",
                        tool: fnName,
                        args: part.functionCall.args,
                        requestId,
                      }),
                    );
                    resultText = JSON.stringify({ status: "sent_to_browser", requestId });
                  } else {
                    const callResult = await toolRegistry.call(fnName, (part.functionCall.args ?? {}) as Record<string, unknown>);
                    resultText =
                      callResult.content
                        .filter((c): c is { type: "text"; text: string } => c.type === "text")
                        .map((c) => c.text)
                        .join("\n") || JSON.stringify(callResult);
                  }
                } catch (toolErr) {
                  resultText = `Error calling tool ${fnName}: ${toolErr instanceof Error ? toolErr.message : String(toolErr)}`;
                }

                controller.enqueue(
                  sseEvent({
                    type: "tool_call_end",
                    name: fnName,
                    result: resultText,
                  }),
                );

                const sig = (part.functionCall as Record<string, unknown>).thoughtSignature;
                toolResponsesInThisTurn.push({
                  functionResponse: {
                    name: fnName,
                    response: { content: resultText },
                  },
                  ...(sig ? { thoughtSignature: sig } : {}),
                });
              }
            }
          }

          if (!hasToolCalls) break;

          // Append assistant response to history
          currentContents.push({ role: "model", parts: modelPartsInThisTurn });

          // Append tool results to history
          currentContents.push({ role: "user", parts: toolResponsesInThisTurn });
        }

        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Unknown error";
        console.error("Chat error:", err);
        controller.enqueue(sseEvent({ type: "error", error: msg }));
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      } finally {
        controller.close();
      }
    },
  });
}

