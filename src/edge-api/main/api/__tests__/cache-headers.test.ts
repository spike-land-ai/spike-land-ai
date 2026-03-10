/// <reference types="@cloudflare/workers-types" />
import { describe, expect, it } from "vitest";
import {
  getSpaResponseCacheControl,
  getSpaShellStatusCode,
  getSpaStaticAssetEdgeCacheSettings,
  getSpaStaticAssetPolicy,
  isApiLikeSpaPath,
  isHtmlLikeResponse,
  isKnownSpaRoute,
  isStaticAssetKey,
  normalizeSpaAssetKey,
  resolveSpaFallbackKeys,
  shouldServeSpaShell,
} from "../routes/spa-route-logic.js";

describe("SPA cache headers", () => {
  it("normalizes pathnames into R2 object keys", () => {
    expect(normalizeSpaAssetKey("/")).toBe("index.html");
    expect(normalizeSpaAssetKey("/about")).toBe("about");
    expect(normalizeSpaAssetKey("assets/index.js")).toBe("assets/index.js");
  });

  it("derives static asset cache policy for hashed and unhashed assets", () => {
    expect(getSpaStaticAssetPolicy("spike-cache-worker.js")).toEqual({
      cacheControl: "public, max-age=0, must-revalidate",
      immutable: false,
      ttl: 0,
      bypassEdgeCache: true,
    });
    expect(getSpaStaticAssetPolicy("service-worker/cache-policy.json")).toEqual({
      cacheControl: "public, max-age=0, must-revalidate",
      immutable: false,
      ttl: 0,
      bypassEdgeCache: true,
    });
    expect(getSpaStaticAssetPolicy("assets/index.12345678.js")).toEqual({
      cacheControl: "public, max-age=31536000, immutable",
      immutable: true,
      ttl: 31_536_000,
    });
    expect(getSpaStaticAssetPolicy("assets/index.js")).toEqual({
      cacheControl: "public, max-age=3600, stale-while-revalidate=3600",
      immutable: false,
      ttl: 3_600,
      swr: 3_600,
    });
    expect(getSpaStaticAssetPolicy("index.html")).toBeNull();
  });

  it("derives edge cache settings for static assets", () => {
    expect(
      getSpaStaticAssetEdgeCacheSettings(
        "https://spike.land/spike-cache-worker.js",
        "spike-cache-worker.js",
        "v42",
      ),
    ).toBeNull();
    expect(
      getSpaStaticAssetEdgeCacheSettings(
        "https://spike.land/assets/index.12345678.js",
        "assets/index.12345678.js",
        "v42",
      ),
    ).toEqual({
      cacheKey: "https://spike.land/assets/index.12345678.js?_cv=v42",
      immutable: true,
      ttl: 31_536_000,
    });
    expect(
      getSpaStaticAssetEdgeCacheSettings("https://spike.land/about", "index.html", "v42"),
    ).toBeNull();
  });

  it("resolves prerender fallback keys from SPA paths", () => {
    expect(resolveSpaFallbackKeys("/blog")).toEqual(["blog.html", "blog/index.html"]);
    expect(resolveSpaFallbackKeys("/docs/")).toEqual(["docs/index.html"]);
    expect(resolveSpaFallbackKeys("/")).toEqual([]);
  });

  it("classifies known routes and API-like paths", () => {
    expect(isKnownSpaRoute("/")).toBe(true);
    expect(isKnownSpaRoute("/pricing")).toBe(true);
    expect(isKnownSpaRoute("/apps/demo")).toBe(true);
    expect(isKnownSpaRoute("/unknown-route")).toBe(false);
    expect(isApiLikeSpaPath("/api/health")).toBe(true);
    expect(isApiLikeSpaPath("/mcp/tools")).toBe(true);
    expect(isApiLikeSpaPath("/pricing")).toBe(false);
  });

  it("decides when the SPA shell is allowed to serve and what status it gets", () => {
    expect(shouldServeSpaShell("/pricing")).toBe(true);
    expect(shouldServeSpaShell("/mcp/authorize")).toBe(true);
    expect(shouldServeSpaShell("/api/unknown")).toBe(false);
    expect(shouldServeSpaShell("/mcp/tools")).toBe(false);
    expect(getSpaShellStatusCode("/settings")).toBe(200);
    expect(getSpaShellStatusCode("/unknown-route")).toBe(404);
  });

  it("derives direct response cache-control and HTML detection", () => {
    expect(isStaticAssetKey("assets/index.js")).toBe(true);
    expect(isStaticAssetKey("index.html")).toBe(false);
    expect(isHtmlLikeResponse("index.html", "application/octet-stream")).toBe(true);
    expect(isHtmlLikeResponse("blog.html", "application/octet-stream")).toBe(true);
    expect(isHtmlLikeResponse("assets/index.js", "text/html; charset=utf-8")).toBe(true);
    expect(isHtmlLikeResponse("assets/index.js", "application/javascript")).toBe(false);
    expect(getSpaResponseCacheControl(true)).toBe("private, no-cache, no-store, must-revalidate");
    expect(getSpaResponseCacheControl(false)).toBe("public, max-age=3600");
  });
});
