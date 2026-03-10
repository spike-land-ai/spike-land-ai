import { useEffect, useRef, useState } from "react";
import { createHighlighterCoreSync, createJavaScriptRegexEngine } from "shiki";

// Lazy-loaded highlighter singleton
let highlighterPromise: Promise<ReturnType<typeof createHighlighterCoreSync>> | null = null;
let highlighterInstance: ReturnType<typeof createHighlighterCoreSync> | null = null;

async function getHighlighter() {
  if (highlighterInstance) return highlighterInstance;
  if (highlighterPromise) return highlighterPromise;

  highlighterPromise = (async () => {
    const [
      { default: vitesseDark },
      { default: vitesseLight },
      { default: langTs },
      { default: langJs },
      { default: langTsx },
      { default: langJsx },
      { default: langJson },
      { default: langBash },
      { default: langCss },
      { default: langHtml },
      { default: langMd },
      { default: langYaml },
      { default: langSql },
      { default: langPython },
      { default: langGo },
      { default: langRust },
      { default: langToml },
      { default: langDiff },
    ] = await Promise.all([
      import("shiki/themes/vitesse-dark.mjs"),
      import("shiki/themes/vitesse-light.mjs"),
      import("shiki/langs/typescript.mjs"),
      import("shiki/langs/javascript.mjs"),
      import("shiki/langs/tsx.mjs"),
      import("shiki/langs/jsx.mjs"),
      import("shiki/langs/json.mjs"),
      import("shiki/langs/bash.mjs"),
      import("shiki/langs/css.mjs"),
      import("shiki/langs/html.mjs"),
      import("shiki/langs/markdown.mjs"),
      import("shiki/langs/yaml.mjs"),
      import("shiki/langs/sql.mjs"),
      import("shiki/langs/python.mjs"),
      import("shiki/langs/go.mjs"),
      import("shiki/langs/rust.mjs"),
      import("shiki/langs/toml.mjs"),
      import("shiki/langs/diff.mjs"),
    ]);

    const h = createHighlighterCoreSync({
      themes: [vitesseDark, vitesseLight],
      langs: [
        langTs,
        langJs,
        langTsx,
        langJsx,
        langJson,
        langBash,
        langCss,
        langHtml,
        langMd,
        langYaml,
        langSql,
        langPython,
        langGo,
        langRust,
        langToml,
        langDiff,
      ],
      engine: createJavaScriptRegexEngine(),
    });

    highlighterInstance = h;
    return h;
  })();

  return highlighterPromise;
}

// Language alias map
const LANG_ALIASES: Record<string, string> = {
  sh: "bash",
  shell: "bash",
  zsh: "bash",
  ts: "typescript",
  js: "javascript",
  yml: "yaml",
  py: "python",
  rs: "rust",
  htm: "html",
  mdx: "markdown",
  md: "markdown",
  jsonc: "json",
};

function resolveLang(raw: string): string {
  const lower = raw.toLowerCase();
  return LANG_ALIASES[lower] ?? lower;
}

interface CodeBlockProps {
  children?: React.ReactNode;
  className?: string;
}

export function CodeBlock({ children, className }: CodeBlockProps) {
  const codeRef = useRef<HTMLDivElement>(null);
  const [highlighted, setHighlighted] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const langMatch = className?.match(/language-(\S+)/);
  const lang = langMatch ? resolveLang(langMatch[1]) : null;
  const code =
    typeof children === "string"
      ? children.replace(/\n$/, "")
      : String(children ?? "").replace(/\n$/, "");
  const isBlock = Boolean(lang) || code.includes("\n");

  useEffect(() => {
    if (!isBlock) return;

    let cancelled = false;
    getHighlighter().then((h) => {
      if (cancelled) return;

      const loadedLangs = h.getLoadedLanguages();
      const effectiveLang = lang && loadedLangs.includes(lang) ? lang : "text";

      try {
        const html = h.codeToHtml(code, {
          lang: effectiveLang,
          themes: { dark: "vitesse-dark", light: "vitesse-light" },
          defaultColor: false,
        });
        setHighlighted(html);
      } catch {
        // Fall back to plain text
      }
    });

    return () => {
      cancelled = true;
    };
  }, [code, lang, isBlock]);

  if (!isBlock) {
    return <code className={className}>{children}</code>;
  }

  const handleCopy = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative">
      {lang && (
        <div className="absolute top-3 left-5 text-[10px] font-bold uppercase tracking-widest text-muted-foreground/40 z-10 select-none">
          {lang}
        </div>
      )}
      <button
        onClick={handleCopy}
        className="absolute top-3 right-3 z-10 opacity-0 group-hover:opacity-100 transition-opacity text-[10px] font-bold uppercase tracking-widest text-muted-foreground/60 hover:text-foreground bg-background/80 backdrop-blur-sm px-2.5 py-1 rounded-lg border border-border/50"
        type="button"
      >
        {copied ? "Copied!" : "Copy"}
      </button>
      {highlighted ? (
        <div
          ref={codeRef}
          className="shiki-container [&_pre]:!bg-transparent [&_pre]:!p-0 [&_pre]:!m-0 [&_code]:!bg-transparent [&_.shiki]:!bg-transparent [&_pre]:overflow-x-auto"
          dangerouslySetInnerHTML={{ __html: highlighted }}
        />
      ) : (
        <pre className="overflow-x-auto">
          <code>{code}</code>
        </pre>
      )}
    </div>
  );
}
