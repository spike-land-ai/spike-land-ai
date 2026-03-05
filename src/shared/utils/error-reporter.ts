export interface ErrorReport {
  message: string;
  stack?: string;
  severity: "warning" | "error" | "fatal";
  source: string;
  metadata?: Record<string, unknown>;
}

export interface ErrorReporter {
  report(error: ErrorReport): void;
  reportException(error: unknown, extra?: {
    severity?: "warning" | "error" | "fatal";
    code?: string;
    metadata?: Record<string, unknown>;
  }): void;
}

export function createErrorReporter(options: {
  service: string;
  endpoint?: string;
  waitUntil?: (promise: Promise<unknown>) => void;
}): ErrorReporter {
  const { service, endpoint, waitUntil } = options;

  function report(error: ErrorReport): void {
    const entry = {
      service_name: service,
      error_code: error.source,
      message: error.message,
      stack_trace: error.stack,
      metadata: error.metadata,
      severity: error.severity,
    };

    if (!endpoint || !waitUntil) {
      console.error(JSON.stringify({ ...entry, timestamp: new Date().toISOString() }));
      return;
    }

    waitUntil(
      fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify([entry]),
      }).catch(() => {
        // Swallow — reporting must never fail the request
      }),
    );
  }

  function reportException(
    error: unknown,
    extra?: {
      severity?: "warning" | "error" | "fatal";
      code?: string;
      metadata?: Record<string, unknown>;
    },
  ): void {
    const message = error instanceof Error ? error.message : String(error);
    const stack = error instanceof Error ? error.stack : undefined;

    report({
      message,
      stack,
      severity: extra?.severity ?? "error",
      source: extra?.code ?? "UNHANDLED",
      metadata: extra?.metadata,
    });
  }

  return { report, reportException };
}
