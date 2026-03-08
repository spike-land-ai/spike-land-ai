import { describe, expect, it } from "vitest";

import {
  createMonacoThemeData,
  createThemeColors,
} from "../../../src/frontend/platform-frontend/editor/monaco-cover/theme";

const lightTokens = {
  background: "#f9fafb",
  foreground: "#111827",
  card: "#ffffff",
  muted: "#f3f4f6",
  mutedForeground: "#4b5563",
  border: "#e5e7eb",
  input: "#d1d5db",
  primary: "#2563eb",
  primaryLight: "#60a5fa",
  accentForeground: "#1e40af",
  destructiveForeground: "#dc2626",
};

const darkTokens = {
  background: "#0a0c14",
  foreground: "#e2e8f0",
  card: "#0d1323cc",
  muted: "#ffffff14",
  mutedForeground: "#94a3b8",
  border: "#ffffff1a",
  input: "#ffffff1f",
  primary: "#ffb800",
  primaryLight: "#fcd34d",
  accentForeground: "#a3b8fc",
  destructiveForeground: "#fca5a5",
};

describe("platform Monaco theme", () => {
  it("maps light design tokens into the cover palette", () => {
    const theme = createThemeColors(lightTokens, false);

    expect(theme.background).toBe("#f9fafb");
    expect(theme.foreground).toBe("#111827");
    expect(theme.activeLineNumber).toBe("#111827");
    expect(theme.tokenColors.keyword).toBe("#2563eb");
    expect(theme.tokenColors.string).toBe("#1e40af");
  });

  it("maps dark design tokens into the Monaco theme data", () => {
    const theme = createMonacoThemeData(darkTokens, true);

    expect(theme.base).toBe("vs-dark");
    expect(theme.colors["editor.background"]).toBe("#0a0c14");
    expect(theme.colors["editor.foreground"]).toBe("#e2e8f0");
    expect(theme.colors["editorSuggestWidget.background"]).toBe("#0d1323cc");
    expect(theme.rules).toContainEqual(
      expect.objectContaining({
        token: "keyword",
        foreground: "ffb800",
        fontStyle: "bold",
      }),
    );
  });
});
