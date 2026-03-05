import { routes } from "@spike-land-ai/code";
import type Env from "./env";
import { handleFetchApi } from "./fetchHandler";
import { handleErrors } from "./handleErrors";
import { handleUnauthorizedRequest } from "./utils";

/**
 * Security headers to add to all responses.
 * These help prevent common web vulnerabilities.
 */
const securityHeaders: Record<string, string> = {
  "X-Content-Type-Options": "nosniff",
  "X-XSS-Protection": "1; mode=block",
  "Permissions-Policy": "autoplay=*",
};

/** CSP frame-ancestors directive — always applied to allow iframe embedding from spike.land */
const FRAME_ANCESTORS =
  "frame-ancestors 'self' https://spike.land https://*.spike.land http://localhost:3000";

/**
 * Adds security headers to a response.
 */
function addSecurityHeaders(response: Response): Response {
  // Skip WebSocket upgrade responses - they cannot be reconstructed
  // and don't need security headers
  if (response.status === 101) {
    return response;
  }

  const newHeaders = new Headers(response.headers);

  // Always remove X-Frame-Options - we use CSP frame-ancestors instead
  newHeaders.delete("X-Frame-Options");

  for (const [key, value] of Object.entries(securityHeaders)) {
    if (!newHeaders.has(key)) {
      newHeaders.set(key, value);
    }
  }

  // Always set frame-ancestors, even if a CSP already exists — append or replace
  const existingCSP = newHeaders.get("Content-Security-Policy");
  if (existingCSP) {
    // Remove any existing frame-ancestors directive and append ours
    const withoutFrameAncestors = existingCSP
      .split(";")
      .map((d) => d.trim())
      .filter((d) => !d.startsWith("frame-ancestors"))
      .join("; ");
    newHeaders.set(
      "Content-Security-Policy",
      withoutFrameAncestors ? `${withoutFrameAncestors}; ${FRAME_ANCESTORS}` : FRAME_ANCESTORS,
    );
  } else {
    newHeaders.set("Content-Security-Policy", FRAME_ANCESTORS);
  }

  return new Response(response.body, {
    status: response.status,
    statusText: response.statusText,
    headers: newHeaders,
  });
}

export async function handleMainFetch(
  request: Request,
  env: Env,
  ctx: ExecutionContext,
): Promise<Response> {
  const { cf } = request as unknown as { cf?: { asOrganization?: string } };
  if (cf?.asOrganization?.startsWith("YANDEX")) {
    return handleUnauthorizedRequest();
  }

  return handleErrors(request, async () => {
    const url = new URL(request.url);

    if (url.pathname === "/health" && request.method === "GET") {
      const deep = url.searchParams.get("deep") === "true";
      let kvStatus = "ok";
      let r2Status = "ok";

      if (deep) {
        try {
          await env.KV.get("__health_check__");
        } catch {
          kvStatus = "degraded";
        }
        try {
          await env.R2.head("__health_check__");
        } catch {
          r2Status = "degraded";
        }
      }

      const overall = kvStatus === "ok" && r2Status === "ok" ? "ok" : "degraded";
      return new Response(
        JSON.stringify({
          status: overall,
          service: "spike-land-backend",
          timestamp: new Date().toISOString(),
          ...(deep ? { kv: kvStatus, r2: r2Status } : {}),
        }),
        {
          status: overall === "ok" ? 200 : 503,
          headers: { "Content-Type": "application/json" },
        },
      );
    }

    const redirect = routes[url.pathname as keyof typeof routes];
    if (redirect) {
      const response = await handleFetchApi(["live", redirect, "embed"], request, env, ctx);
      const finalResponse = response || new Response("Not Found", { status: 404 });
      return addSecurityHeaders(finalResponse);
    }

    const path = url.pathname.slice(1).split("/");
    const response = await handleFetchApi(path, request, env, ctx);
    const finalResponse = response || new Response("Not Found", { status: 404 });
    return addSecurityHeaders(finalResponse);
  }, {
    waitUntil: (p) => ctx.waitUntil(p),
    errorEndpoint: env.ERROR_INGEST_ENDPOINT,
  });
}
