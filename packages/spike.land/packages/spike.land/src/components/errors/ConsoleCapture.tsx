"use client";

import { initializeConsoleCapture } from "@/lib/errors/console-capture.client";
import { useEffect } from "react";

/**
 * ConsoleCapture Component
 *
 * Initializes browser-side error capture on mount.
 * Add this to root layout to enable automatic error tracking.
 */
export function ConsoleCapture(): null {
  useEffect(() => {
    initializeConsoleCapture();
  }, []);

  return null;
}
