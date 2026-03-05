import type { ButtonHTMLAttributes, ReactNode } from "react";
import { Loader2 } from "lucide-react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  loading?: boolean;
  children: ReactNode;
}

const variants = {
  primary:
    "bg-amber-neon text-obsidian-950 border-transparent shadow-[0_0_20px_rgba(255,180,0,0.15)] hover:shadow-[0_0_25px_rgba(255,180,0,0.25)] hover:scale-[1.02] active:scale-[0.98]",
  secondary:
    "bg-white/5 hover:bg-white/10 text-gray-200 border-white/10 hover:border-white/20 shadow-sm",
  ghost: "bg-transparent hover:bg-white/5 text-gray-500 hover:text-white border-transparent",
  danger:
    "bg-red-500/10 hover:bg-red-500/20 text-red-400 border-red-500/20 shadow-sm shadow-red-500/5",
};

const sizes = {
  sm: "px-2.5 py-1.5 text-[10px] font-black uppercase tracking-widest rounded-lg",
  md: "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-xl",
  lg: "px-6 py-3 text-sm font-black uppercase tracking-widest rounded-2xl",
};

export function Button({
  variant = "primary",
  size = "md",
  loading = false,
  disabled,
  children,
  className = "",
  ...props
}: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      aria-busy={loading}
      className={`inline-flex items-center justify-center gap-2 border transition-all duration-300
        disabled:opacity-20 disabled:cursor-not-allowed disabled:grayscale
        ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading ? (
        <Loader2 className="animate-spin h-3.5 w-3.5" aria-hidden="true" />
      ) : null}
      {children}
    </button>
  );
}
