const MCP_PROXY_PATH = "/mcp";
const MCP_ACCEPT = "application/json, text/event-stream";

interface JsonRpcError {
  code?: number;
  message?: string;
}

interface JsonRpcEnvelope<T = unknown> {
  result?: T;
  error?: JsonRpcError;
}

let mcpSessionId: string | null = null;
let pendingInitialization: Promise<string> | null = null;

function makeHeaders(sessionId?: string): Headers {
  const headers = new Headers({
    "Content-Type": "application/json",
    Accept: MCP_ACCEPT,
  });
  if (sessionId) {
    headers.set("Mcp-Session-Id", sessionId);
  }
  return headers;
}

async function readJsonRpc<T>(response: Response): Promise<JsonRpcEnvelope<T> | null> {
  const text = await response.text();
  if (!text) return null;

  try {
    return JSON.parse(text) as JsonRpcEnvelope<T>;
  } catch {
    return null;
  }
}

function extractErrorMessage(
  response: Response,
  payload: JsonRpcEnvelope | null,
  fallback: string,
): string {
  return payload?.error?.message || `${fallback} (HTTP ${response.status})`;
}

async function initializeSession(): Promise<string> {
  const initResponse = await fetch(MCP_PROXY_PATH, {
    method: "POST",
    credentials: "include",
    headers: makeHeaders(),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: {
          name: "spike-land-web",
          version: "0.1.0",
        },
      },
    }),
  });

  const initPayload = await readJsonRpc(initResponse);
  if (!initResponse.ok || initPayload?.error) {
    throw new Error(extractErrorMessage(initResponse, initPayload, "Failed to initialize MCP"));
  }

  const sessionId = initResponse.headers.get("Mcp-Session-Id");
  if (!sessionId) {
    throw new Error("MCP session ID missing");
  }

  const notifyResponse = await fetch(MCP_PROXY_PATH, {
    method: "POST",
    credentials: "include",
    headers: makeHeaders(sessionId),
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
      params: {},
    }),
  });

  if (!notifyResponse.ok) {
    throw new Error(`Failed to complete MCP initialization (HTTP ${notifyResponse.status})`);
  }

  mcpSessionId = sessionId;
  return sessionId;
}

export async function ensureMcpSession(): Promise<string> {
  if (mcpSessionId) {
    return mcpSessionId;
  }

  if (!pendingInitialization) {
    pendingInitialization = initializeSession().finally(() => {
      pendingInitialization = null;
    });
  }

  return pendingInitialization;
}

async function executeTool<T>(toolName: string, args: Record<string, unknown>): Promise<T> {
  const sessionId = await ensureMcpSession();
  const response = await fetch(MCP_PROXY_PATH, {
    method: "POST",
    credentials: "include",
    headers: makeHeaders(sessionId),
    body: JSON.stringify({
      jsonrpc: "2.0",
      id: crypto.randomUUID(),
      method: "tools/call",
      params: { name: toolName, arguments: args },
    }),
  });

  const payload = await readJsonRpc<T>(response);
  if (!response.ok || payload?.error) {
    throw new Error(extractErrorMessage(response, payload, "Tool execution failed"));
  }

  return payload?.result as T;
}

export async function callMcpTool<T = unknown>(
  toolName: string,
  args: Record<string, unknown>,
): Promise<T> {
  try {
    return await executeTool<T>(toolName, args);
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    if (!message.includes("not initialized")) {
      throw error;
    }

    mcpSessionId = null;
    return executeTool<T>(toolName, args);
  }
}

export function resetMcpSession(): void {
  mcpSessionId = null;
  pendingInitialization = null;
}
