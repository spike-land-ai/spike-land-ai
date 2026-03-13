import { Hono } from "hono";
import type { Context, Next } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import { DOCS_MANIFEST, type DocEntry } from "../../core-logic/docs-catalog.js";
import { authMiddleware } from "../middleware/auth.js";
import { compressMessage, type PrdCompressionConfig } from "../../core-logic/prd-compression.js";
import {
  fetchToolCatalog,
  searchToolCatalog,
  type ToolCatalogItem,
} from "../../core-logic/mcp-tools.js";
import {
  PUBLIC_MODEL_ID,
  DEFAULT_PROVIDER_MODELS,
  parseModelSelection,
  resolveSynthesisTarget,
  synthesizeCompletion,
  streamCompletion,
  type ProviderMessage,
  type UsageShape,
} from "../../core-logic/llm-provider.js";

const openAiCompatible = new Hono<{ Bindings: Env; Variables: Variables }>();

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
  provider?: string;
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

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9_]+/i)
    .map((token) => token.trim())
    .filter(Boolean);
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
- The MCP tools listed below are available on the spike.land platform but NOT callable from this conversation. Mention them as capabilities the user can access via the platform.
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

  const prdConfig: PrdCompressionConfig = {
    mode: (c.env.PRD_COMPRESSION_MODE as PrdCompressionConfig["mode"]) ?? "auto",
    geminiApiKey: c.env.GEMINI_API_KEY,
  };
  const compression = await compressMessage(latestUserPrompt, prdConfig);
  const effectivePrompt = compression.formattedMessage;

  const requestId = (c.get("requestId") as string | undefined) ?? crypto.randomUUID();
  const userId = c.get("userId") as string | undefined;
  const toolCatalog = await fetchToolCatalog(c.env.MCP_SERVICE, requestId);
  const selectedDocs = selectRelevantDocs(effectivePrompt);
  const selectedTools = searchToolCatalog(effectivePrompt, toolCatalog, MAX_SELECTED_TOOLS);
  const providerMessages = buildProviderMessages(
    body.messages,
    buildKnowledgePrompt(effectivePrompt, selectedDocs, selectedTools),
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
    if (body.stream) {
      const streamResponse = await streamCompletion(synthesisTarget, providerMessages, {
        temperature: body.temperature,
        maxTokens: body.max_tokens,
      });
      return new Response(streamResponse.body, {
        headers: {
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache, no-transform",
          Connection: "keep-alive",
        },
      });
    }

    const synthesized = await synthesizeCompletion(synthesisTarget, providerMessages, {
      temperature: body.temperature,
      maxTokens: body.max_tokens,
    });
    const content = synthesized.content.trim();
    const id = `chatcmpl_${crypto.randomUUID().replace(/-/g, "")}`;

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
