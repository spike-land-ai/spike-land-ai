"use client";

import { cn } from "@/lib/utils";

interface BrandScoreGaugeProps {
  score: number;
  label?: string;
}

function getColorClass(score: number): string {
  if (score <= 40) return "text-red-400";
  if (score <= 70) return "text-yellow-400";
  return "text-green-400";
}

function getStrokeColor(score: number): string {
  if (score <= 40) return "#f87171";
  if (score <= 70) return "#facc15";
  return "#4ade80";
}

export function BrandScoreGauge({ score, label }: BrandScoreGaugeProps) {
  const radius = 40;
  const circumference = 2 * Math.PI * radius;
  const clampedScore = Math.max(0, Math.min(100, score));
  const offset = circumference - (clampedScore / 100) * circumference;
  const strokeColor = getStrokeColor(clampedScore);
  const textColorClass = getColorClass(clampedScore);

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-28 h-28">
        <svg
          className="w-full h-full -rotate-90"
          viewBox="0 0 100 100"
          aria-label={`Brand score: ${clampedScore}${label ? ` for ${label}` : ""}`}
        >
          {/* Background track */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke="currentColor"
            strokeWidth="8"
            className="text-zinc-800"
          />
          {/* Score arc */}
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="none"
            stroke={strokeColor}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: "stroke-dashoffset 0.6s ease-out" }}
          />
        </svg>
        {/* Center score number */}
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={cn("text-2xl font-bold font-mono", textColorClass)}>
            {clampedScore}
          </span>
        </div>
      </div>
      {label && <span className="text-sm text-zinc-400 text-center">{label}</span>}
    </div>
  );
}
