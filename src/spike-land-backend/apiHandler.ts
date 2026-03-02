import { HTML } from "@spike-land-ai/code";
import type Env from "./env";

/**
 * Validates a URL to prevent SSRF attacks.
 * Blocks requests to internal/private IP ranges and metadata endpoints.
 */
function isAllowedUrl(urlString: string): boolean {
  try {
    const parsed = new URL(urlString);

    // Block non-HTTP(S) protocols
    if (!["http:", "https:"].includes(parsed.protocol)) {
      return false;
    }

    const hostname = parsed.hostname.toLowerCase();

    // Block localhost and loopback
    if (
      hostname === "localhost" ||
      hostname === "127.0.0.1" ||
      hostname === "[::1]" ||
      hostname === "0.0.0.0"
    ) {
      return false;
    }

    // Block cloud metadata endpoints
    if (hostname === "169.254.169.254" || hostname === "metadata.google.internal") {
      return false;
    }

    // Block private IP ranges (RFC 1918)
    const ipParts = hostname.split(".");
    if (ipParts.length === 4) {
      const firstOctet = parseInt(ipParts[0], 10);
      const secondOctet = parseInt(ipParts[1], 10);

      // 10.x.x.x
      if (firstOctet === 10) return false;
      // 172.16.x.x - 172.31.x.x
      if (firstOctet === 172 && secondOctet >= 16 && secondOctet <= 31) {
        return false;
      }
      // 192.168.x.x
      if (firstOctet === 192 && secondOctet === 168) return false;
      // 169.254.x.x (link-local)
      if (firstOctet === 169 && secondOctet === 254) return false;
    }

    return true;
  } catch {
    return false;
  }
}

export async function handleApiRequest(
  path: string[],
  request: Request,
  env: Env,
): Promise<Response> {
  switch (path[0]) {
    case "server-fetch": {
      if (request.method === "POST") {
        const { url, options } = await request.json<{ url: string; options: RequestInit }>();

        // Validate URL to prevent SSRF attacks
        if (!isAllowedUrl(url)) {
          return new Response("URL not allowed", { status: 403 });
        }

        try {
          return (await fetch(url, options)) as unknown as Response;
        } catch (_error) {
          return new Response("Server-side fetch failed", { status: 500 });
        }
      } else {
        return new Response("Method not allowed", { status: 405 });
      }
    }
    case "generate":
    case "room": {
      if (!path[1]) {
        if (request.method === "POST") {
          const id = env.CODE.newUniqueId();
          return new Response(id.toString(), {
            headers: {
              "Access-Control-Allow-Origin": "*",
              "Cross-Origin-Embedder-Policy": "require-corp",
            },
          });
        } else {
          return new Response("Method not allowed", { status: 405 });
        }
      }
      const name = path[1].replace(".tsx", "");
      let id;
      if (name.match(/^[0-9a-f]+$/) && name.length === 16) {
        id = env.CODE.idFromString(name);
      } else if (name.length <= 32) {
        id = env.CODE.idFromName(name);
      } else {
        return new Response("Name too long", { status: 404 });
      }
      const roomObject = env.CODE.get(id);
      const newUrl = new URL(request.url);
      newUrl.pathname = "/" + path.slice(2).join("/");
      if (request.headers.get("Sec-Fetch-Dest") === "script") {
        newUrl.pathname += "/index";
      }
      newUrl.searchParams.append("room", name);
      return roomObject.fetch(new Request(newUrl.toString(), request));
    }
    case "": {
      const respText = await HTML;
      const headers = new Headers({
        "Access-Control-Allow-Origin": "*",
        "Cross-Origin-Embedder-Policy": "require-corp",
        "Cross-Origin-Resource-Policy": "cross-origin",
        "Cross-Origin-Opener-Policy": "same-origin",
        "Cache-Control": "no-cache",
        "Content-Encoding": "gzip",
        "Content-Type": "text/html; charset=UTF-8",
      });
      return new Response(respText, { status: 200, headers });
    }
    default: {
      return new Response("Not found", { status: 404 });
    }
  }
}
