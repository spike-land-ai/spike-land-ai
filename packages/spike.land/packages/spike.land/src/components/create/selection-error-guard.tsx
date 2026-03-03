"use client";

import { useEffect } from "react";

/**
 * Suppresses the browser's InvalidNodeTypeError that occurs when DOM nodes
 * are removed (by React reconciliation or view transitions) while the browser
 * still holds a Range/Selection referencing them. This is a benign error that
 * does not affect functionality.
 *
 * See: SPIKE-LAND-NEXTJS-9 / GitHub #1328
 */
export function SelectionErrorGuard() {
  useEffect(() => {
    function handleError(event: ErrorEvent): void {
      if (
        event.error instanceof DOMException
        && event.error.name === "InvalidNodeTypeError"
        && event.message?.includes("selectNode")
      ) {
        event.preventDefault();
        // Clear any stale selection to prevent further errors
        window.getSelection()?.removeAllRanges();
      }
    }

    window.addEventListener("error", handleError);
    return () => window.removeEventListener("error", handleError);
  }, []);

  return null;
}
