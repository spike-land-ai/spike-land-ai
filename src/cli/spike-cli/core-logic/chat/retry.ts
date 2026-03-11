/**
 * LLM API error recovery with retry logic.
 * Wraps streaming calls with retry for transient errors (429, 500, 529).
 */

import { calculateBackoff } from "../multiplexer/reconnect.js";
import { log } from "../util/logger.js";

export interface RetryOptions {
  /** Maximum number of retries. Default: 3 */
  maxRetries?: number;
  /** Initial delay in ms. Default: 1000 */
  initialDelayMs?: number;
  /** Max delay in ms. Default: 60000 */
  maxDelayMs?: number;
}

const RETRYABLE_STATUS_CODES = new Set([429, 500, 529]);

/**
 * Check if an error is retryable (transient API errors).
 */
export function isRetryableError(error: unknown): boolean {
  if (!(error instanceof Error)) return false;

  const message = error.message.toLowerCase();

  // HTTP status code patterns
  for (const code of RETRYABLE_STATUS_CODES) {
    if (message.includes(String(code))) return true;
  }

  // Common transient error patterns
  if (message.includes("overloaded")) return true;
  if (message.includes("rate limit")) return true;
  if (message.includes("too many requests")) return true;
  if (message.includes("service unavailable")) return true;
  if (message.includes("timeout")) return true;
  if (message.includes("econnreset")) return true;
  if (message.includes("socket hang up")) return true;

  // Anthropic SDK specific
  if ("status" in error && typeof (error as Record<string, unknown>)["status"] === "number") {
    const status = (error as Record<string, unknown>)["status"] as number;
    return RETRYABLE_STATUS_CODES.has(status);
  }

  return false;
}

/**
 * Execute an async function with retry logic for transient errors.
 */
export async function withRetry<T>(fn: () => Promise<T>, options: RetryOptions = {}): Promise<T> {
  const maxRetries = options.maxRetries ?? 3;
  const initialDelayMs = options.initialDelayMs ?? 1000;
  const maxDelayMs = options.maxDelayMs ?? 60000;

  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));

      if (attempt >= maxRetries || !isRetryableError(err)) {
        throw lastError;
      }

      const delay = calculateBackoff(attempt, { initialDelayMs, maxDelayMs });
      log(
        `Retryable error (attempt ${attempt + 1}/${maxRetries}), retrying in ${delay}ms: ${lastError.message}`,
      );
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  throw lastError ?? new Error("withRetry: exhausted retries with no error captured");
}
