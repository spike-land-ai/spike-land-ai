/**
 * Structured Logger
 *
 * Provides consistent logging across the application with automatic
 * sanitization of PII and sensitive tokens/keys.
 */

// Patterns to scrub from logs
const SENSITIVE_PATTERNS = [
  // Session/Auth tokens
  /(?:Bearer\s+|token=)([a-zA-Z0-9_\-\.]+)/gi,
  // API Keys (sk_..., pk_...)
  /(?:api_key|apiKey|secret|password|access_token|refresh_token)[\s=:]*['"]?([^'"&\s;]+)['"]?/gi,
  // Common PII formats (basic email matching for logs context)
  // Bounded lengths prevent catastrophic backtracking on long inputs without '@'
  /([a-zA-Z0-9._%+-]{1,64}@[a-zA-Z0-9.-]{1,253}\.[a-zA-Z]{2,})/g,
];

/**
 * Sanitizes a string or object by masking sensitive information.
 */
export function sanitizeLogData(data: unknown): unknown {
  if (data === null || data === undefined) {
    return data;
  }

  if (typeof data === "string") {
    let sanitized = data;
    for (const pattern of SENSITIVE_PATTERNS) {
      sanitized = sanitized.replace(pattern, (match, group1) => {
        if (group1) {
          return match.replace(group1, "[REDACTED]");
        }
        return "[REDACTED]";
      });
    }
    return sanitized;
  }

  if (data instanceof Error) {
    return {
      name: data.name,
      message: sanitizeLogData(data.message),
      // Only include stack in development or if specifically requested,
      // but scrub it if we do include it.
      stack: process.env.NODE_ENV === "development"
        ? sanitizeLogData(data.stack)
        : undefined,
    };
  }

  if (typeof data === "object") {
    if (Array.isArray(data)) {
      return data.map(sanitizeLogData);
    }

    const sanitizedObj: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(data)) {
      // Blanket redact known sensitive keys
      if (/password|secret|token|key/i.test(key)) {
        sanitizedObj[key] = "[REDACTED]";
      } else {
        sanitizedObj[key] = sanitizeLogData(value);
      }
    }
    return sanitizedObj;
  }

  return data;
}

export type LogContext = Record<string, unknown>;

export const logger = {
  info: (message: string, context?: LogContext) => {
    const sanitizedContext = sanitizeLogData(context);
    console.log(JSON.stringify({
      level: "info",
      timestamp: new Date().toISOString(),
      message: sanitizeLogData(message),
      context: sanitizedContext,
    }));
  },

  warn: (message: string, context?: LogContext) => {
    const sanitizedContext = sanitizeLogData(context);
    console.warn(JSON.stringify({
      level: "warn",
      timestamp: new Date().toISOString(),
      message: sanitizeLogData(message),
      context: sanitizedContext,
    }));
  },

  error: (message: string, error?: unknown, context?: LogContext) => {
    const sanitizedError = sanitizeLogData(error);
    const sanitizedContext = sanitizeLogData(context);
    console.error(JSON.stringify({
      level: "error",
      timestamp: new Date().toISOString(),
      message: sanitizeLogData(message),
      error: sanitizedError,
      context: sanitizedContext,
    }));
  },

  debug: (message: string, context?: LogContext) => {
    const sanitizedContext = sanitizeLogData(context);
    console.debug(JSON.stringify({
      level: "debug",
      timestamp: new Date().toISOString(),
      message: sanitizeLogData(message),
      context: sanitizedContext,
    }));
  },
};

export default logger;
