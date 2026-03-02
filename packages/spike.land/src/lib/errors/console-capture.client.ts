/**
 * Browser Console Capture
 *
 * Captures all console.error calls, uncaught exceptions, and unhandled
 * promise rejections. Batches and sends to /api/errors/report.
 *
 * This module is frontend-only.
 */

// Error source types
type ErrorSource = "console" | "uncaught-exception" | "unhandled-rejection" | "error-boundary";

interface CapturedError {
  message: string;
  stack?: string;
  sourceFile?: string;
  sourceLine?: number;
  sourceColumn?: number;
  callerName?: string;
  errorType?: string;
  route?: string;
  metadata?: Record<string, unknown>;
  timestamp: string;
  environment: "FRONTEND";
}

// Pending errors for batching
let pendingErrors: CapturedError[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let isInitialized = false;

const BATCH_DELAY_MS = 5000;
const MAX_BATCH_SIZE = 10;

// Dedup: fingerprint -> last seen timestamp
const recentErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000;
const MAX_DEDUP_ENTRIES = 100;

// Store original console.error
let originalConsoleError: typeof console.error;

function getErrorFingerprint(error: CapturedError): string {
  return `${error.message}:${error.sourceFile || ""}:${error.sourceLine || ""}`;
}

function isDuplicate(error: CapturedError): boolean {
  const fingerprint = getErrorFingerprint(error);
  const now = Date.now();

  // Clean expired entries if map is too large
  if (recentErrors.size > MAX_DEDUP_ENTRIES) {
    for (const [key, timestamp] of recentErrors) {
      if (now - timestamp > DEDUP_WINDOW_MS) {
        recentErrors.delete(key);
      }
    }
  }

  const lastSeen = recentErrors.get(fingerprint);
  if (lastSeen && now - lastSeen < DEDUP_WINDOW_MS) {
    return true;
  }

  recentErrors.set(fingerprint, now);
  return false;
}

/**
 * Queue error for batched sending
 */
function queueError(error: CapturedError): void {
  // Skip duplicate errors within dedup window
  if (isDuplicate(error)) return;

  pendingErrors.push(error);

  if (pendingErrors.length >= MAX_BATCH_SIZE) {
    void flushErrors();
    return;
  }

  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }
  flushTimeout = setTimeout(() => void flushErrors(), BATCH_DELAY_MS);
}

/**
 * Flush pending errors to the server
 */
async function flushErrors(): Promise<void> {
  if (pendingErrors.length === 0) return;

  const errorsToSend = [...pendingErrors];
  pendingErrors = [];

  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }

  try {
    await fetch("/api/errors/report", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errors: errorsToSend }),
    });
  } catch {
    // Silently fail - don't cause more errors
  }
}

/**
 * Parse stack trace to get source location
 */
function parseStackTrace(stack?: string): {
  file?: string;
  line?: number;
  column?: number;
  caller?: string;
} {
  if (!stack) return {};

  const lines = stack.split("\n");
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i];
    if (!line) continue;
    // Skip internal browser/framework lines
    if (
      line.includes("console-capture") ||
      line.includes("structured-logger") ||
      line.includes("node_modules") ||
      line.includes("<anonymous>")
    ) {
      continue;
    }

    const match = line.match(/at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/);
    if (match && match[2] && match[3] && match[4]) {
      return {
        ...(match[1] ? { caller: match[1] } : {}),
        file: match[2],
        line: parseInt(match[3], 10),
        column: parseInt(match[4], 10),
      };
    }
  }
  return {};
}

/**
 * Create error from console.error arguments
 */
function createErrorFromConsoleArgs(args: unknown[], source: ErrorSource): CapturedError {
  const firstArg = args[0];
  let message: string;
  let stack: string | undefined;
  let errorType: string | undefined;

  if (firstArg instanceof Error) {
    message = firstArg.message;
    stack = firstArg.stack;
    errorType = firstArg.name;
  } else {
    message = args
      .map((arg) => (typeof arg === "object" ? JSON.stringify(arg) : String(arg)))
      .join(" ");
    stack = new Error().stack;
    errorType = "ConsoleError";
  }

  const location = parseStackTrace(stack);

  return {
    message,
    ...(stack !== undefined ? { stack } : {}),
    ...(location.file !== undefined ? { sourceFile: location.file } : {}),
    ...(location.line !== undefined ? { sourceLine: location.line } : {}),
    ...(location.column !== undefined ? { sourceColumn: location.column } : {}),
    ...(location.caller !== undefined ? { callerName: location.caller } : {}),
    ...(errorType !== undefined ? { errorType } : {}),
    ...(typeof window !== "undefined" ? { route: window.location.pathname } : {}),
    metadata: { source },
    timestamp: new Date().toISOString(),
    environment: "FRONTEND",
  };
}

/**
 * Initialize console capture
 */
export function initializeConsoleCapture(): void {
  if (isInitialized || typeof window === "undefined") return;
  isInitialized = true;

  // Store and override console.error
  originalConsoleError = console.error.bind(console);
  console.error = (...args: unknown[]) => {
    // Call original first
    originalConsoleError(...args);

    // Queue for reporting
    const error = createErrorFromConsoleArgs(args, "console");
    queueError(error);
  };

  // Listen for uncaught exceptions
  window.addEventListener("error", (event: ErrorEvent) => {
    const capturedError: CapturedError = {
      message: event.error?.message || event.message,
      ...(event.error?.stack !== undefined ? { stack: event.error.stack } : {}),
      ...(event.filename ? { sourceFile: event.filename } : {}),
      ...(event.lineno ? { sourceLine: event.lineno } : {}),
      ...(event.colno ? { sourceColumn: event.colno } : {}),
      errorType: event.error?.name || "UncaughtException",
      route: window.location.pathname,
      metadata: { source: "uncaught-exception" as ErrorSource },
      timestamp: new Date().toISOString(),
      environment: "FRONTEND",
    };
    queueError(capturedError);
  });

  // Listen for unhandled promise rejections
  window.addEventListener("unhandledrejection", (event) => {
    const reason = event.reason;
    const location = parseStackTrace(reason instanceof Error ? reason.stack : undefined);

    const rejectionStack = reason instanceof Error ? reason.stack : undefined;
    const capturedError: CapturedError = {
      message: reason instanceof Error ? reason.message : String(reason),
      ...(rejectionStack !== undefined ? { stack: rejectionStack } : {}),
      ...(location.file !== undefined ? { sourceFile: location.file } : {}),
      ...(location.line !== undefined ? { sourceLine: location.line } : {}),
      ...(location.column !== undefined ? { sourceColumn: location.column } : {}),
      ...(location.caller !== undefined ? { callerName: location.caller } : {}),
      errorType: reason instanceof Error ? reason.name : "UnhandledRejection",
      route: window.location.pathname,
      metadata: { source: "unhandled-rejection" as ErrorSource },
      timestamp: new Date().toISOString(),
      environment: "FRONTEND",
    };
    queueError(capturedError);
  });

  // Flush on page unload using sendBeacon
  window.addEventListener("beforeunload", () => {
    if (pendingErrors.length > 0) {
      navigator.sendBeacon(
        "/api/errors/report",
        new Blob([JSON.stringify({ errors: pendingErrors })], {
          type: "application/json",
        }),
      );
    }
  });
}

/**
 * Report error from error boundary
 */
export function reportErrorBoundary(error: Error, componentStack?: string): void {
  const location = parseStackTrace(error.stack);

  const capturedError: CapturedError = {
    message: error.message,
    ...(error.stack !== undefined ? { stack: error.stack } : {}),
    ...(location.file !== undefined ? { sourceFile: location.file } : {}),
    ...(location.line !== undefined ? { sourceLine: location.line } : {}),
    ...(location.column !== undefined ? { sourceColumn: location.column } : {}),
    ...(location.caller !== undefined ? { callerName: location.caller } : {}),
    errorType: error.name,
    ...(typeof window !== "undefined" ? { route: window.location.pathname } : {}),
    metadata: {
      source: "error-boundary" as ErrorSource,
      componentStack,
    },
    timestamp: new Date().toISOString(),
    environment: "FRONTEND",
  };
  queueError(capturedError);
}

/**
 * Reset internal state (for testing only)
 */
export function _resetForTesting(): void {
  pendingErrors = [];
  if (flushTimeout) {
    clearTimeout(flushTimeout);
    flushTimeout = null;
  }
  isInitialized = false;
  recentErrors.clear();
}
