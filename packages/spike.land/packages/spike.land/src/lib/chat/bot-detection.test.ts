import { describe, expect, it } from "vitest";
import { getScriptedResponse, isBot } from "./bot-detection";

describe("isBot", () => {
  it("returns false for null user agent", () => {
    expect(isBot(null)).toBe(false);
  });

  it("returns false for normal browser user agent", () => {
    expect(
      isBot(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0",
      ),
    ).toBe(false);
  });

  it("detects Googlebot", () => {
    expect(
      isBot(
        "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
      ),
    ).toBe(true);
  });

  it("detects Bingbot", () => {
    expect(
      isBot(
        "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)",
      ),
    ).toBe(true);
  });

  it("detects HeadlessChrome", () => {
    expect(isBot("Mozilla/5.0 HeadlessChrome/90.0")).toBe(true);
  });

  it("detects Puppeteer", () => {
    expect(isBot("Mozilla/5.0 Puppeteer")).toBe(true);
  });

  it("detects Playwright", () => {
    expect(isBot("Mozilla/5.0 Playwright/1.0")).toBe(true);
  });

  it("detects AhrefsBot", () => {
    expect(isBot("Mozilla/5.0 (compatible; AhrefsBot/7.0)")).toBe(true);
  });

  it("detects SemrushBot", () => {
    expect(isBot("Mozilla/5.0 (compatible; SemrushBot/7)")).toBe(true);
  });

  it("is case-insensitive", () => {
    expect(isBot("GOOGLEBOT")).toBe(true);
    expect(isBot("googleBot")).toBe(true);
  });
});

describe("getScriptedResponse", () => {
  it("returns BAZDMEG response for /bazdmeg route", () => {
    const response = getScriptedResponse("/bazdmeg");
    expect(response).toContain("BAZDMEG");
    expect(response).toContain("spike.land/bazdmeg");
  });

  it("returns BAZDMEG response for /bazdmeg/chat sub-route", () => {
    const response = getScriptedResponse("/bazdmeg/chat");
    expect(response).toContain("BAZDMEG");
  });

  it("returns create response for /create route", () => {
    const response = getScriptedResponse("/create");
    expect(response).toContain("code editor");
    expect(response).toContain("spike.land/create");
  });

  it("returns create response for /create sub-route", () => {
    const response = getScriptedResponse("/create/my-app");
    expect(response).toContain("spike.land/create");
  });

  it("returns default response for other routes", () => {
    const response = getScriptedResponse("/");
    expect(response).toContain("spike.land");
    expect(response).toContain("open-source");
  });

  it("returns default response for unknown routes", () => {
    const response = getScriptedResponse("/some-random-page");
    expect(response).toContain("spike.land");
  });
});
