import type { editor as MonacoEditor } from "monaco-editor";

export interface MonacoThemeColors {
  background: string;
  foreground: string;
  lineNumber: string;
  activeLineNumber: string;
  lineHighlight: string;
  selection: string;
  tokenColors: Record<string, string>;
}

export interface MonacoLayoutConstants {
  fontSize: number;
  lineHeight: number;
  fontFamily: string;
  paddingTop: number;
  paddingBottom: number;
  tabSize: number;
  lineNumberMinWidth: number;
  lineNumberRightPadding: number;
  contentLeftPadding: number;
}

export const SPIKE_PLATFORM_MONACO_THEME = "spike-platform";

interface PlatformThemeTokens {
  background: string;
  foreground: string;
  card: string;
  muted: string;
  mutedForeground: string;
  border: string;
  input: string;
  primary: string;
  primaryLight: string;
  accentBackground: string;
  accentForeground: string;
  destructiveForeground: string;
}

type ColorProperty = "backgroundColor" | "color" | "borderTopColor";

interface ThemeTokenConfig {
  cssVar: string;
  property: ColorProperty;
  light: string;
  dark: string;
}

type ThemeTokenName = keyof PlatformThemeTokens;

const TOKEN_CONFIG: Record<ThemeTokenName, ThemeTokenConfig> = {
  background: {
    cssVar: "--bg",
    property: "backgroundColor",
    light: "#f9fafb",
    dark: "#0a0c14",
  },
  foreground: {
    cssVar: "--fg",
    property: "color",
    light: "#111827",
    dark: "#e2e8f0",
  },
  card: {
    cssVar: "--card-bg",
    property: "backgroundColor",
    light: "#ffffff",
    dark: "#0d1323cc",
  },
  muted: {
    cssVar: "--muted-bg",
    property: "backgroundColor",
    light: "#f3f4f6",
    dark: "#ffffff14",
  },
  mutedForeground: {
    cssVar: "--muted-fg",
    property: "color",
    light: "#4b5563",
    dark: "#94a3b8",
  },
  border: {
    cssVar: "--border-color",
    property: "borderTopColor",
    light: "#e5e7eb",
    dark: "#ffffff1a",
  },
  input: {
    cssVar: "--input-color",
    property: "borderTopColor",
    light: "#d1d5db",
    dark: "#ffffff1f",
  },
  primary: {
    cssVar: "--primary-color",
    property: "color",
    light: "#2563eb",
    dark: "#ffb800",
  },
  primaryLight: {
    cssVar: "--primary-light",
    property: "color",
    light: "#60a5fa",
    dark: "#fcd34d",
  },
  accentBackground: {
    cssVar: "--accent-bg",
    property: "backgroundColor",
    light: "#f0f9ff",
    dark: "#101321",
  },
  accentForeground: {
    cssVar: "--accent-fg",
    property: "color",
    light: "#1e40af",
    dark: "#a3b8fc",
  },
  destructiveForeground: {
    cssVar: "--destructive-fg",
    property: "color",
    light: "#dc2626",
    dark: "#fca5a5",
  },
};

export const LAYOUT: MonacoLayoutConstants = {
  fontSize: 14,
  lineHeight: 22,
  fontFamily: '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
  paddingTop: 12,
  paddingBottom: 12,
  tabSize: 2,
  lineNumberMinWidth: 36,
  lineNumberRightPadding: 16,
  contentLeftPadding: 16,
};

const CHAR_WIDTH = 8.4;
const GUTTER_PADDING = 20;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function toHexChannel(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function rgbaToHex(red: number, green: number, blue: number, alpha = 1): string {
  const alphaChannel = alpha < 1 ? toHexChannel(alpha * 255) : "";
  return `#${toHexChannel(red)}${toHexChannel(green)}${toHexChannel(blue)}${alphaChannel}`;
}

function normalizeHex(hex: string, fallback: string): string {
  const cleaned = hex.trim().replace(/^#/, "");

  if (cleaned.length === 3) {
    const [r, g, b] = cleaned;
    return `#${r}${r}${g}${g}${b}${b}`;
  }

  if (cleaned.length === 4) {
    const [r, g, b, a] = cleaned;
    return `#${r}${r}${g}${g}${b}${b}${a}${a}`;
  }

  if (cleaned.length === 6 || cleaned.length === 8) {
    return `#${cleaned.toLowerCase()}`;
  }

  return fallback;
}

function normalizeColor(value: string, fallback: string): string {
  const trimmed = value.trim();
  if (!trimmed) return fallback;

  if (trimmed.startsWith("#")) {
    return normalizeHex(trimmed, fallback);
  }

  const rgbMatch = trimmed.match(/^rgba?\(([^)]+)\)$/i);
  if (!rgbMatch) {
    return fallback;
  }

  const [red = 0, green = 0, blue = 0, alpha = "1"] = rgbMatch[1]!
    .split(",")
    .map((part) => part.trim());

  return rgbaToHex(Number(red), Number(green), Number(blue), Number(alpha));
}

function hexToRgb(hex: string): { r: number; g: number; b: number } {
  const normalized = normalizeHex(hex, "#000000").replace(/^#/, "");
  const value = normalized.slice(0, 6);

  return {
    r: Number.parseInt(value.slice(0, 2), 16),
    g: Number.parseInt(value.slice(2, 4), 16),
    b: Number.parseInt(value.slice(4, 6), 16),
  };
}

function withAlpha(hex: string, alpha: number): string {
  const { r, g, b } = hexToRgb(hex);
  return rgbaToHex(r, g, b, alpha);
}

function fallbackTokens(isDark: boolean): PlatformThemeTokens {
  return {
    background: isDark ? TOKEN_CONFIG.background.dark : TOKEN_CONFIG.background.light,
    foreground: isDark ? TOKEN_CONFIG.foreground.dark : TOKEN_CONFIG.foreground.light,
    card: isDark ? TOKEN_CONFIG.card.dark : TOKEN_CONFIG.card.light,
    muted: isDark ? TOKEN_CONFIG.muted.dark : TOKEN_CONFIG.muted.light,
    mutedForeground: isDark ? TOKEN_CONFIG.mutedForeground.dark : TOKEN_CONFIG.mutedForeground.light,
    border: isDark ? TOKEN_CONFIG.border.dark : TOKEN_CONFIG.border.light,
    input: isDark ? TOKEN_CONFIG.input.dark : TOKEN_CONFIG.input.light,
    primary: isDark ? TOKEN_CONFIG.primary.dark : TOKEN_CONFIG.primary.light,
    primaryLight: isDark ? TOKEN_CONFIG.primaryLight.dark : TOKEN_CONFIG.primaryLight.light,
    accentBackground: isDark
      ? TOKEN_CONFIG.accentBackground.dark
      : TOKEN_CONFIG.accentBackground.light,
    accentForeground: isDark
      ? TOKEN_CONFIG.accentForeground.dark
      : TOKEN_CONFIG.accentForeground.light,
    destructiveForeground: isDark
      ? TOKEN_CONFIG.destructiveForeground.dark
      : TOKEN_CONFIG.destructiveForeground.light,
  };
}

function resolveCssVarColor(config: ThemeTokenConfig, fallback: string): string {
  if (typeof document === "undefined") {
    return fallback;
  }

  const probe = document.createElement("div");
  probe.style.position = "absolute";
  probe.style.pointerEvents = "none";
  probe.style.opacity = "0";
  probe.style.inset = "0";
  probe.style.setProperty(config.property, `var(${config.cssVar})`);

  document.body.appendChild(probe);
  const computed = getComputedStyle(probe)[config.property];
  probe.remove();

  return normalizeColor(computed, fallback);
}

function readThemeTokens(isDark: boolean): PlatformThemeTokens {
  const defaults = fallbackTokens(isDark);

  return {
    background: resolveCssVarColor(TOKEN_CONFIG.background, defaults.background),
    foreground: resolveCssVarColor(TOKEN_CONFIG.foreground, defaults.foreground),
    card: resolveCssVarColor(TOKEN_CONFIG.card, defaults.card),
    muted: resolveCssVarColor(TOKEN_CONFIG.muted, defaults.muted),
    mutedForeground: resolveCssVarColor(TOKEN_CONFIG.mutedForeground, defaults.mutedForeground),
    border: resolveCssVarColor(TOKEN_CONFIG.border, defaults.border),
    input: resolveCssVarColor(TOKEN_CONFIG.input, defaults.input),
    primary: resolveCssVarColor(TOKEN_CONFIG.primary, defaults.primary),
    primaryLight: resolveCssVarColor(TOKEN_CONFIG.primaryLight, defaults.primaryLight),
    accentBackground: resolveCssVarColor(TOKEN_CONFIG.accentBackground, defaults.accentBackground),
    accentForeground: resolveCssVarColor(TOKEN_CONFIG.accentForeground, defaults.accentForeground),
    destructiveForeground: resolveCssVarColor(
      TOKEN_CONFIG.destructiveForeground,
      defaults.destructiveForeground,
    ),
  };
}

export function createThemeColors(tokens: PlatformThemeTokens, isDark: boolean): MonacoThemeColors {
  return {
    background: tokens.background,
    foreground: tokens.foreground,
    lineNumber: withAlpha(tokens.mutedForeground, isDark ? 0.75 : 0.9),
    activeLineNumber: tokens.foreground,
    lineHighlight: withAlpha(tokens.muted, isDark ? 0.5 : 0.85),
    selection: withAlpha(tokens.primary, isDark ? 0.24 : 0.18),
    tokenColors: {
      keyword: tokens.primary,
      "keyword.flow": tokens.primaryLight,
      string: tokens.accentForeground,
      "string.escape": tokens.primaryLight,
      number: tokens.primaryLight,
      "number.float": tokens.primaryLight,
      "number.hex": tokens.primary,
      comment: tokens.mutedForeground,
      "comment.doc": tokens.mutedForeground,
      type: tokens.accentForeground,
      "type.identifier": tokens.accentForeground,
      variable: tokens.foreground,
      "variable.parameter": tokens.primaryLight,
      identifier: tokens.foreground,
      function: tokens.primary,
      delimiter: withAlpha(tokens.foreground, isDark ? 0.8 : 0.9),
      "delimiter.bracket": withAlpha(tokens.foreground, isDark ? 0.8 : 0.9),
      bracket: withAlpha(tokens.foreground, isDark ? 0.85 : 0.95),
      regexp: tokens.primaryLight,
      annotation: tokens.destructiveForeground,
      tag: tokens.primary,
      "attribute.name": tokens.accentForeground,
      "attribute.value": tokens.foreground,
      invalid: tokens.destructiveForeground,
      "meta.tag": tokens.primary,
    },
  };
}

export function createMonacoThemeData(
  tokens: PlatformThemeTokens,
  isDark: boolean,
): MonacoEditor.IStandaloneThemeData {
  const coverTheme = createThemeColors(tokens, isDark);

  return {
    base: isDark ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "", foreground: tokens.foreground.replace(/^#/, ""), background: tokens.background.replace(/^#/, "") },
      { token: "comment", foreground: tokens.mutedForeground.replace(/^#/, ""), fontStyle: "italic" },
      { token: "keyword", foreground: tokens.primary.replace(/^#/, ""), fontStyle: "bold" },
      { token: "operator", foreground: tokens.primary.replace(/^#/, "") },
      { token: "type", foreground: tokens.accentForeground.replace(/^#/, "") },
      { token: "type.identifier", foreground: tokens.accentForeground.replace(/^#/, "") },
      { token: "class", foreground: tokens.accentForeground.replace(/^#/, ""), fontStyle: "bold" },
      { token: "identifier.function", foreground: tokens.primary.replace(/^#/, ""), fontStyle: "bold" },
      { token: "function", foreground: tokens.primary.replace(/^#/, "") },
      { token: "string", foreground: tokens.accentForeground.replace(/^#/, "") },
      { token: "number", foreground: tokens.primaryLight.replace(/^#/, "") },
      { token: "boolean", foreground: tokens.primary.replace(/^#/, ""), fontStyle: "bold" },
      { token: "tag", foreground: tokens.primary.replace(/^#/, "") },
      { token: "attribute.name", foreground: tokens.accentForeground.replace(/^#/, "") },
      { token: "attribute.value", foreground: tokens.foreground.replace(/^#/, "") },
      { token: "variable", foreground: tokens.foreground.replace(/^#/, "") },
      { token: "identifier", foreground: tokens.foreground.replace(/^#/, "") },
      { token: "invalid", foreground: tokens.destructiveForeground.replace(/^#/, ""), fontStyle: "underline" },
    ],
    colors: {
      "editor.background": tokens.background,
      "editor.foreground": tokens.foreground,
      "editorCursor.foreground": tokens.primary,
      "editor.selectionBackground": coverTheme.selection,
      "editor.inactiveSelectionBackground": withAlpha(tokens.primary, isDark ? 0.16 : 0.1),
      "editor.selectionHighlightBackground": withAlpha(tokens.primaryLight, isDark ? 0.16 : 0.08),
      "editor.wordHighlightBackground": withAlpha(tokens.primaryLight, isDark ? 0.12 : 0.08),
      "editor.wordHighlightStrongBackground": withAlpha(tokens.primary, isDark ? 0.16 : 0.1),
      "editor.lineHighlightBackground": coverTheme.lineHighlight,
      "editor.lineHighlightBorder": withAlpha(tokens.border, isDark ? 0.65 : 0.9),
      "editorLineNumber.foreground": coverTheme.lineNumber,
      "editorLineNumber.activeForeground": coverTheme.activeLineNumber,
      "editorGutter.background": tokens.background,
      "editorIndentGuide.background1": withAlpha(tokens.border, isDark ? 0.35 : 0.5),
      "editorIndentGuide.activeBackground1": withAlpha(tokens.primaryLight, isDark ? 0.45 : 0.3),
      "editorWhitespace.foreground": withAlpha(tokens.border, isDark ? 0.35 : 0.45),
      "editorBracketMatch.border": tokens.primaryLight,
      "editorBracketMatch.background": withAlpha(tokens.primaryLight, isDark ? 0.14 : 0.08),
      "editorHoverWidget.background": tokens.card,
      "editorHoverWidget.border": tokens.border,
      "editorWidget.background": tokens.card,
      "editorWidget.border": tokens.border,
      "editorSuggestWidget.background": tokens.card,
      "editorSuggestWidget.border": tokens.border,
      "editorSuggestWidget.foreground": tokens.foreground,
      "editorSuggestWidget.selectedBackground": withAlpha(tokens.primary, isDark ? 0.14 : 0.08),
      "editorSuggestWidget.highlightForeground": tokens.primary,
      "editorSuggestWidget.focusHighlightForeground": tokens.primaryLight,
      "editorSuggestWidgetStatus.foreground": tokens.mutedForeground,
      "editor.findMatchBackground": withAlpha(tokens.primaryLight, isDark ? 0.18 : 0.12),
      "editor.findMatchBorder": tokens.primaryLight,
      "editor.findMatchHighlightBackground": withAlpha(tokens.primary, isDark ? 0.14 : 0.08),
      "editor.findRangeHighlightBackground": withAlpha(tokens.muted, isDark ? 0.4 : 0.6),
      "editorRangeHighlightBackground": withAlpha(tokens.muted, isDark ? 0.3 : 0.2),
      "editorLink.activeForeground": tokens.primary,
      "editorInfo.foreground": tokens.accentForeground,
      "editorWarning.foreground": tokens.primaryLight,
      "editorError.foreground": tokens.destructiveForeground,
      "editorMarkerNavigation.background": tokens.card,
      "editorMarkerNavigationError.background": withAlpha(
        tokens.destructiveForeground,
        isDark ? 0.2 : 0.1,
      ),
      "editorMarkerNavigationWarning.background": withAlpha(
        tokens.primaryLight,
        isDark ? 0.2 : 0.1,
      ),
      "editorMarkerNavigationInfo.background": withAlpha(
        tokens.accentForeground,
        isDark ? 0.16 : 0.08,
      ),
      "input.background": tokens.card,
      "input.border": tokens.input,
      "input.foreground": tokens.foreground,
      "focusBorder": tokens.primary,
      "dropdown.background": tokens.card,
      "dropdown.border": tokens.border,
      "dropdown.foreground": tokens.foreground,
      "minimap.background": tokens.background,
      "minimap.selectionHighlight": withAlpha(tokens.primaryLight, isDark ? 0.18 : 0.12),
      "minimapSlider.background": withAlpha(tokens.border, isDark ? 0.3 : 0.2),
      "minimapSlider.hoverBackground": withAlpha(tokens.border, isDark ? 0.45 : 0.3),
      "minimapSlider.activeBackground": withAlpha(tokens.primary, isDark ? 0.4 : 0.24),
      "scrollbarSlider.background": withAlpha(tokens.border, isDark ? 0.3 : 0.2),
      "scrollbarSlider.hoverBackground": withAlpha(tokens.border, isDark ? 0.45 : 0.3),
      "scrollbarSlider.activeBackground": withAlpha(tokens.primary, isDark ? 0.4 : 0.24),
    },
  };
}

export function definePlatformMonacoTheme(
  monaco: Pick<MonacoEditor, "editor">,
  isDark: boolean,
): string {
  const tokens = readThemeTokens(isDark);
  monaco.editor.defineTheme(SPIKE_PLATFORM_MONACO_THEME, createMonacoThemeData(tokens, isDark));
  return SPIKE_PLATFORM_MONACO_THEME;
}

export function getTheme(isDark: boolean): MonacoThemeColors {
  return createThemeColors(readThemeTokens(isDark), isDark);
}

export function getGutterWidth(lineCount: number): number {
  const digits = Math.max(1, String(lineCount).length);
  return Math.ceil(digits * CHAR_WIDTH + GUTTER_PADDING);
}
