import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { getChatSystemPrompt } from "../../core-logic/chat-system-prompt.js";
import { BROWSER_TOOLS } from "../../core-logic/chat-browser-tools.js";

const chat = new Hono<{ Bindings: Env; Variables: Variables }>();

chat.post("/api/chat", async (c) => {
  const body = await c.req.json<{ message?: string; history?: Array<{ role: string; content: string }> }>();
  if (!body.message || typeof body.message !== "string") {
    return c.json({ error: "message is required" }, 400);
  }

  const history = Array.isArray(body.history) ? body.history : [];
  const requestId = c.get("requestId");

  // Fetch MCP tools from MCP_SERVICE
  let mcpTools: Array<{ name: string; description: string; input_schema: unknown }> = [];
  try {
    const toolsRes = await c.env.MCP_SERVICE.fetch(
      new Request("https://mcp.spike.land/tools", {
        headers: { "X-Request-Id": requestId },
      }),
    );
    if (toolsRes.ok) {
      const data = await toolsRes.json<{ tools: Array<{ name: string; description: string; inputSchema?: unknown }> }>();
      mcpTools = (data.tools ?? []).slice(0, 50).map((t) => ({
        name: t.name,
        description: t.description,
        input_schema: t.inputSchema ?? { type: "object", properties: {} },
      }));
    }
  } catch {
    // Non-fatal — proceed without MCP tools
  }

  const allTools = [...BROWSER_TOOLS, ...mcpTools];

  const messages: Array<{ role: string; content: unknown }> = [
    ...history.map((h) => ({ role: h.role, content: h.content })),
    { role: "user", content: body.message },
  ];

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
        let toolLoopCount = 0;
        const MAX_TOOL_LOOPS = 10;

        while (toolLoopCount <= MAX_TOOL_LOOPS) {
          const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "x-api-key": c.env.CLAUDE_OAUTH_TOKEN,
              "anthropic-version": "2023-06-01",
            },
            body: JSON.stringify({
              model: "claude-sonnet-4-6",
              max_tokens: 4096,
              system: getChatSystemPrompt(),
              tools: allTools,
              messages,
              stream: true,
            }),
          });

          if (!anthropicRes.ok) {
            await sendEvent({ type: "error", error: `Anthropic API error: ${anthropicRes.status}` });
            break;
          }

          const reader = anthropicRes.body?.getReader();
          if (!reader) break;

          const decoder = new TextDecoder();
          let buffer = "";
          let currentToolName = "";
          let currentToolId = "";
          let toolInputJson = "";
          let hasToolUse = false;
          const toolResults: Array<{ type: "tool_result"; tool_use_id: string; content: string }> = [];
          const contentBlocks: Array<{
            type: string;
            text?: string;
            id?: string;
            name?: string;
            input?: unknown;
          }> = [];

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
                const event = JSON.parse(rawData) as {
                  type: string;
                  content_block?: { type: string; name?: string; id?: string };
                  delta?: { type: string; text?: string; partial_json?: string };
                  index?: number;
                };

                if (event.type === "content_block_start") {
                  const block = event.content_block;
                  if (block?.type === "text") {
                    contentBlocks.push({ type: "text", text: "" });
                  } else if (block?.type === "tool_use") {
                    currentToolName = block.name ?? "";
                    currentToolId = block.id ?? "";
                    toolInputJson = "";
                    hasToolUse = true;
                    await sendEvent({ type: "tool_call_start", name: currentToolName, args: {} });
                  }
                } else if (event.type === "content_block_delta") {
                  const delta = event.delta;
                  if (delta?.type === "text_delta" && delta.text) {
                    // Append to last text block
                    const lastBlock = contentBlocks[contentBlocks.length - 1];
                    if (lastBlock?.type === "text") {
                      lastBlock.text = (lastBlock.text ?? "") + delta.text;
                    }
                    await sendEvent({ type: "text_delta", text: delta.text });
                  } else if (delta?.type === "input_json_delta" && delta.partial_json) {
                    toolInputJson += delta.partial_json;
                  }
                } else if (event.type === "content_block_stop") {
                  if (currentToolName && currentToolId) {
                    let toolArgs: Record<string, unknown> = {};
                    try {
                      toolArgs = JSON.parse(toolInputJson || "{}") as Record<string, unknown>;
                    } catch {
                      // Malformed JSON — use empty args
                    }

                    contentBlocks.push({
                      type: "tool_use",
                      id: currentToolId,
                      name: currentToolName,
                      input: toolArgs,
                    });

                    const isBrowser = currentToolName.startsWith("browser_");
                    if (isBrowser) {
                      const rid = crypto.randomUUID();
                      await sendEvent({
                        type: "browser_command",
                        tool: currentToolName,
                        args: toolArgs,
                        requestId: rid,
                      });
                      toolResults.push({
                        type: "tool_result",
                        tool_use_id: currentToolId,
                        content: JSON.stringify({ success: true, note: "Executed in browser" }),
                      });
                    } else {
                      let result = "Tool call failed";
                      try {
                        const rpcRes = await c.env.MCP_SERVICE.fetch(
                          new Request("https://mcp.spike.land/mcp", {
                            method: "POST",
                            headers: {
                              "Content-Type": "application/json",
                              "X-Request-Id": requestId,
                            },
                            body: JSON.stringify({
                              jsonrpc: "2.0",
                              id: crypto.randomUUID(),
                              method: "tools/call",
                              params: { name: currentToolName, arguments: toolArgs },
                            }),
                          }),
                        );
                        if (rpcRes.ok) {
                          const rpcData = await rpcRes.json<{
                            result?: { content?: Array<{ text?: string }> };
                            error?: { message: string };
                          }>();
                          if (rpcData.result?.content) {
                            result = rpcData.result.content.map((item) => item.text ?? "").join("\n");
                          } else if (rpcData.error) {
                            result = `Error: ${rpcData.error.message}`;
                          }
                        }
                      } catch (error) {
                        result = `Tool error: ${error instanceof Error ? error.message : "unknown"}`;
                      }

                      await sendEvent({ type: "tool_call_end", name: currentToolName, result });
                      toolResults.push({
                        type: "tool_result",
                        tool_use_id: currentToolId,
                        content: result,
                      });
                    }

                    currentToolName = "";
                    currentToolId = "";
                    toolInputJson = "";
                  }
                }
              } catch {
                // Skip malformed SSE events
              }
            }
          }

          if (hasToolUse && toolResults.length > 0 && toolLoopCount < MAX_TOOL_LOOPS) {
            messages.push({
              role: "assistant",
              content: contentBlocks.map((block) => {
                if (block.type === "tool_use") {
                  return { type: "tool_use", id: block.id, name: block.name, input: block.input };
                }
                return { type: "text", text: block.text ?? "" };
              }),
            });
            messages.push({
              role: "user",
              content: toolResults,
            });
            toolLoopCount++;
            continue;
          }

          break;
        }
      } catch (err) {
        try {
          await sendEvent({ type: "error", error: err instanceof Error ? err.message : "Internal error" });
        } catch {
          // Writer may already be closed
        }
      } finally {
        await sendEvent("[DONE]");
        await writer.close();
      }
    })();

  try { c.executionCtx.waitUntil(bgTask); } catch { /* no ExecutionContext in tests */ }

  return new Response(readable, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Request-Id": requestId,
    },
  });
});

export { chat };
