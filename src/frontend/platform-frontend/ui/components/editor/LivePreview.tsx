/**
 * LivePreview — split-pane editor + live preview component.
 *
 * Layout:
 *   ┌──────────────────────┬──────────────────────┐
 *   │  Monaco CodeEditor   │  iframe preview       │
 *   │  (left pane)         │  (right pane)         │
 *   └──────────────────────┴──────────────────────┘
 *   The divider can be dragged to resize panes.
 *
 * Features:
 * - Monaco editor with TypeScript/JSX support
 * - Live iframe preview refreshed on code change (debounced 300 ms)
 * - HMR: posts updated module into the iframe; falls back to full reload
 * - ErrorOverlay shown inside preview pane for compilation errors
 * - File tabs for multi-file support
 * - Auto-save to localStorage
 * - Export/deploy button
 * - Resizable split with pointer-event drag handle
 * - Keyboard shortcut: Cmd/Ctrl+S to export
 *
 * Usage:
 *   <LivePreview
 *     files={[{ name: "App.tsx", content: defaultCode }]}
 *     onDeploy={(files) => uploadFiles(files)}
 *   />
 */

import {
  useState,
  useCallback,
  useRef,
  useEffect,
  useMemo,
} from "react";
import {
  Download,
  RefreshCw,
  Maximize,
  Minimize,
  SplitSquareHorizontal,
  Monitor,
  Code2,
  Plus,
  X,
  Save,
} from "lucide-react";
import { cn } from "../../../styling/cn";
import { Button } from "../../shared/ui/button";
import { CodeEditor } from "../../../editor/CodeEditor";
import { useDarkMode } from "../../hooks/useDarkMode";
import { useTranspile } from "./useTranspile";
import { ErrorOverlay } from "./ErrorOverlay";
import { HMRManager } from "./HMRManager";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface EditorFile {
  name: string;
  content: string;
}

export type LayoutMode = "split" | "editor" | "preview";

export interface LivePreviewProps {
  /** Initial file set. */
  files?: EditorFile[];
  /** Called when the user clicks Export/Deploy. */
  onDeploy?: (files: EditorFile[]) => void;
  /** localStorage key prefix for auto-save (default: "spike-vibe-editor"). */
  storageKey?: string;
  className?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const MIN_PANE_PX = 160;
const DEFAULT_CODE = `import { useState } from "react";

export default function App() {
  const [count, setCount] = useState(0);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-6 p-8">
      <h1 className="text-4xl font-bold tracking-tight">Vibe Editor</h1>
      <p className="text-muted-foreground text-lg">
        Edit this file to see your changes live.
      </p>
      <button
        className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-semibold text-lg hover:opacity-90 transition-opacity"
        onClick={() => setCount((n) => n + 1)}
      >
        Count: {count}
      </button>
    </div>
  );
}
`;

// ---------------------------------------------------------------------------
// Preview iframe
// ---------------------------------------------------------------------------

interface PreviewPaneProps {
  html: string | null;
  isTranspiling: boolean;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
  srcDoc: string | null;
  onRefresh: () => void;
}

function PreviewPane({ html: _html, isTranspiling, iframeRef, srcDoc, onRefresh }: PreviewPaneProps) {
  const [iframeLoading, setIframeLoading] = useState(false);

  useEffect(() => {
    if (srcDoc) setIframeLoading(true);
  }, [srcDoc]);

  return (
    <div className="relative h-full w-full bg-background overflow-hidden">
      {/* Transpiling spinner */}
      {isTranspiling && (
        <div
          aria-label="Transpiling…"
          className="pointer-events-none absolute inset-x-0 top-0 z-20 h-0.5 bg-primary/20"
        >
          <div className="h-full w-1/3 animate-[slide_1.2s_ease-in-out_infinite] bg-primary" />
        </div>
      )}

      {/* Skeleton while iframe loads */}
      {iframeLoading && (
        <div className="pointer-events-none absolute inset-0 z-10 flex flex-col gap-3 p-5 bg-background">
          <div className="h-4 w-2/3 rounded bg-muted animate-pulse" />
          <div className="h-32 w-full rounded-xl bg-muted animate-pulse" />
          <div className="flex gap-3">
            <div className="h-20 flex-1 rounded-lg bg-muted/60 animate-pulse" />
            <div className="h-20 flex-1 rounded-lg bg-muted/60 animate-pulse" />
          </div>
          <div className="h-4 w-4/5 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted/60 animate-pulse" />
        </div>
      )}

      {srcDoc ? (
        <iframe
          ref={iframeRef}
          title="Live Preview"
          srcDoc={srcDoc}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
          className="h-full w-full border-0"
          onLoad={() => setIframeLoading(false)}
        />
      ) : (
        <div className="flex h-full items-center justify-center text-muted-foreground">
          <div className="text-center space-y-3">
            <Monitor className="mx-auto h-10 w-10 opacity-20" aria-hidden="true" />
            <p className="text-sm">Start typing to see your preview</p>
            <Button variant="outline" size="sm" onClick={onRefresh}>
              <RefreshCw className="mr-1.5 h-3.5 w-3.5" />
              Refresh
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// File tabs
// ---------------------------------------------------------------------------

interface FileTabsProps {
  files: EditorFile[];
  activeIndex: number;
  onSelect: (index: number) => void;
  onAdd: () => void;
  onClose: (index: number) => void;
}

function FileTabs({ files, activeIndex, onSelect, onAdd, onClose }: FileTabsProps) {
  return (
    <div
      role="tablist"
      aria-label="Editor files"
      className="flex items-center overflow-x-auto border-b border-border bg-muted/30 shrink-0 scrollbar-none"
    >
      {files.map((file, i) => (
        <div
          key={file.name}
          role="tab"
          aria-selected={i === activeIndex}
          tabIndex={i === activeIndex ? 0 : -1}
          onClick={() => onSelect(i)}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") onSelect(i);
          }}
          className={cn(
            "group flex items-center gap-1.5 px-3 py-2 text-xs font-medium border-r border-border",
            "cursor-pointer select-none whitespace-nowrap transition-colors",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
            i === activeIndex
              ? "bg-background text-foreground border-b-2 border-b-primary -mb-px"
              : "text-muted-foreground hover:text-foreground hover:bg-muted/50",
          )}
        >
          <Code2 className="h-3 w-3 shrink-0" aria-hidden="true" />
          <span>{file.name}</span>
          {files.length > 1 && (
            <button
              type="button"
              aria-label={`Close ${file.name}`}
              onClick={(e) => {
                e.stopPropagation();
                onClose(i);
              }}
              className={cn(
                "ml-0.5 rounded p-0.5 opacity-0 group-hover:opacity-100",
                "hover:bg-destructive/10 hover:text-destructive",
                "transition-opacity focus-visible:outline-none focus-visible:opacity-100",
              )}
            >
              <X className="h-2.5 w-2.5" aria-hidden="true" />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        aria-label="Add new file"
        onClick={onAdd}
        className="px-2 py-2 text-muted-foreground hover:text-foreground hover:bg-muted/50 transition-colors"
      >
        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Drag divider
// ---------------------------------------------------------------------------

interface DividerProps {
  onDragStart: (e: React.PointerEvent) => void;
}

function Divider({ onDragStart }: DividerProps) {
  return (
    <div
      role="separator"
      aria-label="Resize panes"
      aria-orientation="vertical"
      onPointerDown={onDragStart}
      className={cn(
        "relative z-10 flex w-1.5 shrink-0 cursor-col-resize items-center justify-center",
        "bg-border hover:bg-primary/60 active:bg-primary transition-colors",
        "group",
      )}
    >
      <SplitSquareHorizontal
        className="h-4 w-4 text-muted-foreground/50 group-hover:text-primary/80 pointer-events-none"
        aria-hidden="true"
      />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

function newFileName(existing: string[]): string {
  let n = existing.length + 1;
  while (existing.includes(`Component${n}.tsx`)) n++;
  return `Component${n}.tsx`;
}

export function LivePreview({
  files: initialFiles,
  onDeploy,
  storageKey = "spike-vibe-editor",
  className,
}: LivePreviewProps) {
  const { isDarkMode } = useDarkMode();

  // ---- Persistent file state ----
  const loadFiles = useCallback((): EditorFile[] => {
    try {
      const raw = localStorage.getItem(storageKey);
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed) && parsed.length > 0) return parsed as EditorFile[];
      }
    } catch {
      // Ignore parse errors
    }
    return initialFiles ?? [{ name: "App.tsx", content: DEFAULT_CODE }];
  }, [initialFiles, storageKey]);

  const [files, setFiles] = useState<EditorFile>(loadFiles);
  const [activeIndex, setActiveIndex] = useState(0);

  // Auto-save on file change
  useEffect(() => {
    try {
      localStorage.setItem(storageKey, JSON.stringify(files));
    } catch {
      // Ignore quota errors
    }
  }, [files, storageKey]);

  // Normalise files to array
  const fileList: EditorFile[] = useMemo(
    () => (Array.isArray(files) ? files : [files]),
    [files],
  );

  const activeFile = fileList[activeIndex] ?? fileList[0];

  // ---- Code / transpilation ----
  const { html, transpiledCode, error, isTranspiling, clearError } = useTranspile(
    activeFile?.content ?? "",
    { debounceMs: 300, isDarkMode },
  );

  // ---- Layout ----
  const [layout, setLayout] = useState<LayoutMode>("split");
  const [splitPercent, setSplitPercent] = useState(50);
  const [isFullscreen, setIsFullscreen] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartSplit = useRef(50);

  const handleDividerPointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault();
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartSplit.current = splitPercent;
    (e.target as HTMLElement).setPointerCapture(e.pointerId);
  }, [splitPercent]);

  useEffect(() => {
    const onPointerMove = (e: PointerEvent) => {
      if (!isDragging.current || !containerRef.current) return;
      const containerWidth = containerRef.current.offsetWidth;
      const dx = e.clientX - dragStartX.current;
      const deltaPct = (dx / containerWidth) * 100;
      const minPct = (MIN_PANE_PX / containerWidth) * 100;
      const maxPct = 100 - minPct;
      setSplitPercent(
        Math.max(minPct, Math.min(maxPct, dragStartSplit.current + deltaPct)),
      );
    };
    const onPointerUp = () => {
      isDragging.current = false;
    };
    window.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
    return () => {
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerup", onPointerUp);
    };
  }, []);

  // ---- HMR ----
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hmrRef = useRef<HMRManager | null>(null);
  const [srcDoc, setSrcDoc] = useState<string | null>(null);
  const [previewKey, setPreviewKey] = useState(0);

  // Initialise / destroy HMR manager when iframe mounts/unmounts
  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    hmrRef.current = new HMRManager(iframe, (newHtml) => {
      setSrcDoc(newHtml);
      setPreviewKey((k) => k + 1);
    });

    return () => {
      hmrRef.current?.destroy();
      hmrRef.current = null;
    };
  }, [previewKey]);

  // Push updates: try HMR first, full reload if no manager ready yet
  useEffect(() => {
    if (!html) return;

    if (hmrRef.current && transpiledCode) {
      hmrRef.current.update(html, transpiledCode);
    } else {
      setSrcDoc(html);
    }
  }, [html, transpiledCode]);

  // ---- Editor content updates ----
  const handleCodeChange = useCallback(
    (newValue: string) => {
      setFiles((prev) => {
        const list = Array.isArray(prev) ? prev : [prev];
        return list.map((f, i) =>
          i === activeIndex ? { ...f, content: newValue } : f,
        ) as EditorFile;
      });
    },
    [activeIndex],
  );

  // ---- Tab management ----
  const handleAddFile = useCallback(() => {
    const name = newFileName(fileList.map((f) => f.name));
    setFiles((prev) => {
      const list = Array.isArray(prev) ? prev : [prev];
      return [...list, { name, content: `export default function ${name.replace(".tsx", "")}() {\n  return <div>Hello from ${name}</div>;\n}\n` }] as unknown as EditorFile;
    });
    setActiveIndex(fileList.length);
  }, [fileList]);

  const handleCloseFile = useCallback(
    (index: number) => {
      setFiles((prev) => {
        const list = Array.isArray(prev) ? prev : [prev];
        const next = list.filter((_, i) => i !== index);
        return (next.length === 0 ? [{ name: "App.tsx", content: DEFAULT_CODE }] : next) as unknown as EditorFile;
      });
      setActiveIndex((prev) => Math.min(prev, Math.max(0, fileList.length - 2)));
    },
    [fileList.length],
  );

  // ---- Refresh ----
  const handleRefresh = useCallback(() => {
    if (html) {
      setSrcDoc(html);
      setPreviewKey((k) => k + 1);
    }
  }, [html]);

  // ---- Go to line (from ErrorOverlay) ----
  const editorGoToLineRef = useRef<((line: number, col: number) => void) | null>(null);
  const handleGoToLine = useCallback((line: number, col: number) => {
    editorGoToLineRef.current?.(line, col);
  }, []);

  // ---- Export / Deploy ----
  const handleDeploy = useCallback(() => {
    onDeploy?.(fileList);
  }, [fileList, onDeploy]);

  // Cmd/Ctrl+S → deploy
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "s") {
        e.preventDefault();
        handleDeploy();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [handleDeploy]);

  // ---- Escape exits fullscreen ----
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isFullscreen) setIsFullscreen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isFullscreen]);

  // ---- Computed pane widths ----
  const editorStyle =
    layout === "split"
      ? { width: `${splitPercent}%` }
      : layout === "editor"
        ? { width: "100%" }
        : { width: "0%", overflow: "hidden" as const };

  const previewStyle =
    layout === "split"
      ? { width: `${100 - splitPercent}%` }
      : layout === "preview"
        ? { width: "100%" }
        : { width: "0%", overflow: "hidden" as const };

  return (
    <div
      className={cn(
        "flex flex-col bg-background border border-border overflow-hidden",
        isFullscreen ? "fixed inset-0 z-[100] rounded-none" : "relative rounded-xl",
        className,
      )}
    >
      {/* ---- Toolbar ---- */}
      <div
        className={cn(
          "flex items-center justify-between border-b border-border px-3 py-2 shrink-0",
          "bg-muted/30 backdrop-blur-sm",
        )}
      >
        {/* Layout toggles */}
        <div
          className="flex items-center gap-0.5 rounded-lg border border-border bg-background p-0.5"
          role="group"
          aria-label="Layout mode"
        >
          {(
            [
              { id: "editor" as LayoutMode, Icon: Code2, label: "Editor only" },
              { id: "split" as LayoutMode, Icon: SplitSquareHorizontal, label: "Split view" },
              { id: "preview" as LayoutMode, Icon: Monitor, label: "Preview only" },
            ] as const
          ).map(({ id, Icon, label }) => (
            <button
              key={id}
              type="button"
              aria-label={label}
              aria-pressed={layout === id}
              onClick={() => setLayout(id)}
              className={cn(
                "rounded-md p-1.5 transition-colors",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                layout === id
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted",
              )}
            >
              <Icon className="h-3.5 w-3.5" aria-hidden="true" />
            </button>
          ))}
        </div>

        {/* Right actions */}
        <div className="flex items-center gap-1">
          {isTranspiling && (
            <span className="flex items-center gap-1 text-[10px] text-muted-foreground animate-pulse">
              <RefreshCw className="h-3 w-3 animate-spin" aria-hidden="true" />
              Building…
            </span>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={handleRefresh}
            aria-label="Refresh preview"
            title="Refresh preview"
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            <RefreshCw className="h-3.5 w-3.5" aria-hidden="true" />
          </Button>

          {onDeploy && (
            <Button
              size="sm"
              onClick={handleDeploy}
              aria-label="Export or deploy (Cmd+S)"
              title="Export / Deploy (⌘S)"
              className="h-8 gap-1.5 text-xs"
            >
              <Download className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Deploy</span>
            </Button>
          )}

          {!onDeploy && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleDeploy}
              aria-label="Save (Cmd+S)"
              title="Save (⌘S)"
              className="h-8 gap-1.5 text-xs"
            >
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:inline">Save</span>
            </Button>
          )}

          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsFullscreen((f) => !f)}
            aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
            title={isFullscreen ? "Exit fullscreen (Esc)" : "Enter fullscreen"}
            className="h-8 px-2 text-muted-foreground hover:text-foreground"
          >
            {isFullscreen
              ? <Minimize className="h-3.5 w-3.5" aria-hidden="true" />
              : <Maximize className="h-3.5 w-3.5" aria-hidden="true" />}
          </Button>
        </div>
      </div>

      {/* ---- File tabs ---- */}
      {fileList.length > 0 && (
        <FileTabs
          files={fileList}
          activeIndex={activeIndex}
          onSelect={setActiveIndex}
          onAdd={handleAddFile}
          onClose={handleCloseFile}
        />
      )}

      {/* ---- Panes ---- */}
      <div ref={containerRef} className="flex min-h-0 flex-1 overflow-hidden">
        {/* Editor pane */}
        <div style={editorStyle} className="min-h-0 overflow-hidden transition-none">
          {layout !== "preview" && activeFile && (
            <CodeEditor
              value={activeFile.content}
              onChange={handleCodeChange}
              fileName={activeFile.name}
              height="100%"
            />
          )}
        </div>

        {/* Drag divider */}
        {layout === "split" && <Divider onDragStart={handleDividerPointerDown} />}

        {/* Preview pane */}
        <div
          style={previewStyle}
          className="relative min-h-0 overflow-hidden transition-none"
        >
          {layout !== "editor" && (
            <>
              <PreviewPane
                key={previewKey}
                html={html}
                isTranspiling={isTranspiling}
                iframeRef={iframeRef}
                srcDoc={srcDoc}
                onRefresh={handleRefresh}
              />
              <ErrorOverlay
                error={error}
                onDismiss={clearError}
                onGoToLine={handleGoToLine}
              />
            </>
          )}
        </div>
      </div>
    </div>
  );
}
