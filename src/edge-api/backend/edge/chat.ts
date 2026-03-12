import { serverFetchUrl } from "@spike-land-ai/code";
import * as Sentry from "@sentry/cloudflare";
import { handleAnthropicRequest } from "../core-logic/anthropicHandler.js";
import { KVLogger } from "../core-logic/Logs.js";
import { handleMainFetch } from "../lazy-imports/mainFetchHandler.js";
import { handleGPT4Request } from "../core-logic/openaiHandler.js";
import { handleReplicateRequest } from "../ai/replicateHandler.js";

import { getAssetFromKV } from "@cloudflare/kv-asset-handler";
import { serveWithCache } from "@spike-land-ai/code";
import type Env from "../core-logic/env.js";
import { makeResponse } from "../core-logic/makeResponse.js";
import {
  captureWorkerException,
  createWorkerSentryOptions,
} from "../../common/core-logic/sentry.js";
// @ts-expect-error no type declarations for generated mjs asset manifest
import { ASSET_HASH, ASSET_MANIFEST, files } from "./staticContent.mjs";

const main = {
  async fetch(request: Request, env: Env, ctx: ExecutionContext) {
    const url = new URL(request.url);

    const kvServer = serveWithCache(files, () => caches.open(`file-cache-${ASSET_HASH}`));

    const path = url.pathname.slice(1).split("/");

    const [preRoute, codeSpace] = path;

    // Handle MCP server routes
    if (path[0] === "mcp") {
      // Extract codeSpace from agent context or headers
      // The agent should provide the codeSpace it wants to work with
      // Support both "codeSpace" and "codespaceId" for compatibility
      const agentCodeSpace =
        request.headers.get("X-CodeSpace") ||
        url.searchParams.get("codeSpace") ||
        url.searchParams.get("codespaceId") ||
        "default";

      // Create a temporary durable object stub to handle MCP requests
      const id = env.CODE.idFromName(agentCodeSpace);
      const stub = env.CODE.get(id);

      // Ensure the codeSpace is properly included in the forwarded request
      const forwardedUrl = new URL(request.url);
      if (!forwardedUrl.searchParams.has("codeSpace")) {
        forwardedUrl.searchParams.set("codeSpace", agentCodeSpace);
      }

      const forwardedRequest = new Request(forwardedUrl.toString(), {
        method: request.method,
        headers: request.headers,
        body: request.body,
      });

      // Forward the request to the durable object's MCP handler
      return stub.fetch(forwardedRequest);
    }

    const isEditorPath =
      request.method === "GET" && preRoute === "live" && url.pathname === `/live/${codeSpace}`;

    if (kvServer.isAsset(request) || isEditorPath) {
      const assetFetcher = (req: Request, waitUntil: (p: Promise<unknown>) => void) =>
        getAssetFromKV(
          { request: req, waitUntil },
          {
            ASSET_NAMESPACE: env.__STATIC_CONTENT,
            ASSET_MANIFEST,
          },
        );

      if (isEditorPath) {
        const editorRequest = new Request(new URL("/index.html", url.origin).toString());
        return kvServer.serve(editorRequest, assetFetcher, (p: Promise<unknown>) =>
          ctx.waitUntil(p),
        );
      }
      return kvServer.serve(request, assetFetcher, (p: Promise<unknown>) => ctx.waitUntil(p));
    } else if (Object.keys(files).includes(url.pathname.slice(1))) {
      return new Response(JSON.stringify(files), {
        headers: {
          "Content-Type": "application/json",
          "x-hash": ASSET_HASH,
        },
      });
    }

    const logger = new KVLogger("myapp", env.KV);

    await env.KV.put("lastRequest", request.url);

    // SW endpoints removed — service worker has been deleted
    if (url.pathname === "/transpile" && request.method === "POST") {
      const body = await request.text();

      const transpiled = await (
        await fetch("https://esbuild.spikeland.workers.dev", {
          method: "POST",
          body: body,
          headers: {
            TR_ORIGIN: url.origin,
            // Include any additional headers required for authentication
          },
        })
      ).text();

      return new Response(transpiled, {
        headers: {
          "Content-Type": "application/javascript",
        },
      });
    }
    if (url.pathname === "/ASSET_MANIFEST") {
      return new Response(ASSET_MANIFEST as unknown as string, {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    if (url.pathname === serverFetchUrl) {
      const optionsParam = (await request.json()) as RequestInit & {
        url: string;
      };

      try {
        return await fetch(optionsParam.url, optionsParam);
      } catch (error) {
        captureWorkerException("spike-land-backend", error, {
          request,
          tags: { operation: "server-fetch-url" },
          extras: { targetUrl: optionsParam.url },
        });
        console.error("serverFetchUrl fetch failed:", error);
        return new Response(JSON.stringify({ error: "Fetch failed" }), {
          status: 502,
          headers: { "Content-Type": "application/json" },
        });
      }
    }

    if (request.url.includes("anthropic")) {
      ctx.waitUntil(logger.log(`Request for ${request.url}`));
      return handleAnthropicRequest(request, env);
    }
    if (request.url.includes("ai-logs")) {
      function createArray(n: number) {
        return Array.from({ length: n }, (_, index) => index + 1);
      }

      const counter = Number(await env.KV.get("ai:counter"));

      const logs = createArray(counter)
        .slice(-20)
        .map(async (i) => {
          const log = await env.KV.get(`ai:${i}`);
          if (log !== null) {
            return JSON.parse(log);
          }
        });

      const resolvedLogs = await Promise.all(logs);

      return new Response(JSON.stringify(resolvedLogs), {
        headers: {
          "Content-Type": "application/json",
        },
      });
    }

    if (request.url.includes("openai")) {
      ctx.waitUntil(logger.log(`Request for ${request.url}`));
      return handleGPT4Request(request, env);
    }
    if (request.url.includes("whisper")) {
      const formData = await request.formData();

      const body: { [key: string]: unknown; file: File } = {
        file: new File([], ""),
      };
      formData.forEach((value, key) => {
        body[key] = value;
      });
      if (body["record.wav"]) {
        body.file = formData.get("record.wav") as unknown as File;
      }

      const blob = await body.file!.arrayBuffer();

      const inputs = {
        audio: [...new Uint8Array(blob)],
      };
      const response = await env.AI.run("@cf/openai/whisper-tiny-en", inputs);

      return new Response(response.toString(), {
        headers: {
          "Content-Type": "text/plain",
        },
      });
    }
    if (request.url.includes("summarize")) {
      const response = await env.AI.run("@cf/facebook/bart-large-cnn", {
        input_text: await request
          .json<{
            text: string;
          }>()
          .then((data) => data.text),
        max_length: 1024,
      });
      return Response.json({ response });
    }
    if (request.url.includes("remix")) {
      ctx.waitUntil(logger.log(`Request for ${request.url}`));
      return new Response("Remix handler not implemented", { status: 501 });
    }
    if (request.url.includes("replicate")) {
      ctx.waitUntil(logger.log(`Request for ${request.url}`));

      return handleReplicateRequest(request, env, ctx);
    }

    if (request.url.includes("/my-cms/")) {
      return handleCMSIndexRequest(request, env);
    }

    if (request.url.includes("/live-cms/")) {
      return handleCMSIndexRequest(request, env);
    }

    if (request.url.includes("/api/my-turn")) {
      return generateTURNCredentials(env.CF_REAL_TURN_TOKEN);
    }

    return handleMainFetch(request, env, ctx);
  },
};

export { Code } from "../lazy-imports/chatRoom.js";
export { CodeRateLimiter } from "../core-logic/rateLimiter.js";

export default Sentry.withSentry(
  (env: Env) => createWorkerSentryOptions("spike-land-backend", env),
  main satisfies ExportedHandler<Env>,
);

async function generateTURNCredentials(turnToken: string): Promise<Response> {
  const url =
    "https://rtc.live.cloudflare.com/v1/turn/keys/88ad1e0d43c4cf72414a8541fccd52a0/credentials/generate";

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${turnToken}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ ttl: 86400 }),
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const data = await response.json();
    return new Response(JSON.stringify(data), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    captureWorkerException("spike-land-backend", error, {
      request: new Request(url, { method: "POST" }),
      tags: { operation: "generate-turn-credentials" },
    });
    console.error("Error generating TURN credentials:", error);
    return new Response(JSON.stringify({ error: "Failed to generate TURN credentials" }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
}

export async function handleCMSIndexRequest(request: Request, env: Env) {
  const key = request.url;
  const url = new URL(request.url);
  const path = url.pathname;
  switch (request.method) {
    case "PUT":
      await env.R2.put(key, request.body);
      return new Response(`Put ${key} successfully!`);
    case "DELETE":
      await env.R2.delete(key);
      return new Response(`DEL ${key} successfully!`);
    case "GET": {
      let object = await env.R2.get(url.origin + path);
      if (!object) {
        object = await env.R2.get(url.origin + path + ".html");
      }

      if (!object) {
        const myPath = path.split("/").slice(-2)[0];
        object = await env.R2.get(url.origin + myPath + ".html");
      }
      if (!object) {
        return new Response("Not found", { status: 404 });
      }

      return makeResponse(object, key);
    }
    default:
      return new Response("Method not allowed", { status: 405 });
  }
}
