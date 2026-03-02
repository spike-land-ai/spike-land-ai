"use client";

import { reportErrorBoundary } from "@/lib/errors/console-capture.client";
import { useEffect } from "react";

const ALLOWED_ORIGINS = ["http://localhost:3000"];

interface IframeErrorMessage {
  type: "iframe-error";
  source?: string;
  message: string;
  stack?: string;
  componentStack?: string;
  codeSpace?: string;
}

function isIframeErrorMessage(data: unknown): data is IframeErrorMessage {
  return (
    typeof data === "object" &&
    data !== null &&
    "type" in data &&
    (data as { type: unknown }).type === "iframe-error" &&
    "message" in data &&
    typeof (data as { message: unknown }).message === "string"
  );
}

export function IframeErrorBridge(): null {
  useEffect(() => {
    function handleMessage(event: MessageEvent): void {
      // Allow same-origin messages (iframes using relative URLs), explicitly allowed origins,
      // and sandboxed iframes (origin === "null") with our sentinel source field
      const isSameOrigin = event.origin === window.location.origin;
      const isSandboxedBundle =
        event.origin === "null" &&
        typeof event.data === "object" &&
        event.data !== null &&
        (event.data.source === "spike-land-bundle" ||
          event.data.source === "spike-land-worker-dom");
      if (!isSameOrigin && !isSandboxedBundle && !ALLOWED_ORIGINS.includes(event.origin)) {
        return;
      }

      if (!isIframeErrorMessage(event.data)) {
        return;
      }

      const { message, stack, componentStack } = event.data;
      const syntheticError = new Error(message);
      if (stack) {
        syntheticError.stack = stack;
      }

      reportErrorBoundary(syntheticError, componentStack);
    }

    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  return null;
}
