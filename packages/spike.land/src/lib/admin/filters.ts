/**
 * Admin Shared Pagination & Filtering Utilities
 *
 * Common pagination parsing, validation, and response building.
 */

export interface PaginationParams {
  page: number;
  limit: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
}

/**
 * Parse and validate pagination params from URLSearchParams.
 * Clamps page >= 1 and 1 <= limit <= maxLimit.
 */
export function parsePaginationParams(
  searchParams: URLSearchParams,
  defaults: { page?: number; limit?: number; maxLimit?: number } = {},
): PaginationParams {
  const { page: defaultPage = 1, limit: defaultLimit = 20, maxLimit = 50 } = defaults;

  const rawPage = parseInt(searchParams.get("page") || String(defaultPage), 10);
  const rawLimit = parseInt(searchParams.get("limit") || String(defaultLimit), 10);

  const page = Math.max(1, Number.isNaN(rawPage) ? defaultPage : rawPage);
  const limit = Math.min(maxLimit, Math.max(1, Number.isNaN(rawLimit) ? defaultLimit : rawLimit));

  return { page, limit };
}

/**
 * Apply pagination to an in-memory array and return a paginated response.
 */
export function paginateArray<T>(items: T[], params: PaginationParams): PaginatedResponse<T> {
  const { page, limit } = params;
  const total = items.length;
  const totalPages = Math.ceil(total / limit);
  const start = (page - 1) * limit;
  const data = items.slice(start, start + limit);

  return {
    data,
    pagination: { page, limit, total, totalPages },
  };
}

/**
 * Build a standard pagination metadata object (for Prisma-based pagination).
 */
export function buildPaginationMeta(
  total: number,
  params: PaginationParams,
): PaginatedResponse<never>["pagination"] {
  return {
    page: params.page,
    limit: params.limit,
    total,
    totalPages: Math.ceil(total / params.limit),
  };
}
