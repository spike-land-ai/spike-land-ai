import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import Markdown from "react-markdown";
import rehypeRaw from "rehype-raw";
import remarkGfm from "remark-gfm";
import { Pencil, X, GitPullRequest } from "lucide-react";
import { Button } from "../lazy-imports/button";
import { cn } from "@spike-land-ai/shared";
import { apiUrl } from "../core-logic/api";

function MonacoEditorWrapper({
  value,
  onChange,
}: {
  value: string;
  onChange: (v: string) => void;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const editorRef = useRef<{
    getValue(): string;
    dispose(): void;
    onDidChangeModelContent(cb: () => void): void;
  } | null>(null);
  const onChangeRef = useRef(onChange);
  const valueRef = useRef(value);
  onChangeRef.current = onChange;
  valueRef.current = value;

  useEffect(() => {
    if (!containerRef.current) return;
    let isMounted = true;

    import("monaco-editor")
      .then((monaco) => {
        if (!isMounted) return;
        editorRef.current = monaco.editor.create(containerRef.current!, {
          value: valueRef.current,
          language: "markdown",
          theme: "vs-dark",
          minimap: { enabled: false },
          wordWrap: "on",
          fontSize: 13,
          lineNumbers: "on",
          scrollBeyondLastLine: false,
          automaticLayout: true,
        });

        editorRef.current.onDidChangeModelContent(() => {
          onChangeRef.current(editorRef.current!.getValue());
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
  }, []);

  return <div ref={containerRef} className="w-full h-full" />;
}

function isDevMode(): boolean {
  if (typeof window === "undefined") return false;
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.get("dev") === "1") return true;
    return localStorage.getItem("spike_dev_mode") === "1";
  } catch {
    return false;
  }
}

interface ContentCreatorModeProps {
  slug: string;
  initialContent?: string;
}

type ToastState = { message: string; type: "success" | "error" } | null;

export function ContentCreatorMode({ slug, initialContent = "" }: ContentCreatorModeProps) {
  const [content, setContent] = useState(initialContent);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<ToastState>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  const handleSubmitPR = useCallback(async () => {
    setSubmitting(true);
    try {
      const res = await fetch(apiUrl(`/blog/${encodeURIComponent(slug)}/edit`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content }),
      });
      if (res.ok) {
        showToast("PR submitted successfully.", "success");
      } else {
        showToast(`Failed to submit PR (${res.status}).`, "error");
      }
    } catch {
      showToast("Network error submitting PR.", "error");
    } finally {
      setSubmitting(false);
    }
  }, [slug, content, showToast]);

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-border/50 bg-card shrink-0">
        <div className="flex items-center gap-3">
          <Pencil size={18} className="text-primary" />
          <span className="text-sm font-black uppercase tracking-widest">Content Creator Mode</span>
          <span className="text-xs font-bold text-muted-foreground/60 font-mono">/{slug}</span>
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="default"
            size="sm"
            className="rounded-xl font-black uppercase tracking-widest text-xs"
            onClick={handleSubmitPR}
            disabled={submitting}
          >
            <GitPullRequest size={14} className="mr-1.5" />
            {submitting ? "Submitting..." : "Submit PR"}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-xl"
            onClick={() => {
              // Signal parent to close by dispatching a custom event
              window.dispatchEvent(new CustomEvent("spike:close-creator-mode"));
            }}
            aria-label="Close editor"
          >
            <X size={18} />
          </Button>
        </div>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={cn(
            "absolute top-20 left-1/2 -translate-x-1/2 z-[60] px-6 py-3 rounded-2xl text-sm font-bold shadow-2xl border transition-all",
            toast.type === "success"
              ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
              : "bg-destructive/10 border-destructive/30 text-destructive",
          )}
        >
          {toast.message}
        </div>
      )}

      {/* Split View */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left: Editor */}
        <div className="w-1/2 flex flex-col border-r border-border/50">
          <div className="px-4 py-2 border-b border-border/30 bg-muted/30">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
              MDX Source
            </span>
          </div>
          <div className="flex-1 overflow-hidden relative">
            <Suspense
              fallback={
                <textarea
                  className="w-full h-full resize-none bg-background font-mono text-sm p-4 focus:outline-none absolute inset-0"
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  spellCheck={false}
                />
              }
            >
              <MonacoEditorWrapper value={content} onChange={setContent} />
            </Suspense>
          </div>
        </div>

        {/* Right: Preview */}
        <div className="w-1/2 flex flex-col overflow-hidden">
          <div className="px-4 py-2 border-b border-border/30 bg-muted/30">
            <span className="text-[10px] font-black uppercase tracking-widest text-muted-foreground/50">
              Preview
            </span>
          </div>
          <div className="flex-1 overflow-y-auto p-6">
            <div
              className="prose dark:prose-invert max-w-none
              prose-headings:font-black prose-headings:tracking-tighter
              prose-p:text-muted-foreground prose-p:leading-relaxed
              prose-a:text-primary prose-a:no-underline hover:prose-a:underline
              prose-strong:text-foreground prose-strong:font-black
              prose-code:text-primary prose-code:bg-primary/[0.05] prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded-lg prose-code:before:content-none prose-code:after:content-none
              prose-pre:bg-muted/50 prose-pre:border prose-pre:border-border/50 prose-pre:rounded-2xl"
            >
              <Markdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {content}
              </Markdown>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Floating Action Button ──────────────────────────────────────────────────

interface DevModeFABProps {
  slug: string;
  initialContent?: string;
}

export function DevModeFAB({ slug, initialContent }: DevModeFABProps) {
  const [visible, setVisible] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    setVisible(isDevMode());
  }, []);

  useEffect(() => {
    const handler = () => setOpen(false);
    window.addEventListener("spike:close-creator-mode", handler);
    return () => window.removeEventListener("spike:close-creator-mode", handler);
  }, []);

  if (!visible) return null;

  return (
    <>
      {open && <ContentCreatorMode slug={slug} initialContent={initialContent!} />}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Open content creator mode"
          className="fixed bottom-6 right-6 z-50 size-14 rounded-2xl bg-primary text-primary-foreground shadow-2xl shadow-primary/30 flex items-center justify-center hover:scale-110 active:scale-95 transition-transform"
        >
          <Pencil size={22} />
        </button>
      )}
    </>
  );
}
