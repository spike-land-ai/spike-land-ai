export type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  message: string;
  requestId?: string;
  data?: Record<string, unknown>;
}

export interface Logger {
  debug(message: string, data?: Record<string, unknown>): void;
  info(message: string, data?: Record<string, unknown>): void;
  warn(message: string, data?: Record<string, unknown>): void;
  error(message: string, data?: Record<string, unknown>): void;
  withRequestId(id: string): Logger;
}

const LEVEL_ORDER: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

function buildEntry(
  level: LogLevel,
  service: string,
  message: string,
  requestId: string | undefined,
  data: Record<string, unknown> | undefined,
): LogEntry {
  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    message,
  };
  if (requestId !== undefined) entry.requestId = requestId;
  if (data !== undefined) entry.data = data;
  return entry;
}

function makeLogger(service: string, minLevel: LogLevel, requestId: string | undefined): Logger {
  function log(
    level: LogLevel,
    consoleFn: (...args: unknown[]) => void,
    message: string,
    data?: Record<string, unknown>,
  ): void {
    if (LEVEL_ORDER[level] < LEVEL_ORDER[minLevel]) return;
    consoleFn(JSON.stringify(buildEntry(level, service, message, requestId, data)));
  }

  return {
    debug: (message, data) => log("debug", console.debug, message, data),
    info: (message, data) => log("info", console.info, message, data),
    warn: (message, data) => log("warn", console.warn, message, data),
    error: (message, data) => log("error", console.error, message, data),
    withRequestId: (id) => makeLogger(service, minLevel, id),
  };
}

export function createLogger(service: string, options?: { level?: LogLevel }): Logger {
  return makeLogger(service, options?.level ?? "debug", undefined);
}
