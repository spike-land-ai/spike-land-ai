import { describe, expect, it } from "vitest";
import {
  buildChatBody,
  buildHeaders,
  buildPlaygroundPlan,
  normalizeBaseUrl,
  parseOpenAiCompatibleStream,
  resolveDefaultBaseUrl,
  resolveDefaultPathFlavor,
  type PlaygroundConfig,
} from "../../../src/frontend/platform-frontend/core-logic/openai-compatible-playground";

function makeConfig(overrides: Partial<PlaygroundConfig> = {}): PlaygroundConfig {
  return {
    targetPreset: "browser-proxy",
    pathFlavor: "api",
    authMode: "bearer",
    baseUrl: "http://localhost:5173/",
    bearerToken: "secret",
    userId: "user-123",
    model: "spike-agent-v1",
    provider: "auto",
    systemPrompt: "Answer directly.",
    prompt: "How do I test this locally?",
    temperature: 0.2,
    maxTokens: 768,
    stream: false,
    ...overrides,
  };
}

describe("openai-compatible playground helpers", () => {
  it("normalizes base URLs and resolves local defaults", () => {
    expect(normalizeBaseUrl("https://local.spike.land:8787/")).toBe(
      "https://local.spike.land:8787",
    );
    expect(resolveDefaultBaseUrl("browser-proxy", "https://local.spike.land:5173")).toBe(
      "https://local.spike.land:5173",
    );
    expect(resolveDefaultBaseUrl("local-worker", "https://local.spike.land:5173")).toBe(
      "https://local.spike.land:8787",
    );
    expect(resolveDefaultBaseUrl("local-worker", "http://localhost:5173")).toBe(
      "http://localhost:8787",
    );
    expect(resolveDefaultBaseUrl("production", "http://localhost:5173")).toBe(
      "https://api.spike.land",
    );
    expect(resolveDefaultPathFlavor("browser-proxy")).toBe("api");
    expect(resolveDefaultPathFlavor("local-worker")).toBe("compat");
  });

  it("builds bearer headers and omits provider when auto is selected", () => {
    expect(buildHeaders("bearer", { bearerToken: "secret", userId: "user-123" })).toEqual({
      "Content-Type": "application/json",
      Authorization: "Bearer secret",
      "X-User-Id": "user-123",
    });

    expect(buildChatBody(makeConfig())).toEqual({
      model: "spike-agent-v1",
      messages: [
        { role: "system", content: "Answer directly." },
        { role: "user", content: "How do I test this locally?" },
      ],
      temperature: 0.2,
      max_tokens: 768,
      stream: false,
    });
  });

  it("builds executable snippets for browser-proxy mode", () => {
    const plan = buildPlaygroundPlan(makeConfig());

    expect(plan.modelsUrl).toBe("http://localhost:5173/api/v1/models");
    expect(plan.chatUrl).toBe("http://localhost:5173/api/v1/chat/completions");
    expect(plan.curlSnippet).toContain("curl -sS 'http://localhost:5173/api/v1/chat/completions'");
    expect(plan.curlSnippet).toContain("Authorization: Bearer secret");
    expect(plan.fetchSnippet).toContain("credentials: 'omit'");
    expect(plan.fetchSnippet).toContain('"model": "spike-agent-v1"');
  });

  it("adds session cookie guidance for session-mode snippets", () => {
    const plan = buildPlaygroundPlan(
      makeConfig({
        authMode: "session",
        bearerToken: "",
        userId: "",
      }),
    );

    expect(plan.curlSnippet).toContain("better-auth.session_token=<AUTH_SESSION_COOKIE>");
    expect(plan.fetchSnippet).toContain("credentials: 'include'");
    expect(plan.liveHeaders).toEqual({ "Content-Type": "application/json" });
  });

  it("parses synthetic streaming payloads into assistant text", () => {
    const parsed = parseOpenAiCompatibleStream(`data: {"choices":[{"delta":{"role":"assistant"}}]}

data: {"choices":[{"delta":{"content":"Hello "}}]}

data: {"choices":[{"delta":{"content":"world"}}]}

data: [DONE]
`);

    expect(parsed).toEqual({ assistant: "Hello world", events: 3 });
  });
});
