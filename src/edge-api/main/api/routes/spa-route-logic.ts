const IMMUTABLE_EXTENSIONS = new Set([".js", ".css", ".wasm", ".woff2", ".woff", ".ttf"]);
const EXACT_SPA_ROUTES = new Set([
  "/",
  "/about",
  "/analytics",
  "/build",
  "/callback",
  "/cockpit",
  "/dashboard",
  "/learn",
  "/login",
  "/mcp",
  "/mcp/authorize",
  "/migrate",
  "/packages",
  "/packages/new",
  "/packages/qa-studio/ui",
  "/pricing",
  "/privacy",
  "/security",
  "/settings",
  "/store",
  "/terms",
  "/tools",
  "/version",
  "/vibe-code",
  "/what-we-do",
  "/bazdmeg",
  "/agency/portfolio",
]);
const PREFIXED_SPA_ROUTES = [
  "/apps",
  "/blog",
  "/bugbook",
  "/dashboard",
  "/docs",
  "/learn",
  "/messages",
  "/packages",
];
const API_PREFIXES = ["/oauth/", "/api/"];
const CONTROL_PLANE_ASSET_KEYS = new Set([
  "spike-cache-worker.js",
  "service-worker/cache-policy.json",
  "manifest.webmanifest",
  "site.webmanifest",
  "about.txt",
]);

const HTML_RESPONSE_CACHE_CONTROL = "private, no-cache, no-store, must-revalidate";
const DIRECT_ASSET_CACHE_CONTROL = "public, max-age=3600";
const IMMUTABLE_ASSET_CACHE_CONTROL = "public, max-age=31536000, immutable";
const REVALIDATING_ASSET_CACHE_CONTROL = "public, max-age=3600, stale-while-revalidate=3600";
const CONTROL_PLANE_ASSET_CACHE_CONTROL = "public, max-age=0, must-revalidate";

export interface SpaStaticAssetPolicy {
  cacheControl: string;
  immutable: boolean;
  ttl: number;
  swr?: number;
  bypassEdgeCache?: boolean;
}

export interface SpaStaticAssetEdgeCacheSettings {
  cacheKey: string;
  immutable: boolean;
  ttl: number;
  swr?: number;
}

export function isHashedAssetKey(path: string): boolean {
  return /\.[a-f0-9]{8,}\.\w+$/.test(path);
}

export function normalizeSpaAssetKey(pathname: string): string {
  const key = pathname.startsWith("/") ? pathname.slice(1) : pathname;
  return key || "index.html";
}

export function isStaticAssetKey(key: string): boolean {
  return key.includes(".") && key !== "index.html";
}

export function getSpaStaticAssetPolicy(key: string): SpaStaticAssetPolicy | null {
  if (!isStaticAssetKey(key)) {
    return null;
  }

  if (CONTROL_PLANE_ASSET_KEYS.has(key)) {
    return {
      cacheControl: CONTROL_PLANE_ASSET_CACHE_CONTROL,
      immutable: false,
      ttl: 0,
      bypassEdgeCache: true,
    };
  }

  const extension = key.slice(key.lastIndexOf("."));
  const immutable = IMMUTABLE_EXTENSIONS.has(extension) && isHashedAssetKey(key);
  if (immutable) {
    return {
      cacheControl: IMMUTABLE_ASSET_CACHE_CONTROL,
      immutable: true,
      ttl: 31_536_000,
    };
  }

  return {
    cacheControl: REVALIDATING_ASSET_CACHE_CONTROL,
    immutable: false,
    ttl: 3_600,
    swr: 3_600,
  };
}

export function getSpaStaticAssetEdgeCacheSettings(
  requestUrl: string,
  key: string,
  cacheVersion: string,
): SpaStaticAssetEdgeCacheSettings | null {
  const policy = getSpaStaticAssetPolicy(key);
  if (!policy || policy.bypassEdgeCache) {
    return null;
  }

  return {
    cacheKey: `${requestUrl}?_cv=${cacheVersion}`,
    immutable: policy.immutable,
    ttl: policy.ttl,
    ...(policy.swr === undefined ? {} : { swr: policy.swr }),
  };
}

export function resolveSpaFallbackKeys(pathname: string): string[] {
  const key = normalizeSpaAssetKey(pathname);
  if (key === "index.html") {
    return [];
  }

  const fallbackKeys = [key.endsWith("/") ? `${key}index.html` : `${key}.html`];
  if (!key.endsWith("/")) {
    fallbackKeys.push(`${key}/index.html`);
  }
  return fallbackKeys;
}

export function isKnownSpaRoute(path: string): boolean {
  return (
    EXACT_SPA_ROUTES.has(path) ||
    PREFIXED_SPA_ROUTES.some((prefix) => path.startsWith(`${prefix}/`))
  );
}

export function isApiLikeSpaPath(path: string): boolean {
  return path.startsWith("/mcp/") || API_PREFIXES.some((prefix) => path.startsWith(prefix));
}

export function shouldServeSpaShell(path: string): boolean {
  return !isApiLikeSpaPath(path) || isKnownSpaRoute(path);
}

export function getSpaShellStatusCode(path: string): 200 | 404 {
  return isKnownSpaRoute(path) ? 200 : 404;
}

export function isHtmlLikeResponse(key: string, contentType: string): boolean {
  return key === "index.html" || key.endsWith(".html") || contentType.includes("text/html");
}

export function getSpaResponseCacheControl(isHtmlResponse: boolean): string {
  return isHtmlResponse ? HTML_RESPONSE_CACHE_CONTROL : DIRECT_ASSET_CACHE_CONTROL;
}
