const BATCH_INTERVAL_MS = 5_000;
const MAX_BATCH_SIZE = 10;
const RATE_LIMIT_PER_MINUTE = 20;

interface ErrorEntry {
  service_name: string;
  error_code?: string;
  message: string;
  stack_trace?: string;
  metadata?: Record<string, unknown>;
  severity?: "warning" | "error" | "fatal";
}

const buffer: ErrorEntry[] = [];
let flushTimer: ReturnType<typeof setTimeout> | null = null;
let sentThisMinute = 0;
let minuteStart = Date.now();

function resetRateLimit() {
  const now = Date.now();
  if (now - minuteStart > 60_000) {
    sentThisMinute = 0;
    minuteStart = now;
  }
}

async function flush() {
  flushTimer = null;
  if (buffer.length === 0) return;

  resetRateLimit();
  const remaining = RATE_LIMIT_PER_MINUTE - sentThisMinute;
  if (remaining <= 0) return;

  const batch = buffer.splice(0, Math.min(MAX_BATCH_SIZE, remaining));
  sentThisMinute += batch.length;

  try {
    await fetch("/errors/ingest", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(batch),
      keepalive: true,
    });
  } catch {
    // Network failure — drop the batch to avoid infinite retry
  }

  // If buffer still has items, schedule another flush
  if (buffer.length > 0) {
    scheduleFlush();
  }
}

function scheduleFlush() {
  if (!flushTimer) {
    flushTimer = setTimeout(flush, BATCH_INTERVAL_MS);
  }
}

export function reportError(
  error: Error | string,
  extra?: { code?: string; severity?: "warning" | "error" | "fatal"; metadata?: Record<string, unknown> },
) {
  const msg = typeof error === "string" ? error : error.message;
  const stack = typeof error === "string" ? undefined : error.stack;

  buffer.push({
    service_name: "spike-app",
    error_code: extra?.code ?? "CLIENT_ERROR",
    message: msg,
    stack_trace: stack,
    metadata: {
      url: window.location.href,
      userAgent: navigator.userAgent,
      ...extra?.metadata,
    },
    severity: extra?.severity ?? "error",
  });

  // Flush immediately for fatal errors
  if (extra?.severity === "fatal") {
    flush();
  } else {
    scheduleFlush();
  }
}
