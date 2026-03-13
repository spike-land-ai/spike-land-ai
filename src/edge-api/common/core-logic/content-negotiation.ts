import type { Context } from "hono";

export function acceptsMarkdown(c: Context): boolean {
  const accept = c.req.header("Accept") ?? "";
  return accept.includes("text/markdown");
}

export function markdownResponse(body: string, cacheControl: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Cache-Control": cacheControl,
      Vary: "Accept, Accept-Encoding",
    },
  });
}
