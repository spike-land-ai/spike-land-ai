import { describe, expect, it } from "vitest";

import { createSpikeLandMonacoTheme } from "../../../src/frontend/monaco-editor/editor/theme-palette";

function createStyleReader(tokens: Record<string, string>) {
  return {
    getPropertyValue(token: string) {
      return tokens[token] ?? "";
    },
  };
}

describe("createSpikeLandMonacoTheme", () => {
  it("maps light theme tokens into a Monaco light palette", () => {
    const theme = createSpikeLandMonacoTheme(
      createStyleReader({
        "--background": "0 0% 100%",
        "--foreground": "0 0% 0%",
        "--card": "0 0% 96%",
        "--popover": "0 0% 97%",
        "--primary": "0 100% 50%",
        "--accent": "120 100% 50%",
        "--muted": "0 0% 92%",
        "--muted-foreground": "0 0% 50%",
        "--border": "0 0% 85%",
        "--input": "0 0% 90%",
        "--destructive": "0 100% 35%",
      }) as Pick<CSSStyleDeclaration, "getPropertyValue">,
    );

    expect(theme.base).toBe("vs");
    expect(theme.colors["editor.background"]).toBe("#ffffff");
    expect(theme.colors["editor.foreground"]).toBe("#000000");
    expect(theme.colors["editorCursor.foreground"]).toBe("#00ff00");
    expect(theme.rules).toContainEqual(
      expect.objectContaining({
        token: "keyword",
        foreground: "ff0000",
        fontStyle: "bold",
      }),
    );
    expect(theme.rules).toContainEqual(
      expect.objectContaining({
        token: "string",
        foreground: "00ff00",
      }),
    );
  });

  it("switches to a Monaco dark base when the background token is dark", () => {
    const theme = createSpikeLandMonacoTheme(
      createStyleReader({
        "--background": "0 0% 4%",
        "--foreground": "0 0% 100%",
        "--card": "0 0% 8%",
        "--popover": "0 0% 6%",
        "--primary": "220 100% 60%",
        "--accent": "180 100% 50%",
        "--muted": "0 0% 12%",
        "--muted-foreground": "0 0% 65%",
        "--border": "0 0% 20%",
        "--input": "0 0% 18%",
        "--destructive": "0 100% 60%",
      }) as Pick<CSSStyleDeclaration, "getPropertyValue">,
    );

    expect(theme.base).toBe("vs-dark");
    expect(theme.colors["editor.background"]).toBe("#0a0a0a");
    expect(theme.colors["editor.foreground"]).toBe("#ffffff");
    expect(theme.colors["editor.lineHighlightBackground"]).toMatch(/^#1f1f1f/i);
  });
});
