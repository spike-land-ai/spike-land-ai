"use client";

import { useAuthRedirect } from "@/hooks/useAuthRedirect";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import { PipelineTimeline } from "./pipeline-timeline";

interface GenerationShellProps {
  slug: string;
  className?: string;
}

type Phase =
  | "NEW"
  | "PLANNING"
  | "PLAN_REVIEW"
  | "CODING"
  | "TRANSPILING"
  | "CODE_REVIEW"
  | "PUBLISHED"
  | "FAILED";

interface StreamEvent {
  type: string;
  phase?: Phase;
  message?: string;
  slug?: string;
  codespaceUrl?: string;
  title?: string;
  description?: string;
  results?: Array<{
    reviewerAgentId: string;
    decision: string;
    feedback: string | null;
    eloAtReview: number;
  }>;
  approved?: boolean;
}

export function GenerationShell({ slug, className }: GenerationShellProps) {
  const [phase, setPhase] = useState<Phase>("NEW");
  const [message, setMessage] = useState("Preparing to generate...");
  const [error, setError] = useState<string | null>(null);
  const [reviews, setReviews] = useState<StreamEvent["results"]>([]);
  const router = useRouter();
  const { redirectToSignIn } = useAuthRedirect();
  const hasStarted = useRef(false);
  const abortRef = useRef<AbortController | null>(null);

  const startGeneration = useCallback(async () => {
    if (!slug) return;
    abortRef.current?.abort();

    setPhase("NEW");
    setMessage("Starting generation...");
    setError(null);
    setReviews([]);
    hasStarted.current = true;

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      // Start generation
      const res = await fetch("/api/g/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug }),
        signal: controller.signal,
      });

      if (res.status === 401) {
        redirectToSignIn();
        return;
      }

      if (!res.ok && res.status !== 202) {
        const data = await res.json().catch(() => ({}));
        setError(data.error ?? `HTTP ${res.status}`);
        setPhase("FAILED");
        return;
      }

      const data = await res.json();

      if (data.status === "PUBLISHED") {
        router.refresh();
        return;
      }

      // Connect to SSE stream
      if (!data.streamUrl) return;

      const eventSource = new EventSource(data.streamUrl);

      eventSource.onmessage = e => {
        try {
          const event: StreamEvent = JSON.parse(e.data);

          if (event.type === "status" && event.phase) {
            setPhase(event.phase);
            setMessage(event.message ?? `Phase: ${event.phase}`);
          } else if (event.type === "review_complete") {
            if (event.results) setReviews(event.results);
          } else if (event.type === "complete") {
            setPhase("PUBLISHED");
            setMessage("Generation complete!");
            eventSource.close();
            // Refresh to show the iframe
            setTimeout(() => router.refresh(), 500);
          } else if (event.type === "error") {
            setPhase("FAILED");
            setError(event.message ?? "Generation failed");
            eventSource.close();
          }
        } catch {
          // Ignore parse errors
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        // Check if we finished or genuinely errored
        if (phase !== "PUBLISHED") {
          setError("Connection lost. Refresh to check status.");
        }
      };

      // Cleanup on abort
      controller.signal.addEventListener("abort", () => {
        eventSource.close();
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(
        err instanceof Error ? err.message : "Failed to start generation",
      );
      setPhase("FAILED");
    }
  }, [slug, router, redirectToSignIn, phase]);

  useEffect(() => {
    if (!hasStarted.current) {
      startGeneration();
    }
    return () => {
      abortRef.current?.abort();
    };
  }, [startGeneration]);

  if (error) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center min-h-[50vh] p-8",
          className,
        )}
      >
        <div className="bg-destructive/10 border border-destructive/50 rounded-lg p-6 max-w-lg w-full text-center">
          <h3 className="text-xl font-bold text-destructive mb-2">
            Generation Failed
          </h3>
          <p className="text-muted-foreground mb-4">{error}</p>
          <button
            onClick={() => {
              hasStarted.current = false;
              startGeneration();
            }}
            className="px-6 py-2 bg-primary text-primary-foreground rounded-full hover:bg-primary/90 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[80vh] w-full p-8",
        className,
      )}
    >
      <div className="max-w-md w-full space-y-8">
        <div className="text-center space-y-4">
          <div className="relative inline-flex">
            <div className="w-16 h-16 rounded-2xl flex items-center justify-center shadow-lg bg-gradient-to-br from-indigo-500 to-purple-600 shadow-indigo-500/25">
              <Loader2 className="w-8 h-8 text-white animate-spin" />
            </div>
          </div>

          <h1 className="text-3xl font-bold tracking-tight">
            Building your app...
          </h1>
          <p className="text-muted-foreground">
            Generating
            <span className="font-mono bg-muted px-2 py-0.5 rounded mx-1 text-foreground">
              /{slug}
            </span>
          </p>
        </div>

        <PipelineTimeline
          currentPhase={phase}
          message={message}
          reviews={reviews}
        />
      </div>
    </div>
  );
}
