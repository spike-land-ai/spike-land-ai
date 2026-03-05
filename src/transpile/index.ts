import { build, transpile, wasmFile as wasmModule } from "@spike-land-ai/code/src/@/lib/transpile";

Object.assign(globalThis, {
  performance: {
    now: () => Date.now(),
  },
});

const getCorsHeaders = (requestUrl?: string) => {
  let allowOrigin = "https://spike.land";
  if (requestUrl) {
    const origin = new URL(requestUrl).origin;
    if (origin.endsWith(".spike.land") || origin.startsWith("http://localhost:")) {
      allowOrigin = origin;
    }
  }

  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "*",
    "cache-control": "no-cache",
  } as const;
};

const initAndTransform = (code: string, origin: string) =>
  transpile({ code, originToUse: origin, wasmModule });

const handleGetRequest = async (codeSpace: string, origin: string) => {
  try {
    const results = await build({
      codeSpace,
      origin,
      format: "esm",
      splitting: false,
      external: ["/*"],
      wasmModule,
    });

    if (!results) {
      return new Response("No results", { status: 404 });
    }

    if (typeof results === "string") {
      return new Response(results, {
        headers: {
          ...getCorsHeaders(),
          "Content-Type": "application/javascript",
        },
      });
    }

    return new Response(JSON.stringify(results), {
      headers: {
        ...getCorsHeaders(),
        "Content-Type": "application/json",
      },
    });
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    return new Response(error.message, { status: 500 });
  }
};

async function hashCode(code: string): Promise<string> {
  const data = new TextEncoder().encode(code);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 32);
}

const handlePostRequest = async (request: Request, ctx?: ExecutionContext) => {
  try {
    const code = await request.text();
    const origin = request.headers.get("TR_ORIGIN") ?? "";

    // Content-addressed cache: same input always produces same output
    const hash = await hashCode(code + origin);
    const cacheKey = new Request(`https://transpile.internal/${hash}`, { method: "GET" });
    const cache = (caches as unknown as { default: Cache }).default;

    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    const respText = await initAndTransform(code, origin);

    const response = new Response(respText, {
      headers: {
        ...getCorsHeaders(request.url),
        "Content-Type": "application/javascript",
        "Cache-Control": "public, max-age=86400, immutable",
      },
    });

    // Cache in background — deterministic output, safe to cache for 24h
    try {
      ctx?.waitUntil(cache.put(cacheKey, response.clone()));
    } catch { /* waitUntil not available outside worker context */ }

    return response;
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    return new Response(error.message || "Unknown error", { status: 500 });
  }
};

export default {
  async fetch(request: Request, _env: unknown, ctx: ExecutionContext) {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      return new Response(
        JSON.stringify({ status: "ok", service: "transpile", timestamp: new Date().toISOString() }),
        { status: 200, headers: { "Content-Type": "application/json" } },
      );
    }

    const params = url.searchParams;
    const codeSpace = params.get("codeSpace") || "empty";
    const originParam = params.get("origin");
    const origin = originParam === "testing" ? "https://testing.spike.land" : "https://spike.land";

    if (request.method === "GET") {
      return handleGetRequest(codeSpace, origin);
    }

    if (request.method === "POST") {
      return handlePostRequest(request, ctx);
    }

    return new Response("Method not allowed. Try POST or GET.", {
      status: 405,
      headers: {
        ...getCorsHeaders(request.url),
      },
    });
  },
};
