/**
 * Promise Utilities
 */

/**
 * Maps an array to promises with concurrency control.
 * Similar to p-map or Promise.map from Bluebird.
 *
 * @param items - Array of items to process
 * @param mapper - Async function to process each item
 * @param concurrency - Maximum number of concurrent executions
 * @returns Promise resolving to array of results in original order
 */
export async function pMap<T, R>(
  items: T[],
  mapper: (item: T, index: number) => Promise<R>,
  concurrency: number,
): Promise<R[]> {
  const results = new Array<R>(items.length);
  let index = 0;

  const worker = async () => {
    while (index < items.length) {
      const i = index++;
      // Check bounds again just in case (though condition above handles it)
      if (i >= items.length) return;

      try {
        const item = items[i];
        if (item === undefined) return;
        results[i] = await mapper(item, i);
      } catch (error) {
        // If one fails, the whole Promise.all will reject,
        // stopping other workers (eventually, though they might finish current task)
        throw error;
      }
    }
  };

  // Create workers up to concurrency limit or items length
  const workerCount = Math.min(items.length, Math.max(1, concurrency));
  const workers = Array.from({ length: workerCount }, worker);

  await Promise.all(workers);
  return results;
}
