import { cn } from "@/lib/utils";
import React from "react";

interface GlassCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  variant?: "neutral" | "claude" | "openClaw" | "critical" | "high" | "highlighted";
  hoverEffect?: boolean;
}

export function GlassCard({
  children,
  className,
  variant = "neutral",
  hoverEffect = true,
  ...props
}: GlassCardProps) {
  const getVariantStyles = () => {
    switch (variant) {
      case "claude":
        return "border-amber-500/20 bg-amber-500/5 hover:bg-amber-500/10 hover:border-amber-500/30";
      case "openClaw":
        return "border-emerald-500/20 bg-emerald-500/5 hover:bg-emerald-500/10 hover:border-emerald-500/30";
      case "critical":
        return "border-red-500/20 bg-red-500/5 hover:bg-red-500/10 hover:border-red-500/30";
      case "high":
        return "border-yellow-500/20 bg-yellow-500/5 hover:bg-yellow-500/10 hover:border-yellow-500/30";
      case "highlighted":
        return "border-indigo-500/30 bg-indigo-500/10 hover:bg-indigo-500/15 hover:border-indigo-500/40 shadow-[0_0_30px_rgba(99,102,241,0.1)]";
      case "neutral":
      default:
        return "border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20";
    }
  };

  return (
    <div
      className={cn(
        "rounded-xl border backdrop-blur-md transition-all duration-300",
        getVariantStyles(),
        hoverEffect && "hover:shadow-lg hover:-translate-y-1",
        className,
      )}
      style={{
        boxShadow: hoverEffect
          ? `0 8px 32px 0 ${variant === "neutral" ? "rgba(0,0,0,0.2)" : "rgba(0,0,0,0.1)"}`
          : undefined,
      }}
      {...props}
    >
      {children}
    </div>
  );
}
