import { Suspense, useState, useCallback, useMemo, useRef, useEffect } from "react";
import { Copy, Check, FileCode } from "lucide-react";
import { cn } from "../styling/cn";
import { useDarkMode } from "../ui/hooks/useDarkMode";
import { useMonacoTypeAcquisition } from "../ui/hooks/useMonacoTypeAcquisition";
import { MonacoCover } from "./monaco-cover/MonacoCover";
import { definePlatformMonacoTheme, SPIKE_PLATFORM_MONACO_THEME } from "./monaco-cover/theme";

import EditorWorker from "../../../monaco-editor/src/deprecated/editor/editor.worker?worker";
import TsWorker from "../../../monaco-editor/src/languages/features/typescript/ts.worker?worker";
import JsonWorker from "../../../monaco-editor/src/languages/features/json/json.worker?worker";
import CssWorker from "../../../monaco-editor/src/languages/features/css/css.worker?worker";
import HtmlWorker from "../../../monaco-editor/src/languages/features/html/html.worker?worker";

if (typeof globalThis !== "undefined") {
  (globalThis as Record<string, unknown>).MonacoEnvironment = {
    getWorker(_moduleId: string, label: string) {
      if (label === "typescript" || label === "javascript") return new TsWorker();
      if (label === "json") return new JsonWorker();
      if (label === "css" || label === "scss" || label === "less") return new CssWorker();
      if (label === "html" || label === "handlebars" || label === "razor") return new HtmlWorker();
      return new EditorWorker();
    },
  };
}

interface LocalMonacoEditorProps {
  value: string;
  language?: string;
  theme?: string;
  fileName?: string;
  onChange?: (value: string) => void;
  options?: Record<string, unknown>;
  onMount?: (editor: MonacoEditorInstance, monaco: MonacoModule) => void;
  beforeMount?: (monaco: MonacoModule) => void;
}

interface MonacoEditorInstance {
  getValue(): string;
  setValue(value: string): void;
  dispose(): void;
  focus(): void;
  getModel(): { uri: { path: string } } | null;
  onDidChangeModelContent(cb: () => void): void;
  updateOptions(options: Record<string, unknown>): void;
}

interface MonacoModule {
  editor: {
    create(element: HTMLElement, options: Record<string, unknown>): MonacoEditorInstance;
    createModel(value: string, language?: string, uri?: unknown): unknown;
    getModel(uri: unknown): { setValue(value: string): void } | null;
    setModelLanguage(model: unknown, language: string): void;
    setTheme(theme: string): void;
  };
  Uri: { parse(uri: string): unknown };
  languages?: { typescript?: MonacoTypescript };
  typescript?: MonacoTypescript;
}

interface MonacoTypescript {
  typescriptDefaults?: {
    setCompilerOptions(options: Record<string, unknown>): void;
    setDiagnosticsOptions(options: Record<string, unknown>): void;
    setEagerModelSync(value: boolean): void;
  };
}

function LocalMonacoEditor({
  value,
  language,
  theme,
  fileName,
  onChange,
  options,
  onMount,
  beforeMount,
}: LocalMonacoEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<MonacoEditorInstance | null>(null);
  const propsRef = useRef({
    value,
    language,
    theme,
    fileName,
    onChange,
    options,
    onMount,
    beforeMount,
  });
  propsRef.current = { value, language, theme, fileName, onChange, options, onMount, beforeMount };

  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;
    const props = propsRef.current;

    import("monaco-editor")
      .then((monaco: MonacoModule) => {
        if (!isMounted) return;

        if (props.beforeMount) {
          props.beforeMount(monaco);
        }

        const uri = monaco.Uri.parse(`file:///${props.fileName || "file.tsx"}`);
        let model = monaco.editor.getModel(uri);
        if (!model) {
          model = monaco.editor.createModel(props.value, props.language, uri);
        } else {
          model.setValue(props.value);
          monaco.editor.setModelLanguage(model, props.language || "typescript");
        }

        editorRef.current = monaco.editor.create(containerRef.current!, {
          model,
          theme: props.theme,
          ...props.options,
        });

        if (props.onMount) {
          props.onMount(editorRef.current, monaco);
        }

        editorRef.current.onDidChangeModelContent(() => {
          propsRef.current.onChange?.(editorRef.current!.getValue());
        });
      })
      .catch((err: unknown) => {
        console.error("Failed to load monaco-editor", err);
      });

    return () => {
      isMounted = false;
      if (editorRef.current) {
        editorRef.current.dispose();
      }
    };
  }, []); // Run once on mount

  useEffect(() => {
    if (editorRef.current && editorRef.current.getValue() !== value) {
      editorRef.current.setValue(value);
    }
  }, [value]);

  useEffect(() => {
    if (editorRef.current) {
      import("monaco-editor").then((monaco) => {
        const themeToApply = theme ?? "vs";

        if (themeToApply === SPIKE_PLATFORM_MONACO_THEME) {
          definePlatformMonacoTheme(
            monaco as unknown as { editor: MonacoModule["editor"] },
            document.documentElement.classList.contains("dark"),
          );
        }
        monaco.editor.setTheme(themeToApply);
        const model = editorRef.current.getModel();
        if (model) {
          monaco.editor.setModelLanguage(model, language);
        }
      });
    }
  }, [theme, language]);

  return <div ref={containerRef} className="w-full h-full" />;
}

/** Map file extensions to Monaco language identifiers. */
const EXTENSION_LANGUAGE_MAP: Record<string, string> = {
  ts: "typescript",
  tsx: "typescript",
  js: "javascript",
  jsx: "javascript",
  css: "css",
  scss: "scss",
  less: "less",
  json: "json",
  html: "html",
  xml: "xml",
  md: "markdown",
  mdx: "markdown",
  yaml: "yaml",
  yml: "yaml",
  sh: "shell",
  bash: "shell",
  py: "python",
  go: "go",
  rs: "rust",
  sql: "sql",
};

function detectLanguage(fileName: string | undefined, fallback: string): string {
  if (!fileName) return fallback;
  const ext = fileName.split(".").pop()?.toLowerCase();
  return (ext && EXTENSION_LANGUAGE_MAP[ext]) ?? fallback;
}

export interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language?: string;
  theme?: string;
  readOnly?: boolean;
  height?: string;
  fileName?: string;
}

function LoadingSpinner() {
  return (
    <div className="flex h-full w-full items-center justify-center bg-background">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-border border-t-primary" />
    </div>
  );
}

export function CodeEditor({
  value,
  onChange,
  language = "typescript",
  theme,
  readOnly = false,
  height = "100%",
  fileName,
}: CodeEditorProps) {
  const { isDarkMode } = useDarkMode();
  const [copied, setCopied] = useState(false);
  const [monacoInstance, setMonacoInstance] = useState<typeof import("monaco-editor") | null>(null);
  const [isEditing, setIsEditing] = useState(false);

  const { typesReady } = useMonacoTypeAcquisition({
    monaco: monacoInstance,
    code: value,
  });

  // Derive Monaco theme: explicit prop overrides auto-detection.
  const monacoTheme = theme ?? SPIKE_PLATFORM_MONACO_THEME;

  // Auto-detect language from fileName extension; fall back to the prop.
  const resolvedLanguage = useMemo(() => detectLanguage(fileName, language), [fileName, language]);

  // Derive line count from current value for the toolbar badge.
  const lineCount = useMemo(() => value.split("\n").length, [value]);

  const handleChange = useCallback(
    (newValue: string | undefined) => {
      onChange(newValue ?? "");
    },
    [onChange],
  );

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Clipboard API may be unavailable in some contexts — fail silently.
    }
  }, [value]);

  const handleBeforeMount = useCallback((monaco: MonacoModule) => {
    if (monacoTheme === SPIKE_PLATFORM_MONACO_THEME) {
      definePlatformMonacoTheme(monaco as unknown as { editor: MonacoModule["editor"] }, isDarkMode);
    }

    // Local monaco package exports typescript directly on the root object
    const typescript = monaco?.typescript || monaco?.languages?.typescript;
    if (!typescript) return;

    const tsDefaults = typescript.typescriptDefaults;
    if (!tsDefaults) return;

    tsDefaults.setCompilerOptions({
      target: 9, // ScriptTarget.ES2022
      module: 99, // ModuleKind.ESNext
      moduleResolution: 2, // ModuleResolutionKind.NodeJs
      jsx: 2, // JsxEmit.React
      allowNonTsExtensions: true,
      allowSyntheticDefaultImports: true,
      esModuleInterop: true,
      strict: false,
      noEmit: true,
      skipLibCheck: true,
      lib: ["dom", "dom.iterable", "es2015", "es2016", "esnext"],
    });

    // Eagerly opt-in to validation but suppress "missing module" noise
    // that fires before ATA has fetched the type definitions.
    tsDefaults.setDiagnosticsOptions({
      noSemanticValidation: false,
      noSyntaxValidation: false,
      noSuggestionDiagnostics: true,
      diagnosticCodesToIgnore: [2307, 7016],
    });

    // Enable automatic type acquisition for the editor model
    tsDefaults.setEagerModelSync(true);
  }, [isDarkMode, monacoTheme]);

  // Focus the editor as soon as it mounts so users can type immediately.
  const handleMount = useCallback((editor: MonacoEditorInstance, monaco: MonacoModule) => {
    editor.focus();
    setMonacoInstance(monaco);
  }, []);

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-lg border border-border bg-background",
        "shadow-sm",
      )}
      style={{ height }}
    >
      {/* Toolbar */}
      <div
        className="flex shrink-0 items-center justify-between border-b border-border bg-muted/40 px-3 py-2 cursor-pointer select-none"
        onClick={() => setIsEditing(true)}
      >
        <div className="flex items-center gap-2">
          <FileCode className="h-4 w-4 text-muted-foreground" />
          {fileName && <span className="text-sm font-medium text-foreground">{fileName}</span>}
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              "bg-primary/10 text-primary",
            )}
          >
            {resolvedLanguage}
          </span>
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              "bg-muted text-muted-foreground",
            )}
          >
            {lineCount} {lineCount === 1 ? "line" : "lines"}
          </span>
          {!isEditing && (
            <span className="text-xs font-medium text-muted-foreground/60 ml-2">Click to edit</span>
          )}
          {monacoInstance &&
            isEditing &&
            (resolvedLanguage === "typescript" || resolvedLanguage === "typescriptreact") && (
              <span
                className={cn(
                  "rounded-full px-2 py-0.5 text-xs font-medium",
                  typesReady
                    ? "bg-green-500/10 text-green-500"
                    : "bg-yellow-500/10 text-yellow-500 animate-pulse",
                )}
              >
                {typesReady ? "Types Loaded" : "Loading Types..."}
              </span>
            )}
        </div>

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            handleCopy();
          }}
          aria-label={copied ? "Copied to clipboard" : "Copy code to clipboard"}
          className={cn(
            "flex items-center gap-1.5 rounded-md px-2 py-1 text-xs",
            "text-muted-foreground transition-colors",
            "hover:bg-muted hover:text-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          )}
        >
          {copied ? (
            <>
              <Check className="h-3.5 w-3.5 text-green-500" />
              <span className="text-green-500">Copied</span>
            </>
          ) : (
            <>
              <Copy className="h-3.5 w-3.5" />
              <span>Copy</span>
            </>
          )}
        </button>
      </div>

      {/* Editor area */}
      <div className="min-h-0 flex-1 relative bg-background">
        {!isEditing ? (
          <MonacoCover value={value} isDark={isDarkMode} onClick={() => setIsEditing(true)} />
        ) : (
          <Suspense fallback={<LoadingSpinner />}>
            <LocalMonacoEditor
              height="100%"
              language={resolvedLanguage}
              theme={monacoTheme}
              value={value}
              fileName={fileName}
              onChange={handleChange}
              beforeMount={handleBeforeMount}
              onMount={handleMount}
              options={{
                readOnly,
                minimap: { enabled: false },
                fontSize: 14,
                lineHeight: 22,
                fontFamily:
                  '"JetBrains Mono", "Fira Code", "Cascadia Code", ui-monospace, monospace',
                fontLigatures: true,
                scrollBeyondLastLine: false,
                wordWrap: "on",
                tabSize: 2,
                renderWhitespace: "selection",
                smoothScrolling: true,
                cursorBlinking: "smooth",
                padding: { top: 12, bottom: 12 },
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: true },
                suggest: { showKeywords: true },
              }}
            />
          </Suspense>
        )}
      </div>
    </div>
  );
}
