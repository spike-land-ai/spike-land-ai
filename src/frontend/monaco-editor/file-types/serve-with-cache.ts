import { md5 } from "../crypto-data-structures/md5";
import { routes } from "../core-logic/lib/routes";
const MIME_TYPES: Record<string, string> = {
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".cjs": "application/javascript",
  ".json": "application/json",
  ".ts": "application/typescript",
  ".tsx": "application/typescript",
  ".jsx": "application/javascript",
  ".wasm": "application/wasm",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".txt": "text/plain",
  ".xml": "text/xml",
  ".pdf": "application/pdf",
  ".zip": "application/zip",
  ".map": "application/json",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".ttf": "font/ttf",
  ".otf": "font/otf",
  ".eot": "application/vnd.ms-fontobject",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mp3": "audio/mpeg",
  ".wav": "audio/wav",
};

function lookup(path: string): string | false {
  const ext = path.slice(path.lastIndexOf(".")).toLowerCase();
  return MIME_TYPES[ext] || false;
}

// Simplified getContentType function
function getContentType(path: string) {
  return lookup(path) || "application/octet-stream";
}

function getHashHeaderValue(filePath: string, assetHash: string): string {
  const fileParts = filePath.split(".");
  if (fileParts.length < 3) {
    return assetHash;
  }
  return fileParts.at(-2) || assetHash;
}

export const serveWithCache = (files: Record<string, string>, cacheToUse: () => Promise<Cache>) => {
  const ASSET_HASH = files["ASSET_HASH"] || md5(JSON.stringify(files));

  let _fileCache: Cache | null | undefined;
  const fileCachePromise = cacheToUse()
    .then((cache) => {
      _fileCache = cache;
      return cache;
    })
    .catch((error) => {
      console.error("Cache creation failed:", error);
      _fileCache = null; // Indicate that cache is unavailable
    });

  const isAsset = (request: Request) => {
    const url = new URL(request.url);
    const pathname = decodeURIComponent(
      url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname,
    );
    const assetPath = pathname.startsWith(ASSET_HASH + "/")
      ? pathname.slice(ASSET_HASH.length + 1)
      : pathname;
    return assetPath in files || pathname in files;
  };

  // Instance-specific in-flight requests map
  const inFlightRequests = new Map<string, Promise<Response>>();

  return {
    isAsset,
    shouldBeCached: (request: Request) => {
      if (isAsset(request)) {
        return true;
      }
      const url = new URL(request.url);
      if (
        url.pathname.startsWith("/live/") ||
        url.pathname.startsWith("/my-cms/") ||
        url.pathname.startsWith("/api/")
      ) {
        return false;
      }
      return !Object.hasOwn(routes, url.pathname);
    },

    serve: async (
      request: Request,
      assetFetcher: (req: Request, waitUntil: (p: Promise<unknown>) => void) => Promise<Response>,
      waitUntil: (p: Promise<unknown>) => void,
    ) => {
      if (request.method !== "GET") {
        return new Response("Method Not Allowed", { status: 405 });
      }

      if (!isAsset(request)) {
        return new Response("Not Found", { status: 404 });
      }

      const url = new URL(request.url);
      const pathname = decodeURIComponent(
        url.pathname.startsWith("/") ? url.pathname.slice(1) : url.pathname,
      );
      const filePath = pathname.startsWith(ASSET_HASH + "/")
        ? pathname.slice(ASSET_HASH.length + 1)
        : pathname;

      if (!(filePath in files)) {
        return new Response("Not Found", { status: 404 });
      }

      if (_fileCache === undefined) {
        await fileCachePromise;
      }

      const cacheUrl = new URL(request.url);
      cacheUrl.pathname = files[filePath] || filePath;
      cacheUrl.search = "";
      cacheUrl.hash = "";

      const cacheKey = new Request(cacheUrl.toString());

      if (_fileCache) {
        // Attempt to find the response in the cache
        const cachedResp = await _fileCache.match(cacheKey);
        if (cachedResp) return cachedResp.clone();

        if (inFlightRequests.has(request.url)) {
          // Wait for the in-flight fetch to complete
          const inFlightResponse = await inFlightRequests.get(request.url)!;
          return inFlightResponse.clone();
        }

        // Construct the new URL based on the files mapping
        const newUrl = new URL(request.url);
        newUrl.pathname = "/" + (files[filePath] || filePath);
        newUrl.pathname = newUrl.pathname.replace(ASSET_HASH + "/", "");

        const req = new Request(newUrl.toString(), {
          method: request.method,
          headers: request.headers,
          redirect: request.redirect,
        });

        // Create a promise to represent the in-flight fetch
        const inFlightPromise = (async (req: Request) => {
          const resolvedFilePath = files[filePath] ? files[filePath] : filePath;
          const hash = getHashHeaderValue(resolvedFilePath, ASSET_HASH);

          let kvResp: Response;
          try {
            kvResp = await assetFetcher(req, waitUntil);
          } catch (error) {
            console.error("Asset fetch error:", error);
            inFlightRequests.delete(request.url);
            return new Response("Internal Server Error", { status: 500 });
          }

          if (!kvResp.ok) {
            inFlightRequests.delete(request.url);
            return kvResp;
          }

          // Clone the body before consuming it
          const bodyClone = await kvResp.clone().arrayBuffer();

          // Clone headers and set appropriate Content-Type
          const headers = new Headers(kvResp.headers);
          const contentType = getContentType(filePath);
          headers.set("Content-Type", contentType);
          headers.set("x-hash", hash);

          // Content-type-aware cache control
          const isHtml = contentType.includes("text/html") || !filePath.includes(".");
          const isHashed = /\.[0-9a-f]{8,}\./.test(filePath);
          if (isHtml) {
            headers.set("Cache-Control", "public, no-cache, must-revalidate");
          } else if (isHashed) {
            headers.set("Cache-Control", "public, max-age=604800, immutable");
          } else {
            headers.set("Cache-Control", "public, max-age=14400, stale-while-revalidate=86400");
          }
          headers.set("Access-Control-Allow-Origin", "*");
          // Access-Control-Allow-Credentials: true
          headers.set("Access-Control-Allow-Credentials", "true");
          // Set security headers
          headers.set("Cross-Origin-Embedder-Policy", "require-corp");

          const response = new Response(bodyClone, {
            status: kvResp.status,
            statusText: kvResp.statusText,
            headers,
          });

          if (response.status === 200) {
            // Cache the response asynchronously if cache is available
            waitUntil(
              _fileCache.put(cacheKey, response.clone()).catch((error) => {
                console.error("Cache put error:", error);
              }),
            );
          }

          // Remove the in-flight request from the map
          inFlightRequests.delete(request.url);

          return response.clone();
        })(req);

        // Store the in-flight promise
        inFlightRequests.set(request.url, inFlightPromise);

        // Await the in-flight fetch and ensure we return a cloned response
        const response = await inFlightPromise;
        return response.clone();
      }

      // If we reach here, it means the cache is not available
      return new Response("Service Unavailable", { status: 503 });
    },
  };
};
