"use client";

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { AlertTriangle, FileText, Info, Lightbulb, X } from "lucide-react";
import { ComplexityBadge } from "./ComplexityBadge";
import type { ComplexityLevel } from "./ComplexityBadge";

interface ReviewSummaryCardProps {
  score: number;
  issuesFound: number;
  errors: number;
  warnings: number;
  suggestions: number;
  filesReviewed: number;
  linesReviewed: number;
  complexity: ComplexityLevel;
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-green-400";
  if (score >= 60) return "text-yellow-400";
  if (score >= 40) return "text-orange-400";
  return "text-red-400";
}

function scoreRingColor(score: number): string {
  if (score >= 80) return "stroke-green-400";
  if (score >= 60) return "stroke-yellow-400";
  if (score >= 40) return "stroke-orange-400";
  return "stroke-red-400";
}

interface StatRowProps {
  icon: React.ComponentType<{ className?: string; }>;
  label: string;
  value: number;
  colorClass: string;
}

function StatRow({ icon: Icon, label, value, colorClass }: StatRowProps) {
  return (
    <div className="flex items-center justify-between py-1.5">
      <div className="flex items-center gap-2">
        <Icon className={cn("h-3.5 w-3.5", colorClass)} />
        <span className="text-sm text-zinc-400">{label}</span>
      </div>
      <span className={cn("text-sm font-mono font-semibold", colorClass)}>
        {value}
      </span>
    </div>
  );
}

export function ReviewSummaryCard({
  score,
  issuesFound,
  errors,
  warnings,
  suggestions,
  filesReviewed,
  linesReviewed,
  complexity,
}: ReviewSummaryCardProps) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference - (score / 100) * circumference;

  return (
    <Card className="bg-zinc-900 border-zinc-800 w-full max-w-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base text-zinc-100 flex items-center justify-between">
          Review Summary
          <ComplexityBadge level={complexity} />
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* Score ring */}
        <div className="flex items-center gap-6">
          <div className="relative flex-shrink-0">
            <svg width="96" height="96" className="-rotate-90">
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                stroke="currentColor"
                strokeWidth="6"
                className="text-zinc-800"
              />
              <circle
                cx="48"
                cy="48"
                r={radius}
                fill="none"
                strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={dashOffset}
                strokeLinecap="round"
                className={cn("transition-all duration-700", scoreRingColor(score))}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className={cn("text-2xl font-bold font-mono", scoreColor(score))}>
                {score}
              </span>
              <span className="text-xs text-zinc-500">/ 100</span>
            </div>
          </div>
          <div className="flex-1 space-y-1">
            <div className="text-sm text-zinc-400">
              <span className="text-zinc-200 font-semibold">{issuesFound}</span> issues found
            </div>
            <div className="text-xs text-zinc-500">
              <span className="text-zinc-300">{filesReviewed}</span> files,{" "}
              <span className="text-zinc-300">{linesReviewed.toLocaleString()}</span> lines
            </div>
          </div>
        </div>

        {/* Issue breakdown */}
        <div className="border-t border-zinc-800 pt-4 space-y-0.5">
          <StatRow
            icon={X}
            label="Errors"
            value={errors}
            colorClass="text-red-400"
          />
          <StatRow
            icon={AlertTriangle}
            label="Warnings"
            value={warnings}
            colorClass="text-yellow-400"
          />
          <StatRow
            icon={Info}
            label="Info"
            value={issuesFound - errors - warnings - suggestions}
            colorClass="text-blue-400"
          />
          <StatRow
            icon={Lightbulb}
            label="Suggestions"
            value={suggestions}
            colorClass="text-purple-400"
          />
          <StatRow
            icon={FileText}
            label="Files Reviewed"
            value={filesReviewed}
            colorClass="text-zinc-400"
          />
        </div>
      </CardContent>
    </Card>
  );
}
