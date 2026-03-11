/**
 * Tool execution middleware pipeline.
 * Provides validation, timeout, retry, caching, and logging middleware.
 */

import { calculateBackoff } from "../multiplexer/reconnect.js";
import { log } from "../util/logger.js";

export interface ToolCallCtx {
  toolName: string;
  input: Record<string, unknown>;
  inputSchema?: Record<string, unknown>;
  /** Abort signal for timeout support */
  signal?: AbortSignal;
}

export interface ToolExecResult {
  result: string;
  isError: boolean;
}

export type ToolHandler = (ctx: ToolCallCtx) => Promise<ToolExecResult>;
export type ToolMiddleware = (
  ctx: ToolCallCtx,
  next: () => Promise<ToolExecResult>,
) => Promise<ToolExecResult>;

/**
 * Compose an array of middleware functions with a final handler into a single function.
 */
export function composeMiddleware(
  middlewares: ToolMiddleware[],
  handler: ToolHandler,
): ToolHandler {
  return (ctx: ToolCallCtx) => {
    function dispatch(i: number): Promise<ToolExecResult> {
      if (i >= middlewares.length) {
        return handler(ctx);
      }

      const middleware = middlewares[i];
      if (!middleware) return handler(ctx);
      return middleware(ctx, () => dispatch(i + 1));
    }

    return dispatch(0);
  };
}

/**
 * Validates tool input against its JSON Schema (basic required-field check).
 */
export function validationMiddleware(): ToolMiddleware {
  return async (ctx, next) => {
    const schema = ctx.inputSchema;
    if (!schema) return next();

    const required = (schema["required"] as string[] | undefined) ?? [];
    const properties = schema["properties"] as Record<string, unknown> | undefined;

    for (const field of required) {
      if (!(field in ctx.input) || ctx.input[field] === undefined) {
        // Check if schema has a default
        const prop = properties?.[field] as Record<string, unknown> | undefined;
        if (prop && "default" in prop) continue;

        return {
          result: `Validation error: missing required field "${field}" for tool "${ctx.toolName}"`,
          isError: true,
        };
      }
    }

    // Type validation for known properties
    if (properties) {
      for (const [key, value] of Object.entries(ctx.input)) {
        const prop = properties[key] as Record<string, unknown> | undefined;
        if (!prop) continue;

        const expectedType = prop["type"] as string | undefined;
        if (!expectedType) continue;

        const actualType = typeof value;
        if (expectedType === "string" && actualType !== "string") {
          return {
            result: `Validation error: field "${key}" expected string, got ${actualType}`,
            isError: true,
          };
        }
        if (expectedType === "number" && actualType !== "number") {
          return {
            result: `Validation error: field "${key}" expected number, got ${actualType}`,
            isError: true,
          };
        }
        if (expectedType === "boolean" && actualType !== "boolean") {
          return {
            result: `Validation error: field "${key}" expected boolean, got ${actualType}`,
            isError: true,
          };
        }
      }
    }

    return next();
  };
}

/**
 * Adds a timeout to tool execution using AbortController.
 */
export function timeoutMiddleware(defaultMs: number = 30000): ToolMiddleware {
  return async (ctx, next) => {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), defaultMs);

    // Propagate abort signal to context
    const originalSignal = ctx.signal;
    ctx.signal = controller.signal;

    try {
      const result = await Promise.race([
        next(),
        new Promise<ToolExecResult>((_, reject) => {
          controller.signal.addEventListener("abort", () => {
            reject(new Error(`Tool "${ctx.toolName}" timed out after ${defaultMs}ms`));
          });
        }),
      ]);
      return result;
    } catch (err) {
      if (originalSignal?.aborted) {
        return {
          result: `Tool "${ctx.toolName}" was cancelled`,
          isError: true,
        };
      }
      if (err instanceof Error && err.message.includes("timed out")) {
        return {
          result: err.message,
          isError: true,
        };
      }
      throw err;
    } finally {
      clearTimeout(timeout);
      if (originalSignal) ctx.signal = originalSignal;
    }
  };
}

/**
 * Retries failed tool executions with exponential backoff.
 * Reuses calculateBackoff from reconnect.ts.
 */
export function retryMiddleware(maxRetries: number = 2): ToolMiddleware {
  return async (_ctx, next) => {
    let lastResult: ToolExecResult | undefined;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      const result = await next();

      if (!result.isError) {
        return result;
      }

      lastResult = result;

      // Don't retry validation errors or cancellations
      if (
        result.result.includes("Validation error") ||
        result.result.includes("was cancelled") ||
        result.result.includes("not found")
      ) {
        return result;
      }

      if (attempt < maxRetries) {
        const delay = calculateBackoff(attempt, { initialDelayMs: 500, maxDelayMs: 5000 });
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }

    return lastResult ?? { result: "", isError: false };
  };
}

/** Pattern for tools whose results can be cached (read-only operations). */
const CACHEABLE_PATTERNS = /^(list|get|search|status|describe|show|read|fetch|find|count)/;

/**
 * LRU cache for GET-like tools. Caches results for tools matching read-only patterns.
 */
export function cachingMiddleware(maxEntries: number = 100, ttlMs: number = 60000): ToolMiddleware {
  const cache = new Map<string, { result: ToolExecResult; expiry: number }>();

  return async (ctx, next) => {
    // Only cache tools matching read-only patterns
    const toolBaseName = ctx.toolName.split("__").pop() ?? ctx.toolName;
    if (!CACHEABLE_PATTERNS.test(toolBaseName)) {
      return next();
    }

    const key = `${ctx.toolName}:${JSON.stringify(ctx.input)}`;
    const now = Date.now();

    // Check cache
    const cached = cache.get(key);
    if (cached && cached.expiry > now) {
      return cached.result;
    }

    const result = await next();

    // Only cache successful results
    if (!result.isError) {
      // Evict oldest if at capacity
      if (cache.size >= maxEntries) {
        const firstKey = cache.keys().next().value;
        if (firstKey) cache.delete(firstKey);
      }
      cache.set(key, { result, expiry: now + ttlMs });
    }

    return result;
  };
}

/**
 * Logs tool execution with duration tracking.
 */
export function loggingMiddleware(): ToolMiddleware {
  return async (ctx, next) => {
    const start = Date.now();
    log(`[tool] ${ctx.toolName} started`);

    try {
      const result = await next();
      const duration = Date.now() - start;
      const status = result.isError ? "ERROR" : "OK";
      log(`[tool] ${ctx.toolName} ${status} (${duration}ms)`);
      return result;
    } catch (err) {
      const duration = Date.now() - start;
      log(`[tool] ${ctx.toolName} EXCEPTION (${duration}ms): ${err}`);
      throw err;
    }
  };
}

/**
 * Options for creating a tool executor.
 */
export interface ToolExecutorOptions {
  /** Custom middleware to apply before built-ins. Default: [] */
  middleware?: ToolMiddleware[];
  /** Enable validation middleware. Default: true */
  validation?: boolean;
  /** Timeout in ms. Set to 0 to disable. Default: 30000 */
  timeoutMs?: number;
  /** Max retries. Set to 0 to disable. Default: 0 */
  maxRetries?: number;
  /** Enable caching for GET-like tools. Default: false */
  caching?: boolean;
  /** Enable logging middleware. Default: true */
  logging?: boolean;
}

/**
 * Create a pipeline-wrapped tool executor.
 */
export function createToolPipeline(
  handler: ToolHandler,
  options: ToolExecutorOptions = {},
): ToolHandler {
  const middlewares: ToolMiddleware[] = [];

  // Custom middleware first
  if (options.middleware) {
    middlewares.push(...options.middleware);
  }

  // Built-in middleware
  if (options.logging !== false) {
    middlewares.push(loggingMiddleware());
  }

  if (options.validation !== false) {
    middlewares.push(validationMiddleware());
  }

  if (options.timeoutMs !== 0) {
    middlewares.push(timeoutMiddleware(options.timeoutMs ?? 30000));
  }

  if (options.maxRetries && options.maxRetries > 0) {
    middlewares.push(retryMiddleware(options.maxRetries));
  }

  if (options.caching) {
    middlewares.push(cachingMiddleware());
  }

  return composeMiddleware(middlewares, handler);
}
