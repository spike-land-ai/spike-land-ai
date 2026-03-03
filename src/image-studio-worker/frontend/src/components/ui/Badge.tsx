import type { ReactNode } from "react";

interface BadgeProps {
  variant?: "default" | "success" | "warning" | "error" | "info";
  children: ReactNode;
  className?: string;
}

const variants = {
  default: "bg-gray-700 text-gray-300",
  success: "bg-green-500/20 text-green-400 border border-green-500/30",
  warning: "bg-amber-500/20 text-amber-400 border border-amber-500/30",
  error: "bg-red-500/20 text-red-400 border border-red-500/30",
  info: "bg-accent-500/20 text-accent-400 border border-accent-500/30",
};

export function Badge({ variant = "default", children, className = "" }: BadgeProps) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}
    >
      {children}
    </span>
  );
}
