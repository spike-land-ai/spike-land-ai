import { Hono } from "hono";
import type { Env, Variables } from "../../core-logic/env.js";
import {
  resolveSynthesisTarget,
  DEFAULT_PROVIDER_MODELS,
  type ProviderId,
} from "../../core-logic/llm-provider.js";

const spikeChatDebug = new Hono<{ Bindings: Env; Variables: Variables }>();

/** GET /api/spike-chat/debug/providers — check LLM provider availability. */
spikeChatDebug.get("/api/spike-chat/debug/providers", async (c) => {
  const userId = c.get("userId") as string | undefined;

  const providers: Array<{
    provider: ProviderId;
    model: string;
    available: boolean;
    keySource: "byok" | "platform" | "none";
  }> = [];

  for (const provider of ["openai", "anthropic", "google", "xai"] as ProviderId[]) {
    const target = await resolveSynthesisTarget(c.env, userId, {
      publicModel: "spike-agent-v1",
      provider,
      upstreamModel: DEFAULT_PROVIDER_MODELS[provider],
    });

    providers.push({
      provider,
      model: DEFAULT_PROVIDER_MODELS[provider],
      available: target !== null,
      keySource: target?.keySource ?? "none",
    });
  }

  const autoTarget = await resolveSynthesisTarget(c.env, userId, {
    publicModel: "spike-agent-v1",
    provider: "auto",
    upstreamModel: undefined,
  });

  return c.json({
    providers,
    autoSelected: autoTarget
      ? {
          provider: autoTarget.provider,
          model: autoTarget.upstreamModel,
          keySource: autoTarget.keySource,
        }
      : null,
  });
});

/** GET /api/spike-chat/debug/session — check session DO status. */
spikeChatDebug.get("/api/spike-chat/debug/session", async (c) => {
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
      getMeta(key: string): Promise<string | null>;
    };

    const history = await stub.getHistory();
    const lastActiveAt = await stub.getMeta("lastActiveAt");
    const persona = await stub.getMeta("persona");

    return c.json({
      sessionId,
      messageCount: history.length,
      lastActiveAt: lastActiveAt ? Number(lastActiveAt) : null,
      persona,
      doAvailable: true,
    });
  } catch {
    return c.json({
      sessionId,
      messageCount: 0,
      lastActiveAt: null,
      persona: null,
      doAvailable: false,
    });
  }
});

/** GET /api/spike-chat/debug/ws-test — WebSocket echo for connectivity testing. */
spikeChatDebug.get("/api/spike-chat/debug/ws-test", async (c) => {
  const upgradeHeader = c.req.header("Upgrade");
  if (upgradeHeader !== "websocket") {
    return c.json({
      status: "ok",
      message: "WebSocket echo endpoint. Connect with a WebSocket client to test connectivity.",
      timestamp: Date.now(),
    });
  }

  const pair = new WebSocketPair();
  const [client, server] = [pair[0], pair[1]];

  server.accept();
  server.addEventListener("message", (event) => {
    server.send(
      JSON.stringify({
        echo: event.data,
        timestamp: Date.now(),
      }),
    );
  });
  server.addEventListener("close", () => {
    server.close();
  });

  return new Response(null, {
    status: 101,
    webSocket: client,
  });
});

export { spikeChatDebug };
