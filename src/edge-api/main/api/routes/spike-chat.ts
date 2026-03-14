import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { BROWSER_TOOLS } from "../../core-logic/chat-browser-tools.js";
import {
  buildAetherSystemPrompt,
  buildExtractPrompt,
  type UserMemory,
} from "../../core-logic/aether-prompt.js";
import {
  fetchUserNotes,
  selectNotes,
  saveNote,
  parseExtractedNote,
} from "../../core-logic/aether-memory.js";
import { fetchToolCatalog } from "../../core-logic/mcp-tools.js";
import { safeJsonParse, executeAgentTool } from "../../core-logic/chat-tool-execution.js";
import {
  resolveSynthesisTarget,
  streamCompletion,
  synthesizeCompletion,
  type ProviderMessage,
  type ResolvedSynthesisTarget,
} from "../../core-logic/llm-provider.js";
import { getRubik3SystemPrompt } from "../../core-logic/rubik-persona-prompt.js";
import { getErdosPersonaPrompt } from "../../core-logic/erdos-persona-prompt.js";
import { getRadixPersonaPrompt } from "../../core-logic/radix-persona-prompt.js";
import { getGovPersonaPrompt } from "../../core-logic/gov-persona-prompt.js";
const spikeChat = new Hono<{ Bindings: Env; Variables: Variables }>();
const MAX_TOOL_LOOPS = 3;
const MAX_HISTORY_MESSAGES = 16;
const MAX_RECENT_HISTORY_MESSAGES = 6;
const MAX_HISTORY_CHARS = 6_000;
const RECENT_MESSAGE_CHAR_LIMIT = 1_200;
const OLDER_ASSISTANT_CHAR_LIMIT = 320;
const OLDER_USER_CHAR_LIMIT = 240;
const TOOL_HINT_LIMIT = 12;
const ALLOWED_CHAT_EMAILS = new Set(["zoltan.erdos@spike.land", "zolika84@gmail.com"]);
const TOOL_INTENT_PATTERNS = [
  /\b(search|find|look up|lookup|latest|current|today|browse|inspect|check)\b/i,
  /\b(open|navigate|click|fill|screenshot|scroll|read)\b/i,
  /\b(price|pricing|docs?|documentation|api|endpoint|status|error|logs?)\b/i,
  /\b(compare|verify|debug|deploy|build|tool|mcp)\b/i,
  /\b(this page|current page|article|here)\b/i,
] as const;
type SpikeChatRole = "system" | "user" | "assistant" | "tool";

const SPIKE_BROWSER_TOOLS: Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> = BROWSER_TOOLS.map((tool) => ({
  type: "function",
  function: {
    name: tool.name,
    description: tool.description,
    parameters: tool.input_schema,
  },
}));

const SPIKE_AGENT_TOOLS: Array<{
  type: "function";
  function: {
    name: string;
    description: string;
    parameters: Record<string, unknown>;
  };
}> = [
  ...SPIKE_BROWSER_TOOLS,
  {
    type: "function",
    function: {
      name: "mcp_tool_search",
      description:
        "Search the MCP tool catalog by natural-language query. Use this when you know the task but not the exact tool name.",
      parameters: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description: "What you need the tool to do or the data you want to find.",
          },
        },
        required: ["query"],
      },
    },
  },
  {
    type: "function",
    function: {
      name: "mcp_tool_call",
      description:
        "Call an MCP tool by exact name with a JSON arguments object. Use mcp_tool_search first when you are not already sure of the correct tool.",
      parameters: {
        type: "object",
        properties: {
          name: {
            type: "string",
            description: "Exact MCP tool name to call.",
          },
          arguments: {
            type: "object",
            description: "JSON arguments to send to the target MCP tool.",
          },
        },
        required: ["name"],
      },
    },
  },
];

interface ParsedToolCall {
  toolCallId: string;
  name: string;
  args: Record<string, unknown>;
  rawArgs: string;
}

interface BrowserResultRequestBody {
  sessionId?: string;
  toolCallId?: string;
  result?: unknown;
}

interface SpikeChatMessage {
  role: SpikeChatRole;
  content: string | null;
  tool_call_id?: string;
  tool_calls?: Array<{
    id: string;
    type: "function";
    function: {
      name: string;
      arguments: string;
    };
  }>;
}

interface LocalIntentSummary {
  intent: "conversation" | "grounded_lookup" | "browser_action";
  urgency: "low" | "medium" | "high";
  needsTools: boolean;
  reason: string;
}

interface HeuristicNoteCandidate {
  trigger: string;
  lesson: string;
  confidence: number;
}

function normalizeText(value: string, maxChars: number) {
  const compact = value.replace(/\s+/g, " ").trim();
  if (!compact) {
    return "";
  }

  if (compact.length <= maxChars) {
    return compact;
  }

  return `${compact.slice(0, Math.max(0, maxChars - 3)).trimEnd()}...`;
}

function compressHistory(
  history: Array<{ role: string; content: string }> | undefined,
): Array<{ role: "user" | "assistant"; content: string }> {
  if (!Array.isArray(history)) {
    return [];
  }

  const compacted = history
    .filter(
      (entry): entry is { role: "user" | "assistant"; content: string } =>
        (entry.role === "user" || entry.role === "assistant") &&
        typeof entry.content === "string" &&
        entry.content.trim().length > 0,
    )
    .slice(-MAX_HISTORY_MESSAGES)
    .map((entry, index, entries) => {
      const isRecent = index >= Math.max(0, entries.length - MAX_RECENT_HISTORY_MESSAGES);
      const charLimit = isRecent
        ? RECENT_MESSAGE_CHAR_LIMIT
        : entry.role === "assistant"
          ? OLDER_ASSISTANT_CHAR_LIMIT
          : OLDER_USER_CHAR_LIMIT;

      return {
        role: entry.role,
        content: normalizeText(entry.content, charLimit),
      };
    })
    .filter((entry) => entry.content.length > 0);

  let totalChars = compacted.reduce((sum, entry) => sum + entry.content.length, 0);
  while (totalChars > MAX_HISTORY_CHARS && compacted.length > MAX_RECENT_HISTORY_MESSAGES) {
    const removed = compacted.shift();
    totalChars -= removed?.content.length ?? 0;
  }

  return compacted;
}

function classifyIntent(
  userMessage: string,
  pageContext?: {
    url?: string;
    title?: string;
    slug?: string;
    contentSnippet?: string;
  },
): LocalIntentSummary {
  const compact = userMessage.replace(/\s+/g, " ").trim();
  const lower = compact.toLowerCase();
  const mentionsPageContext =
    Boolean(pageContext?.title || pageContext?.url || pageContext?.slug) &&
    /\b(this|here|page|article|above|current)\b/i.test(compact);
  const needsTools =
    mentionsPageContext || TOOL_INTENT_PATTERNS.some((pattern) => pattern.test(lower));

  if (/\b(open|navigate|click|fill|screenshot|scroll|read)\b/i.test(lower)) {
    return {
      intent: "browser_action",
      urgency: /\bnow|urgent|asap|immediately\b/i.test(lower) ? "high" : "medium",
      needsTools,
      reason: "The request appears to require live navigation or browser interaction.",
    };
  }

  if (needsTools) {
    return {
      intent: "grounded_lookup",
      urgency: /\bblocker|broken|incident|outage|failing\b/i.test(lower) ? "high" : "medium",
      needsTools: true,
      reason: "The request depends on live platform state, docs, tools, or page context.",
    };
  }

  return {
    intent: "conversation",
    urgency: "low",
    needsTools: false,
    reason: "The request can be answered directly without live tool usage.",
  };
}

function buildPlanArtifact(
  userMessage: string,
  intent: LocalIntentSummary,
  toolCatalog: Array<{ name: string }>,
): string {
  if (!intent.needsTools) {
    return userMessage;
  }

  const hints = toolCatalog.slice(0, TOOL_HINT_LIMIT).map((tool) => tool.name);
  const lines = [
    "## Execution Brief",
    `Intent: ${intent.intent}`,
    `Urgency: ${intent.urgency}`,
    `Tool use: ${intent.needsTools ? "Allowed when needed" : "Not required"}`,
    `Reason: ${intent.reason}`,
  ];

  if (hints.length > 0) {
    lines.push(`Catalog hints: ${hints.join(", ")}`);
  }

  lines.push("## User Message");
  lines.push(userMessage);
  return lines.join("\n");
}

function extractNoteCandidate(userMessage: string): HeuristicNoteCandidate | null {
  const compact = userMessage.replace(/\s+/g, " ").trim();
  if (compact.length < 12) {
    return null;
  }

  const explicitRemember = /(?:^|\b)(?:remember|note that)\s+(.{8,200})$/i.exec(compact);
  if (explicitRemember?.[1]) {
    const fact = normalizeText(explicitRemember[1], 180);
    return {
      trigger: "explicit memory request",
      lesson: fact,
      confidence: 0.7,
    };
  }

  const preference = /(?:^|\b)(?:i prefer|we prefer|please use|always use)\s+(.{4,160})$/i.exec(
    compact,
  );
  if (preference?.[1]) {
    const fact = normalizeText(preference[1], 160);
    return {
      trigger: "stated preference",
      lesson: `User preference: ${fact}`,
      confidence: 0.62,
    };
  }

  const goal = /(?:^|\b)(?:my goal is|i'm trying to|i am trying to|we need to)\s+(.{6,180})$/i.exec(
    compact,
  );
  if (goal?.[1]) {
    const fact = normalizeText(goal[1], 180);
    return {
      trigger: "current goal",
      lesson: `Current goal: ${fact}`,
      confidence: 0.58,
    };
  }

  return null;
}

export function buildSpikeChatMessages(
  systemPrompt: string,
  history: Array<{ role: string; content: string }> | undefined,
  userMessage: string,
): SpikeChatMessage[] {
  const messages: SpikeChatMessage[] = [{ role: "system", content: systemPrompt }];

  for (const entry of compressHistory(history)) {
    messages.push({ role: entry.role, content: entry.content });
  }

  messages.push({ role: "user", content: userMessage });
  return messages;
}

/** Stream LLM response via provider resolution as SSE. Returns full text + parsed tool calls. */
async function streamLlmResponse(
  target: ResolvedSynthesisTarget,
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
): Promise<{ fullText: string; toolCalls: ParsedToolCall[] }> {
  const providerMessages: ProviderMessage[] = messages.map((m) => ({
    role: m.role === "tool" ? ("user" as const) : m.role,
    content: m.content ?? "",
  }));

  const res = await streamCompletion(target, providerMessages, {
    temperature: opts.temperature,
    maxTokens: opts.maxTokens,
    tools: opts.tools,
  });

  const reader = res.body?.getReader();
  if (!reader) throw new Error("No response body from LLM provider");

  const decoder = new TextDecoder();
  let buffer = "";
  let fullText = "";
  const toolCallState = new Map<number, { id: string; name: string; argBuffer: string }>();

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
                index: number;
                function: { name?: string; arguments?: string };
              }>;
            };
            finish_reason?: string;
          }>;
        };

        const delta = chunk.choices[0]?.delta;
        if (!delta) continue;

        if (delta.content) {
          fullText += delta.content;
          await sendEvent({ type: "text_delta", text: delta.content });
        }

        if (delta.tool_calls) {
          for (const tc of delta.tool_calls) {
            const idx = tc.index ?? 0;
            const existing = toolCallState.get(idx);
            const toolCallId =
              typeof (tc as { id?: unknown }).id === "string"
                ? ((tc as { id?: string }).id ?? "")
                : (existing?.id ?? crypto.randomUUID());
            const nextState = existing ?? {
              id: toolCallId,
              name: "",
              argBuffer: "",
            };
            if (tc.function.name) {
              nextState.name = tc.function.name;
            }
            if (tc.function.arguments) {
              nextState.argBuffer += tc.function.arguments;
            }
            toolCallState.set(idx, nextState);
          }
        }
      } catch {
        // skip malformed SSE
      }
    }
  }

  const toolCalls: ParsedToolCall[] = [...toolCallState.values()]
    .filter((state) => state.name)
    .map((state) => ({
      toolCallId: state.id,
      name: state.name,
      args: safeJsonParse<Record<string, unknown>>(state.argBuffer || "{}", {}),
      rawArgs: state.argBuffer || "{}",
    }));

  return { fullText, toolCalls };
}

spikeChat.post("/api/spike-chat/browser-results", async (c) => {
  const userId = c.get("userId") as string | undefined;
  const body = await c.req.json<BrowserResultRequestBody>();

  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  if (!body.sessionId || !body.toolCallId) {
    return c.json({ error: "sessionId and toolCallId are required" }, 400);
  }

  // Try DO callback path first (zero-polling)
  try {
    const sessionStub = c.env.SPIKE_CHAT_SESSIONS.get(
      c.env.SPIKE_CHAT_SESSIONS.idFromName(body.sessionId),
    ) as DurableObjectStub & {
      deliverBrowserResult(toolCallId: string, result: unknown): Promise<boolean>;
    };
    const delivered = await sessionStub.deliverBrowserResult(body.toolCallId, body.result ?? null);
    if (delivered) {
      return c.json({ ok: true });
    }
  } catch {
    // DO unavailable — fall through to D1 path
  }

  // Fallback: D1 update (for sessions started before DO migration)
  const result = await c.env.DB.prepare(
    `UPDATE spike_chat_browser_results
     SET status = 'done',
         result_json = ?,
         updated_at = ?
     WHERE tool_call_id = ? AND session_id = ? AND user_id = ?`,
  )
    .bind(JSON.stringify(body.result ?? null), Date.now(), body.toolCallId, body.sessionId, userId)
    .run();

  if ((result.meta.changes ?? 0) === 0) {
    return c.json({ error: "Browser result not found" }, 404);
  }

  return c.json({ ok: true });
});

spikeChat.post("/api/spike-chat", async (c) => {
  const body = await c.req.json<{
    message?: string;
    history?: Array<{ role: string; content: string }>;
    persona?: string;
    pageContext?: {
      url?: string;
      title?: string;
      slug?: string;
      contentSnippet?: string;
    };
  }>();
  if (!body.message || typeof body.message !== "string") {
    return c.json({ error: "message is required" }, 400);
  }

  if (body.message.length > 8000) {
    return c.json({ error: "message too long (max 8000 characters)" }, 400);
  }

  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }
  const userRow = await c.env.DB.prepare("SELECT email FROM users WHERE id = ? LIMIT 1")
    .bind(userId)
    .first<{ email: string }>();
  if (!userRow || !ALLOWED_CHAT_EMAILS.has(userRow.email)) {
    return c.json({ error: "Forbidden" }, 403);
  }

  const userMessage = body.message.trim();
  const requestId = (c.get("requestId") as string | undefined) ?? crypto.randomUUID();
  const sessionId = `spike-chat-${userId}`;
  const persona = typeof body.persona === "string" ? body.persona.trim() : undefined;

  // Get DO stub for session management (used for browser callbacks + history)
  interface SessionDOStub extends DurableObjectStub {
    addMessage(msg: {
      role: string;
      content: string;
      timestamp: number;
      toolCallId?: string;
    }): Promise<void>;
    waitForBrowserResult(toolCallId: string): Promise<unknown>;
    appendEvent(data: string): number;
    setMeta(key: string, value: string): Promise<void>;
  }
  let sessionDO: SessionDOStub | null = null;
  try {
    sessionDO = c.env.SPIKE_CHAT_SESSIONS.get(
      c.env.SPIKE_CHAT_SESSIONS.idFromName(sessionId),
    ) as unknown as SessionDOStub;
  } catch {
    // DO binding unavailable (local dev without DO support)
  }

  // Resolve LLM provider (BYOK → platform fallback)
  const llmTarget = await resolveSynthesisTarget(c.env, userId, {
    publicModel: "spike-agent-v1",
    provider: "auto",
    upstreamModel: undefined,
  });
  if (!llmTarget) {
    return c.json(
      { error: "No LLM provider available. Add a BYOK key or configure a platform provider." },
      503,
    );
  }

  // Load user memory
  const userNotes: UserMemory["notes"] = await fetchUserNotes(c.env.DB, userId).catch(
    (): UserMemory["notes"] => [],
  );
  const selectedNotes = selectNotes(userNotes);
  const userMemory: UserMemory = {
    lifeSummary: "",
    notes: selectedNotes,
    currentGoals: [],
  };

  const { stablePrefix, dynamicSuffix } = buildAetherSystemPrompt(userMemory);
  let fullSystemPrompt = dynamicSuffix ? `${stablePrefix}\n\n${dynamicSuffix}` : stablePrefix;

  // Inject page context when the user is reading a specific page
  if (body.pageContext) {
    const ctx = body.pageContext;
    const parts: string[] = ["## Current Page Context"];
    if (ctx.title) parts.push(`The user is currently reading: "${ctx.title}"`);
    if (ctx.url) parts.push(`URL: ${ctx.url}`);
    if (ctx.contentSnippet) {
      parts.push(`\nArticle excerpt:\n${ctx.contentSnippet.slice(0, 2000)}`);
    }
    parts.push("\nUse this context to answer questions about what the user is reading.");
    fullSystemPrompt = `${fullSystemPrompt}\n\n${parts.join("\n")}`;
  }

  // Merge Rubik-3 persona prompt when requested
  if (persona === "rubik-3") {
    fullSystemPrompt = `${fullSystemPrompt}\n\n${getRubik3SystemPrompt()}`;
  }

  // Merge Erdős persona prompt when requested
  if (persona === "erdos") {
    fullSystemPrompt = `${fullSystemPrompt}\n\n${getErdosPersonaPrompt()}`;
  }

  // Merge Radix persona prompt when requested
  if (persona === "radix") {
    fullSystemPrompt = `${fullSystemPrompt}\n\n${getRadixPersonaPrompt()}`;
  }

  // Merge Gov persona prompt when requested
  if (persona === "gov") {
    fullSystemPrompt = `${fullSystemPrompt}\n\n${getGovPersonaPrompt()}`;
  }

  const intentSummary = classifyIntent(userMessage, body.pageContext);
  const toolCatalog = intentSummary.needsTools
    ? await fetchToolCatalog(c.env.MCP_SERVICE, requestId)
    : [];

  // Set up SSE stream
  const { readable, writable } = new TransformStream();
  const writer = writable.getWriter();
  const encoder = new TextEncoder();

  const sendEvent = async (data: unknown) => {
    if (data === "[DONE]") {
      await writer.write(encoder.encode("data: [DONE]\n\n"));
    } else {
      const serialized = JSON.stringify(data);
      const eventName =
        typeof data === "object" &&
        data !== null &&
        typeof (data as { type?: unknown }).type === "string"
          ? (data as { type: string }).type
          : null;

      // Append to DO event log for stream resumption
      let seq: number | undefined;
      if (sessionDO) {
        try {
          seq = sessionDO.appendEvent(serialized) as unknown as number;
        } catch {
          // DO unavailable — continue without event log
        }
      }

      let frame = "";
      if (seq !== undefined) {
        frame += `id: ${seq}\n`;
      }
      if (eventName) {
        frame += `event: ${eventName}\n`;
      }
      frame += `data: ${serialized}\n\n`;
      await writer.write(encoder.encode(frame));
    }
  };

  const bgTask = (async () => {
    try {
      // Persist user message to DO session history
      if (sessionDO) {
        try {
          await sessionDO.addMessage({
            role: "user",
            content: userMessage,
            timestamp: Date.now(),
          });
          if (persona) {
            await sessionDO.setMeta("persona", persona);
          }
        } catch {
          // DO persistence is non-critical
        }
      }

      await sendEvent({
        type: "context_sync",
        sessionId,
        activeNoteCount: selectedNotes.length,
        totalNoteCount: userNotes.length,
        toolCatalogCount: toolCatalog.length,
        provider: llmTarget.provider,
        model: llmTarget.upstreamModel,
        keySource: llmTarget.keySource,
      });

      // --- Stage 1: CLASSIFY ---
      await sendEvent({ type: "stage_update", stage: "classify" });

      // --- Stage 2: PLAN ---
      await sendEvent({ type: "stage_update", stage: "plan" });
      const planArtifact = buildPlanArtifact(userMessage, intentSummary, toolCatalog);

      // --- Stage 3: EXECUTE (streamed) ---
      await sendEvent({ type: "stage_update", stage: "execute" });
      const executionMessages = buildSpikeChatMessages(
        fullSystemPrompt,
        body.history,
        planArtifact,
      );
      let assistantResponse = "";

      for (let loop = 0; loop < MAX_TOOL_LOOPS; loop++) {
        const iteration = await streamLlmResponse(llmTarget, executionMessages, sendEvent, {
          temperature: 0.2,
          maxTokens: 4096,
          ...(intentSummary.needsTools ? { tools: SPIKE_AGENT_TOOLS } : {}),
        });

        assistantResponse += iteration.fullText;

        if (iteration.toolCalls.length === 0) {
          break;
        }

        executionMessages.push({
          role: "assistant",
          content: iteration.fullText || null,
          tool_calls: iteration.toolCalls.map((toolCall) => ({
            id: toolCall.toolCallId,
            type: "function" as const,
            function: {
              name: toolCall.name,
              arguments: toolCall.rawArgs,
            },
          })),
        });

        for (const toolCall of iteration.toolCalls) {
          await sendEvent({
            type: "tool_call_start",
            toolCallId: toolCall.toolCallId,
            name: toolCall.name,
            args: toolCall.args,
            transport: "mcp",
          });

          const toolResult = await executeAgentTool({
            mcpService: c.env.MCP_SERVICE,
            db: c.env.DB,
            requestId,
            contextId: sessionId,
            userId,
            toolCallId: toolCall.toolCallId,
            toolName: toolCall.name,
            toolArgs: toolCall.args,
            toolCatalog,
            tableName: "spike_chat_browser_results",
            contextIdColumn: "session_id",
            // Use DO callback for zero-polling browser results when available.
            // Capture sessionDO in a local const so the lambda's closure is
            // narrowed to the non-null type and TypeScript can verify the call.
            ...(sessionDO
              ? ((capturedDO) => ({
                  waitViaCallback: (tcId: string) => capturedDO.waitForBrowserResult(tcId),
                }))(sessionDO)
              : {}),
          });

          await sendEvent({
            type: "tool_call_end",
            toolCallId: toolCall.toolCallId,
            name: toolCall.name,
            result: toolResult.result,
            status: toolResult.status,
            transport: toolResult.transport,
          });

          executionMessages.push({
            role: "tool",
            tool_call_id: toolCall.toolCallId,
            content: toolResult.result,
          });
        }

        if (loop === MAX_TOOL_LOOPS - 1) {
          await sendEvent({
            type: "error",
            error: `Stopped after ${MAX_TOOL_LOOPS} tool rounds to avoid an infinite loop.`,
          });
        }
      }

      // Persist assistant response to DO session
      if (sessionDO && assistantResponse) {
        try {
          await sessionDO.addMessage({
            role: "assistant",
            content: assistantResponse,
            timestamp: Date.now(),
          });
        } catch {
          // DO persistence is non-critical
        }
      }

      // --- Stage 4: EXTRACT ---
      await sendEvent({ type: "stage_update", stage: "extract" });
      await (async () => {
        try {
          // Fast path: regex extraction (zero latency)
          const regexExtracted = extractNoteCandidate(userMessage);
          let savedLesson: string | null = null;

          if (regexExtracted) {
            await saveNote(c.env.DB, userId, {
              id: crypto.randomUUID(),
              trigger: regexExtracted.trigger,
              lesson: regexExtracted.lesson,
              confidence: regexExtracted.confidence,
              helpCount: 0,
              createdAt: Date.now(),
              lastUsedAt: Date.now(),
            });
            savedLesson = regexExtracted.lesson;
          }

          // LLM extraction: catches implicit lessons the regex misses
          if (assistantResponse && userMessage.length >= 20) {
            const extractInput = `User: ${userMessage}\n\nAssistant: ${assistantResponse.slice(0, 1500)}`;
            const llmResult = await synthesizeCompletion(
              llmTarget,
              [
                { role: "system", content: buildExtractPrompt() },
                { role: "user", content: extractInput },
              ],
              { temperature: 0.1, maxTokens: 256 },
            );
            const llmNote = parseExtractedNote(llmResult.content);
            // Deduplicate: skip if LLM lesson matches regex lesson
            if (llmNote && llmNote.lesson !== savedLesson) {
              await saveNote(c.env.DB, userId, {
                id: crypto.randomUUID(),
                trigger: llmNote.trigger,
                lesson: llmNote.lesson,
                confidence: llmNote.confidence,
                helpCount: 0,
                createdAt: Date.now(),
                lastUsedAt: Date.now(),
              });
              savedLesson = llmNote.lesson;
            }
          }

          if (savedLesson) {
            await sendEvent({
              type: "memory_update",
              activeNoteCount: selectedNotes.length,
              totalNoteCount: userNotes.length + 1,
              lesson: savedLesson,
            });
          }
        } catch {
          // Note extraction is non-critical
        }
      })();
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

/** GET /api/spike-chat/history — retrieve compressed session history from DO. */
spikeChat.get("/api/spike-chat/history", async (c) => {
  const userId = c.get("userId") as string | undefined;
  if (!userId) {
    return c.json({ error: "Authentication required" }, 401);
  }

  const sessionId = `spike-chat-${userId}`;
  try {
    const stub = c.env.SPIKE_CHAT_SESSIONS.get(
      c.env.SPIKE_CHAT_SESSIONS.idFromName(sessionId),
    ) as DurableObjectStub & {
      getHistory(): Promise<Array<{ role: string; content: string; timestamp: number }>>;
    };
    const history = await stub.getHistory();
    return c.json({ sessionId, messages: history });
  } catch {
    return c.json({ sessionId, messages: [] });
  }
});

/**
 * GET /api/spike-chat/stream/:sessionId — SSE replay endpoint.
 * Reconnects with Last-Event-ID to resume a stream from where the client left off.
 */
spikeChat.get("/api/spike-chat/stream/:sessionId", async (c) => {
  const targetSessionId = c.req.param("sessionId");
  const lastEventIdHeader = c.req.header("Last-Event-ID");
  const lastEventId = lastEventIdHeader ? Number(lastEventIdHeader) : 0;

  if (!targetSessionId) {
    return c.json({ error: "sessionId is required" }, 400);
  }

  try {
    const stub = c.env.SPIKE_CHAT_SESSIONS.get(
      c.env.SPIKE_CHAT_SESSIONS.idFromName(targetSessionId),
    ) as DurableObjectStub & {
      replayEvents(lastEventId: number): Array<{ seq: number; data: string }>;
    };
    const events = stub.replayEvents(lastEventId) as unknown as Array<{
      seq: number;
      data: string;
    }>;

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        for (const event of events) {
          controller.enqueue(encoder.encode(`id: ${event.seq}\ndata: ${event.data}\n\n`));
        }
        controller.enqueue(encoder.encode("data: [DONE]\n\n"));
        controller.close();
      },
    });

    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
      },
    });
  } catch {
    return c.json({ error: "Session not found" }, 404);
  }
});

export { spikeChat };
