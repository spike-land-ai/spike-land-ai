"use client";

import { cn } from "@/lib/utils";
import { Bot, Loader2, Zap } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { toast } from "sonner";

interface StreamingContentProps {
  path: string[];
  className?: string;
}

type StreamEvent =
  | { type: "agent"; name: string; model: string; }
  | { type: "chunk"; content: string; }
  | {
    type: "complete";
    content: string;
    title: string;
    description: string;
    agent?: string;
  }
  | { type: "error"; message: string; };

export function StreamingContent({ path, className }: StreamingContentProps) {
  const [content, setContent] = useState("");
  const [status, setStatus] = useState<
    "connecting" | "streaming" | "complete" | "error"
  >(
    "connecting",
  );
  const [error, setError] = useState<string | null>(null);
  const [agentName, setAgentName] = useState<string | null>(null);
  const [agentModel, setAgentModel] = useState<string | null>(null);
  const router = useRouter();

  const startStreaming = useCallback(async () => {
    setStatus("connecting");
    setContent("");
    setError(null);
    setAgentName(null);
    setAgentModel(null);

    try {
      const response = await fetch("/api/learnit/stream", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ path }),
      });

      if (!response.ok) {
        if (response.status === 429) {
          toast.error(
            "Rate limit reached. Please try again later or sign in for more.",
          );
          setStatus("error");
          setError(
            "Rate limit reached. Please try again later or sign in for higher limits.",
          );
          return;
        }
        if (response.status === 202) {
          toast.info("Content is already being generated. Please wait...");
          setStatus("streaming");
          const pollInterval = setInterval(async () => {
            try {
              router.refresh();
            } catch {
              // Ignore refresh errors
            }
          }, 2000);
          setTimeout(() => clearInterval(pollInterval), 60000);
          return;
        }
        throw new Error(`HTTP error: ${response.status}`);
      }

      const reader = response.body?.getReader();
      if (!reader) {
        throw new Error("No response body");
      }

      setStatus("streaming");
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const data = line.slice(6);
            try {
              const event: StreamEvent = JSON.parse(data);

              if (event.type === "agent") {
                setAgentName(event.name);
                setAgentModel(event.model);
              } else if (event.type === "chunk") {
                setContent(prev => prev + event.content);
              } else if (event.type === "complete") {
                if (event.agent) setAgentName(event.agent);
                setStatus("complete");
                setTimeout(() => {
                  router.refresh();
                }, 500);
              } else if (event.type === "error") {
                setStatus("error");
                setError(event.message);
                toast.error(`Generation failed: ${event.message}`);
              }
            } catch {
              // Skip invalid JSON
            }
          }
        }
      }
    } catch (err) {
      setStatus("error");
      const message = err instanceof Error
        ? err.message
        : "Failed to generate content";
      setError(message);
      toast.error(message);
    }
  }, [path, router]);

  useEffect(() => {
    startStreaming();
  }, [startStreaming]);

  if (status === "error") {
    return (
      <div
        className={cn(
          "p-8 border border-destructive/50 rounded-lg bg-destructive/10",
          className,
        )}
      >
        <h3 className="text-lg font-semibold text-destructive mb-2">
          Generation Failed
        </h3>
        <p className="text-muted-foreground mb-4">{error}</p>
        <button
          onClick={startStreaming}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
        >
          Try Again
        </button>
      </div>
    );
  }

  const isSpike = agentName === "Spike";

  return (
    <div className={cn("relative", className)}>
      {/* Agent badge */}
      {agentName && (
        <div
          className={cn(
            "inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium mb-4",
            isSpike
              ? "bg-primary/10 text-primary border border-primary/20"
              : "bg-muted text-muted-foreground border border-border",
          )}
        >
          {isSpike
            ? <Bot className="w-3.5 h-3.5" />
            : <Zap className="w-3.5 h-3.5" />}
          <span>
            {isSpike ? "Answered by Spike" : `Generated by ${agentName}`}
          </span>
          {agentModel && <span className="text-[10px] opacity-60">({agentModel})</span>}
        </div>
      )}

      {/* Status indicator */}
      <div className="flex items-center gap-2 mb-6 text-muted-foreground">
        {status === "connecting" && (
          <>
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Connecting to AI...</span>
          </>
        )}
        {status === "streaming" && (
          <>
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex rounded-full h-3 w-3 bg-primary" />
            </span>
            <span>{isSpike ? "Spike is writing..." : "AI is writing..."}</span>
          </>
        )}
        {status === "complete" && (
          <>
            <span className="text-green-500">✓</span>
            <span>Complete! Loading formatted content...</span>
          </>
        )}
      </div>

      {/* Streaming content with typing effect */}
      <div className="prose prose-slate dark:prose-invert max-w-none">
        {content
          ? (
            <div className="overflow-auto max-h-[70vh]">
              <ReactMarkdown remarkPlugins={[remarkGfm]}>
                {content}
              </ReactMarkdown>
              {status === "streaming" && (
                <span className="inline-block w-2 h-4 bg-primary ml-1 animate-pulse" />
              )}
            </div>
          )
          : (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <Loader2 className="w-8 h-8 animate-spin mb-4" />
              <p>Generating tutorial content...</p>
              <p className="text-sm mt-2">This usually takes 10-20 seconds</p>
            </div>
          )}
      </div>
    </div>
  );
}
