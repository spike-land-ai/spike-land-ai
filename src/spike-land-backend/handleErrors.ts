import { createErrorReporter, type ErrorReporter } from "@spike-land-ai/shared";

// Generic error message for client responses - never expose internal details
const GENERIC_ERROR_MESSAGE = "An internal error occurred. Please try again later.";

export function handleErrors(
  request: Request,
  cb: () => Promise<Response>,
  options?: {
    waitUntil?: (promise: Promise<unknown>) => void;
    errorEndpoint?: string;
  },
): Promise<Response> {
  let reporter: ErrorReporter | undefined;
  if (options?.waitUntil && options?.errorEndpoint) {
    reporter = createErrorReporter({
      service: "spike-land-backend",
      endpoint: options.errorEndpoint,
      waitUntil: options.waitUntil,
    });
  }

  return cb().catch((err: unknown) => {
    // Always log full error details server-side for debugging
    // This information stays on the server and is never sent to clients
    if (err instanceof Error) {
      console.error("[handleErrors] Uncaught exception:", {
        message: err.message,
        stack: err.stack,
        name: err.name,
      });
    } else {
      console.error("[handleErrors] Uncaught non-Error exception:", err);
    }

    // Report error to ingestion endpoint (non-blocking)
    if (reporter) {
      reporter.reportException(err, {
        code: "UNCAUGHT_EXCEPTION",
        severity: "fatal",
        metadata: {
          url: request.url,
          method: request.method,
          isWebSocket: request.headers.get("Upgrade") === "websocket",
        },
      });
    }

    if (request.headers.get("Upgrade") === "websocket") {
      // In Cloudflare Workers: pair[0] is the server socket (returned in Response),
      // pair[1] is the client socket (where you accept() and communicate).
      const { 0: serverSocket, 1: clientSocket } = new WebSocketPair();
      clientSocket.accept();
      // SECURITY: Only send generic error message, never stack traces
      // Stack traces can reveal internal implementation details (OWASP A01:2021)
      clientSocket.send(JSON.stringify({ error: GENERIC_ERROR_MESSAGE }));
      clientSocket.close(1011, "Uncaught exception during session setup");
      return new Response(null, {
        status: 101,
        webSocket: serverSocket,
      } as { status: number; webSocket: WebSocket });
    } else {
      // SECURITY: Only return generic error message, never stack traces
      // Stack traces can reveal file paths, library versions, and code structure
      return new Response(JSON.stringify({ error: GENERIC_ERROR_MESSAGE }), {
        status: 500,
        headers: { "Content-Type": "application/json" },
      });
    }
  });
}
