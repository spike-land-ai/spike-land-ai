"use client";

import { PipelineProgress } from "@/components/enhance/PipelineProgress";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useJobStream } from "@/hooks/useJobStream";
import { cn } from "@/lib/utils";
import type { JobStatus, PipelineStage } from "@prisma/client";
import {
  AlertCircle,
  Download,
  Layers,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import { useCallback, useEffect, useState } from "react";

export interface MixResult {
  jobId: string;
  resultUrl: string;
  width: number;
  height: number;
}

interface MixResultCardProps {
  activeJobId: string | null;
  hasImages: boolean;
  onComplete?: (result: MixResult) => void;
  onError?: (error: string) => void;
  onRetry?: () => void;
}

type MixState =
  | { type: "empty"; }
  | { type: "processing"; stage: PipelineStage | null; }
  | { type: "completed"; result: MixResult; }
  | { type: "failed"; error: string; };

export function MixResultCard({
  activeJobId,
  hasImages,
  onComplete,
  onError,
  onRetry,
}: MixResultCardProps) {
  const [state, setState] = useState<MixState>({ type: "empty" });

  const handleJobComplete = useCallback(
    (job: {
      id: string;
      status: JobStatus;
      currentStage: PipelineStage | null;
      enhancedUrl: string | null;
      enhancedWidth: number | null;
      enhancedHeight: number | null;
    }) => {
      if (job.enhancedUrl) {
        const result: MixResult = {
          jobId: job.id,
          resultUrl: job.enhancedUrl,
          width: job.enhancedWidth || 1024,
          height: job.enhancedHeight || 1024,
        };
        setState({ type: "completed", result });
        onComplete?.(result);
      }
    },
    [onComplete],
  );

  const handleJobError = useCallback(
    (error: string) => {
      setState({ type: "failed", error });
      onError?.(error);
    },
    [onError],
  );

  const { job } = useJobStream({
    jobId: activeJobId,
    onComplete: handleJobComplete,
    onError: handleJobError,
  });

  // Update state when job changes
  useEffect(() => {
    if (!activeJobId) {
      // Only reset to empty if we're not in completed state
      setState(prev => prev.type === "completed" ? prev : { type: "empty" });
      return;
    }

    if (job) {
      if (job.status === "PROCESSING" || job.status === "PENDING") {
        setState({ type: "processing", stage: job.currentStage });
      } else if (job.status === "COMPLETED" && job.enhancedUrl) {
        setState({
          type: "completed",
          result: {
            jobId: job.id,
            resultUrl: job.enhancedUrl,
            width: job.enhancedWidth || 1024,
            height: job.enhancedHeight || 1024,
          },
        });
      } else if (job.status === "FAILED") {
        setState({
          type: "failed",
          error: job.errorMessage || "Mix failed",
        });
      }
    } else {
      // Job ID is set but job data not yet received
      setState({ type: "processing", stage: null });
    }
  }, [activeJobId, job]);

  const handleDownload = useCallback(async () => {
    if (state.type !== "completed") return;

    try {
      const response = await fetch(state.result.resultUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `mix-${state.result.jobId}.jpg`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error("Failed to download:", error);
    }
  }, [state]);

  return (
    <div className="space-y-2">
      <p className="text-sm font-medium text-muted-foreground">Generated Mix</p>
      <Card
        className={cn(
          "relative overflow-hidden aspect-square rounded-3xl border-white/10 transition-all duration-500 bg-white/[0.02] group/card",
          state.type === "completed"
            && "ring-2 ring-emerald-500/20 shadow-2xl shadow-emerald-500/10",
        )}
      >
        {state.type === "empty" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <div className="h-20 w-20 rounded-3xl bg-white/5 flex items-center justify-center transition-all duration-500 group-hover/card:scale-110 group-hover/card:bg-emerald-500/10">
              <Layers className="h-10 w-10 text-zinc-600 transition-colors group-hover/card:text-emerald-500" />
            </div>
            <div className="space-y-1">
              <p className="text-sm font-bold text-zinc-400 group-hover/card:text-zinc-200 transition-colors">
                {hasImages ? "Engines ready" : "Awaiting assets"}
              </p>
              <p className="text-[10px] uppercase tracking-widest font-black text-zinc-600">
                {hasImages ? "Click create to blend" : "Choose input photos"}
              </p>
            </div>
          </div>
        )}

        {state.type === "processing" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-6 p-6">
            <div className="relative">
              <div className="h-20 w-20 rounded-full border-4 border-emerald-500/10 border-t-emerald-500 animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center">
                <Sparkles className="h-8 w-8 text-emerald-500 animate-pulse" />
              </div>
            </div>
            <div className="space-y-3 text-center w-full max-w-xs">
              <div className="space-y-1">
                <p className="text-xs font-black uppercase tracking-[0.2em] text-emerald-500 animate-pulse">
                  Blending Neural Maps
                </p>
                <p className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                  {state.stage || "Initializing"}
                </p>
              </div>
              <PipelineProgress
                currentStage={state.stage}
                className="justify-center"
              />
            </div>
          </div>
        )}

        {state.type === "completed" && (
          <div className="h-full w-full animate-in zoom-in-95 duration-700">
            <Image
              src={state.result.resultUrl}
              alt="Mix result"
              fill
              className="object-cover transition-transform duration-1000 hover:scale-110"
              sizes="(max-width: 768px) 100vw, 400px"
            />
            {/* Action buttons overlay */}
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent">
              <div className="flex gap-2">
                <Button
                  size="lg"
                  variant="default"
                  onClick={handleDownload}
                  className="flex-1 bg-emerald-600 hover:bg-emerald-500 text-white font-black uppercase tracking-widest text-xs h-12 rounded-xl shadow-xl shadow-emerald-900/20"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Save Composition
                </Button>
              </div>
            </div>
          </div>
        )}

        {state.type === "failed" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center animate-in fade-in duration-500">
            <div className="h-20 w-20 rounded-3xl bg-red-500/10 flex items-center justify-center">
              <AlertCircle className="h-10 w-10 text-red-500" />
            </div>
            <div className="space-y-2">
              <p className="text-sm font-bold text-red-400 uppercase tracking-widest">
                Mix failure
              </p>
              <p className="text-xs text-zinc-500 font-medium leading-relaxed px-4">
                {state.error}
              </p>
              {onRetry && (
                <Button
                  size="sm"
                  variant="outline"
                  onClick={onRetry}
                  className="mt-4 border-red-500/20 text-red-400 hover:bg-red-500/10 rounded-xl px-6"
                >
                  <RefreshCw className="h-3.5 w-3.5 mr-2" />
                  Try Again
                </Button>
              )}
            </div>
          </div>
        )}
      </Card>
    </div>
  );
}
