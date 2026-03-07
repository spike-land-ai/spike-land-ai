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

export function useAppSession(slug: string, graph: Record<string, unknown>, tools: string[]) {
  const sessionKey = `mcp-session-${slug}`;

  const [session, setSession] = useState<AppSession>(() => {
    try {
      const stored = sessionStorage.getItem(sessionKey);
      if (stored) return JSON.parse(stored);
    } catch {
      // ignore
    }
    return {
      appSlug: slug,
      outputs: {},
      history: [],
      availableTools: [],
    };
  });

  // Recompute available tools based on current outputs
  const computeAvailableTools = useCallback((outputs: Record<string, unknown>) => {
    return tools.filter((tool) => {
      const toolGraph = graph[tool] as { always_available?: boolean; inputs?: Record<string, unknown> } | undefined;
      if (!toolGraph) return true; // Default available if no graph def
      if (toolGraph.always_available) return true;

      // Check inputs dependencies
      const inputs = toolGraph.inputs || {};
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
  }, [graph, tools]);

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

  const recordToolResult = useCallback((toolName: string, input: Record<string, unknown>, result: unknown) => {
    setSession((prev) => {
      const toolGraph = graph[toolName] as { outputs?: Record<string, string> } | undefined;
      const newOutputs = { ...prev.outputs };

      if (toolGraph && toolGraph.outputs) {
        // Map result keys to session outputs
        // E.g. { "set_id": "string" }
        // If result is object, we extract it.
        const resObj = typeof result === "string" ? { text: result } : (result as Record<string, unknown> || {});
        
        for (const outKey of Object.keys(toolGraph.outputs)) {
          // Attempt to find the output either in raw JSON or by assuming the result has it
          let valToSave = undefined;
          if (resObj && typeof resObj === "object" && outKey in resObj) {
            valToSave = resObj[outKey];
          } else if (resObj && Array.isArray(resObj.content)) {
            // Try to extract from text block
            const textBlock = resObj.content.find((c: Record<string, unknown>) => c.type === "text") as { text?: string } | undefined;
            if (textBlock && textBlock.text) {
              try {
                const parsed = JSON.parse(textBlock.text);
                if (parsed && typeof parsed === "object" && outKey in parsed) {
                  valToSave = parsed[outKey];
                }
              } catch (e) {
                console.warn(`Failed to parse JSON from text block for tool ${toolName}`, e);
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
  }, [graph]);

  const resetSession = useCallback(() => {
    setSession({
      appSlug: slug,
      outputs: {},
      history: [],
      availableTools: computeAvailableTools({}),
    });
  }, [slug, computeAvailableTools]);

  const isToolAvailable = useCallback((toolName: string) => {
    return session.availableTools.includes(toolName);
  }, [session.availableTools]);

  return { session, recordToolResult, resetSession, isToolAvailable };
}
