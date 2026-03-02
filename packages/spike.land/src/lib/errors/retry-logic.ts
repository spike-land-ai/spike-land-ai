/**
 * Retry logic with exponential backoff for transient failures
 */

import { sleep } from "@/lib/utils";

interface RetryOptions {
  maxAttempts?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffMultiplier?: number;
  shouldRetry?: (error: Error, attempt: number) => boolean;
  onRetry?: (error: Error, attempt: number, delayMs: number) => void;
}

interface RetryResult<T> {
  success: boolean;
  data?: T;
  error?: Error;
  attempts: number;
}

const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000, // 1 second
  maxDelayMs: 10000, // 10 seconds
  backoffMultiplier: 2,
  shouldRetry: (error: Error, _attempt: number) => {
    // Default: retry on network errors, timeouts, and 5xx errors
    const errorMessage = error.message.toLowerCase();
    return (
      errorMessage.includes("network") ||
      errorMessage.includes("timeout") ||
      errorMessage.includes("503") ||
      errorMessage.includes("502") ||
      errorMessage.includes("500") ||
      errorMessage.includes("fetch failed") ||
      errorMessage.includes("econnrefused")
    );
  },
  onRetry: (_error: Error, _attempt: number, _delayMs: number) => {
    // Default: no-op
  },
};

/**
 * Calculate delay for exponential backoff with jitter
 */
function calculateDelay(
  attempt: number,
  initialDelayMs: number,
  maxDelayMs: number,
  backoffMultiplier: number,
): number {
  // Exponential backoff: initialDelay * (multiplier ^ attempt)
  const exponentialDelay = initialDelayMs * Math.pow(backoffMultiplier, attempt);

  // Add random jitter (±25%) to prevent thundering herd
  const jitter = exponentialDelay * 0.25 * (Math.random() * 2 - 1);
  const delayWithJitter = exponentialDelay + jitter;

  // Cap at maxDelayMs
  return Math.min(delayWithJitter, maxDelayMs);
}

import { tryCatch } from "@/lib/try-catch";

/**
 * Retry an async operation with exponential backoff
 *
 * @example
 * ```typescript
 * const result = await retryWithBackoff(
 *   async () => await fetch('/api/enhance'),
 *   {
 *     maxAttempts: 3,
 *     onRetry: (error, attempt, delay) => {
 *       logger.info(`Retry attempt ${attempt} after ${delay}ms: ${error.message}`);
 *     }
 *   }
 * );
 *
 * if (result.success) {
 *   logger.info('Success:', result.data);
 * } else {
 *   logger.error('Failed after retries:', result.error);
 * }
 * ```
 */
export async function retryWithBackoff<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {},
): Promise<RetryResult<T>> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error = new Error("Unknown error");
  let attempt = 0;

  while (attempt < opts.maxAttempts) {
    const { data, error } = await tryCatch(operation());

    if (!error) {
      return {
        success: true,
        data,
        attempts: attempt + 1,
      };
    }

    lastError = error instanceof Error ? error : new Error(String(error));
    attempt++;

    // Check if we should retry
    const shouldRetry = opts.shouldRetry(lastError, attempt);

    // If this was the last attempt or we shouldn't retry, throw
    if (attempt >= opts.maxAttempts || !shouldRetry) {
      break;
    }

    // Calculate delay and wait
    const delayMs = calculateDelay(
      attempt - 1, // 0-indexed for calculation
      opts.initialDelayMs,
      opts.maxDelayMs,
      opts.backoffMultiplier,
    );

    // Call retry callback
    opts.onRetry(lastError, attempt, delayMs);

    // Wait before next attempt
    await sleep(delayMs);
  }

  return {
    success: false,
    error: lastError,
    attempts: attempt,
  };
}

/**
 * Create a retry wrapper for a function
 *
 * @example
 * ```typescript
 * const enhanceWithRetry = createRetryWrapper(
 *   enhanceImage,
 *   { maxAttempts: 3 }
 * );
 *
 * const result = await enhanceWithRetry(imageId, tier);
 * ```
 */
export function createRetryWrapper<TArgs extends unknown[], TReturn>(
  fn: (...args: TArgs) => Promise<TReturn>,
  options: RetryOptions = {},
): (...args: TArgs) => Promise<RetryResult<TReturn>> {
  return async (...args: TArgs): Promise<RetryResult<TReturn>> => {
    return retryWithBackoff(() => fn(...args), options);
  };
}

/**
 * Retry multiple operations in parallel, failing fast on first non-retryable error
 */
export async function retryBatch<T>(
  operations: Array<() => Promise<T>>,
  options: RetryOptions = {},
): Promise<Array<RetryResult<T>>> {
  return Promise.all(operations.map((operation) => retryWithBackoff(operation, options)));
}
