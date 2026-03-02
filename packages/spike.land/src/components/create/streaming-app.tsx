"use client";

import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import type { CreateGenerationResult } from "@/lib/create/types";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";

const GENERATION_TIMEOUT_MS = 120_000;
const POLL_INTERVAL_MS = 3_000;
const POLL_MAX_DURATION_MS = 60_000;

interface StreamingAppProps {
  path: string[];
  className?: string;
}

export function StreamingApp({ path, className }: StreamingAppProps) {
  const [status, setStatus] = useState<"loading" | "error">("loading");
  const [error, setError] = useState<string | null>(null);
  const [buildLog, setBuildLog] = useState<string[]>([]);
  const [generatedCode, setGeneratedCode] = useState<string | null>(null);
  const [showCode, setShowCode] = useState(false);
  const router = useRouter();
  const { redirectToSignIn } = useAuthRedirect();
  const hasAttemptedGeneration = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const pathKeyRef = useRef(JSON.stringify(path));

  const startGeneration = useCallback(async () => {
    abortRef.current?.abort();

    setStatus("loading");
    setError(null);
    setBuildLog([]);
    setGeneratedCode(null);
    setShowCode(false);
    hasAttemptedGeneration.current = true;

    const controller = new AbortController();
    abortRef.current = controller;
    const timeoutId = setTimeout(() => controller.abort(), GENERATION_TIMEOUT_MS);

    try {
      const response = await fetch("/api/create/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path: JSON.parse(pathKeyRef.current) }),
        signal: controller.signal,
      });

      if (!response.ok) {
        if (response.status === 401) {
          redirectToSignIn();
          return;
        }
        if (response.status === 429) {
          setStatus("error");
          setError("Rate limit reached. Please try again later or sign in for more.");
          return;
        }
        if (response.status === 202) {
          toast.info("App is already being generated. Waiting...");
          const pollInterval = setInterval(() => {
            window.getSelection()?.removeAllRanges();
            router.refresh();
          }, POLL_INTERVAL_MS);
          setTimeout(() => clearInterval(pollInterval), POLL_MAX_DURATION_MS);
          return;
        }
        throw new Error(`HTTP error: ${response.status}`);
      }

      const result: CreateGenerationResult = await response.json();

      if (result.buildLog) {
        setBuildLog(result.buildLog);
      }

      if (result.success) {
        window.getSelection()?.removeAllRanges();
        router.refresh();
      } else {
        setStatus("error");
        setError(result.error || "Generation failed");
        if (result.code) {
          setGeneratedCode(result.code);
        }
        toast.error(`Generation failed: ${result.error || "Unknown error"}`);
      }
    } catch (err) {
      setStatus("error");
      let message = "Failed to generate app";
      if (err instanceof Error) {
        message = err.name === "AbortError" ? "Request timed out" : err.message;
      }
      setError(message);
      toast.error(message);
    } finally {
      clearTimeout(timeoutId);
    }
  }, [router, redirectToSignIn]);

  useEffect(() => {
    startGeneration();

    return () => {
      abortRef.current?.abort();
    };
  }, [startGeneration]);

  if (status === "error") {
    return (
      <div className={cn("flex flex-col items-center justify-center min-h-[50vh] p-8", className)}>
        <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-6 max-w-lg w-full text-center">
          <h3 className="text-xl font-bold text-destructive mb-2">Generation Failed</h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <div className="flex flex-col items-center gap-3">
            <button
              onClick={startGeneration}
              className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
            >
              Try Again
            </button>
          </div>
        </div>
        {generatedCode && (
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm mt-6 max-w-lg w-full">
            <button
              onClick={() => setShowCode((v) => !v)}
              className="w-full bg-muted/50 px-4 py-3 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider flex items-center justify-between hover:bg-muted/70 transition-colors"
            >
              <span>Generated Code ({generatedCode.length} chars)</span>
              <span className="text-[10px]">{showCode ? "Hide" : "Show"}</span>
            </button>
            {showCode && (
              <pre
                className="p-4 max-h-[400px] overflow-auto font-mono text-xs text-foreground/80 whitespace-pre-wrap break-all"
                suppressHydrationWarning
              >
                {generatedCode}
              </pre>
            )}
          </div>
        )}
        {buildLog.length > 0 && (
          <div className="bg-card border rounded-xl overflow-hidden shadow-sm mt-6 max-w-lg w-full">
            <div className="bg-muted/50 px-4 py-3 border-b text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Build Log
            </div>
            <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto font-mono text-xs">
              {buildLog.map((msg, i) => (
                <div key={i} className="flex items-start gap-2">
                  <div className="mt-1 w-1.5 h-1.5 rounded-full shrink-0 bg-green-500" />
                  <span className="break-all" suppressHydrationWarning>
                    {msg}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className={cn("flex flex-col items-center justify-center min-h-[80vh] w-full", className)}>
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="relative inline-flex">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/25">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
            <span className="absolute -top-1 -right-1 flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-indigo-500" />
            </span>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">Building your app...</h1>
          <p className="text-muted-foreground">
            Spike Land AI is crafting a React application based on
            <span className="font-mono bg-muted px-2 py-0.5 rounded mx-1 text-foreground">
              /{path.join("/")}
            </span>
          </p>
        </div>
      </div>
    </div>
  );
}
