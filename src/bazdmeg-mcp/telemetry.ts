/**
 * Telemetry
 *
 * Logs all MCP tool calls and events to a local JSONL file.
 */

import { appendFile, writeFile } from "node:fs/promises";
import type { TelemetryEvent } from "./types.js";
import { getWorkspace } from "./workspace-state.js";

const TELEMETRY_PATH = "/tmp/bazdmeg-telemetry.jsonl";
const CONTEXT_LOG_PATH = "/tmp/bazdmeg-context-log.jsonl";

/**
 * Log a telemetry event to the JSONL file.
 */
export async function logEvent(event: TelemetryEvent): Promise<void> {
  const line = JSON.stringify(event) + "\n";
  try {
    await appendFile(TELEMETRY_PATH, line);
  } catch {
    // If file doesn't exist, create it
    await writeFile(TELEMETRY_PATH, line);
  }
}

/**
 * Log a tool call event.
 */
export async function logToolCall(
  toolName: string,
  input: unknown,
  resultStatus: string,
  durationMs: number,
): Promise<void> {
  await logEvent({
    eventType: "tool_call",
    tool: toolName,
    workspace: getWorkspace()?.packageName ?? null,
    metadata: {
      inputSummary: summarize(input),
      resultStatus,
      durationMs,
    },
    timestamp: new Date().toISOString(),
    durationMs,
  });
}

/**
 * Log a workspace enter event.
 */
export async function logWorkspaceEnter(
  packageName: string,
  allowedPaths: string[],
): Promise<void> {
  await logEvent({
    eventType: "workspace_enter",
    tool: "bazdmeg_enter_workspace",
    workspace: packageName,
    metadata: { allowedPaths, pathCount: allowedPaths.length },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log a workspace exit event.
 */
export async function logWorkspaceExit(packageName: string): Promise<void> {
  await logEvent({
    eventType: "workspace_exit",
    tool: "bazdmeg_exit_workspace",
    workspace: packageName,
    metadata: {},
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log a context served event.
 */
export async function logContextServed(packageName: string, items: string[]): Promise<void> {
  const contextEvent = {
    packageName,
    items,
    timestamp: new Date().toISOString(),
  };

  await logEvent({
    eventType: "context_served",
    tool: "bazdmeg_get_context",
    workspace: packageName,
    metadata: { items, itemCount: items.length },
    timestamp: contextEvent.timestamp,
  });

  // Also log to the context-specific log for the feedback loop
  const line = JSON.stringify(contextEvent) + "\n";
  try {
    await appendFile(CONTEXT_LOG_PATH, line);
  } catch {
    await writeFile(CONTEXT_LOG_PATH, line);
  }
}

/**
 * Log a context gap report.
 */
export async function logContextGap(
  packageName: string | null,
  missingContext: string,
  whatWasNeeded: string,
): Promise<void> {
  await logEvent({
    eventType: "context_gap",
    tool: "bazdmeg_report_context_gap",
    workspace: packageName,
    metadata: { missingContext, whatWasNeeded },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log a stuck signal event.
 */
export async function logStuckSignal(
  packageName: string | null,
  reason: string,
  attemptedAction: string,
): Promise<void> {
  await logEvent({
    eventType: "agent_stuck",
    tool: "bazdmeg_signal_stuck",
    workspace: packageName,
    metadata: { reason, attemptedAction },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Log a gate check event.
 */
export async function logGateCheck(
  gateName: string,
  status: string,
  detail: string,
): Promise<void> {
  await logEvent({
    eventType: "gate_check",
    tool: "bazdmeg_run_gates",
    workspace: getWorkspace()?.packageName ?? null,
    metadata: { gateName, status, detail },
    timestamp: new Date().toISOString(),
  });
}

/**
 * Summarize an input value for telemetry (avoid logging full content).
 */
function summarize(input: unknown): string {
  if (input === null || input === undefined) return "null";
  if (typeof input === "string") {
    return input.length > 100 ? input.slice(0, 100) + "..." : input;
  }
  if (typeof input === "object") {
    return Object.keys(input as Record<string, unknown>).join(", ");
  }
  return String(input);
}

/**
 * Get the telemetry file path (for tests).
 */
export function getTelemetryPath(): string {
  return TELEMETRY_PATH;
}

/**
 * Get the context log path (for tests).
 */
export function getContextLogPath(): string {
  return CONTEXT_LOG_PATH;
}
