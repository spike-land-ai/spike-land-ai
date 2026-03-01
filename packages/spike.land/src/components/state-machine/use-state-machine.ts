"use client";

import { useCallback, useRef, useState } from "react";
import type {
  ActionType,
  HistoryType,
  MachineExport,
  MachineSummary,
  StateNode,
  StateType,
  Transition,
  TransitionLogEntry,
  ValidationIssue,
} from "@/lib/state-machine/types";

// Re-export types for convenience
export type {
  ActionType,
  HistoryType,
  MachineExport,
  MachineSummary,
  StateNode,
  StateType,
  Transition,
  TransitionLogEntry,
  ValidationIssue,
};

// ---------------------------------------------------------------------------
// MCP Proxy helper
// ---------------------------------------------------------------------------

interface McpProxyResponse {
  result?: {
    content: Array<{ type: string; text: string; }>;
  };
  error?: string;
}

export async function mcpCall(
  tool: string,
  params: Record<string, unknown>,
  retryCount = 0,
): Promise<string> {
  const MAX_RETRIES = 2;
  try {
    const res = await fetch("/api/mcp/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ tool, params }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`MCP proxy error (${res.status}): ${text}`);
    }

    const data: McpProxyResponse = await res.json();

    if (data.error) {
      throw new Error(data.error);
    }

    const text = data.result?.content?.[0]?.text;
    if (!text) {
      throw new Error("Empty response from MCP proxy");
    }

    return text;
  } catch (error) {
    if (retryCount < MAX_RETRIES) {
      console.warn(
        `[MCP] Call failed for ${tool}, retrying (${retryCount + 1}/${MAX_RETRIES})...`,
        error,
      );
      // Exponential backoff: 500ms, 1500ms
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(3, retryCount)));
      return mcpCall(tool, params, retryCount + 1);
    }
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Types for hook state
// ---------------------------------------------------------------------------

export interface MachineTab {
  id: string;
  name: string;
  stateCount: number;
  transitionCount: number;
  hasUnsavedChanges: boolean;
}

export interface MachineState {
  activeStates: string[];
  context: Record<string, unknown>;
}

export interface MachineData {
  definition: {
    id: string;
    name: string;
    initial: string;
    states: Record<string, StateNode>;
    transitions: Transition[];
    context: Record<string, unknown>;
    userId: string;
  };
  currentStates: string[];
  context: Record<string, unknown>;
  history: Record<string, string[]>;
  transitionLog: TransitionLogEntry[];
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useStateMachine() {
  const [machines, setMachines] = useState<MachineTab[]>([]);
  const [activeMachineId, setActiveMachineId] = useState<string | null>(null);
  const [machineData, setMachineData] = useState<Record<string, MachineData>>(
    {},
  );
  const [validationIssues, setValidationIssues] = useState<
    Record<string, ValidationIssue[]>
  >({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<NodeJS.Timeout | null>(null);

  const clearError = useCallback(() => setError(null), []);

  // ── List machines ──────────────────────────────────────────────────
  const listMachines = useCallback(async () => {
    try {
      const text = await mcpCall("sm_list", {});
      const tabs: MachineTab[] = [];
      const lines = text.split("\n");
      for (const line of lines) {
        // - `id` **name** — 2 states, 1 transitions
        const match = line.match(
          /- \`([^`]+)\` \*\*(.*?)\*\* — (\d+) states, (\d+) transitions/,
        );
        if (match) {
          tabs.push({
            id: match[1] || "",
            name: match[2] || "",
            stateCount: parseInt(match[3] || "0", 10),
            transitionCount: parseInt(match[4] || "0", 10),
            hasUnsavedChanges: false,
          });
        }
      }
      setMachines(tabs);
      return tabs;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to list machines");
      return [];
    }
  }, []);

  // ── Create machine ─────────────────────────────────────────────────
  const createMachine = useCallback(
    async (
      name: string,
      initialState?: string,
      context?: Record<string, unknown>,
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, unknown> = { name };
        if (initialState) params.initial_state = initialState;
        if (context) params.context = context;

        const text = await mcpCall("sm_create", params);

        const idMatch = text.match(/- \*\*ID:\*\* \`([^`]+)\`/);
        const nameMatch = text.match(/- \*\*Name:\*\* (.*)/);

        const id = idMatch
          ? idMatch[1] || `unknown-${Date.now()}`
          : `unknown-${Date.now()}`;
        const machineName = nameMatch ? (nameMatch[1] || name).trim() : name;

        const newTab: MachineTab = {
          id: id,
          name: machineName,
          stateCount: 0,
          transitionCount: 0,
          hasUnsavedChanges: false,
        };
        setMachines(prev => [...prev, newTab]);
        setActiveMachineId(id);
        return id;
      } catch (err) {
        console.error("[useStateMachine] createMachine error:", err);
        setError(
          err instanceof Error ? err.message : "Failed to create machine",
        );
        return null;
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  // ── Refresh machine data (export full state) ──────────────────────
  const refreshMachine = useCallback(async (machineId: string) => {
    try {
      const text = await mcpCall("sm_export", { machine_id: machineId });

      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      if (!jsonMatch || !jsonMatch[1]) {
        console.error("[useStateMachine] regex failed to match on text:", text);
        throw new Error("No JSON payload in export response");
      }

      const exported: MachineData = JSON.parse(jsonMatch[1]);
      setMachineData(prev => ({ ...prev, [machineId]: exported }));

      // Update tab counts
      setMachines(prev =>
        prev.map(m =>
          m.id === machineId
            ? {
              ...m,
              stateCount: Object.keys(exported.definition.states).length,
              transitionCount: exported.definition.transitions.length,
            }
            : m
        )
      );

      return exported;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to refresh machine",
      );
      return null;
    }
  }, []);

  // ── Add state ──────────────────────────────────────────────────────
  const addState = useCallback(
    async (
      machineId: string,
      stateId: string,
      type: StateType = "atomic",
      options?: {
        parent?: string;
        initial?: string;
        entry_actions?: Array<
          { type: ActionType; params: Record<string, unknown>; }
        >;
        exit_actions?: Array<
          { type: ActionType; params: Record<string, unknown>; }
        >;
        history_type?: HistoryType;
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, unknown> = {
          machine_id: machineId,
          state_id: stateId,
          type,
          ...options,
        };
        await mcpCall("sm_add_state", params);
        await refreshMachine(machineId);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to add state");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [refreshMachine],
  );

  // ── Remove state ───────────────────────────────────────────────────
  const removeState = useCallback(
    async (machineId: string, stateId: string) => {
      setLoading(true);
      setError(null);
      try {
        await mcpCall("sm_remove_state", {
          machine_id: machineId,
          state_id: stateId,
        });
        await refreshMachine(machineId);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove state");
        return false;
      } finally {
        setLoading(false);
      }
    },
    [refreshMachine],
  );

  // ── Add transition ─────────────────────────────────────────────────
  const addTransition = useCallback(
    async (
      machineId: string,
      source: string,
      target: string,
      event: string,
      options?: {
        guard_expression?: string;
        actions?: Array<{ type: ActionType; params: Record<string, unknown>; }>;
        internal?: boolean;
        delay_expression?: string;
      },
    ) => {
      setLoading(true);
      setError(null);
      try {
        const params: Record<string, unknown> = {
          machine_id: machineId,
          source,
          target,
          event,
          ...options,
        };
        await mcpCall("sm_add_transition", params);
        await refreshMachine(machineId);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to add transition",
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [refreshMachine],
  );

  // ── Remove transition ──────────────────────────────────────────────
  const removeTransition = useCallback(
    async (machineId: string, transitionId: string) => {
      setLoading(true);
      setError(null);
      try {
        await mcpCall("sm_remove_transition", {
          machine_id: machineId,
          transition_id: transitionId,
        });
        await refreshMachine(machineId);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to remove transition",
        );
        return false;
      } finally {
        setLoading(false);
      }
    },
    [refreshMachine],
  );

  // ── Send event ─────────────────────────────────────────────────────
  const sendEvent = useCallback(
    async (
      machineId: string,
      event: string,
      payload?: Record<string, unknown>,
    ) => {
      setError(null);
      try {
        const params: Record<string, unknown> = {
          machine_id: machineId,
          event,
        };
        if (payload) params.payload = payload;
        await mcpCall("sm_send_event", params);
        await refreshMachine(machineId);
        return null;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to send event");
        return null;
      }
    },
    [refreshMachine],
  );

  // ── Get state ──────────────────────────────────────────────────────
  const getState = useCallback(async (machineId: string) => {
    try {
      const text = await mcpCall("sm_get_state", { machine_id: machineId });
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      return jsonMatch && jsonMatch[1]
        ? {
          activeStates: [],
          context: JSON.parse(jsonMatch[1]),
        } as MachineState
        : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get state");
      return null;
    }
  }, []);

  // ── Get history ────────────────────────────────────────────────────
  const getHistory = useCallback(async (machineId: string, limit?: number) => {
    try {
      const params: Record<string, unknown> = { machine_id: machineId };
      if (limit) params.limit = limit;
      await mcpCall("sm_get_history", params);
      return [];
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to get history");
      return [];
    }
  }, []);

  // ── Reset machine ──────────────────────────────────────────────────
  const resetMachine = useCallback(
    async (machineId: string) => {
      setError(null);
      try {
        await mcpCall("sm_reset", { machine_id: machineId });
        await refreshMachine(machineId);
        return true;
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Failed to reset machine",
        );
        return false;
      }
    },
    [refreshMachine],
  );

  // ── Validate machine ──────────────────────────────────────────────
  const validateMachine = useCallback(async (machineId: string) => {
    try {
      const text = await mcpCall("sm_validate", {
        machine_id: machineId,
      });
      const issues: ValidationIssue[] = [];
      const lines = text.split("\n");
      for (const line of lines) {
        const match = line.match(
          /- \*\*\[(ERROR|WARNING)\]\*\* (.*?)(?: \(state: \`([^`]+)\`\))?(?: \(transition: \`([^`]+)\`\))?/,
        );
        if (match && match[1]) {
          issues.push({
            level: match[1].toLowerCase() as "error" | "warning",
            message: match[2] || "",
            ...(match[3] !== undefined ? { stateId: match[3] } : {}),
            ...(match[4] !== undefined ? { transitionId: match[4] } : {}),
          });
        }
      }
      setValidationIssues(prev => ({ ...prev, [machineId]: issues }));
      return issues;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Failed to validate machine",
      );
      return [];
    }
  }, []);

  // ── Export machine ─────────────────────────────────────────────────
  const exportMachine = useCallback(async (machineId: string) => {
    try {
      const text = await mcpCall("sm_export", { machine_id: machineId });
      const jsonMatch = text.match(/```json\n([\s\S]*?)\n```/);
      return jsonMatch && jsonMatch[1]
        ? JSON.parse(jsonMatch[1]) as MachineExport
        : null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to export machine");
      return null;
    }
  }, []);

  // ── Share machine ──────────────────────────────────────────────────
  const shareMachine = useCallback(async (machineId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = machineData[machineId];
      const text = await mcpCall("sm_share", {
        machine_id: machineId,
        machine_data: data ?? undefined,
      });
      const tokenMatch = text.match(/- \*\*Token:\*\* \`([^`]+)\`/);
      const urlMatch = text.match(/- \*\*Link:\*\* \[(.*?)\]/);
      if (tokenMatch && urlMatch) {
        return { token: tokenMatch[1] || "", url: urlMatch[1] || "" };
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to share machine");
      return null;
    } finally {
      setLoading(false);
    }
  }, [machineData]);

  // ── Set context ────────────────────────────────────────────────────
  const setContext = useCallback(
    async (machineId: string, context: Record<string, unknown>) => {
      setError(null);
      try {
        await mcpCall("sm_set_context", {
          machine_id: machineId,
          context,
        });
        await refreshMachine(machineId);
        return true;
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to set context");
        return false;
      }
    },
    [refreshMachine],
  );

  // ── Switch active machine ──────────────────────────────────────────
  const switchMachine = useCallback(
    async (machineId: string) => {
      setActiveMachineId(machineId);
      if (!machineData[machineId]) {
        await refreshMachine(machineId);
      }
    },
    [machineData, refreshMachine],
  );

  // ── Close machine tab ──────────────────────────────────────────────
  const closeMachine = useCallback(
    (machineId: string) => {
      setMachines(prev => prev.filter(m => m.id !== machineId));
      setMachineData(prev => {
        const next = { ...prev };
        delete next[machineId];
        return next;
      });
      setValidationIssues(prev => {
        const next = { ...prev };
        delete next[machineId];
        return next;
      });
      if (activeMachineId === machineId) {
        setMachines(prev => {
          const remaining = prev.filter(m => m.id !== machineId);
          const first = remaining[0];
          setActiveMachineId(first ? first.id : null);
          return remaining;
        });
      }
    },
    [activeMachineId],
  );

  // Computed
  const activeMachine = activeMachineId
    ? machineData[activeMachineId] ?? null
    : null;
  const activeValidation = activeMachineId
    ? validationIssues[activeMachineId] ?? []
    : [];

  return {
    // State
    machines,
    activeMachineId,
    activeMachine,
    activeValidation,
    machineData,
    loading,
    error,

    // Actions
    listMachines,
    createMachine,
    refreshMachine,
    addState,
    removeState,
    addTransition,
    removeTransition,
    sendEvent,
    getState,
    getHistory,
    resetMachine,
    validateMachine,
    exportMachine,
    shareMachine,
    setContext,
    switchMachine,
    closeMachine,
    clearError,
    setActiveMachineId,
    pollRef,
  };
}

export type UseStateMachine = ReturnType<typeof useStateMachine>;
