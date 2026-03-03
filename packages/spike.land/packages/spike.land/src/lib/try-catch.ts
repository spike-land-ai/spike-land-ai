/**
 * tryCatch Utility
 *
 * A functional error handling wrapper that returns { data, error } tuples.
 * This is a pure utility with no side effects - no error reporting, no stats.
 *
 * Error reporting is now handled automatically by:
 * - Browser: ConsoleCapture component initializes console.error capture and exception handlers
 * - Server: instrumentation.ts (captures console.error)
 * - React: Error boundaries (reportErrorBoundary)
 *
 * Usage:
 *   const { data, error } = await tryCatch(somePromise());
 *   if (error) {
 *     // handle error
 *   }
 */

interface Success<T> {
  data: T;
  error: null;
}

interface Failure<E> {
  data: null;
  error: E;
}

type Result<T, E = Error> = Success<T> | Failure<E>;

/**
 * Async wrapper - returns { data, error } tuple
 *
 * @param promise - The promise to wrap
 * @returns Result object with { data, error }
 */
export async function tryCatch<T, E = Error>(
  promise: Promise<T>,
): Promise<Result<T, E>> {
  try {
    const data = await promise;
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}

/**
 * Sync wrapper - returns { data, error } tuple
 *
 * @param fn - The function to wrap
 * @returns Result object with { data, error }
 */
export function tryCatchSync<T, E = Error>(fn: () => T): Result<T, E> {
  try {
    const data = fn();
    return { data, error: null };
  } catch (error) {
    return { data: null, error: error as E };
  }
}
