export type PlaygroundTargetPreset = "browser-proxy" | "local-worker" | "production";
export type PlaygroundPathFlavor = "compat" | "api";
export type PlaygroundAuthMode = "bearer" | "session";
export type PlaygroundProvider = "auto" | "openai" | "anthropic" | "google" | "xai";

export interface PlaygroundConfig {
  targetPreset: PlaygroundTargetPreset;
  pathFlavor: PlaygroundPathFlavor;
  authMode: PlaygroundAuthMode;
  baseUrl: string;
  bearerToken: string;
  userId: string;
  model: string;
  provider: PlaygroundProvider;
  systemPrompt: string;
  prompt: string;
  temperature: number | null;
  maxTokens: number | null;
  stream: boolean;
}

export interface PlaygroundPlan {
  normalizedBaseUrl: string;
  pathPrefix: string;
  modelsUrl: string;
  chatUrl: string;
  chatBody: Record<string, unknown>;
  liveHeaders: Record<string, string>;
  snippetHeaders: Record<string, string>;
  curlSnippet: string;
  fetchSnippet: string;
}

const DEFAULT_BROWSER_ORIGIN = "http://localhost:5173";
const SESSION_COOKIE_PLACEHOLDER = "<AUTH_SESSION_COOKIE>";
const INTERNAL_SECRET_PLACEHOLDER = "<INTERNAL_SERVICE_SECRET>";
const USER_ID_PLACEHOLDER = "local-dev-user";

function escapeSingleQuotedShell(value: string): string {
  return value.replace(/'/g, `'\"'\"'`);
}

export function normalizeBaseUrl(value: string): string {
  return value.trim().replace(/\/+$/, "");
}

export function resolveDefaultBaseUrl(
  targetPreset: PlaygroundTargetPreset,
  origin: string,
): string {
  if (targetPreset === "browser-proxy") {
    return normalizeBaseUrl(origin) || DEFAULT_BROWSER_ORIGIN;
  }

  if (targetPreset === "production") {
    return "https://api.spike.land";
  }

  try {
    const parsed = new URL(origin);
    if (parsed.hostname === "local.spike.land") {
      return "https://local.spike.land:8787";
    }
  } catch {
    // Fall through to the plain localhost default.
  }

  return "http://localhost:8787";
}

export function resolveDefaultPathFlavor(
  targetPreset: PlaygroundTargetPreset,
): PlaygroundPathFlavor {
  return targetPreset === "browser-proxy" ? "api" : "compat";
}

export function buildPathPrefix(pathFlavor: PlaygroundPathFlavor): string {
  return pathFlavor === "api" ? "/api/v1" : "/v1";
}

export function buildChatBody(config: PlaygroundConfig): Record<string, unknown> {
  const messages: Array<{ role: "system" | "user"; content: string }> = [];

  if (config.systemPrompt.trim()) {
    messages.push({ role: "system", content: config.systemPrompt.trim() });
  }

  messages.push({ role: "user", content: config.prompt.trim() });

  return {
    model: config.model.trim() || "spike-agent-v1",
    messages,
    ...(config.provider !== "auto" ? { provider: config.provider } : {}),
    ...(config.temperature !== null ? { temperature: config.temperature } : {}),
    ...(config.maxTokens !== null ? { max_tokens: config.maxTokens } : {}),
    stream: config.stream,
  };
}

export function buildHeaders(
  authMode: PlaygroundAuthMode,
  options?: {
    bearerToken?: string;
    userId?: string;
    usePlaceholders?: boolean;
  },
): Record<string, string> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };

  if (authMode !== "bearer") {
    return headers;
  }

  const token = options?.bearerToken?.trim();
  if (token || options?.usePlaceholders) {
    headers.Authorization = `Bearer ${token || INTERNAL_SECRET_PLACEHOLDER}`;
  }

  const userId = options?.userId?.trim();
  if (userId || options?.usePlaceholders) {
    headers["X-User-Id"] = userId || USER_ID_PLACEHOLDER;
  }

  return headers;
}

function stringifyRequestBody(value: Record<string, unknown>): string {
  return JSON.stringify(value, null, 2);
}

function buildCurlHeaders(headers: Record<string, string>): string[] {
  return Object.entries(headers).map(
    ([name, value]) => `  -H '${escapeSingleQuotedShell(`${name}: ${value}`)}' \\`,
  );
}

export function parseOpenAiCompatibleStream(raw: string): { assistant: string; events: number } {
  let assistant = "";
  let events = 0;

  for (const line of raw.split("\n")) {
    if (!line.startsWith("data: ")) {
      continue;
    }

    const payload = line.slice(6).trim();
    if (!payload || payload === "[DONE]") {
      continue;
    }

    try {
      const parsed = JSON.parse(payload) as {
        choices?: Array<{ delta?: { content?: string } }>;
      };
      assistant += parsed.choices?.[0]?.delta?.content ?? "";
      events += 1;
    } catch {
      // Ignore malformed stream chunks and keep the raw payload available to callers.
    }
  }

  return { assistant, events };
}

export function buildPlaygroundPlan(config: PlaygroundConfig): PlaygroundPlan {
  const normalizedBaseUrl = normalizeBaseUrl(config.baseUrl);
  const pathPrefix = buildPathPrefix(config.pathFlavor);
  const modelsUrl = `${normalizedBaseUrl}${pathPrefix}/models`;
  const chatUrl = `${normalizedBaseUrl}${pathPrefix}/chat/completions`;
  const chatBody = buildChatBody(config);
  const liveHeaders = buildHeaders(config.authMode, {
    bearerToken: config.bearerToken,
    userId: config.userId,
  });
  const snippetHeaders = buildHeaders(config.authMode, {
    bearerToken: config.bearerToken,
    userId: config.userId,
    usePlaceholders: true,
  });
  const curlLines = [
    config.authMode === "session"
      ? "# Reuse an authenticated browser session or add your auth cookie below."
      : "# Internal bearer auth is the fastest path for local worker testing.",
    `curl -sS '${chatUrl}' \\`,
    `  -X POST \\`,
    ...buildCurlHeaders(snippetHeaders),
    ...(config.authMode === "session"
      ? [`  --cookie 'better-auth.session_token=${SESSION_COOKIE_PLACEHOLDER}' \\`]
      : []),
    "  --data-binary @- <<'JSON'",
    stringifyRequestBody(chatBody),
    "JSON",
  ];
  const fetchSnippetLines = [
    `const response = await fetch(${JSON.stringify(chatUrl)}, {`,
    "  method: 'POST',",
    `  credentials: ${config.authMode === "session" ? "'include'" : "'omit'"},`,
    `  headers: ${stringifyRequestBody(snippetHeaders)},`,
    `  body: JSON.stringify(${stringifyRequestBody(chatBody)}),`,
    "});",
    "",
    "const contentType = response.headers.get('content-type') ?? '';",
    "const raw = await response.text();",
    "console.log({ ok: response.ok, status: response.status, contentType, raw });",
  ];

  return {
    normalizedBaseUrl,
    pathPrefix,
    modelsUrl,
    chatUrl,
    chatBody,
    liveHeaders,
    snippetHeaders,
    curlSnippet: curlLines.join("\n"),
    fetchSnippet: fetchSnippetLines.join("\n"),
  };
}
