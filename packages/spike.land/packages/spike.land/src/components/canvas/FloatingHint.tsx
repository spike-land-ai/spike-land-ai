"use client";

import { useReducedMotion } from "@/hooks/useReducedMotion";
import { cn } from "@/lib/utils";
import type { ReactNode } from "react";

export interface FloatingHintProps {
  text: string;
  icon?: ReactNode;
  isVisible: boolean;
  isTouchDevice?: boolean;
}

/**
 * Floating hint bar component that displays contextual information.
 * Appears at the bottom of the screen with a smooth enter/exit animation.
 * Shows different text based on device type (touch vs desktop).
 */
export function FloatingHint({
  text,
  icon,
  isVisible,
  isTouchDevice = false,
}: FloatingHintProps) {
  // Check if user prefers reduced motion (hydration-safe)
  const prefersReducedMotion = useReducedMotion();

  // Default icons based on device type
  const defaultIcon = isTouchDevice
    ? (
      // Touch/tap icon
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M7 11.5V14m0-2.5v-6a1.5 1.5 0 113 0m-3 6a1.5 1.5 0 00-3 0v2a7.5 7.5 0 0015 0v-5a1.5 1.5 0 00-3 0m-6-3V11m0-5.5v-1a1.5 1.5 0 013 0v1m0 0V11m0-5.5a1.5 1.5 0 013 0v3m0 0V11"
        />
      </svg>
    )
    : (
      // Keyboard icon
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
        aria-hidden="true"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
    );

  const displayIcon = icon ?? defaultIcon;

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="floating-hint"
      className={cn(
        "fixed bottom-8 left-1/2 -translate-x-1/2 z-50",
        "flex items-center gap-3",
        "bg-black/60 backdrop-blur-sm",
        "text-white/90 text-sm font-medium",
        "rounded-full px-6 py-3",
        "shadow-lg",
        "transition-all duration-300",
        isVisible
          ? prefersReducedMotion ? "opacity-100" : "animate-float-up"
          : "opacity-0 pointer-events-none translate-y-full",
      )}
    >
      {displayIcon && (
        <span className="flex-shrink-0" data-testid="floating-hint-icon">
          {displayIcon}
        </span>
      )}
      <span data-testid="floating-hint-text">{text}</span>
    </div>
  );
}

/**
 * Default hint text based on device type.
 */
export const HINT_TEXT = {
  desktop: "Press Spacebar to enter slideshow",
  touch: "Double-tap to enter slideshow",
} as const;
