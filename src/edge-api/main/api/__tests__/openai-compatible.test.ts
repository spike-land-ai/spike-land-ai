import { afterEach, describe, expect, it, vi } from "vitest";
import { Hono } from "hono";
import { openAiCompatible } from "../routes/openai-compatible";
import type { Env, Variables } from "../../core-logic/env";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("openAiCompatible route", () => {
  it("requires authentication for the OpenAI-compatible surface", async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route("/", openAiCompatible);

    const res = await app.request("/v1/models", { method: "GET" }, {
      INTERNAL_SERVICE_SECRET: "secret",
    } as unknown as Env);

    expect(res.status).toBe(401);
  });

  it("lists the virtual local-agent model with bearer internal auth", async () => {
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
    expect(body.data).toHaveLength(1);
    expect(body.data[0]).toMatchObject({
      id: "spike-agent-v1",
      owned_by: "spike.land",
    });
  });

  it("returns an OpenAI-style chat completion built from local agent context", async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route("/", openAiCompatible);

    const mcpFetch = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({
          tools: [
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
          ],
        }),
        { headers: { "Content-Type": "application/json" } },
      ),
    );

    const fetchMock = vi
      .fn()
      .mockImplementation(async (_input: string | URL | Request, init?: RequestInit) => {
        const body = JSON.parse(String(init?.body)) as {
          model: string;
          messages: Array<{ role: string; content: string }>;
        };

        expect(body.model).toBe("grok-4-1");
        expect(body.messages[0]?.role).toBe("system");
        expect(body.messages[0]?.content).toContain("router-agent");
        expect(body.messages[0]?.content).toContain("docs-agent");
        expect(body.messages[0]?.content).toContain("Deployment Guide");
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
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "spike-agent-v1",
          messages: [
            { role: "user", content: "How do I deploy a Cloudflare Worker with MCP tools?" },
          ],
          user: "test-user",
        }),
      },
      {
        INTERNAL_SERVICE_SECRET: "secret",
        XAI_API_KEY: "xai-key",
        MCP_SERVICE: { fetch: mcpFetch },
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
    expect(mcpFetch).toHaveBeenCalledTimes(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("streams Server-Sent Events in OpenAI chunk format", async () => {
    const app = new Hono<{ Bindings: Env; Variables: Variables }>();
    app.route("/", openAiCompatible);

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue(
        new Response(
          JSON.stringify({
            choices: [
              { message: { content: "Streaming works through the local agent pipeline." } },
            ],
          }),
          { headers: { "Content-Type": "application/json" } },
        ),
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
        XAI_API_KEY: "xai-key",
        MCP_SERVICE: {
          fetch: vi.fn().mockResolvedValue(
            new Response(JSON.stringify({ tools: [] }), {
              headers: { "Content-Type": "application/json" },
            }),
          ),
        },
      } as unknown as Env,
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/event-stream");

    const text = await res.text();
    expect(text).toContain('"object":"chat.completion.chunk"');
    expect(text).toContain('"role":"assistant"');
    expect(text).toContain("Streaming works through the local agent pipeline.");
    expect(text).toContain("[DONE]");
  });
});
