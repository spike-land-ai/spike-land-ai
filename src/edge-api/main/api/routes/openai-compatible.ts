import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { DOCS_MANIFEST, type DocEntry } from "../../core-logic/docs-catalog.js";
import { authMiddleware } from "../middleware/auth.js";

const openAiCompatible = new Hono<{ Bindings: Env; Variables: Variables }>();

const PUBLIC_MODEL_ID = "spike-agent-v1";
const SYNTHESIZER_MODEL_ID = "grok-4-1";
const MODEL_CREATED_AT = 1_741_651_200;
const MAX_SELECTED_DOCS = 3;
const MAX_SELECTED_TOOLS = 6;
type OpenAiErrorStatus = 400 | 401 | 402 | 403 | 404 | 409 | 422 | 429 | 500 | 502 | 503;

interface OpenAiMessagePart {
  type?: string;
  text?: string;
}

interface OpenAiChatMessage {
  role?: string;
  content?: string | OpenAiMessagePart[] | null;
  name?: string;
}

interface OpenAiChatCompletionRequest {
  model?: string;
  messages?: OpenAiChatMessage[];
  stream?: boolean;
  temperature?: number;
  max_tokens?: number;
  user?: string;
}

interface ToolCatalogItem {
  name: string;
  description: string;
  category: string | undefined;
  inputSchema: unknown | undefined;
}

interface UsageShape {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
}

interface XaiChatResponse {
  choices?: Array<{ message?: { content?: string } }>;
  usage?: UsageShape;
}

function openAiError(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  status: OpenAiErrorStatus,
  message: string,
  options?: {
    type?: string;
    param?: string;
    code?: string;
  },
) {
  return c.json(
    {
      error: {
        message,
        type: options?.type ?? "invalid_request_error",
        param: options?.param ?? null,
        code: options?.code ?? null,
      },
    },
    status,
  );
}

async function openAiCompatibleAuthMiddleware(
  c: Context<{ Bindings: Env; Variables: Variables }>,
  next: Next,
): Promise<Response | void> {
  const authHeader = c.req.header("authorization");

  if (authHeader?.startsWith("Bearer ") && c.env.INTERNAL_SERVICE_SECRET) {
    const token = authHeader.slice(7).trim();
    if (token === c.env.INTERNAL_SERVICE_SECRET) {
      const userId = c.req.header("x-user-id") ?? "openai-compatible-client";
      c.set("userId", userId);
      return next();
    }
  }

  return authMiddleware(c, next);
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
}

function normalizeMessageContent(content: OpenAiChatMessage["content"]): string {
  if (typeof content === "string") {
    return content;
  }

  if (Array.isArray(content)) {
    return content
      .map((part) => {
        if (!part || typeof part !== "object") {
          return "";
        }
        return typeof part.text === "string" ? part.text : "";
      })
      .filter(Boolean)
      .join("\n");
  }

  if (content == null) {
    return "";
  }

  try {
    return JSON.stringify(content);
  } catch {
    return String(content);
  }
}

function lastUserMessage(messages: OpenAiChatMessage[]): string {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    if (message?.role !== "user") {
      continue;
    }

    const content = normalizeMessageContent(message.content).trim();
    if (content) {
      return content;
    }
  }

  return "";
}

function inferIntent(query: string): string {
  const lower = query.toLowerCase();

  if (/(build|create|implement|ship|prototype)/.test(lower)) {
    return "implementation";
  }
  if (/(fix|debug|broken|error|failing)/.test(lower)) {
    return "debugging";
  }
  if (/(deploy|worker|cloudflare|wrangler|production)/.test(lower)) {
    return "deployment";
  }
  if (/(mcp|tool|agent|api|auth|oauth)/.test(lower)) {
    return "platform-capability";
  }

  return "general";
}

function scoreDoc(query: string, doc: DocEntry): number {
  const lowerQuery = query.toLowerCase();
  const tokens = tokenize(query);
  const title = doc.title.toLowerCase();
  const description = doc.description.toLowerCase();
  const category = doc.category.toLowerCase();
  const slug = doc.slug.toLowerCase();

  let score = 0;
  if (title.includes(lowerQuery)) score += 12;
  if (description.includes(lowerQuery)) score += 8;
  if (slug.includes(lowerQuery)) score += 6;

  for (const token of tokens) {
    if (title.includes(token)) score += 4;
    if (description.includes(token)) score += 3;
    if (category.includes(token)) score += 2;
    if (slug.includes(token)) score += 2;
  }

  return score;
}

function selectRelevantDocs(query: string): DocEntry[] {
  return DOCS_MANIFEST.map((doc) => ({ doc, score: scoreDoc(query, doc) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.doc.title.localeCompare(right.doc.title);
    })
    .slice(0, MAX_SELECTED_DOCS)
    .map((entry) => entry.doc);
}

function scoreTool(query: string, tool: ToolCatalogItem): number {
  const lowerQuery = query.toLowerCase();
  const queryTokens = tokenize(query);
  const lowerName = tool.name.toLowerCase();
  const lowerDescription = tool.description.toLowerCase();
  const lowerCategory = (tool.category ?? "").toLowerCase();

  let score = 0;
  if (lowerName.includes(lowerQuery)) score += 12;
  if (lowerDescription.includes(lowerQuery)) score += 8;

  for (const token of queryTokens) {
    if (lowerName.includes(token)) score += 4;
    if (lowerDescription.includes(token)) score += 2;
    if (lowerCategory.includes(token)) score += 2;
  }

  return score;
}

function searchToolCatalog(query: string, toolCatalog: ToolCatalogItem[]): ToolCatalogItem[] {
  return toolCatalog
    .map((tool) => ({ tool, score: scoreTool(query, tool) }))
    .filter((entry) => entry.score > 0)
    .sort((left, right) => {
      if (right.score !== left.score) {
        return right.score - left.score;
      }
      return left.tool.name.localeCompare(right.tool.name);
    })
    .slice(0, MAX_SELECTED_TOOLS)
    .map((entry) => entry.tool);
}

async function fetchToolCatalog(env: Env, requestId: string): Promise<ToolCatalogItem[]> {
  try {
    const toolsRes = await env.MCP_SERVICE.fetch(
      new Request("https://mcp.spike.land/tools", {
        headers: { "X-Request-Id": requestId },
      }),
    );

    if (!toolsRes.ok) {
      return [];
    }

    const data = await toolsRes.json<{
      tools?: Array<{
        name: string;
        description: string;
        category?: string;
        inputSchema?: unknown;
      }>;
    }>();

    return (data.tools ?? []).map((tool) => ({
      name: tool.name,
      description: tool.description,
      category: tool.category,
      inputSchema: tool.inputSchema,
    }));
  } catch {
    return [];
  }
}

function buildKnowledgePrompt(query: string, docs: DocEntry[], tools: ToolCatalogItem[]): string {
  const intent = inferIntent(query);
  const docSection =
    docs.length > 0
      ? docs
          .map(
            (doc) =>
              `- ${doc.title} [${doc.category}] - ${doc.description} (source: /api/docs/${doc.slug})`,
          )
          .join("\n")
      : "- No strong internal documentation matches were found.";
  const toolSection =
    tools.length > 0
      ? tools.map((tool) => `- ${tool.name} - ${tool.description}`).join("\n")
      : "- No strong MCP tool matches were found.";

  return `You are Spike's ChatGPT-compatible API.

The answer must be constructed through a local agent pipeline before synthesis.

Local agents:
- router-agent: inferred intent = ${intent}
- docs-agent: selected the most relevant local docs for this request
- capability-agent: selected the most relevant MCP tools available on spike.land
- synthesis-agent: writes the final answer using the local agent notes below

Rules:
- Prefer the local docs and MCP capability context below over generic prior knowledge.
- If the local context is incomplete, say so plainly instead of inventing details.
- Be direct and implementation-focused.
- When relevant, mention the exact internal doc or tool name that informed the answer.

Relevant docs:
${docSection}

Relevant MCP tools:
${toolSection}`;
}

function buildProviderMessages(
  requestMessages: OpenAiChatMessage[],
  knowledgePrompt: string,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const providerMessages: Array<{ role: "system" | "user" | "assistant"; content: string }> = [
    { role: "system", content: knowledgePrompt },
  ];

  const callerSystemMessages = requestMessages
    .filter((message) => message.role === "system")
    .map((message) => normalizeMessageContent(message.content).trim())
    .filter(Boolean);

  if (callerSystemMessages.length > 0) {
    providerMessages.push({
      role: "system",
      content: `Caller instructions:\n${callerSystemMessages.join("\n\n")}`,
    });
  }

  for (const message of requestMessages) {
    const content = normalizeMessageContent(message.content).trim();
    if (!content) {
      continue;
    }

    if (message.role === "user" || message.role === "assistant") {
      providerMessages.push({ role: message.role, content });
      continue;
    }

    if (message.role === "tool") {
      providerMessages.push({
        role: "assistant",
        content: `Tool result${message.name ? ` from ${message.name}` : ""}:\n${content}`,
      });
    }
  }

  return providerMessages;
}

function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}

function finalizeUsage(
  usage: UsageShape | undefined,
  messages: OpenAiChatMessage[],
  content: string,
) {
  const promptEstimate = messages.reduce(
    (total, message) => total + estimateTokens(normalizeMessageContent(message.content)),
    0,
  );
  const completionEstimate = estimateTokens(content);

  const promptTokens = usage?.prompt_tokens ?? promptEstimate;
  const completionTokens = usage?.completion_tokens ?? completionEstimate;
  const totalTokens = usage?.total_tokens ?? promptTokens + completionTokens;

  return {
    prompt_tokens: promptTokens,
    completion_tokens: completionTokens,
    total_tokens: totalTokens,
  };
}

async function synthesizeCompletion(
  apiKey: string,
  messages: Array<{ role: "system" | "user" | "assistant"; content: string }>,
  options: { temperature: number | undefined; maxTokens: number | undefined },
) {
  const res = await fetch("https://api.x.ai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: SYNTHESIZER_MODEL_ID,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 768,
      stream: false,
    }),
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Local synthesis failed (${res.status}): ${errorText}`);
  }

  const data = await res.json<XaiChatResponse>();
  return {
    content: data.choices?.[0]?.message?.content ?? "",
    usage: data.usage,
  };
}

function splitStreamingChunks(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) {
    return [];
  }

  const words = trimmed.split(/\s+/);
  const chunks: string[] = [];
  let current = "";

  for (const word of words) {
    const next = current ? `${current} ${word}` : word;
    if (next.length > 120 && current) {
      chunks.push(`${current} `);
      current = word;
      continue;
    }
    current = next;
  }

  if (current) {
    chunks.push(current);
  }

  return chunks;
}

function buildStreamResponse(id: string, model: string, content: string) {
  const created = Math.floor(Date.now() / 1000);
  const encoder = new TextEncoder();
  const chunks = splitStreamingChunks(content);

  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const send = (payload: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(payload)}\n\n`));
      };

      send({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta: { role: "assistant" }, finish_reason: null }],
      });

      for (const chunk of chunks) {
        send({
          id,
          object: "chat.completion.chunk",
          created,
          model,
          choices: [{ index: 0, delta: { content: chunk }, finish_reason: null }],
        });
      }

      send({
        id,
        object: "chat.completion.chunk",
        created,
        model,
        choices: [{ index: 0, delta: {}, finish_reason: "stop" }],
      });

      controller.enqueue(encoder.encode("data: [DONE]\n\n"));
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}

async function handleChatCompletion(c: Context<{ Bindings: Env; Variables: Variables }>) {
  let body: OpenAiChatCompletionRequest;

  try {
    body = await c.req.json<OpenAiChatCompletionRequest>();
  } catch {
    return openAiError(c, 400, "Request body must be valid JSON.");
  }

  const model = body.model ?? PUBLIC_MODEL_ID;
  if (model !== PUBLIC_MODEL_ID) {
    return openAiError(c, 400, `Unsupported model "${model}".`, {
      param: "model",
      code: "model_not_found",
    });
  }

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return openAiError(c, 400, "messages must be a non-empty array.", {
      param: "messages",
    });
  }

  const latestUserPrompt = lastUserMessage(body.messages);
  if (!latestUserPrompt) {
    return openAiError(c, 400, "A non-empty user message is required.", {
      param: "messages",
    });
  }

  if (!c.env.XAI_API_KEY) {
    return openAiError(c, 503, "XAI_API_KEY is not configured for local synthesis.", {
      type: "service_unavailable_error",
      code: "provider_unavailable",
    });
  }

  const requestId = (c.get("requestId") as string | undefined) ?? crypto.randomUUID();
  const toolCatalog = await fetchToolCatalog(c.env, requestId);
  const selectedDocs = selectRelevantDocs(latestUserPrompt);
  const selectedTools = searchToolCatalog(latestUserPrompt, toolCatalog);
  const providerMessages = buildProviderMessages(
    body.messages,
    buildKnowledgePrompt(latestUserPrompt, selectedDocs, selectedTools),
  );

  try {
    const synthesized = await synthesizeCompletion(c.env.XAI_API_KEY, providerMessages, {
      temperature: body.temperature,
      maxTokens: body.max_tokens,
    });
    const content = synthesized.content.trim();
    const id = `chatcmpl_${crypto.randomUUID().replace(/-/g, "")}`;

    if (body.stream) {
      return buildStreamResponse(id, model, content);
    }

    return c.json({
      id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model,
      choices: [
        {
          index: 0,
          message: {
            role: "assistant",
            content,
          },
          finish_reason: "stop",
        },
      ],
      usage: finalizeUsage(synthesized.usage, body.messages, content),
    });
  } catch (error) {
    return openAiError(c, 502, error instanceof Error ? error.message : "Local synthesis failed.", {
      type: "upstream_error",
      code: "local_agent_synthesis_failed",
    });
  }
}

openAiCompatible.use("/v1/*", openAiCompatibleAuthMiddleware);
openAiCompatible.use("/api/v1/*", openAiCompatibleAuthMiddleware);

function modelsResponse() {
  return {
    object: "list",
    data: [
      {
        id: PUBLIC_MODEL_ID,
        object: "model",
        created: MODEL_CREATED_AT,
        owned_by: "spike.land",
      },
    ],
  };
}

openAiCompatible.get("/v1/models", (c) => c.json(modelsResponse()));
openAiCompatible.get("/api/v1/models", (c) => c.json(modelsResponse()));
openAiCompatible.post("/v1/chat/completions", handleChatCompletion);
openAiCompatible.post("/api/v1/chat/completions", handleChatCompletion);

export { openAiCompatible };
