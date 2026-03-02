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

const handlePostRequest = async (request: Request) => {
  try {
    const respText = await initAndTransform(
      await request.text(),
      request.headers.get("TR_ORIGIN") ?? "",
    );

    return new Response(respText, {
      headers: {
        ...getCorsHeaders(request.url),
        "Content-Type": "application/javascript",
      },
    });
  } catch (e) {
    const error = e instanceof Error ? e : new Error(String(e));
    return new Response(error.message || "Unknown error", { status: 500 });
  }
};

export default {
  async fetch(request: Request) {
    const url = new URL(request.url);
    const params = url.searchParams;
    const codeSpace = params.get("codeSpace") || "empty";
    const originParam = params.get("origin");
    const origin = originParam === "testing" ? "https://testing.spike.land" : "https://spike.land";

    if (request.method === "GET") {
      return handleGetRequest(codeSpace, origin);
    }

    if (request.method === "POST") {
      return handlePostRequest(request);
    }

    return new Response("Method not allowed. Try POST or GET.", {
      status: 405,
      headers: {
        ...getCorsHeaders(request.url),
      },
    });
  },
};
