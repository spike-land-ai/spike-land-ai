import { useState, useEffect, useCallback } from "react";

export interface AppHistoryEntry {
  tool: string;
  input: Record<string, unknown>;
  result: unknown;
  timestamp: number;
}

export interface AppSession {
  appSlug: string;
  outputs: Record<string, unknown>;
  history: AppHistoryEntry[];
  availableTools: string[];
}

/** Shape of a tool's graph node that describes availability and I/O contracts. */
interface ToolGraphNode {
  always_available?: boolean;
  inputs?: Record<string, string>;
  outputs?: Record<string, string>;
}

/** A content-block array result returned by some MCP tools. */
interface ContentBlock {
  type: string;
  text?: string;
}

/** Result shape that wraps content blocks (e.g. from Claude tool-use responses). */
interface ContentBlockResult {
  content: ContentBlock[];
  [key: string]: unknown;
}

function isContentBlockResult(value: unknown): value is ContentBlockResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "content" in value &&
    Array.isArray((value as ContentBlockResult).content)
  );
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Manages per-app session state including tool outputs, call history, and
 * availability computed from the app's tool dependency graph.
 *
 * Session state is persisted to `sessionStorage` using the key
 * `mcp-session-<slug>` so it survives page reloads within the same browser tab.
 *
 * @param slug - The slug of the MCP app being run (used as the storage key).
 * @param graph - The app's tool dependency graph keyed by tool name. Each node
 *   may declare `always_available`, `inputs` (dependency refs), and `outputs`.
 * @param tools - Ordered list of all tool names exposed by the app.
 * @returns An object containing the current {@link AppSession}, helpers to
 *   record tool results, reset the session, and query tool availability.
 */
export function useAppSession(slug: string, graph: Record<string, unknown>, tools: string[]) {
  const sessionKey = `mcp-session-${slug}`;

  const [session, setSession] = useState<AppSession>(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored) return JSON.parse(stored) as AppSession;
    } catch (err) {
      console.error("Failed to parse session storage:", err);
    }
    return {
      appSlug: slug,
      outputs: {},
      history: [],
      availableTools: [],
    };
  });

  // Recompute available tools based on current outputs
  const computeAvailableTools = useCallback(
    (outputs: Record<string, unknown>) => {
      return tools.filter((tool) => {
        const node = graph[tool];
        const toolGraph: ToolGraphNode | undefined = isPlainObject(node)
          ? (node as ToolGraphNode)
          : undefined;

        if (!toolGraph) return true; // Default available if no graph def
        if (toolGraph.always_available) return true;

        // Check inputs dependencies
        const inputs = toolGraph.inputs ?? {};
        for (const val of Object.values(inputs)) {
          if (typeof val === "string" && val.startsWith("from:")) {
            const path = val.slice(5); // e.g., "tool_name.output_key"
            if (outputs[path] === undefined) {
              return false;
            }
          }
        }
        return true;
      });
    },
    [graph, tools],
  );

  // Update available tools when session state changes
  useEffect(() => {
    const available = computeAvailableTools(session.outputs);
    setSession((s) => {
      // Only update if array actually changed to avoid render loops
      if (JSON.stringify(s.availableTools) !== JSON.stringify(available)) {
        return { ...s, availableTools: available };
      }
      return s;
    });
  }, [session.outputs, computeAvailableTools]);

  // Persist session
  useEffect(() => {
    sessionStorage.setItem(sessionKey, JSON.stringify(session));
  }, [session, sessionKey]);

  /**
   * Records the result of a tool invocation into session outputs and history.
   * Output values are extracted from the result using the graph's output key
   * definitions, supporting plain objects, string results, and content-block
   * arrays from MCP responses.
   *
   * @param toolName - The name of the tool that was called.
   * @param input - The input arguments passed to the tool.
   * @param result - The raw result returned by the tool.
   */
  const recordToolResult = useCallback(
    (toolName: string, input: Record<string, unknown>, result: unknown) => {
      setSession((prev) => {
        const node = graph[toolName];
        const toolGraph: ToolGraphNode | undefined = isPlainObject(node)
          ? (node as ToolGraphNode)
          : undefined;

        const newOutputs = { ...prev.outputs };

        if (toolGraph?.outputs) {
          // Normalise result into a key-value object for output extraction.
          const resObj: Record<string, unknown> =
            typeof result === "string" ? { text: result } : isPlainObject(result) ? result : {};

          for (const outKey of Object.keys(toolGraph.outputs)) {
            let valToSave: unknown;

            if (outKey in resObj) {
              valToSave = resObj[outKey];
            } else if (isContentBlockResult(result)) {
              // Try to extract from text block containing JSON
              const textBlock = result.content.find(
                (block): block is ContentBlock & { text: string } =>
                  block.type === "text" && typeof block.text === "string",
              );
              if (textBlock) {
                try {
                  const parsed: unknown = JSON.parse(textBlock.text);
                  if (isPlainObject(parsed) && outKey in parsed) {
                    valToSave = parsed[outKey];
                  }
                } catch {
                  console.warn(`Failed to parse JSON from text block for tool ${toolName}`);
                }
              }
            }

            if (valToSave !== undefined) {
              newOutputs[`${toolName}.${outKey}`] = valToSave;
            }
          }
        }

        return {
          ...prev,
          outputs: newOutputs,
          history: [...prev.history, { tool: toolName, input, result, timestamp: Date.now() }],
        };
      });
    },
    [graph],
  );

  /**
   * Resets the session back to its initial state, clearing all outputs and
   * history while recomputing the initial set of available tools.
   */
  const resetSession = useCallback(() => {
    setSession({
      appSlug: slug,
      outputs: {},
      history: [],
      availableTools: computeAvailableTools({}),
    });
  }, [slug, computeAvailableTools]);

  /**
   * Returns `true` when the named tool is currently available given the
   * session's accumulated outputs and the graph's dependency declarations.
   *
   * @param toolName - The tool name to check.
   */
  const isToolAvailable = useCallback(
    (toolName: string) => {
      return session.availableTools.includes(toolName);
    },
    [session.availableTools],
  );

  return { session, recordToolResult, resetSession, isToolAvailable };
}
