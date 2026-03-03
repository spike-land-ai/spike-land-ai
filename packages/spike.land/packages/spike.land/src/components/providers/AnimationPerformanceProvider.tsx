"use client";

import { MotionConfig } from "framer-motion";
import { type ReactNode, useEffect, useState } from "react";
import { detectSlowDevice } from "@/lib/device";

interface AnimationPerformanceProviderProps {
  children: ReactNode;
}

export function AnimationPerformanceProvider({ children }: AnimationPerformanceProviderProps) {
  const [shouldReduceMotion, setShouldReduceMotion] = useState(false);

  useEffect(() => {
    // Check for slow device
    if (detectSlowDevice()) {
      setShouldReduceMotion(true);
      return;
    }

    // Also respect user's system preference for reduced motion
    const mediaQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (mediaQuery.matches) {
      setShouldReduceMotion(true);
    }

    const handler = (event: MediaQueryListEvent) => {
      setShouldReduceMotion(event.matches || detectSlowDevice());
    };

    mediaQuery.addEventListener("change", handler);
    return () => mediaQuery.removeEventListener("change", handler);
  }, []);

  return (
    <MotionConfig reducedMotion={shouldReduceMotion ? "always" : "user"}>
      {children}
    </MotionConfig>
  );
}
