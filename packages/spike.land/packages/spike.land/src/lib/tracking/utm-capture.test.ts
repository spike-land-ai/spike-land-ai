import { describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
  cookies: vi.fn(),
}));

vi.mock("@/lib/try-catch", () => ({
  tryCatchSync: vi.fn((fn: () => unknown) => {
    try {
      return { data: fn(), error: null };
    } catch (e) {
      return { data: null, error: e };
    }
  }),
}));

const { captureUTMParams, getPlatformFromUTM } = await import("./utm-capture");

describe("captureUTMParams", () => {
  it("extracts all UTM params from URL", () => {
    const url = new URL(
      "https://spike.land?utm_source=google&utm_medium=cpc&utm_campaign=summer&utm_term=shoes&utm_content=ad1",
    );
    const params = captureUTMParams(url);
    expect(params).toEqual({
      utm_source: "google",
      utm_medium: "cpc",
      utm_campaign: "summer",
      utm_term: "shoes",
      utm_content: "ad1",
    });
  });

  it("extracts gclid", () => {
    const url = new URL("https://spike.land?gclid=abc123");
    const params = captureUTMParams(url);
    expect(params.gclid).toBe("abc123");
  });

  it("extracts fbclid", () => {
    const url = new URL("https://spike.land?fbclid=xyz789");
    const params = captureUTMParams(url);
    expect(params.fbclid).toBe("xyz789");
  });

  it("returns empty object for URL without UTM params", () => {
    const url = new URL("https://spike.land/page");
    const params = captureUTMParams(url);
    expect(Object.keys(params)).toHaveLength(0);
  });

  it("ignores non-UTM params", () => {
    const url = new URL("https://spike.land?foo=bar&utm_source=test");
    const params = captureUTMParams(url);
    expect(params).toEqual({ utm_source: "test" });
    expect((params as Record<string, unknown>).foo).toBeUndefined();
  });
});

describe("getPlatformFromUTM", () => {
  it("returns GOOGLE_ADS for gclid", () => {
    expect(getPlatformFromUTM({ gclid: "abc" })).toBe("GOOGLE_ADS");
  });

  it("returns FACEBOOK for fbclid", () => {
    expect(getPlatformFromUTM({ fbclid: "abc" })).toBe("FACEBOOK");
  });

  it("prioritizes gclid over fbclid", () => {
    expect(getPlatformFromUTM({ gclid: "a", fbclid: "b" })).toBe("GOOGLE_ADS");
  });

  it("returns GOOGLE_ADS for google utm_source", () => {
    expect(getPlatformFromUTM({ utm_source: "google" })).toBe("GOOGLE_ADS");
    expect(getPlatformFromUTM({ utm_source: "gads" })).toBe("GOOGLE_ADS");
  });

  it("returns FACEBOOK for facebook utm_source", () => {
    expect(getPlatformFromUTM({ utm_source: "facebook" })).toBe("FACEBOOK");
    expect(getPlatformFromUTM({ utm_source: "fb" })).toBe("FACEBOOK");
    expect(getPlatformFromUTM({ utm_source: "instagram" })).toBe("FACEBOOK");
    expect(getPlatformFromUTM({ utm_source: "meta" })).toBe("FACEBOOK");
  });

  it("returns OTHER for unknown utm_source", () => {
    expect(getPlatformFromUTM({ utm_source: "twitter" })).toBe("OTHER");
    expect(getPlatformFromUTM({ utm_source: "newsletter" })).toBe("OTHER");
  });

  it("returns DIRECT for no params", () => {
    expect(getPlatformFromUTM({})).toBe("DIRECT");
  });

  it("is case insensitive for source matching", () => {
    expect(getPlatformFromUTM({ utm_source: "GOOGLE" })).toBe("GOOGLE_ADS");
    expect(getPlatformFromUTM({ utm_source: "Facebook" })).toBe("FACEBOOK");
  });
});
