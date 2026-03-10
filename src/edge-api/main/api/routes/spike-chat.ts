import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import {
  buildAetherSystemPrompt,
  buildClassifyPrompt,
  buildPlanPrompt,
  buildExtractPrompt,
  type UserMemory,
} from "../../core-logic/aether-prompt.js";
import {
  fetchUserNotes,
  selectNotes,
  saveNote,
  parseExtractedNote,
} from "../../core-logic/aether-memory.js";

const spikeChat = new Hono<{ Bindings: Env; Variables: Variables }>();
type SpikeChatRole = "system" | "user" | "assistant";

interface SpikeChatMessage {
  role: SpikeChatRole;
  content: string;
}

/** Call Grok (xAI) with OpenAI-compatible format. Non-streaming. */
async function callGrok(
  apiKey: string,
  systemPrompt: string,
  userMessage: string,
  opts: { temperature?: number; maxTokens?: number },
): Promise<string> {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: "grok-4-1",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 256,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Grok API error ${res.status}: ${errText}`);
    throw new Error(`AI service error (${res.status})`);
  }

  const data = await res.json<{
    choices: Array<{ message: { content: string } }>;
  }>();
  return data.choices[0]?.message.content ?? "";
}

/** Stream Grok response as SSE to the client. Returns the full collected text. */
export function buildSpikeChatMessages(
  systemPrompt: string,
  history: Array<{ role: string; content: string }> | undefined,
  userMessage: string,
): SpikeChatMessage[] {
  const messages: SpikeChatMessage[] = [{ role: "system", content: systemPrompt }];

  if (Array.isArray(history)) {
    for (const entry of history) {
      if (
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string"
      ) {
        const content = entry.content.trim();
        if (content) {
          messages.push({ role: entry.role, content });
        }
      }
    }
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

async function streamGrokResponse(
  apiKey: string,
  messages: SpikeChatMessage[],
  sendEvent: (data: unknown) => Promise<void>,
  opts: {
    temperature?: number;
    maxTokens?: number;
    tools?: Array<{
      type: "function";
      function: { name: string; description: string; parameters: unknown };
    }>;
  },
): Promise<string> {
  const body: Record<string, unknown> = {
    model: "grok-4-1",
    messages,
    temperature: opts.temperature ?? 0.2,
    max_tokens: opts.maxTokens ?? 4096,
    stream: true,
  };
  if (opts.tools && opts.tools.length > 0) {
    body.tools = opts.tools;
  }

  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const errText = await res.text();
    console.error(`Grok streaming API error ${res.status}: ${errText}`);
    throw new Error(`AI service error (${res.status})`);
  }

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body from Grok");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  let currentToolName = "";
  let toolArgBuffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split("\n");
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const rawData = line.slice(6).trim();
      if (rawData === "[DONE]" || !rawData) continue;

      try {
        const chunk = JSON.parse(rawData) as {
          choices: Array<{
            delta: {
              content?: string;
              tool_calls?: Array<{
                function: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string;
          }>;
        };

        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        // Text content
        if (delta.content) {
          fullText += delta.content;
          await sendEvent({ type: "text_delta", text: delta.content });
        }

        // Tool calls (OpenAI format)
        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            if (tc.function.name) {
              currentToolName = tc.function.name;
              toolArgBuffer = "";
              await sendEvent({ type: "tool_call_start", name: currentToolName, args: {} });
            }
            if (tc.function.arguments) {
              toolArgBuffer += tc.function.arguments;
            }
          }
        }

        // Finish reason — tool call end
        if (chunk.choices[0]?.finish_reason === "tool_calls" && currentToolName) {
          await sendEvent({ type: "tool_call_end", name: currentToolName, result: toolArgBuffer });
          currentToolName = "";
          toolArgBuffer = "";
        }
      } catch {
        // skip malformed SSE
      }
    }
  }

  return fullText;
}

spikeChat.post("/api/spike-chat", async (c) => {
  const body = await c.req.json<{
    message?: string;
    history?: Array<{ role: string; content: string }>;
  }>();
  if (!body.message || typeof body.message !== "string") {
    return c.json({ error: "message is required" }, 400);
  }

  if (body.message.length > 8000) {
    return c.json({ error: "message too long (max 8000 characters)" }, 400);
  }

  const apiKey = c.env.XAI_API_KEY;
  if (!apiKey) {
    return c.json({ error: "XAI_API_KEY not configured" }, 503);
  }

  const userId = c.get("userId") as string | undefined;
  const userMessage = body.message.trim();
  const requestId = (c.get("requestId") as string | undefined) ?? crypto.randomUUID();

  // Load user memory
  const userNotes: UserMemory["notes"] = userId
    ? await fetchUserNotes(c.env.DB, userId).catch((): UserMemory["notes"] => [])
    : [];
  const selectedNotes = selectNotes(userNotes);
  const userMemory: UserMemory = {
    lifeSummary: "",
    notes: selectedNotes,
    currentGoals: [],
  };

  const { stablePrefix, dynamicSuffix } = buildAetherSystemPrompt(userMemory);
  const fullSystemPrompt = dynamicSuffix ? `${stablePrefix}\n\n${dynamicSuffix}` : stablePrefix;

  // Fetch MCP tools for Grok function calling
  let grokTools: Array<{
    type: "function";
    function: { name: string; description: string; parameters: unknown };
  }> = [];
  try {
    const toolsRes = await c.env.MCP_SERVICE.fetch(
      new Request("https://mcp.spike.land/tools", {
        headers: { "X-Request-Id": requestId },
      }),
    );
    if (toolsRes.ok) {
      const data = await toolsRes.json<{
        tools: Array<{
          name: string;
          description: string;
          inputSchema?: unknown;
        }>;
      }>();
      grokTools = (data.tools ?? []).slice(0, 30).map((t) => ({
        type: "function" as const,
        function: {
          name: t.name,
          description: t.description,
          parameters: t.inputSchema ?? { type: "object", properties: {} },
        },
      }));
    }
  } catch {
    // Non-fatal — proceed without tools
  }

  // Set up SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (data: unknown) => {
    if (data === "[DONE]") {
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } else {
      await writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
    }
  };

  const bgTask = (async () => {
    try {
      // --- Stage 1: CLASSIFY ---
      await sendEvent({ type: "stage_update", stage: "classify" });
      let classifiedIntent = "{}";
      try {
        classifiedIntent = await callGrok(apiKey, buildClassifyPrompt(), userMessage, {
          temperature: 0.1,
          maxTokens: 200,
        });
      } catch {
        classifiedIntent = JSON.stringify({
          intent: "conversation",
          domain: "general",
          urgency: "medium",
          suggestedTools: [],
        });
      }

      // --- Stage 2: PLAN ---
      await sendEvent({ type: "stage_update", stage: "plan" });
      let planArtifact = userMessage;
      try {
        const toolNames = grokTools.map((t) => t.function.name);
        const planPrompt = buildPlanPrompt(classifiedIntent, toolNames);
        const planResult = await callGrok(apiKey, planPrompt, userMessage, {
          temperature: 0.4,
          maxTokens: 1024,
        });
        planArtifact = `## Plan\n${planResult}\n\n## User Message\n${userMessage}`;
      } catch {
        // Fall through with raw user message
      }

      // --- Stage 3: EXECUTE (streamed) ---
      await sendEvent({ type: "stage_update", stage: "execute" });
      const executionMessages = buildSpikeChatMessages(
        fullSystemPrompt,
        body.history,
        planArtifact,
      );
      const assistantResponse = await streamGrokResponse(apiKey, executionMessages, sendEvent, {
        temperature: 0.2,
        maxTokens: 4096,
      });

      // --- Stage 4: EXTRACT (background) ---
      await sendEvent({ type: "stage_update", stage: "extract" });
      const extractTask = (async () => {
        try {
          const extractResult = await callGrok(
            apiKey,
            buildExtractPrompt(),
            `User: ${userMessage}\n\nAssistant: ${assistantResponse.slice(0, 2000)}`,
            { temperature: 0.2, maxTokens: 256 },
          );
          const extracted = parseExtractedNote(extractResult);
          if (extracted && userId) {
            await saveNote(c.env.DB, userId, {
              id: crypto.randomUUID(),
              trigger: extracted.trigger,
              lesson: extracted.lesson,
              confidence: extracted.confidence,
              helpCount: 0,
              createdAt: Date.now(),
              lastUsedAt: Date.now(),
            });
          }
        } catch {
          // Note extraction is non-critical
        }
      })();

      try {
        c.executionCtx.waitUntil(extractTask);
      } catch {
        // No ExecutionContext in tests
      }
    } catch (err) {
      try {
        await sendEvent({
          type: "error",
          error: err instanceof Error ? err.message : "Internal error",
        });
      } catch {
        // Writer may already be closed
      }
    } finally {
      await sendEvent("[DONE]");
      await writer.close();
    }
  })();

  try {
    c.executionCtx.waitUntil(bgTask);
  } catch {
    // No ExecutionContext in tests
  }

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
      "X-Request-Id": requestId,
    },
  });
});

export { spikeChat };
