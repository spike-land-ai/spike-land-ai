"use client";

import { Badge } from "@/components/ui/badge";

interface SubmissionCardProps {
  id: string;
  status: string;
  codespaceUrl: string | null;
  reviewScore: number | null;
  eloChange: number | null;
  iterations: number;
  inputTokens: number;
  outputTokens: number;
  totalDurationMs: number | null;
  userName: string | null;
  userImage: string | null;
  reviewCount: number;
  errors?: Array<{ error: string; iteration: number; fixed: boolean; }>;
}

const statusColors: Record<string, string> = {
  PROMPTED: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  GENERATING: "bg-blue-500/10 text-blue-400 border-blue-500/20",
  TRANSPILING: "bg-purple-500/10 text-purple-400 border-purple-500/20",
  REVIEWING: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  SCORED: "bg-green-500/10 text-green-400 border-green-500/20",
  FAILED: "bg-red-500/10 text-red-400 border-red-500/20",
};

export function SubmissionCard({
  status,
  codespaceUrl,
  reviewScore,
  eloChange,
  iterations,
  inputTokens,
  outputTokens,
  totalDurationMs,
  userName,
  reviewCount,
  errors,
}: SubmissionCardProps) {
  const failedWithNoWork = status === "FAILED" && iterations === 0
    && inputTokens + outputTokens === 0;
  const firstError = failedWithNoWork && errors?.length
    ? errors[0]!.error
    : null;
  return (
    <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-sm text-zinc-200">
            {userName || "Anonymous"}
          </span>
          <Badge
            variant="outline"
            className={`text-xs ${statusColors[status] || ""}`}
          >
            {status.toLowerCase()}
          </Badge>
        </div>
        {reviewScore !== null && (
          <div className="flex items-center gap-2">
            <span className="text-sm font-mono text-zinc-300">
              {(reviewScore * 100).toFixed(0)}%
            </span>
            {eloChange !== null && (
              <span
                className={`text-xs font-mono ${
                  eloChange > 0
                    ? "text-green-400"
                    : eloChange < 0
                    ? "text-red-400"
                    : "text-zinc-500"
                }`}
              >
                {eloChange > 0 ? "+" : ""}
                {eloChange}
              </span>
            )}
          </div>
        )}
      </div>
      <div className="flex items-center gap-4 text-xs text-zinc-500">
        {firstError
          ? (
            <span
              className="text-red-400 truncate max-w-[300px]"
              title={firstError}
            >
              {firstError}
            </span>
          )
          : (
            <>
              <span>{iterations} iteration{iterations !== 1 ? "s" : ""}</span>
              <span>{inputTokens + outputTokens} tokens</span>
            </>
          )}
        {totalDurationMs && <span>{(totalDurationMs / 1000).toFixed(1)}s</span>}
        <span>{reviewCount} review{reviewCount !== 1 ? "s" : ""}</span>
        {codespaceUrl && (
          <a
            href={codespaceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-400 hover:text-blue-300"
          >
            Preview
          </a>
        )}
      </div>
    </div>
  );
}
