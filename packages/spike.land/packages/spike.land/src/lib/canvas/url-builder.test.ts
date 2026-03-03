import { describe, expect, it } from "vitest";
import { buildCanvasUrl } from "./url-builder";

describe("buildCanvasUrl", () => {
  const BASE = "https://example.com";

  describe("base URL construction", () => {
    it("builds a URL with the given albumId", () => {
      const url = buildCanvasUrl("album-123", null, {}, BASE);
      expect(url).toContain("/canvas/album-123");
    });

    it("uses the provided baseUrl", () => {
      const url = buildCanvasUrl("abc", null, {}, "https://custom.host");
      expect(url.startsWith("https://custom.host")).toBe(true);
    });

    it("falls back to window.location.origin when no baseUrl is provided", () => {
      // In jsdom environment, window.location.origin defaults to "http://localhost:3000"
      const url = buildCanvasUrl("fallback-album", null, {});
      expect(url).toContain("/canvas/fallback-album");
      // Should start with a valid origin (jsdom sets http://localhost:3000)
      expect(url.startsWith("http://")).toBe(true);
    });
  });

  describe("shareToken parameter", () => {
    it("omits token param when shareToken is null", () => {
      const url = buildCanvasUrl("album-1", null, {}, BASE);
      expect(url).not.toContain("token=");
    });

    it("includes token param when shareToken is provided", () => {
      const url = buildCanvasUrl("album-1", "tok-abc", {}, BASE);
      expect(url).toContain("token=tok-abc");
    });
  });

  describe("rotation parameter", () => {
    it("omits rotation when it matches DEFAULT_ROTATION (0)", () => {
      const url = buildCanvasUrl("album-1", null, { rotation: 0 }, BASE);
      expect(url).not.toContain("rotation=");
    });

    it("includes rotation=90 when non-default", () => {
      const url = buildCanvasUrl("album-1", null, { rotation: 90 }, BASE);
      expect(url).toContain("rotation=90");
    });

    it("includes rotation=180 when non-default", () => {
      const url = buildCanvasUrl("album-1", null, { rotation: 180 }, BASE);
      expect(url).toContain("rotation=180");
    });

    it("includes rotation=270 when non-default", () => {
      const url = buildCanvasUrl("album-1", null, { rotation: 270 }, BASE);
      expect(url).toContain("rotation=270");
    });

    it("omits rotation when settings.rotation is undefined", () => {
      const url = buildCanvasUrl("album-1", null, {}, BASE);
      expect(url).not.toContain("rotation");
    });
  });

  describe("order parameter", () => {
    it("omits order when it matches DEFAULT_ORDER ('album')", () => {
      const url = buildCanvasUrl("album-1", null, { order: "album" }, BASE);
      expect(url).not.toContain("order=");
    });

    it("includes order=random when non-default", () => {
      const url = buildCanvasUrl("album-1", null, { order: "random" }, BASE);
      expect(url).toContain("order=random");
    });

    it("omits order when settings.order is undefined", () => {
      const url = buildCanvasUrl("album-1", null, {}, BASE);
      expect(url).not.toContain("order=");
    });
  });

  describe("interval parameter", () => {
    it("omits interval when it matches DEFAULT_INTERVAL (10)", () => {
      const url = buildCanvasUrl("album-1", null, { interval: 10 }, BASE);
      expect(url).not.toContain("interval=");
    });

    it("includes interval=5 when non-default", () => {
      const url = buildCanvasUrl("album-1", null, { interval: 5 }, BASE);
      expect(url).toContain("interval=5");
    });

    it("includes interval=30 when non-default", () => {
      const url = buildCanvasUrl("album-1", null, { interval: 30 }, BASE);
      expect(url).toContain("interval=30");
    });

    it("omits interval when settings.interval is undefined", () => {
      const url = buildCanvasUrl("album-1", null, {}, BASE);
      expect(url).not.toContain("interval=");
    });
  });

  describe("combined settings", () => {
    it("builds full URL with all non-default settings and token", () => {
      const url = buildCanvasUrl(
        "gallery-xyz",
        "share-tok",
        { rotation: 90, order: "random", interval: 5 },
        BASE,
      );
      expect(url).toContain("token=share-tok");
      expect(url).toContain("rotation=90");
      expect(url).toContain("order=random");
      expect(url).toContain("interval=5");
    });

    it("returns a valid URL string parseable by URL constructor", () => {
      const urlStr = buildCanvasUrl(
        "test-album",
        "tok-xyz",
        { rotation: 180, order: "random", interval: 15 },
        BASE,
      );
      expect(() => new URL(urlStr)).not.toThrow();
    });
  });
});
