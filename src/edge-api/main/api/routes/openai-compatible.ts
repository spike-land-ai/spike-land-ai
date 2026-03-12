import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { DOCS_MANIFEST, type DocEntry } from "../../core-logic/docs-catalog.js";
import { resolveByokKey, type ByokProvider } from "../../core-logic/byok.js";
import { authMiddleware } from "../middleware/auth.js";

const openAiCompatible = new Hono<{ Bindings: Env; Variables: Variables }>();

const PUBLIC_MODEL_ID = "spike-agent-v1";
const MODEL_CREATED_AT = 1_741_651_200;
const MAX_SELECTED_DOCS = 3;
const MAX_SELECTED_TOOLS = 6;
const AUTO_BYOK_PRIORITY: ByokProvider[] = ["openai", "anthropic", "google"];
const AUTO_PLATFORM_PRIORITY: ProviderId[] = ["xai", "anthropic", "google", "openai"];

const DEFAULT_PROVIDER_MODELS: Record<ProviderId, string> = {
  openai: "gpt-4.1",
  anthropic: "claude-sonnet-4-20250514",
  google: "gemini-2.5-flash",
  xai: "grok-4-1",
};

type ProviderId = "openai" | "anthropic" | "google" | "xai";
type ProviderSelection = ProviderId | "auto";
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
  provider?: string;
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

interface OpenAiCompatibleResponse {
  choices?: Array<{ message?: { content?: string | OpenAiMessagePart[] | null } }>;
  usage?: UsageShape;
}

interface AnthropicResponse {
  content?: Array<{ type?: string; text?: string }>;
  usage?: {
    input_tokens?: number;
    output_tokens?: number;
  };
}

interface GoogleResponse {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: string }>;
    };
  }>;
  usageMetadata?: {
    promptTokenCount?: number;
    candidatesTokenCount?: number;
    totalTokenCount?: number;
  };
}

interface ProviderMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

interface ParsedModelSelection {
  publicModel: string;
  provider: ProviderSelection;
  upstreamModel: string | undefined;
}

interface ResolvedSynthesisTarget {
  provider: ProviderId;
  upstreamModel: string;
  apiKey: string;
  keySource: "byok" | "platform";
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
): ProviderMessage[] {
  const providerMessages: ProviderMessage[] = [{ role: "system", content: knowledgePrompt }];

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

function compactUsage(values: {
  prompt_tokens: number | undefined;
  completion_tokens: number | undefined;
  total_tokens: number | undefined;
}): UsageShape | undefined {
  const usage: UsageShape = {};

  if (values.prompt_tokens !== undefined) {
    usage.prompt_tokens = values.prompt_tokens;
  }
  if (values.completion_tokens !== undefined) {
    usage.completion_tokens = values.completion_tokens;
  }
  if (values.total_tokens !== undefined) {
    usage.total_tokens = values.total_tokens;
  }

  return Object.keys(usage).length > 0 ? usage : undefined;
}

function normalizeProviderName(value: string): ProviderId | undefined {
  const normalized = value.trim().toLowerCase();
  if (normalized === "openai") return "openai";
  if (normalized === "anthropic") return "anthropic";
  if (normalized === "google" || normalized === "gemini") return "google";
  if (normalized === "xai" || normalized === "grok") return "xai";
  return undefined;
}

function inferProviderFromRawModel(model: string): ProviderId | undefined {
  const normalized = model.trim().toLowerCase();
  if (
    /^(gpt|o1|o3|o4|o5|chatgpt|codex|computer-use|gpt-oss)/.test(normalized) ||
    normalized.includes("openai")
  ) {
    return "openai";
  }
  if (normalized.startsWith("claude") || normalized.includes("anthropic")) {
    return "anthropic";
  }
  if (normalized.startsWith("gemini") || normalized.includes("google")) {
    return "google";
  }
  if (normalized.startsWith("grok") || normalized.includes("xai")) {
    return "xai";
  }
  return undefined;
}

function parseModelSelection(
  body: OpenAiChatCompletionRequest,
):
  | { ok: true; value: ParsedModelSelection }
  | { ok: false; message: string; param?: string; code?: string } {
  const publicModel = body.model?.trim() || PUBLIC_MODEL_ID;
  const providerHint =
    typeof body.provider === "string" && body.provider.trim()
      ? normalizeProviderName(body.provider)
      : undefined;

  if (typeof body.provider === "string" && body.provider.trim() && !providerHint) {
    return {
      ok: false,
      message: `Unsupported provider "${body.provider}".`,
      param: "provider",
      code: "provider_not_supported",
    };
  }

  if (publicModel === PUBLIC_MODEL_ID) {
    if (providerHint) {
      return {
        ok: true,
        value: {
          publicModel,
          provider: providerHint,
          upstreamModel: DEFAULT_PROVIDER_MODELS[providerHint],
        },
      };
    }

    return {
      ok: true,
      value: {
        publicModel,
        provider: "auto",
        upstreamModel: undefined,
      },
    };
  }

  if (publicModel.includes("/")) {
    const slashIndex = publicModel.indexOf("/");
    const prefix = publicModel.slice(0, slashIndex);
    const normalizedProvider = normalizeProviderName(prefix);
    if (!normalizedProvider) {
      return {
        ok: false,
        message: `Unsupported model "${publicModel}".`,
        param: "model",
        code: "model_not_found",
      };
    }

    if (providerHint && providerHint !== normalizedProvider) {
      return {
        ok: false,
        message: `provider "${body.provider}" does not match model "${publicModel}".`,
        param: "provider",
        code: "provider_model_mismatch",
      };
    }

    const suffix = publicModel.slice(slashIndex + 1).trim();
    return {
      ok: true,
      value: {
        publicModel,
        provider: normalizedProvider,
        upstreamModel: suffix || DEFAULT_PROVIDER_MODELS[normalizedProvider],
      },
    };
  }

  if (providerHint) {
    const inferred = inferProviderFromRawModel(publicModel);
    if (inferred && inferred !== providerHint) {
      return {
        ok: false,
        message: `provider "${body.provider}" does not match model "${publicModel}".`,
        param: "provider",
        code: "provider_model_mismatch",
      };
    }

    return {
      ok: true,
      value: {
        publicModel,
        provider: providerHint,
        upstreamModel: publicModel,
      },
    };
  }

  const inferred = inferProviderFromRawModel(publicModel);
  if (!inferred) {
    return {
      ok: false,
      message: `Unsupported model "${publicModel}". Use "${PUBLIC_MODEL_ID}" or a provider model like "openai/gpt-4.1".`,
      param: "model",
      code: "model_not_found",
    };
  }

  return {
    ok: true,
    value: {
      publicModel,
      provider: inferred,
      upstreamModel: publicModel,
    },
  };
}

function getPlatformKey(env: Env, provider: ProviderId): string | null {
  if (provider === "openai") {
    return env.OPENAI_API_KEY ?? null;
  }
  if (provider === "anthropic") {
    return env.CLAUDE_OAUTH_TOKEN ?? null;
  }
  if (provider === "google") {
    return env.GEMINI_API_KEY ?? null;
  }
  return env.XAI_API_KEY ?? null;
}

async function resolveExplicitSynthesisTarget(
  env: Env,
  userId: string | undefined,
  provider: ProviderId,
  upstreamModel: string,
): Promise<ResolvedSynthesisTarget | null> {
  if (provider !== "xai" && userId) {
    const byokKey = await resolveByokKey(
      env.MCP_SERVICE,
      userId,
      provider,
      env.MCP_INTERNAL_SECRET,
    );
    if (byokKey) {
      return {
        provider,
        upstreamModel,
        apiKey: byokKey,
        keySource: "byok",
      };
    }
  }

  const platformKey = getPlatformKey(env, provider);
  if (!platformKey) {
    return null;
  }

  return {
    provider,
    upstreamModel,
    apiKey: platformKey,
    keySource: "platform",
  };
}

async function resolveAutoSynthesisTarget(
  env: Env,
  userId: string | undefined,
): Promise<ResolvedSynthesisTarget | null> {
  if (userId) {
    const byokResults = await Promise.all(
      AUTO_BYOK_PRIORITY.map(async (provider) => ({
        provider,
        key: await resolveByokKey(env.MCP_SERVICE, userId, provider, env.MCP_INTERNAL_SECRET),
      })),
    );

    const match = byokResults.find((entry) => entry.key);
    if (match?.key) {
      return {
        provider: match.provider,
        upstreamModel: DEFAULT_PROVIDER_MODELS[match.provider],
        apiKey: match.key,
        keySource: "byok",
      };
    }
  }

  for (const provider of AUTO_PLATFORM_PRIORITY) {
    const platformKey = getPlatformKey(env, provider);
    if (platformKey) {
      return {
        provider,
        upstreamModel: DEFAULT_PROVIDER_MODELS[provider],
        apiKey: platformKey,
        keySource: "platform",
      };
    }
  }

  return null;
}

async function resolveSynthesisTarget(
  env: Env,
  userId: string | undefined,
  selection: ParsedModelSelection,
): Promise<ResolvedSynthesisTarget | null> {
  if (selection.provider === "auto") {
    return resolveAutoSynthesisTarget(env, userId);
  }

  return resolveExplicitSynthesisTarget(
    env,
    userId,
    selection.provider,
    selection.upstreamModel ?? DEFAULT_PROVIDER_MODELS[selection.provider],
  );
}

async function callOpenAiStyleProvider(
  endpoint: string,
  apiKey: string,
  model: string,
  messages: ProviderMessage[],
  options: { temperature: number | undefined; maxTokens: number | undefined },
): Promise<{ content: string; usage: UsageShape | undefined }> {
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages,
      temperature: options.temperature ?? 0.2,
      max_tokens: options.maxTokens ?? 768,
      stream: false,
    }),
  });

  if (!res.ok) {
    console.error("[openai-compatible] openai-style synthesis failed", {
      endpoint,
      status: res.status,
    });
    throw new Error(`Synthesis provider request failed with status ${res.status}.`);
  }

  const data = await res.json<OpenAiCompatibleResponse>();
  return {
    content: normalizeMessageContent(data.choices?.[0]?.message?.content ?? ""),
    usage: data.usage,
  };
}

async function callAnthropicProvider(
  apiKey: string,
  model: string,
  messages: ProviderMessage[],
  options: { temperature: number | undefined; maxTokens: number | undefined },
): Promise<{ content: string; usage: UsageShape | undefined }> {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim();
  const nonSystemMessages = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));

  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: options.maxTokens ?? 768,
      temperature: options.temperature ?? 0.2,
      ...(system ? { system } : {}),
      messages: nonSystemMessages,
    }),
  });

  if (!res.ok) {
    console.error("[openai-compatible] anthropic synthesis failed", {
      status: res.status,
    });
    throw new Error(`Anthropic synthesis request failed with status ${res.status}.`);
  }

  const data = await res.json<AnthropicResponse>();
  const content = (data.content ?? [])
    .map((entry) => (entry.type === "text" ? (entry.text ?? "") : ""))
    .join("");

  return {
    content,
    usage: data.usage
      ? compactUsage({
          prompt_tokens: data.usage.input_tokens,
          completion_tokens: data.usage.output_tokens,
          total_tokens:
            data.usage.input_tokens !== undefined || data.usage.output_tokens !== undefined
              ? (data.usage.input_tokens ?? 0) + (data.usage.output_tokens ?? 0)
              : undefined,
        })
      : undefined,
  };
}

async function callGoogleProvider(
  apiKey: string,
  model: string,
  messages: ProviderMessage[],
  options: { temperature: number | undefined; maxTokens: number | undefined },
): Promise<{ content: string; usage: UsageShape | undefined }> {
  const system = messages
    .filter((message) => message.role === "system")
    .map((message) => message.content)
    .join("\n\n")
    .trim();
  const contents = messages
    .filter((message) => message.role !== "system")
    .map((message) => ({
      role: message.role === "assistant" ? "model" : "user",
      parts: [{ text: message.content }],
    }));

  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        ...(system ? { systemInstruction: { parts: [{ text: system }] } } : {}),
        contents,
        generationConfig: {
          temperature: options.temperature ?? 0.2,
          maxOutputTokens: options.maxTokens ?? 768,
        },
      }),
    },
  );

  if (!res.ok) {
    console.error("[openai-compatible] google synthesis failed", {
      status: res.status,
      model,
    });
    throw new Error(`Google synthesis request failed with status ${res.status}.`);
  }

  const data = await res.json<GoogleResponse>();
  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .filter(Boolean)
      .join("") ?? "";

  return {
    content,
    usage: data.usageMetadata
      ? compactUsage({
          prompt_tokens: data.usageMetadata.promptTokenCount,
          completion_tokens: data.usageMetadata.candidatesTokenCount,
          total_tokens: data.usageMetadata.totalTokenCount,
        })
      : undefined,
  };
}

async function synthesizeCompletion(
  target: ResolvedSynthesisTarget,
  messages: ProviderMessage[],
  options: { temperature: number | undefined; maxTokens: number | undefined },
) {
  if (target.provider === "openai") {
    return callOpenAiStyleProvider(
      "https://api.openai.com/v1/chat/completions",
      target.apiKey,
      target.upstreamModel,
      messages,
      options,
    );
  }

  if (target.provider === "anthropic") {
    return callAnthropicProvider(target.apiKey, target.upstreamModel, messages, options);
  }

  if (target.provider === "google") {
    return callGoogleProvider(target.apiKey, target.upstreamModel, messages, options);
  }

  return callOpenAiStyleProvider(
    "https://api.x.ai/v1/chat/completions",
    target.apiKey,
    target.upstreamModel,
    messages,
    options,
  );
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

  if (!Array.isArray(body.messages) || body.messages.length === 0) {
    return openAiError(c, 400, "messages must be a non-empty array.", {
      param: "messages",
    });
  }

  const parsedModel = parseModelSelection(body);
  if (!parsedModel.ok) {
    return openAiError(c, 400, parsedModel.message, {
      ...(parsedModel.param ? { param: parsedModel.param } : {}),
      ...(parsedModel.code ? { code: parsedModel.code } : {}),
    });
  }

  const latestUserPrompt = lastUserMessage(body.messages);
  if (!latestUserPrompt) {
    return openAiError(c, 400, "A non-empty user message is required.", {
      param: "messages",
    });
  }

  const requestId = (c.get("requestId") as string | undefined) ?? crypto.randomUUID();
  const userId = c.get("userId") as string | undefined;
  const toolCatalog = await fetchToolCatalog(c.env, requestId);
  const selectedDocs = selectRelevantDocs(latestUserPrompt);
  const selectedTools = searchToolCatalog(latestUserPrompt, toolCatalog);
  const providerMessages = buildProviderMessages(
    body.messages,
    buildKnowledgePrompt(latestUserPrompt, selectedDocs, selectedTools),
  );

  const synthesisTarget = await resolveSynthesisTarget(c.env, userId, parsedModel.value);
  if (!synthesisTarget) {
    return openAiError(
      c,
      503,
      "No matching synthesis provider is configured. Add a BYOK key or configure a platform provider.",
      {
        type: "service_unavailable_error",
        code: "provider_unavailable",
      },
    );
  }

  try {
    const synthesized = await synthesizeCompletion(synthesisTarget, providerMessages, {
      temperature: body.temperature,
      maxTokens: body.max_tokens,
    });
    const content = synthesized.content.trim();
    const id = `chatcmpl_${crypto.randomUUID().replace(/-/g, "")}`;

    if (body.stream) {
      return buildStreamResponse(id, parsedModel.value.publicModel, content);
    }

    return c.json({
      id,
      object: "chat.completion",
      created: Math.floor(Date.now() / 1000),
      model: parsedModel.value.publicModel,
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
      {
        id: `openai/${DEFAULT_PROVIDER_MODELS.openai}`,
        object: "model",
        created: MODEL_CREATED_AT,
        owned_by: "spike.land",
      },
      {
        id: `anthropic/${DEFAULT_PROVIDER_MODELS.anthropic}`,
        object: "model",
        created: MODEL_CREATED_AT,
        owned_by: "spike.land",
      },
      {
        id: `google/${DEFAULT_PROVIDER_MODELS.google}`,
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
