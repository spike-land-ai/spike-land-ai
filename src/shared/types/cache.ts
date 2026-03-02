/**
 * Cache Entry Types
 *
 * Generic type definitions for caching mechanisms.
 * Provides type-safe cache storage with expiry tracking.
 *
 * Resolves #797: Type Safety Improvements
 */

/**
 * Generic cache entry with data and expiry time
 * @template T - The type of data being cached
 */
export interface CacheEntry<T> {
  /** The cached data */
  data: T;
  /** Expiry timestamp in milliseconds since epoch */
  expiry: number;
}

/**
 * Cache key type - always a string
 */
export type CacheKey = string;

/**
 * Type-safe cache map
 * @template T - The type of data being cached
 */
export type CacheMap<T> = Map<CacheKey, CacheEntry<T>>;
