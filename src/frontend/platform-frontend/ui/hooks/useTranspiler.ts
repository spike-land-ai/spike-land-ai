import { useState, useEffect, useRef } from "react";

interface TranspileResult {
  html: string | null;
  error: string | null;
  isTranspiling: boolean;
}

const TRANSPILE_ENDPOINT = "https://js.spike.land";
const PREVIEW_MODULE_ORIGIN = "https://js.spike.land";
const PREVIEW_REACT_VERSION = "19.2.4";
const PREVIEW_EMOTION_VERSION = "11.14.0";
const PREVIEW_TAILWIND_BROWSER_URL = `${PREVIEW_MODULE_ORIGIN}/@/workers/tw.worker.js`;

function getPreviewTokens(isDarkMode: boolean) {
  if (isDarkMode) {
    return {
      bg: "#0a0c14",
      fg: "#e2e8f0",
      cardBg: "rgba(255, 255, 255, 0.05)",
      cardFg: "#f8fafc",
      mutedBg: "rgba(255, 255, 255, 0.08)",
      mutedFg: "#94a3b8",
      border: "rgba(255, 255, 255, 0.1)",
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

/**
 * Post-process transpiled code so it can run in an inline module script.
 * - Named default exports (`export default function App`) keep the binding.
 * - Anonymous default exports get assigned to `const App`.
 * - Other `export` keywords are stripped.
 */
function prepareForPreview(transpiled: string): { code: string; appRef: string } {
  let code = transpiled;
  let appRef = "App";

  // export default function Name(
  const namedFn = code.match(/export\s+default\s+function\s+(\w+)/);
  if (namedFn) {
    appRef = namedFn[1]!;
    code = code.replace(/export\s+default\s+function\s+/, "function ");
  } else {
    // export default class Name
    const namedClass = code.match(/export\s+default\s+class\s+(\w+)/);
    if (namedClass) {
      appRef = namedClass[1]!;
      code = code.replace(/export\s+default\s+class\s+/, "class ");
    } else {
      // export default Identifier;
      const ident = code.match(/export\s+default\s+(\w+)\s*;/);
      if (ident) {
        appRef = ident[1]!;
        code = code.replace(/export\s+default\s+\w+\s*;/, "");
      } else if (/export\s+default\s+/.test(code)) {
        // Anonymous: export default () => ... or export default (props) => ...
        code = code.replace(/export\s+default\s+/, "const App = ");
        appRef = "App";
      }
    }
  }

  // Strip remaining export keywords (export const, export function, export { })
  code = code.replace(/^export\s+\{[^}]*\}\s*;?\s*$/gm, "");
  code = code.replace(/^export\s+/gm, "");

  return { code, appRef };
}

function buildPreviewHtml(transpiledCode: string, isDarkMode: boolean): string {
  const { code, appRef } = prepareForPreview(transpiledCode);
  const tokens = getPreviewTokens(isDarkMode);
  const themeName = isDarkMode ? "dark" : "light";

  return `<!DOCTYPE html>
<html lang="en" data-theme="${themeName}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <script type="importmap">
  {
    "imports": {
      "react": "${PREVIEW_MODULE_ORIGIN}/react@${PREVIEW_REACT_VERSION}?bundle",
      "react/jsx-runtime": "${PREVIEW_MODULE_ORIGIN}/react@${PREVIEW_REACT_VERSION}/jsx-runtime?bundle",
      "react/jsx-dev-runtime": "${PREVIEW_MODULE_ORIGIN}/react@${PREVIEW_REACT_VERSION}/jsx-dev-runtime?bundle",
      "react-dom": "${PREVIEW_MODULE_ORIGIN}/react-dom@${PREVIEW_REACT_VERSION}?bundle&external=react",
      "react-dom/client": "${PREVIEW_MODULE_ORIGIN}/react-dom@${PREVIEW_REACT_VERSION}/client?bundle&external=react",
      "@emotion/react/jsx-runtime": "${PREVIEW_MODULE_ORIGIN}/@emotion/react@${PREVIEW_EMOTION_VERSION}/jsx-runtime?bundle&external=react",
      "@emotion/react/jsx-dev-runtime": "${PREVIEW_MODULE_ORIGIN}/@emotion/react@${PREVIEW_EMOTION_VERSION}/jsx-dev-runtime?bundle&external=react",
      "@emotion/react": "${PREVIEW_MODULE_ORIGIN}/@emotion/react@${PREVIEW_EMOTION_VERSION}?bundle&external=react",
      "@emotion/styled": "${PREVIEW_MODULE_ORIGIN}/@emotion/styled@${PREVIEW_EMOTION_VERSION}?bundle&external=react,@emotion/react"
    }
  }
  </script>
  <script src="${PREVIEW_TAILWIND_BROWSER_URL}"></script>
  <style type="text/tailwindcss">
    @theme inline {
      --font-sans: var(--font-sans);
      --font-display: var(--font-display);
      --font-mono: var(--font-mono);
      --color-background: var(--bg);
      --color-foreground: var(--fg);
      --color-card: var(--card-bg);
      --color-card-foreground: var(--card-fg);
      --color-muted: var(--muted-bg);
      --color-muted-foreground: var(--muted-fg);
      --color-border: var(--border-color);
      --color-primary: var(--primary-color);
      --color-primary-foreground: var(--primary-fg);
      --color-primary-light: var(--primary-light);
      --color-success-foreground: var(--success-fg);
      --color-warning-foreground: var(--warning-fg);
      --color-info-foreground: var(--info-fg);
    }
  </style>
  <style>
    :root {
      --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-display: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      --font-mono: ui-monospace, "SFMono-Regular", "SF Mono", Menlo, Consolas, monospace;
      --bg: ${tokens.bg};
      --fg: ${tokens.fg};
      --card-bg: ${tokens.cardBg};
      --card-fg: ${tokens.cardFg};
      --muted-bg: ${tokens.mutedBg};
      --muted-fg: ${tokens.mutedFg};
      --border-color: ${tokens.border};
      --primary-color: ${tokens.primary};
      --primary-fg: ${tokens.primaryFg};
      --primary-light: ${tokens.primaryLight};
      --success-fg: ${tokens.successFg};
      --warning-fg: ${tokens.warningFg};
      --info-fg: ${tokens.infoFg};
      --chat-accent: ${tokens.chatAccent};
      --chat-accent-light: ${tokens.chatAccentLight};
      --destructive-fg: ${tokens.destructiveFg};
    }

    * { box-sizing: border-box; margin: 0; padding: 0; }
    html { color-scheme: ${themeName}; }
    html, body, #root { min-height: 100%; }
    body {
      background: var(--bg);
      color: var(--fg);
      font-family: var(--font-sans);
      -webkit-font-smoothing: antialiased;
      font-feature-settings: "cv02", "cv03", "cv04", "cv11", "ss01";
    }
    ::selection {
      background: color-mix(in srgb, var(--chat-accent) 22%, transparent);
    }
  </style>
</head>
<body>
  <div id="root"></div>
  <div id="error-display" style="display:none;padding:1rem;color:var(--destructive-fg);font-family:var(--font-mono);font-size:13px;white-space:pre-wrap;background:color-mix(in srgb, var(--destructive-fg) 8%, var(--card-bg));border:1px solid color-mix(in srgb, var(--destructive-fg) 18%, transparent);margin:1rem;border-radius:16px;"></div>
  <script>
  globalThis.process ??= { env: {} };
  globalThis.process.env ??= {};
  globalThis.process.env.NODE_ENV ??= "development";
  globalThis.global ??= globalThis;
  </script>
  <script type="module">
  window.addEventListener("error", (e) => {
    const el = document.getElementById("error-display");
    el.style.display = "block";
    el.textContent = e.message;
  });
  window.addEventListener("unhandledrejection", (e) => {
    const el = document.getElementById("error-display");
    el.style.display = "block";
    el.textContent = e.reason instanceof Error ? e.reason.message : String(e.reason);
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
    el.style.display = "block";
    el.textContent = err.message;
  }
  </script>
</body>
</html>`;
}

async function fetchTranspiledCode(source: string, originToUse: string): Promise<string> {
  const response = await fetch(TRANSPILE_ENDPOINT, {
    method: "POST",
    headers: {
      "Content-Type": "text/plain",
      TR_ORIGIN: originToUse,
    },
    body: source,
  });

  const text = await response.text();

  if (!response.ok) {
    throw new Error(text || `HTTP ${response.status}`);
  }

  return text;
}

export function useTranspiler(
  source: string,
  debounceMs = 300,
  isDarkMode = false,
): TranspileResult {
  const [result, setResult] = useState<TranspileResult>({
    html: null,
    error: null,
    isTranspiling: false,
  });
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const lastTranspiledRef = useRef<string | null>(null);

  useEffect(() => {
    if (!lastTranspiledRef.current) return;

    setResult((prev) => {
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
      setResult({ html: null, error: null, isTranspiling: false });
      return;
    }

    setResult((prev) => ({ ...prev, isTranspiling: true }));

    timeoutRef.current = setTimeout(() => {
      void (async () => {
        const originToUse =
          typeof window !== "undefined" ? window.location.origin : "https://spike.land";

        try {
          const transpiledCode = await fetchTranspiledCode(source, originToUse);
          lastTranspiledRef.current = transpiledCode;
          const html = buildPreviewHtml(transpiledCode, isDarkMode);
          setResult({ html, error: null, isTranspiling: false });
        } catch (err) {
          lastTranspiledRef.current = null;
          setResult({
            html: null,
            error: `Transpiler failed: ${err instanceof Error ? err.message : String(err)}`,
            isTranspiling: false,
          });
        }
      })();
    }, debounceMs);

    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, [source, debounceMs]);

  return result;
}
