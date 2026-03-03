import { useEffect, useState, useCallback } from "react";
import { Loader2, CheckCircle, XCircle } from "lucide-react";
import { callTool, parseToolResult } from "@/api/client";

interface JobPollerProps {
  jobId: string;
  toolName: string;
  onComplete?: (result: Record<string, unknown>) => void;
  onError?: (error: string) => void;
  interval?: number;
}

export function JobPoller({
  jobId,
  toolName,
  onComplete,
  onError,
  interval = 3000,
}: JobPollerProps) {
  const [status, setStatus] = useState<string>("PENDING");
  const [error, setError] = useState<string | null>(null);

  const poll = useCallback(async () => {
    try {
      const result = await callTool(toolName, { job_id: jobId });
      const data = parseToolResult<Record<string, unknown>>(result);
      const jobStatus = (data.status as string) ?? "PENDING";
      setStatus(jobStatus);

      if (jobStatus === "COMPLETED") {
        onComplete?.(data);
        return true;
      }
      if (jobStatus === "FAILED" || jobStatus === "CANCELLED") {
        const msg = (data.error as string) ?? (data.errorMessage as string) ?? "Job failed";
        setError(msg);
        onError?.(msg);
        return true;
      }
      return false;
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Polling failed";
      setError(msg);
      onError?.(msg);
      return true;
    }
  }, [jobId, toolName, onComplete, onError]);

  useEffect(() => {
    let cancelled = false;
    const run = async () => {
      const done = await poll();
      if (!done && !cancelled) {
        setTimeout(run, interval);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [poll, interval]);

  if (error) {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-red-500/10 border border-red-500/20">
        <XCircle className="w-5 h-5 text-red-400" />
        <span className="text-sm text-red-300">{error}</span>
      </div>
    );
  }

  if (status === "COMPLETED") {
    return (
      <div className="flex items-center gap-2 p-3 rounded-lg bg-green-500/10 border border-green-500/20">
        <CheckCircle className="w-5 h-5 text-green-400" />
        <span className="text-sm text-green-300">Completed</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 p-3 rounded-lg bg-accent-500/10 border border-accent-500/20">
      <Loader2 className="w-5 h-5 text-accent-400 animate-spin" />
      <span className="text-sm text-accent-300">
        {status === "PROCESSING" ? "Processing..." : "Waiting to start..."}
      </span>
    </div>
  );
}
