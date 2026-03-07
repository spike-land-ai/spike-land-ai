/// <reference lib="webworker" />

const sw = self as unknown as ServiceWorkerGlobalScope & typeof globalThis;

const CACHE_NAME_PREFIX = "spike-land-cache-v";
let CACHE_NAME = "spike-land-cache-v3";

// Navigation requests must always hit the network to pick up new deployments
const PRECACHE_ASSETS: string[] = [];

const CACHED_ORIGINS = [
  "unpkg.com",
  "esm.spike.land",
  "cdn.jsdelivr.net",
  "cdnjs.cloudflare.com",
  "fonts.googleapis.com",
  "fonts.gstatic.com",
];

const CACHED_EXTENSIONS = [
  ".wasm",
  ".js",
  ".css",
  ".woff",
  ".woff2",
  ".ttf",
  ".png",
  ".jpg",
  ".jpeg",
  ".svg",
  ".json",
];

interface PrecacheManifest {
  version: string;
  assets: Array<{ url: string }>;
}

async function loadManifestAndPrecache(): Promise<void> {
  try {
    const response = await fetch("/precache-manifest.json");
    if (response.ok) {
      const manifest: PrecacheManifest = await response.json();
      CACHE_NAME = CACHE_NAME_PREFIX + manifest.version;

      const cache = await caches.open(CACHE_NAME);

      // Always precache the base assets
      await cache.addAll(PRECACHE_ASSETS);

      // Cache manifest assets individually so one failure doesn't block others
      const results = await Promise.allSettled(
        manifest.assets.map(async (asset) => {
          const assetResponse = await fetch(asset.url);
          if (assetResponse.ok) {
            await cache.put(asset.url, assetResponse);
          }
        }),
      );

      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        console.warn(`Precache: ${failed}/${results.length} assets failed`);
      }
    } else {
      // Fallback: no manifest available, just cache base assets
      const cache = await caches.open(CACHE_NAME);
      await cache.addAll(PRECACHE_ASSETS);
    }
  } catch {
    // Fallback on any error
    const cache = await caches.open(CACHE_NAME);
    await cache.addAll(PRECACHE_ASSETS);
  }
}

sw.addEventListener("install", (event) => {
  console.debug("Service worker installing...");
  event.waitUntil(loadManifestAndPrecache().then(() => sw.skipWaiting()));
});

sw.addEventListener("activate", (event) => {
  console.debug("Service worker activating...");
  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((name) => {
            // Only delete old versioned caches that use our prefix
            if (
              (name.startsWith(CACHE_NAME_PREFIX) || name.startsWith("spike-land-offline-")) &&
              name !== CACHE_NAME
            ) {
              return caches.delete(name);
            }
            return undefined;
          }),
        );
      })
      .then(() => sw.clients.claim()),
  );
});

async function notifyClientsOffline(): Promise<void> {
  const allClients = await sw.clients.matchAll({ type: "window" });
  for (const client of allClients) {
    client.postMessage({ type: "OFFLINE_MODE" });
  }
}

sw.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // Skip non-GET requests or browser extensions or API calls/websocket connections
  if (
    request.method !== "GET" ||
    url.protocol.startsWith("chrome-extension") ||
    url.pathname.startsWith("/api/") ||
    url.protocol === "ws:" ||
    url.protocol === "wss:"
  ) {
    return;
  }

  // Determine if we should cache this request
  const isCachedOrigin = CACHED_ORIGINS.some((domain) => url.hostname.includes(domain));
  const isCachedExtension = CACHED_EXTENSIONS.some((ext) => url.pathname.endsWith(ext));

  // Only cache GET requests from our origin if they look like static assets or are in PRECACHE
  const isLocalAsset =
    url.origin === sw.location.origin &&
    (url.pathname.startsWith("/assets/") ||
      url.pathname.startsWith("/@fs/") ||
      url.pathname.includes("/workers/") ||
      isCachedExtension ||
      PRECACHE_ASSETS.includes(url.pathname));

  // Explicitly check for Monaco, ATA, and esbuild
  // ATA often uses unpkg.com/typescript or unpkg.com/@types
  const isMonacoOrAtaOrEsbuild =
    url.pathname.includes("monaco") ||
    url.pathname.includes("ata") ||
    url.pathname.includes("typescript") ||
    url.pathname.includes("esbuild") ||
    url.hostname === "unpkg.com" ||
    url.hostname === "esm.spike.land";

  const shouldCache = isCachedOrigin || isCachedExtension || isLocalAsset || isMonacoOrAtaOrEsbuild;

  if (shouldCache) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          // Stale-while-revalidate for most assets, Cache-first for immutable CDNs and wasm
          // wasm and CDN assets with versions are effectively immutable
          const isImmutable =
            isCachedOrigin || url.pathname.endsWith(".wasm") || url.pathname.includes("@");

          if (isImmutable) {
            return cachedResponse;
          } else {
            // Fetch in background to update cache for mutable assets
            event.waitUntil(
              fetch(request)
                .then((networkResponse) => {
                  if (networkResponse && networkResponse.status === 200) {
                    return caches
                      .open(CACHE_NAME)
                      .then((cache) => cache.put(request, networkResponse.clone()));
                  }
                  return undefined;
                })
                .catch(() => {}),
            );
            return cachedResponse;
          }
        }

        return fetch(request)
          .then((networkResponse) => {
            if (!networkResponse || networkResponse.status !== 200) {
              return networkResponse;
            }

            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });

            return networkResponse;
          })
          .catch((err) => {
            // If offline and request is for a page, notify clients and return cached index
            if (request.mode === "navigate") {
              event.waitUntil(notifyClientsOffline());
              return caches
                .match("/index.html")
                .then((r) => r ?? new Response("Offline", { status: 503 }));
            }
            console.warn("Fetch failed and no cache available for:", url.href, err);
            return new Response("Network error", { status: 503 });
          });
      }),
    );
  }
});
