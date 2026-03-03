import { McpAuthError, McpRateLimitError, McpRpcError } from "./errors";
import { tokenManager } from "./token-manager";
import type { CallToolResult, JsonRpcResponse } from "./types";

export interface CallToolOptions {
  signal?: AbortSignal;
}

/**
 * Call an MCP tool via the JSON-RPC proxy
 */
export async function callTool<T = unknown>(
  name: string,
  args: unknown = {},
  options: CallToolOptions = {},
  _retried = false,
  _enableRetried = false,
): Promise<T> {
  const token = await tokenManager.getToken();
  if (!token) throw new McpAuthError();

  const response = await fetch("/api/mcp", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({
      jsonrpc: "2.0",
      method: "tools/call",
      params: {
        name,
        arguments: args,
      },
      id: Math.random().toString(36).substring(7),
    }),
    signal: options.signal,
  });

  if (response.status === 401) {
    if (_retried) throw new McpAuthError();
    tokenManager.clear();
    const newToken = await tokenManager.getToken();
    if (!newToken) throw new McpAuthError();
    return callTool(name, args, options, true, _enableRetried);
  }

  if (response.status === 429) {
    throw new McpRateLimitError();
  }

  if (!response.ok) {
    throw new Error(`MCP request failed with status ${response.status}`);
  }

  const rpcResponse: JsonRpcResponse<CallToolResult> = await response.json();

  if (rpcResponse.error) {
    // Auto-enable disabled tools: call search_tools to enable, then retry once
    const disabledMatch = rpcResponse.error.message.match(
      /^Tool (\S+) (?:disabled|not found)$/,
    );
    if (disabledMatch && !_enableRetried) {
      await callTool(
        "search_tools",
        { query: disabledMatch[1] },
        options,
        _retried,
        true,
      );
      return callTool(name, args, options, _retried, true);
    }

    throw new McpRpcError(
      rpcResponse.error.code,
      rpcResponse.error.message,
      rpcResponse.error.data,
    );
  }

  if (rpcResponse.result?.isError) {
    const message = rpcResponse.result.content
      .filter(c => c.type === "text")
      .map(c => c.text)
      .join("\n");

    // Auto-enable disabled tools from isError results (MCP SDK may wrap
    // disabled/not-found McpError into a CallToolResult with isError:true)
    const disabledResultMatch = message.match(
      /^Tool (\S+) (?:disabled|not found)$/,
    );
    if (disabledResultMatch && !_enableRetried) {
      await callTool(
        "search_tools",
        { query: disabledResultMatch[1] },
        options,
        _retried,
        true,
      );
      return callTool(name, args, options, _retried, true);
    }

    throw new Error(message || `Tool ${name} reported an error`);
  }

  // MCP results are wrapped in a content array. By convention, we return the parsed JSON
  // if the first content item is text that looks like JSON, or the raw content if not.
  const textContent = rpcResponse.result?.content.find(c => c.type === "text")
    ?.text;

  if (textContent) {
    try {
      return JSON.parse(textContent);
    } catch {
      return textContent as T;
    }
  }

  return rpcResponse.result as T;
}
