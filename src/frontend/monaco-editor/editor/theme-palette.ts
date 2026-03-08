import type { editor as MonacoEditor } from "monaco-editor";

export const SPIKE_LAND_MONACO_THEME = "spike-land";

type ThemeToken =
  | "--background"
  | "--foreground"
  | "--card"
  | "--popover"
  | "--primary"
  | "--accent"
  | "--muted"
  | "--muted-foreground"
  | "--border"
  | "--input"
  | "--destructive";

export type StyleReader = Pick<CSSStyleDeclaration, "getPropertyValue">;

interface HslColor {
  h: number;
  s: number;
  l: number;
}

interface RgbColor {
  r: number;
  g: number;
  b: number;
}

interface ThemeColor {
  hsl: HslColor;
  hex: string;
  tokenHex: string;
  alpha: (opacity: number) => string;
}

const THEME_TOKENS: ThemeToken[] = [
  "--background",
  "--foreground",
  "--card",
  "--popover",
  "--primary",
  "--accent",
  "--muted",
  "--muted-foreground",
  "--border",
  "--input",
  "--destructive",
];

const DEFAULT_TOKENS: Record<ThemeToken, string> = {
  "--background": "224 71% 4%",
  "--foreground": "210 40% 98%",
  "--card": "222 47% 7%",
  "--popover": "224 71% 4%",
  "--primary": "263 70% 50%",
  "--accent": "187 100% 50%",
  "--muted": "222 47% 11%",
  "--muted-foreground": "215 20% 65%",
  "--border": "217 33% 17%",
  "--input": "217 33% 17%",
  "--destructive": "0 84% 60%",
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function parseHslTriplet(value: string, fallback: HslColor): HslColor {
  const parts = value.match(/-?\d*\.?\d+/g)?.slice(0, 3).map(Number);

  if (!parts || parts.length < 3 || parts.some((part) => Number.isNaN(part))) {
    return fallback;
  }

  const [h, s, l] = parts;

  return {
    h,
    s: clamp(s, 0, 100),
    l: clamp(l, 0, 100),
  };
}

function hslToRgb({ h, s, l }: HslColor): RgbColor {
  const saturation = s / 100;
  const lightness = l / 100;
  const chroma = (1 - Math.abs(2 * lightness - 1)) * saturation;
  const hueSection = ((h % 360) + 360) % 360 / 60;
  const match = chroma * (1 - Math.abs((hueSection % 2) - 1));

  let red = 0;
  let green = 0;
  let blue = 0;

  if (hueSection >= 0 && hueSection < 1) {
    red = chroma;
    green = match;
  } else if (hueSection < 2) {
    red = match;
    green = chroma;
  } else if (hueSection < 3) {
    green = chroma;
    blue = match;
  } else if (hueSection < 4) {
    green = match;
    blue = chroma;
  } else if (hueSection < 5) {
    red = match;
    blue = chroma;
  } else {
    red = chroma;
    blue = match;
  }

  const adjustment = lightness - chroma / 2;

  return {
    r: Math.round((red + adjustment) * 255),
    g: Math.round((green + adjustment) * 255),
    b: Math.round((blue + adjustment) * 255),
  };
}

function toHexChannel(value: number): string {
  return clamp(Math.round(value), 0, 255).toString(16).padStart(2, "0");
}

function rgbToHex(color: RgbColor, opacity = 1, includeHash = true): string {
  const prefix = includeHash ? "#" : "";
  const alpha = clamp(opacity, 0, 1);
  const alphaChannel = alpha < 1 ? toHexChannel(alpha * 255) : "";

  return `${prefix}${toHexChannel(color.r)}${toHexChannel(color.g)}${toHexChannel(color.b)}${alphaChannel}`;
}

function readThemeColor(styles: StyleReader, token: ThemeToken): ThemeColor {
  const fallback = parseHslTriplet(DEFAULT_TOKENS[token], { h: 0, s: 0, l: 0 });
  const hsl = parseHslTriplet(styles.getPropertyValue(token).trim(), fallback);
  const rgb = hslToRgb(hsl);

  return {
    hsl,
    hex: rgbToHex(rgb),
    tokenHex: rgbToHex(rgb, 1, false),
    alpha: (opacity: number) => rgbToHex(rgb, opacity),
  };
}

export function getSpikeLandThemeSignature(styles: StyleReader): string {
  return THEME_TOKENS.map((token) => styles.getPropertyValue(token).trim()).join("|");
}

export function createSpikeLandMonacoTheme(
  styles: StyleReader,
): MonacoEditor.IStandaloneThemeData {
  const background = readThemeColor(styles, "--background");
  const foreground = readThemeColor(styles, "--foreground");
  const card = readThemeColor(styles, "--card");
  const popover = readThemeColor(styles, "--popover");
  const primary = readThemeColor(styles, "--primary");
  const accent = readThemeColor(styles, "--accent");
  const muted = readThemeColor(styles, "--muted");
  const mutedForeground = readThemeColor(styles, "--muted-foreground");
  const border = readThemeColor(styles, "--border");
  const input = readThemeColor(styles, "--input");
  const destructive = readThemeColor(styles, "--destructive");
  const isDark = background.hsl.l < 50;

  return {
    base: isDark ? "vs-dark" : "vs",
    inherit: true,
    rules: [
      { token: "", foreground: foreground.tokenHex, background: background.tokenHex },
      { token: "comment", foreground: mutedForeground.tokenHex, fontStyle: "italic" },
      { token: "keyword", foreground: primary.tokenHex, fontStyle: "bold" },
      { token: "operator", foreground: primary.tokenHex },
      { token: "type", foreground: accent.tokenHex },
      { token: "type.identifier", foreground: accent.tokenHex },
      { token: "class", foreground: accent.tokenHex, fontStyle: "bold" },
      { token: "identifier.function", foreground: primary.tokenHex, fontStyle: "bold" },
      { token: "function", foreground: primary.tokenHex },
      { token: "string", foreground: accent.tokenHex },
      { token: "number", foreground: primary.tokenHex },
      { token: "boolean", foreground: primary.tokenHex, fontStyle: "bold" },
      { token: "constant", foreground: accent.tokenHex },
      { token: "tag", foreground: primary.tokenHex },
      { token: "attribute.name", foreground: accent.tokenHex },
      { token: "attribute.value", foreground: foreground.tokenHex },
      { token: "variable", foreground: foreground.tokenHex },
      { token: "identifier", foreground: foreground.tokenHex },
      { token: "invalid", foreground: destructive.tokenHex, fontStyle: "underline" },
    ],
    colors: {
      "editor.background": background.hex,
      "editor.foreground": foreground.hex,
      "editorCursor.foreground": accent.hex,
      "editor.selectionBackground": primary.alpha(isDark ? 0.26 : 0.18),
      "editor.inactiveSelectionBackground": primary.alpha(isDark ? 0.16 : 0.1),
      "editor.selectionHighlightBackground": accent.alpha(isDark ? 0.16 : 0.1),
      "editor.wordHighlightBackground": accent.alpha(isDark ? 0.14 : 0.08),
      "editor.wordHighlightStrongBackground": primary.alpha(isDark ? 0.18 : 0.12),
      "editor.lineHighlightBackground": muted.alpha(isDark ? 0.36 : 0.55),
      "editor.lineHighlightBorder": border.alpha(0.55),
      "editorLineNumber.foreground": mutedForeground.alpha(isDark ? 0.85 : 0.72),
      "editorLineNumber.activeForeground": foreground.hex,
      "editorGutter.background": background.hex,
      "editorIndentGuide.background1": border.alpha(isDark ? 0.36 : 0.5),
      "editorIndentGuide.activeBackground1": accent.alpha(isDark ? 0.5 : 0.36),
      "editorWhitespace.foreground": border.alpha(isDark ? 0.36 : 0.45),
      "editorBracketMatch.border": accent.hex,
      "editorBracketMatch.background": accent.alpha(isDark ? 0.12 : 0.08),
      "editorHoverWidget.background": popover.hex,
      "editorHoverWidget.border": border.hex,
      "editorWidget.background": card.hex,
      "editorWidget.border": border.hex,
      "editorSuggestWidget.background": popover.hex,
      "editorSuggestWidget.border": border.hex,
      "editorSuggestWidget.foreground": foreground.hex,
      "editorSuggestWidget.selectedBackground": accent.alpha(isDark ? 0.18 : 0.12),
      "editorSuggestWidget.highlightForeground": accent.hex,
      "editorSuggestWidget.focusHighlightForeground": primary.hex,
      "editorSuggestWidgetStatus.foreground": mutedForeground.hex,
      "editor.findMatchBackground": accent.alpha(isDark ? 0.22 : 0.14),
      "editor.findMatchBorder": accent.hex,
      "editor.findMatchHighlightBackground": primary.alpha(isDark ? 0.16 : 0.12),
      "editor.findRangeHighlightBackground": muted.alpha(isDark ? 0.4 : 0.6),
      "editorRangeHighlightBackground": muted.alpha(isDark ? 0.28 : 0.2),
      "editorLink.activeForeground": primary.hex,
      "editorInfo.foreground": accent.hex,
      "editorWarning.foreground": primary.hex,
      "editorError.foreground": destructive.hex,
      "editorMarkerNavigation.background": card.hex,
      "editorMarkerNavigationError.background": destructive.alpha(isDark ? 0.24 : 0.12),
      "editorMarkerNavigationWarning.background": primary.alpha(isDark ? 0.22 : 0.12),
      "editorMarkerNavigationInfo.background": accent.alpha(isDark ? 0.18 : 0.1),
      "input.background": input.hex,
      "input.border": border.hex,
      "input.foreground": foreground.hex,
      "focusBorder": accent.hex,
      "dropdown.background": popover.hex,
      "dropdown.border": border.hex,
      "dropdown.foreground": foreground.hex,
      "minimap.background": background.hex,
      "minimap.selectionHighlight": accent.alpha(isDark ? 0.2 : 0.14),
      "minimapSlider.background": border.alpha(isDark ? 0.28 : 0.2),
      "minimapSlider.hoverBackground": border.alpha(isDark ? 0.4 : 0.32),
      "minimapSlider.activeBackground": accent.alpha(isDark ? 0.4 : 0.24),
      "scrollbarSlider.background": border.alpha(isDark ? 0.28 : 0.18),
      "scrollbarSlider.hoverBackground": border.alpha(isDark ? 0.4 : 0.28),
      "scrollbarSlider.activeBackground": accent.alpha(isDark ? 0.4 : 0.24),
    },
  };
}
