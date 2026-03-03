"use client";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import * as React from "react";

interface TextOverlayProps {
  children: React.ReactNode;
  position?:
    | "bottom-left"
    | "bottom-right"
    | "top-left"
    | "top-right"
    | "center";
  gradient?: boolean;
  className?: string;
}

const positionClasses = {
  "bottom-left": "bottom-4 left-4",
  "bottom-right": "bottom-4 right-4",
  "top-left": "top-4 left-4",
  "top-right": "top-4 right-4",
  center: "top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2",
};

/**
 * A text overlay component for displaying text on top of images.
 * Provides gradient backing for legibility and position variants.
 * Respects prefers-reduced-motion for transitions.
 */
const TextOverlay = React.forwardRef<HTMLDivElement, TextOverlayProps>(
  ({ children, position = "bottom-left", gradient = true, className }, ref) => {
    // Check if user prefers reduced motion (hydration-safe)
    const prefersReducedMotion = useReducedMotion();

    return (
      <div
        ref={ref}
        className={cn(
          "absolute z-10",
          positionClasses[position],
          gradient && "bg-black/60 backdrop-blur-sm",
          "text-white/90 text-sm font-medium",
          "rounded-full px-4 py-1.5",
          "shadow-lg",
          !prefersReducedMotion && "transition-opacity duration-150",
          className,
        )}
        data-testid="text-overlay"
      >
        {children}
      </div>
    );
  },
);
TextOverlay.displayName = "TextOverlay";

export { TextOverlay };
