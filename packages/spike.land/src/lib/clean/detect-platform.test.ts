import { describe, expect, it } from "vitest";

import { detectPlatform, getCameraPermissionInstructions } from "./detect-platform";

describe("detectPlatform", () => {
  it("detects iOS Safari", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("ios-safari");
  });

  it("detects iPad Safari", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (iPad; CPU OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("ios-safari");
  });

  it("detects Android Chrome", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
      ),
    ).toBe("android-chrome");
  });

  it("detects desktop Chrome", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      ),
    ).toBe("desktop-chrome");
  });

  it("detects desktop Edge as desktop-chrome", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0",
      ),
    ).toBe("desktop-chrome");
  });

  it("detects desktop Firefox", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0",
      ),
    ).toBe("desktop-firefox");
  });

  it("detects desktop Safari", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15",
      ),
    ).toBe("desktop-safari");
  });

  it("returns 'other' for unknown user agents", () => {
    expect(detectPlatform("SomeBot/1.0")).toBe("other");
  });

  it("returns 'other' for empty string", () => {
    expect(detectPlatform("")).toBe("other");
  });

  it("detects iOS Chrome as ios-safari (all iOS browsers use WebKit)", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) CriOS/120.0.0.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("ios-safari");
  });

  it("detects iPod as ios-safari", () => {
    expect(
      detectPlatform(
        "Mozilla/5.0 (iPod touch; CPU iPhone OS 15_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/15.0 Mobile/15E148 Safari/604.1",
      ),
    ).toBe("ios-safari");
  });

  it("falls back to navigator.userAgent when no argument provided", () => {
    const result = detectPlatform();
    expect(typeof result).toBe("string");
    expect([
      "other",
      "desktop-chrome",
      "desktop-firefox",
      "desktop-safari",
      "ios-safari",
      "android-chrome",
    ]).toContain(result);
  });
});

describe("getCameraPermissionInstructions", () => {
  it("returns iOS Safari instructions", () => {
    const result = getCameraPermissionInstructions("ios-safari");
    expect(result).toContain("Settings");
    expect(result).toContain("Safari");
    expect(result).toContain("Camera");
  });

  it("returns Android Chrome instructions", () => {
    const result = getCameraPermissionInstructions("android-chrome");
    expect(result).toContain("lock icon");
    expect(result).toContain("Permissions");
  });

  it("returns desktop Chrome instructions", () => {
    const result = getCameraPermissionInstructions("desktop-chrome");
    expect(result).toContain("Site settings");
  });

  it("returns desktop Firefox instructions", () => {
    const result = getCameraPermissionInstructions("desktop-firefox");
    expect(result).toContain("More information");
    expect(result).toContain("Permissions");
  });

  it("returns desktop Safari instructions", () => {
    const result = getCameraPermissionInstructions("desktop-safari");
    expect(result).toContain("Websites");
  });

  it("returns generic instructions for other platforms", () => {
    const result = getCameraPermissionInstructions("other");
    expect(result).toContain("browser settings");
  });
});
