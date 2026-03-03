"use client";

import { cn } from "@/lib/utils";
import { useId } from "react";

interface PdMcpLogoProps {
  size?: "sm" | "md" | "lg" | "xl";
  variant?: "icon" | "horizontal" | "stacked";
  className?: string;
  showText?: boolean;
}

const sizeMap = {
  sm: { width: 28, height: 20, text: "text-xs", gap: "gap-1.5" },
  md: { width: 42, height: 30, text: "text-sm", gap: "gap-2" },
  lg: { width: 56, height: 40, text: "text-base", gap: "gap-2.5" },
  xl: { width: 84, height: 60, text: "text-xl", gap: "gap-3" },
};

export function PdMcpLogo({
  size = "md",
  variant = "horizontal",
  className,
  showText = true,
}: PdMcpLogoProps) {
  const uniqueId = useId();

  const glowId = `pdmcp-glow-${uniqueId}`;
  const bgGradientId = `pdmcp-bg-${uniqueId}`;
  const bar2GradientId = `pdmcp-bar2-${uniqueId}`;
  const bar3GradientId = `pdmcp-bar3-${uniqueId}`;

  const { width, height, text, gap } = sizeMap[size];

  const badge = (
    <svg
      width={width}
      height={height}
      viewBox="0 0 84 60"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className="flex-shrink-0"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={bgGradientId} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#1e293b" />
          <stop offset="100%" stopColor="#0f172a" />
        </linearGradient>
        <linearGradient id={bar2GradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#00E5FF" />
          <stop offset="100%" stopColor="#A855F7" />
        </linearGradient>
        <linearGradient id={bar3GradientId} x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#A855F7" />
          <stop offset="100%" stopColor="#FF00FF" />
        </linearGradient>
        <filter id={glowId} x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="2" result="coloredBlur" />
          <feMerge>
            <feMergeNode in="coloredBlur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Background */}
      <rect
        x="0"
        y="0"
        width="84"
        height="60"
        rx="8"
        fill={`url(#${bgGradientId})`}
      />
      <rect
        x="0.5"
        y="0.5"
        width="83"
        height="59"
        rx="7.5"
        fill="none"
        stroke="white"
        strokeOpacity="0.1"
      />

      {/* Progressive disclosure bars */}
      <g filter={`url(#${glowId})`}>
        <rect x="10" y="15" width="12" height="6" rx="3" fill="#00E5FF" />
        <rect
          x="10"
          y="27"
          width="20"
          height="6"
          rx="3"
          fill={`url(#${bar2GradientId})`}
        />
        <rect
          x="10"
          y="39"
          width="28"
          height="6"
          rx="3"
          fill={`url(#${bar3GradientId})`}
        />
      </g>

      {/* MCP text */}
      <text
        x="74"
        y="40"
        textAnchor="end"
        fill="white"
        fontFamily="system-ui, -apple-system, sans-serif"
        fontSize="18"
        fontWeight="800"
        letterSpacing="1"
      >
        MCP
      </text>
    </svg>
  );

  const wordmark = (
    <span
      className={cn(
        "font-heading font-bold tracking-tight",
        text,
        "text-foreground",
      )}
    >
      PD-MCP
    </span>
  );

  if (variant === "icon" || !showText) {
    return (
      <div
        className={cn("inline-flex items-center", className)}
        role="img"
        aria-label="Progressive Disclosure MCP logo"
      >
        {badge}
      </div>
    );
  }

  if (variant === "stacked") {
    return (
      <div
        className={cn("inline-flex flex-col items-center gap-1", className)}
        role="img"
        aria-label="Progressive Disclosure MCP logo"
      >
        {badge}
        {wordmark}
      </div>
    );
  }

  return (
    <div
      className={cn("inline-flex items-center", gap, className)}
      role="img"
      aria-label="Progressive Disclosure MCP logo"
    >
      {badge}
      {wordmark}
    </div>
  );
}
