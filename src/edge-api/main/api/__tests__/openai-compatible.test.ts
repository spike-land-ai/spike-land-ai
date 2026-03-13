import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { openAiCompatible } from "../routes/openai-compatible";
import type { Env, Variables } from "../../core-logic/env";

afterEach(() => {
  vi.restoreAllMocks();
});

function makeMcpFetcher(options?: {
  byok?: Partial<Record<"openai" | "anthropic" | "google", string>>;
  tools?: Array<{ name: string; description: string; category?: string }>;
}) {
  const tools = options?.tools ?? [
    {
      name: "deploy_worker",
      description: "Deploy a Cloudflare Worker to production.",
      category: "deployment",
    },
    {
      name: "mcp_tool_search",
      description: "Search the MCP registry by natural-language query.",
      category: "mcp",
    },
  ];

  return vi.fn(async (request: Request) => {
    const url = new URL(request.url);

    if (url.pathname === "/tools") {
      return new Response(JSON.stringify({ tools }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    if (url.pathname === "/internal/byok/get") {
      expect(request.headers.get("x-internal-secret")).toBe("mcp-secret");
      const body = await request.json<{ provider?: "openai" | "anthropic" | "google" }>();
      const key = body.provider ? (options?.byok?.[body.provider] ?? null) : null;
      return new Response(JSON.stringify({ key }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    return new Response("not found", { status: 404 });
  });
}

describe("openAiCompatible route", () => {
  it("requires authentication for the OpenAI-compatible surface", async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route("/", openAiCompatible);

    const res = await app.request("/v1/models", { method: "GET" }, {
      INTERNAL_SERVICE_SECRET: "secret",
    } as unknown as Env);

    expect(res.status).toBe(401);
  });

  it("lists the virtual local-agent model selectors with bearer internal auth", async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route("/", openAiCompatible);

    const res = await app.request(
      "/v1/models",
      {
        method: "GET",
        headers: { Authorization: "Bearer secret" },
      },
      {
        INTERNAL_SERVICE_SECRET: "secret",
      } as unknown as Env,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      object: string;
      data: Array<{ id: string; owned_by: string }>;
    }>();

    expect(body.object).toBe("list");
    expect(body.data.map((entry) => entry.id)).toEqual([
      "spike-agent-v1",
      "openai/gpt-4.1",
      "anthropic/claude-sonnet-4-20250514",
      "google/gemini-2.5-flash",
    ]);
  });

  it("auto-selects a user's BYOK key before platform providers for spike-agent-v1", async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route("/", openAiCompatible);

    const mcpFetch = makeMcpFetcher({
      byok: { openai: "user-openai-key" },
    });

    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
        const requestUrl = input instanceof Request ? input.url : String(input);
        expect(requestUrl).toBe("https://api.openai.com/v1/chat/completions");
        expect(init?.headers).toMatchObject({
          "Content-Type": "application/json",
          Authorization: "Bearer user-openai-key",
        });

        const body = JSON.parse(String(init?.body)) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
        };

        expect(body.model).toBe("gpt-4.1");
        expect(body.messages[0]?.role).toBe("system");
        expect(body.messages[0]?.content).toContain("router-agent");
        expect(body.messages[0]?.content).toContain("deploy_worker");

        return new Response(
          JSON.stringify({
            choices: [
              { message: { content: "Use the Deployment Guide and the deploy_worker tool." } },
            ],
            usage: { prompt_tokens: 123, completion_tokens: 12, total_tokens: 135 },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      });

    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request(
      "/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "X-User-Id": "user-123",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "spike-agent-v1",
          messages: [
            { role: "user", content: "How do I deploy a Cloudflare Worker with MCP tools?" },
          ],
        }),
      },
      {
        INTERNAL_SERVICE_SECRET: "secret",
        MCP_INTERNAL_SECRET: "mcp-secret",
        MCP_SERVICE: { fetch: mcpFetch },
        XAI_API_KEY: "platform-xai-key",
      } as unknown as Env,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      object: string;
      model: string;
      choices: Array<{ message: { role: string; content: string } }>;
      usage: { prompt_tokens: number; completion_tokens: number; total_tokens: number };
    }>();

    expect(body.object).toBe("chat.completion");
    expect(body.model).toBe("spike-agent-v1");
    expect(body.choices[0]?.message.role).toBe("assistant");
    expect(body.choices[0]?.message.content).toContain("Deployment Guide");
    expect(body.usage.total_tokens).toBe(135);
    expect(mcpFetch).toHaveBeenCalledTimes(4);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("uses the user's BYOK key for an explicit provider model", async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route("/", openAiCompatible);

    const mcpFetch = makeMcpFetcher({
      byok: { anthropic: "user-anthropic-key" },
      tools: [],
    });

    const fetchMock = vi
      .fn()
      .mockImplementation(async (input: string | URL | Request, init?: RequestInit) => {
        const requestUrl = input instanceof Request ? input.url : String(input);
        expect(requestUrl).toBe("https://api.anthropic.com/v1/messages");
        expect(init?.headers).toMatchObject({
          "x-api-key": "user-anthropic-key",
          "anthropic-version": "2023-06-01",
        });

        const body = JSON.parse(String(init?.body)) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
        };
        expect(body.model).toBe("claude-sonnet-4-20250514");

        return new Response(
          JSON.stringify({
            content: [{ type: "text", text: "Anthropic BYOK answered this request." }],
            usage: { input_tokens: 100, output_tokens: 20 },
          }),
          { headers: { "Content-Type": "application/json" } },
        );
      });

    vi.stubGlobal("fetch", fetchMock);

    const res = await app.request(
      "/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "X-User-Id": "user-456",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "anthropic/claude-sonnet-4-20250514",
          messages: [{ role: "user", content: "Answer this with my Anthropic key." }],
        }),
      },
      {
        INTERNAL_SERVICE_SECRET: "secret",
        MCP_INTERNAL_SECRET: "mcp-secret",
        MCP_SERVICE: { fetch: mcpFetch },
      } as unknown as Env,
    );

    expect(res.status).toBe(200);
    const body = await res.json<{
      model: string;
      choices: Array<{ message: { content: string } }>;
      usage: { total_tokens: number };
    }>();

    expect(body.model).toBe("anthropic/claude-sonnet-4-20250514");
    expect(body.choices[0]?.message.content).toContain("Anthropic BYOK");
    expect(body.usage.total_tokens).toBe(120);
    expect(mcpFetch).toHaveBeenCalledTimes(2);
  });

  it("returns 503 when an explicit BYOK-only provider has no available key", async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route("/", openAiCompatible);

    const res = await app.request(
      "/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "X-User-Id": "user-789",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "openai/gpt-4.1",
          messages: [{ role: "user", content: "Use OpenAI." }],
        }),
      },
      {
        INTERNAL_SERVICE_SECRET: "secret",
        MCP_INTERNAL_SECRET: "mcp-secret",
        MCP_SERVICE: { fetch: makeMcpFetcher() },
      } as unknown as Env,
    );

    expect(res.status).toBe(503);
    expect(await res.json()).toEqual({
      error: {
        message:
          "No matching synthesis provider is configured. Add a BYOK key or configure a platform provider.",
        type: "service_unavailable_error",
        param: null,
        code: "provider_unavailable",
      },
    });
  });

  it("streams Server-Sent Events in OpenAI chunk format", async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route("/", openAiCompatible);

    const encoder = new TextEncoder();
    const sseBody = [
      `data: ${JSON.stringify({ choices: [{ delta: { role: "assistant" }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: { content: "Streaming works through the local agent pipeline." }, finish_reason: null }] })}\n\n`,
      `data: ${JSON.stringify({ choices: [{ delta: {}, finish_reason: "stop" }] })}\n\n`,
      "data: [DONE]\n\n",
    ].join("");

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(encoder.encode(sseBody), {
          headers: { "Content-Type": "text/event-stream" },
        }),
      ),
    );

    const res = await app.request(
      "/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: "Bearer secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messages: [{ role: "user", content: "Stream this answer." }],
          stream: true,
        }),
      },
      {
        INTERNAL_SERVICE_SECRET: "secret",
        XAI_API_KEY: "platform-xai-key",
        MCP_INTERNAL_SECRET: "mcp-secret",
        MCP_SERVICE: {
          fetch: makeMcpFetcher({ tools: [] }),
        },
      } as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await res.text();
    expect(text).toContain('"role":"assistant"');
    expect(text).toContain("Streaming works through the local agent pipeline.");
    expect(text).toContain("[DONE]");
  });
});
