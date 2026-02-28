/**
 * Server Console Capture
 *
 * Captures console.error calls on the server and reports them
 * to the error logging infrastructure.
 *
 * This module is server-only.
 */

import "server-only";

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
  environment: "BACKEND";
}

// Pending errors for batching
let pendingErrors: CapturedError[] = [];
let flushTimeout: ReturnType<typeof setTimeout> | null = null;
let isInitialized = false;

// Store original console.error
let originalConsoleError: typeof console.error;

const BATCH_DELAY_MS = 2000;
const MAX_BATCH_SIZE = 10;

// Dedup: fingerprint -> last seen timestamp
const recentErrors = new Map<string, number>();
const DEDUP_WINDOW_MS = 60_000;
const MAX_DEDUP_ENTRIES = 100;

// Stack trace patterns to skip (internal logging infrastructure)
const STACK_SKIP_PATTERNS = [
  "console-capture",
  "structured-logger",
  "node_modules",
];

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

function isFromStructuredLogger(): boolean {
  const stack = new Error().stack;
  if (!stack) return false;
  return stack.includes("structured-logger");
}

/**
 * Get base URL for internal API calls
 */
function getBaseUrl(): string {
  return (
    process.env.NEXTAUTH_URL
    || process.env.NEXT_PUBLIC_APP_URL
    || "http://localhost:3000"
  );
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
    if (STACK_SKIP_PATTERNS.some(pattern => line.includes(pattern))) {
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
 * Flush pending errors to the API
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
    await fetch(`${getBaseUrl()}/api/errors/report`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ errors: errorsToSend }),
    });
  } catch (error) {
    // Log to original console to avoid infinite loop
    originalConsoleError?.(
      "[ServerConsoleCapture] Failed to flush errors:",
      error,
    );
  }
}

/**
 * Queue error for batched sending
 */
function queueError(error: CapturedError): void {
  pendingErrors.push(error);

  if (pendingErrors.length >= MAX_BATCH_SIZE) {
    void flushErrors();
    return;
  }

  if (flushTimeout) {
    clearTimeout(flushTimeout);
  }
  flushTimeout = setTimeout(() => void flushErrors(), BATCH_DELAY_MS);

  // Don't block process exit
  if (flushTimeout.unref) {
    flushTimeout.unref();
  }
}

/**
 * Initialize server console capture
 * Call this once at app startup (e.g., in instrumentation.ts)
 */
export function initializeServerConsoleCapture(): void {
  if (isInitialized) return;
  isInitialized = true;

  // Store and override console.error
  originalConsoleError = console.error.bind(console);

  console.error = (...args: unknown[]) => {
    // Always call original first
    originalConsoleError(...args);

    // Skip if in workflow environment
    if (process.env.WORKFLOW_RUNTIME) return;

    // Skip structured logger output to avoid polluting error DB
    if (isFromStructuredLogger()) return;

    // Create captured error
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
        .map(arg => (typeof arg === "object") ? JSON.stringify(arg) : String(arg))
        .join(" ");
      stack = new Error().stack;
      errorType = "ConsoleError";
    }

    const location = parseStackTrace(stack);

    const capturedError: CapturedError = {
      message,
      ...(stack !== undefined ? { stack } : {}),
      ...(location.file !== undefined ? { sourceFile: location.file } : {}),
      ...(location.line !== undefined ? { sourceLine: location.line } : {}),
      ...(location.column !== undefined ? { sourceColumn: location.column } : {}),
      ...(location.caller !== undefined ? { callerName: location.caller } : {}),
      ...(errorType !== undefined ? { errorType } : {}),
      metadata: { source: "console" },
      timestamp: new Date().toISOString(),
      environment: "BACKEND",
    };

    // Skip duplicate errors within dedup window
    if (isDuplicate(capturedError)) return;

    queueError(capturedError);
  };
}

/**
 * Force flush all pending errors (for shutdown)
 */
export async function flushServerErrors(): Promise<void> {
  await flushErrors();
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
