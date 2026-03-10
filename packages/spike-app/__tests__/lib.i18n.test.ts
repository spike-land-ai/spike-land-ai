import { describe, expect, it } from "vitest";
import { resolveSupportedLanguage } from "../../../src/frontend/platform-frontend/ui/i18n";

describe("resolveSupportedLanguage", () => {
  it("normalizes region-specific English locales", () => {
    expect(resolveSupportedLanguage("en-GB")).toBe("en");
  });

  it("normalizes region-specific Hungarian locales", () => {
    expect(resolveSupportedLanguage("hu-HU")).toBe("hu");
  });

  it("falls back to English for unsupported locales", () => {
    expect(resolveSupportedLanguage("fr-FR")).toBe("en");
    expect(resolveSupportedLanguage(undefined)).toBe("en");
  });
});
