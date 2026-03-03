/**
 * Structured logging utility with request IDs for debugging
 */

import { randomBytes } from "crypto";

type LogLevel = "debug" | "info" | "warn" | "error";

export interface LogContext {
  requestId?: string;
  userId?: string;
  sessionId?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  duration?: number;
  [key: string]: unknown;
}

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  requestId: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
  };
}

/**
 * Generate a unique request ID
 */
export function generateRequestId(): string {
  return randomBytes(16).toString("hex");
}

/**
 * Structured logger class
 */
class StructuredLogger {
  private environment: string;
  private enableConsole: boolean;
  private enableJson: boolean;

  constructor() {
    this.environment = process.env.NODE_ENV || "development";
    this.enableConsole = this.environment === "development";
    this.enableJson = this.environment === "production";
  }

  /**
   * Create a log entry
   */
  private createLogEntry(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: Error,
  ): LogEntry {
    const entry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      requestId: context?.requestId || generateRequestId(),
      ...(context && { context }),
      ...(error && {
        error: {
          name: error.name,
          message: error.message,
          stack: error.stack,
        },
      }),
    };

    return entry;
  }

  /**
   * Format log entry for console output
   */
  private formatForConsole(entry: LogEntry): string {
    const levelColors: Record<LogLevel, string> = {
      debug: "\x1b[36m", // Cyan
      info: "\x1b[32m", // Green
      warn: "\x1b[33m", // Yellow
      error: "\x1b[31m", // Red
    };
    const reset = "\x1b[0m";
    const color = levelColors[entry.level];

    const parts = [
      `${color}[${entry.level.toUpperCase()}]${reset}`,
      `[${entry.requestId.slice(0, 8)}]`,
      entry.message,
    ];

    if (entry.context) {
      const contextStr = Object.entries(entry.context)
        .filter(([key]) => key !== "requestId")
        .map(([key, value]) => `${key}=${JSON.stringify(value)}`)
        .join(" ");
      if (contextStr) {
        parts.push(`| ${contextStr}`);
      }
    }

    if (entry.error) {
      parts.push(`\n  Error: ${entry.error.message}`);
      if (entry.error.stack) {
        parts.push(`\n  Stack: ${entry.error.stack}`);
      }
    }

    return parts.join(" ");
  }

  /**
   * Output log entry
   */
  private output(entry: LogEntry): void {
    if (this.enableJson) {
      // In production, output JSON for log aggregation services
      console.log(JSON.stringify(entry));
    } else if (this.enableConsole) {
      // In development, output formatted console logs
      const formatted = this.formatForConsole(entry);
      switch (entry.level) {
        case "error":
          console.error(formatted);
          break;
        case "warn":
          console.warn(formatted);
          break;
        case "info":
          console.info(formatted);
          break;
        case "debug":
          console.debug(formatted);
          break;
      }
    }
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    if (this.environment === "development") {
      const entry = this.createLogEntry("debug", message, context);
      this.output(entry);
    }
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    const entry = this.createLogEntry("info", message, context);
    this.output(entry);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    const entry = this.createLogEntry("warn", message, context);
    this.output(entry);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const entry = this.createLogEntry("error", message, context, error);
    this.output(entry);
  }

  /**
   * Create a child logger with inherited context
   */
  child(context: LogContext): ChildLogger {
    return new ChildLogger(this, context);
  }
}

/**
 * Child logger with inherited context
 */
class ChildLogger {
  constructor(
    private parent: StructuredLogger,
    private inheritedContext: LogContext,
  ) {}

  private mergeContext(context?: LogContext): LogContext {
    return { ...this.inheritedContext, ...context };
  }

  debug(message: string, context?: LogContext): void {
    this.parent.debug(message, this.mergeContext(context));
  }

  info(message: string, context?: LogContext): void {
    this.parent.info(message, this.mergeContext(context));
  }

  warn(message: string, context?: LogContext): void {
    this.parent.warn(message, this.mergeContext(context));
  }

  error(message: string, error?: Error, context?: LogContext): void {
    this.parent.error(message, error, this.mergeContext(context));
  }

  child(context: LogContext): ChildLogger {
    return new ChildLogger(this.parent, this.mergeContext(context));
  }
}

// Export singleton instance
export const logger = new StructuredLogger();

// Export class for testing
export { StructuredLogger };
