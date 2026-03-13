/**
 * useTranspile — hook that manages transpilation of TypeScript/JSX source
 * via the remote transpile worker at js.spike.land.
 *
 * Caches the last successful transpilation result in a ref so the preview
 * can survive theme changes without re-fetching from the network.
 *
 * Usage:
 *   const { transpiledCode, html, error, isTranspiling } = useTranspile(source, { debounceMs: 300, isDarkMode });
 */

import { useState, useEffect, useRef, useCallback } from "react";

export interface TranspileOptions {
  debounceMs?: number;
  isDarkMode?: boolean;
}

export interface TranspileState {
  transpiledCode: string | null;
  html: string | null;
  error: TranspileError | null;
  isTranspiling: boolean;
  clearError: () => void;
}

export interface TranspileError {
  message: string;
  /** 1-based line number in the source, if parseable */
  line?: number;
  /** 1-based column number, if parseable */
  column?: number;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TRANSPILE_ENDPOINT = "https://js.spike.land";
const MODULE_ORIGIN = "https://js.spike.land";
const REACT_VERSION = "19.2.4";
const EMOTION_VERSION = "11.14.0";
const TW_WORKER_URL = `${MODULE_ORIGIN}/@/workers/tw.worker.js`;

// ---------------------------------------------------------------------------
// Theme tokens
// ---------------------------------------------------------------------------

interface ThemeTokens {
  bg: string;
  fg: string;
  cardBg: string;
  cardFg: string;
  mutedBg: string;
  mutedFg: string;
  border: string;
  primary: string;
  primaryFg: string;
  primaryLight: string;
  successFg: string;
  warningFg: string;
  infoFg: string;
  chatAccent: string;
  chatAccentLight: string;
  destructiveFg: string;
}

function getThemeTokens(isDarkMode: boolean): ThemeTokens {
  if (isDarkMode) {
    return {
      bg: "#0a0c14",
      fg: "#e2e8f0",
      cardBg: "rgba(255,255,255,0.05)",
      cardFg: "#f8fafc",
      mutedBg: "rgba(255,255,255,0.08)",
      mutedFg: "#94a3b8",
      border: "rgba(255,255,255,0.1)",
      primary: "#ffb800",
      primaryFg: "#0a0c14",
      primaryLight: "#fcd34d",
      successFg: "#34d399",
      warningFg: "#fbbf24",
      infoFg: "#38bdf8",
      chatAccent: "#ffb800",
      chatAccentLight: "#fcd34d",
      destructiveFg: "#fca5a5",
    };
  }
  return {
    bg: "#f9fafb",
    fg: "#111827",
    cardBg: "#ffffff",
    cardFg: "#111827",
    mutedBg: "#f3f4f6",
    mutedFg: "#4b5563",
    border: "#e5e7eb",
    primary: "#2563eb",
    primaryFg: "#ffffff",
    primaryLight: "#60a5fa",
    successFg: "#16a34a",
    warningFg: "#d97706",
    infoFg: "#0891b2",
    chatAccent: "#f0a500",
    chatAccentLight: "#f6c453",
    destructiveFg: "#dc2626",
  };
}

// ---------------------------------------------------------------------------
// Code preparation helpers
// ---------------------------------------------------------------------------

function prepareCodeForPreview(transpiled: string): { code: string; appRef: string } {
  let code = transpiled;
  let appRef = "App";

  const namedFn = code.match(/export\s+default\s+function\s+(\w+)/);
  if (namedFn) {
    appRef = namedFn[1] ?? "App";
    code = code.replace(/export\s+default\s+function\s+/, "function ");
  } else {
    const namedClass = code.match(/export\s+default\s+class\s+(\w+)/);
    if (namedClass) {
      appRef = namedClass[1] ?? "App";
      code = code.replace(/export\s+default\s+class\s+/, "class ");
    } else {
      const ident = code.match(/export\s+default\s+(\w+)\s*;/);
      if (ident) {
        appRef = ident[1] ?? "App";
        code = code.replace(/export\s+default\s+\w+\s*;/, "");
      } else if (/export\s+default\s+/.test(code)) {
        code = code.replace(/export\s+default\s+/, "const App = ");
        appRef = "App";
      }
    }
  }

  code = code.replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, "");
  code = code.replace(/^export\s+/gm, "");

  return { code, appRef };
}

// ---------------------------------------------------------------------------
// HTML scaffold builder
// ---------------------------------------------------------------------------

export function buildPreviewHtml(transpiledCode: string, isDarkMode: boolean): string {
  const { code, appRef } = prepareCodeForPreview(transpiledCode);
  const t = getThemeTokens(isDarkMode);
  const themeName = isDarkMode ? "dark" : "light";

  return `<!DOCTYPE html>
<html lang="en" data-theme="${themeName}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script type="importmap">
  {
    "imports": {
      "react": "${MODULE_ORIGIN}/react@${REACT_VERSION}?bundle",
      "react/jsx-runtime": "${MODULE_ORIGIN}/react@${REACT_VERSION}/jsx-runtime?bundle",
      "react/jsx-dev-runtime": "${MODULE_ORIGIN}/react@${REACT_VERSION}/jsx-dev-runtime?bundle",
      "react-dom": "${MODULE_ORIGIN}/react-dom@${REACT_VERSION}?bundle&external=react",
      "react-dom/client": "${MODULE_ORIGIN}/react-dom@${REACT_VERSION}/client?bundle&external=react",
      "@emotion/react/jsx-runtime": "${MODULE_ORIGIN}/@emotion/react@${EMOTION_VERSION}/jsx-runtime?bundle&external=react",
      "@emotion/react/jsx-dev-runtime": "${MODULE_ORIGIN}/@emotion/react@${EMOTION_VERSION}/jsx-dev-runtime?bundle&external=react",
      "@emotion/react": "${MODULE_ORIGIN}/@emotion/react@${EMOTION_VERSION}?bundle&external=react",
      "@emotion/styled": "${MODULE_ORIGIN}/@emotion/styled@${EMOTION_VERSION}?bundle&external=react,@emotion/react"
    }
  }
  </script>
  <script src="${TW_WORKER_URL}"></script>
  <style type="text/tailwindcss">
    @theme inline {
      --color-background: var(--bg);
      --color-foreground: var(--fg);
      --color-card: var(--card-bg);
      --color-card-foreground: var(--card-fg);
      --color-muted: var(--muted-bg);
      --color-muted-foreground: var(--muted-fg);
      --color-border: var(--border-color);
      --color-primary: var(--primary-color);
      --color-primary-foreground: var(--primary-fg);
    }
  </style>
  <style>
    :root {
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-mono: ui-monospace, "SFMono-Regular", Menlo, Consolas, monospace;
      --bg: ${t.bg};
      --fg: ${t.fg};
      --card-bg: ${t.cardBg};
      --card-fg: ${t.cardFg};
      --muted-bg: ${t.mutedBg};
      --muted-fg: ${t.mutedFg};
      --border-color: ${t.border};
      --primary-color: ${t.primary};
      --primary-fg: ${t.primaryFg};
      --primary-light: ${t.primaryLight};
      --success-fg: ${t.successFg};
      --warning-fg: ${t.warningFg};
      --info-fg: ${t.infoFg};
      --destructive-fg: ${t.destructiveFg};
    }
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    html { color-scheme: ${themeName}; }
    html, body, #root { height: 100%; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      -webkit-font-smoothing: antialiased;
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error-display" style="display:none;padding:1rem;color:var(--destructive-fg);font-family:var(--font-mono);font-size:13px;white-space:pre-wrap;background:color-mix(in srgb,var(--destructive-fg) 8%,var(--card-bg));border:1px solid color-mix(in srgb,var(--destructive-fg) 18%,transparent);margin:1rem;border-radius:12px;"></div>
  <script>
  globalThis.process ??= { env: {} };
  globalThis.process.env ??= {};
  globalThis.process.env.NODE_ENV ??= "development";
  globalThis.global ??= globalThis;
  </script>
  <script type="module">
  window.addEventListener("error", (e) => {
    const el = document.getElementById("error-display");
    if (el) { el.style.display = "block"; el.textContent = e.message; }
  });
  window.addEventListener("unhandledrejection", (e) => {
    const el = document.getElementById("error-display");
    if (el) {
      el.style.display = "block";
      el.textContent = e.reason instanceof Error ? e.reason.message : String(e.reason);
    }
  });

  ${code}

  try {
    const { createRoot } = await import("react-dom/client");
    const { createElement } = await import("react");
    const _Comp = typeof ${appRef} !== "undefined" ? ${appRef} : null;
    if (_Comp) {
      createRoot(document.getElementById("root")).render(createElement(_Comp));
    } else {
      document.getElementById("root").innerHTML =
        '<p style="padding:2rem;text-align:center;color:#64748b;">No component found. Export a default function.</p>';
    }
  } catch (err) {
    const el = document.getElementById("error-display");
    if (el) { el.style.display = "block"; el.textContent = err.message; }
  }
  </script>
</body>
</html>`;
}

// ---------------------------------------------------------------------------
// Error line/col parser for esbuild-style errors
// ---------------------------------------------------------------------------

function parseTranspileError(raw: string): TranspileError {
  // esbuild format: "Transform failed with N errors:\n<file>:<line>:<col>: error: <msg>"
  const lineColMatch = raw.match(/:(\d+):(\d+):\s*error:\s*(.+)/);
  if (lineColMatch) {
    return {
      line: Number(lineColMatch[1]),
      column: Number(lineColMatch[2]),
      message: lineColMatch[3] ?? raw,
    };
  }
  return { message: raw };
}

// ---------------------------------------------------------------------------
// Remote transpilation via js.spike.land
// ---------------------------------------------------------------------------

const transpileCache = new Map<string, string>();

async function remoteTranspile(source: string): Promise<string> {
  const cached = transpileCache.get(source);
  if (cached) return cached;

  const origin =
    typeof window !== "undefined" ? window.location.origin : "https://spike.land";

  const response = await fetch(TRANSPILE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      TR_ORIGIN: origin,
    },
    body: source,
  });

  const text = await response.text();
  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`);
  }

  // Keep cache bounded — evict oldest 100 entries when over 200
  if (transpileCache.size > 200) {
    const keys = transpileCache.keys();
    for (let i = 0; i < 100; i++) {
      const next = keys.next();
      if (!next.done) transpileCache.delete(next.value);
    }
  }
  transpileCache.set(source, text);
  return text;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useTranspile(source: string, options: TranspileOptions = {}): TranspileState {
  const { debounceMs = 300, isDarkMode = false } = options;

  const [state, setState] = useState<Omit<TranspileState, "clearError">>({
    transpiledCode: null,
    html: null,
    error: null,
    isTranspiling: false,
  });

  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastTranspiledRef = useRef<string | null>(null);

  // Re-render preview HTML when theme flips without re-transpiling
  useEffect(() => {
    if (!lastTranspiledRef.current) return;
    setState((prev) => {
      if (prev.error) return prev;
      return {
        ...prev,
        html: buildPreviewHtml(lastTranspiledRef.current!, isDarkMode),
      };
    });
  }, [isDarkMode]);

  // Debounced transpilation
  useEffect(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);

    if (!source.trim()) {
      lastTranspiledRef.current = null;
      setState({ transpiledCode: null, html: null, error: null, isTranspiling: false });
      return;
    }

    setState((prev) => ({ ...prev, isTranspiling: true }));

    timeoutRef.current = setTimeout(() => {
      void (async () => {
        try {
          const code = await remoteTranspile(source);
          lastTranspiledRef.current = code;
          setState({
            transpiledCode: code,
            html: buildPreviewHtml(code, isDarkMode),
            error: null,
            isTranspiling: false,
          });
        } catch (err) {
          lastTranspiledRef.current = null;
          const raw = err instanceof Error ? err.message : String(err);
          setState({
            transpiledCode: null,
            html: null,
            error: parseTranspileError(raw),
            isTranspiling: false,
          });
        }
      })();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [source, debounceMs]); // eslint-disable-line react-hooks/exhaustive-deps — isDarkMode handled separately

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return { ...state, clearError };
}
