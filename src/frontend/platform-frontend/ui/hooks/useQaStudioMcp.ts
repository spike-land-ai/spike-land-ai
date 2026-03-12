import { useState, useEffect, useCallback, useRef } from "react";

export type ToolCallResult = {
  content: Array<{ type: string; text?: string; data?: string; mimeType?: string }>;
  isError?: boolean;
};

export type HistoryItem = {
  id: number;
  tool: string;
  args: Record<string, unknown>;
  result?: ToolCallResult;
  error?: string;
  timestamp: number;
  duration?: number;
};

/** Pending promise callbacks keyed by JSON-RPC request ID. */
type PendingEntry = {
  resolve: (val: ToolCallResult) => void;
  reject: (err: unknown) => void;
};

/** Parsed JSON-RPC response message from the MCP SSE stream. */
interface JsonRpcResponse {
  id?: number;
  result?: ToolCallResult;
  error?: unknown;
}

function parseJsonRpcMessage(raw: string): JsonRpcResponse | null {
  try {
    return JSON.parse(raw) as JsonRpcResponse;
  } catch {
    return null;
  }
}

/**
 * Connects to a QA Studio MCP server over the SSE transport and exposes a
 * typed `callTool` function for invoking browser-automation tools.
 *
 * The hook manages the full connection lifecycle:
 * 1. Opens an `EventSource` to the MCP server's SSE endpoint.
 * 2. On receiving the `"endpoint"` event, sends an MCP `initialize` handshake
 *    via HTTP POST to the advertised message endpoint.
 * 3. Once initialized, marks the connection as `connected` and routes incoming
 *    JSON-RPC responses back to pending `callTool` callers.
 * 4. Cleans up the `EventSource` on unmount via a `useEffect` teardown.
 *
 * The last-used server URL is persisted to `localStorage` under the key
 * `"qa-studio-mcp-url"` so it survives page reloads.
 *
 * @returns State values (`url`, `connected`, `history`, `isCalling`) and
 *   action callbacks (`connect`, `disconnect`, `callTool`).
 */
export function useQaStudioMcp() {
  const [url, setUrl] = useState(
    () => localStorage.getItem("qa-studio-mcp-url") || "http://localhost:3100/mcp",
  );
  const [connected, setConnected] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [isCalling, setIsCalling] = useState(false);

  const eventSourceRef = useRef<EventSource | null>(null);
  const postUrlRef = useRef<string | null>(null);
  const pendingRequestsRef = useRef<Map<number, PendingEntry>>(new Map());
  const nextIdRef = useRef(1);

  /**
   * Closes the active SSE connection and clears the stored POST endpoint URL.
   * Any pending tool-call promises will remain unresolved (callers should not
   * rely on them after a disconnect).
   */
  const disconnect = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    postUrlRef.current = null;
    setConnected(false);
  }, []);

  /**
   * Establishes a new SSE connection to the given MCP server URL, persists the
   * URL to `localStorage`, and performs the MCP `initialize` handshake once
   * the server advertises its POST endpoint.
   *
   * Any existing connection is closed before the new one is opened.
   *
   * @param targetUrl - The full URL of the MCP SSE endpoint
   *   (e.g. `"http://localhost:3100/mcp"`).
   */
  const connect = useCallback(
    (targetUrl: string) => {
      disconnect();
      setUrl(targetUrl);
      localStorage.setItem("qa-studio-mcp-url", targetUrl);

      try {
        const es = new EventSource(targetUrl, { withCredentials: true });
        eventSourceRef.current = es;

        es.onerror = () => {
          console.error("SSE connection error");
          disconnect();
        };

        es.addEventListener("endpoint", (e: MessageEvent<string>) => {
          // Resolve the absolute POST endpoint URL from the server-provided path.
          const rawEndpoint: string = e.data;
          if (rawEndpoint.startsWith("http")) {
            postUrlRef.current = rawEndpoint;
          } else if (rawEndpoint.startsWith("/")) {
            const urlObj = new URL(targetUrl);
            postUrlRef.current = `${urlObj.origin}${rawEndpoint}`;
          } else {
            postUrlRef.current = targetUrl.replace("/mcp", "") + rawEndpoint;
          }

          const postUrl = postUrlRef.current;
          if (!postUrl) return;

          // Send MCP initialize request.
          const initId = nextIdRef.current++;
          fetch(postUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              jsonrpc: "2.0",
              id: initId,
              method: "initialize",
              params: {
                protocolVersion: "2024-11-05",
                capabilities: {},
                clientInfo: { name: "qa-studio-ui", version: "0.1.0" },
              },
            }),
          }).catch(console.error);

          pendingRequestsRef.current.set(initId, {
            resolve: () => {
              // Once initialized, send the `initialized` notification.
              fetch(postUrl, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                  jsonrpc: "2.0",
                  method: "notifications/initialized",
                }),
              }).catch(console.error);
              setConnected(true);
            },
            reject: () => {
              disconnect();
            },
          });
        });

        es.addEventListener("message", (e: MessageEvent<string>) => {
          const msg = parseJsonRpcMessage(e.data);
          if (msg === null) {
            console.error("Error parsing message", e.data);
            return;
          }

          if (msg.id !== undefined && pendingRequestsRef.current.has(msg.id)) {
            const pending = pendingRequestsRef.current.get(msg.id);
            pendingRequestsRef.current.delete(msg.id);
            if (pending) {
              if (msg.error !== undefined) {
                pending.reject(msg.error);
              } else {
                pending.resolve(msg.result ?? { content: [] });
              }
            }
          }
        });
      } catch (err) {
        console.error("Failed to connect", err);
        disconnect();
      }
    },
    [disconnect],
  );

  /**
   * Invokes a named MCP tool on the connected server and returns the result.
   * The call is recorded in `history` with its duration; errors are also
   * persisted in the history entry.
   *
   * @param name - The MCP tool name to invoke.
   * @param args - A key-value map of arguments to pass to the tool.
   * @returns A promise that resolves with the {@link ToolCallResult} when the
   *   server responds, or rejects with the JSON-RPC error when the call fails.
   * @throws {Error} When the hook is not connected to a server.
   */
  const callTool = useCallback(
    async (name: string, args: Record<string, unknown>): Promise<ToolCallResult> => {
      if (!connected || !postUrlRef.current) {
        throw new Error("Not connected");
      }

      setIsCalling(true);
      const id = nextIdRef.current++;
      const startTime = Date.now();

      const historyItem: HistoryItem = {
        id,
        tool: name,
        args,
        timestamp: startTime,
      };

      setHistory((prev) => [historyItem, ...prev]);

      return new Promise<ToolCallResult>((resolve, reject) => {
        pendingRequestsRef.current.set(id, {
          resolve: (result) => {
            const duration = Date.now() - startTime;
            setHistory((prev) =>
              prev.map((item) => (item.id === id ? { ...item, result, duration } : item)),
            );
            setIsCalling(false);
            resolve(result);
          },
          reject: (err) => {
            const duration = Date.now() - startTime;
            setHistory((prev) =>
              prev.map((item) =>
                item.id === id
                  ? {
                      ...item,
                      error:
                        typeof err === "string"
                          ? err
                          : err instanceof Error
                            ? err.message
                            : "Unknown error",
                      duration,
                    }
                  : item,
              ),
            );
            setIsCalling(false);
            reject(err);
          },
        });

        const postUrl = postUrlRef.current;
        if (!postUrl) {
          const pending = pendingRequestsRef.current.get(id);
          pendingRequestsRef.current.delete(id);
          pending?.reject(new Error("Not connected"));
          return;
        }

        fetch(postUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            jsonrpc: "2.0",
            id,
            method: "tools/call",
            params: { name, arguments: args },
          }),
        }).catch((err: unknown) => {
          if (pendingRequestsRef.current.has(id)) {
            const pending = pendingRequestsRef.current.get(id);
            pendingRequestsRef.current.delete(id);
            pending?.reject(err);
          }
        });
      });
    },
    [connected],
  );

  // Disconnect the SSE stream on unmount to release the network connection.
  useEffect(() => {
    return () => {
      disconnect();
    };
  }, [disconnect]);

  return {
    url,
    connected,
    history,
    isCalling,
    connect,
    disconnect,
    callTool,
  };
}
