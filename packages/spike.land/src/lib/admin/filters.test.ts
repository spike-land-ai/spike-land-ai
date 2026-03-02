import { describe, expect, it } from "vitest";
import { buildPaginationMeta, paginateArray, parsePaginationParams } from "./filters";

describe("parsePaginationParams", () => {
  it("returns defaults when no params provided", () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params);
    expect(result).toEqual({ page: 1, limit: 20 });
  });

  it("parses page and limit from search params", () => {
    const params = new URLSearchParams({ page: "3", limit: "10" });
    const result = parsePaginationParams(params);
    expect(result).toEqual({ page: 3, limit: 10 });
  });

  it("clamps page to minimum of 1", () => {
    const params = new URLSearchParams({ page: "-5" });
    const result = parsePaginationParams(params);
    expect(result.page).toBe(1);
  });

  it("clamps limit to minimum of 1", () => {
    const params = new URLSearchParams({ limit: "0" });
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(1);
  });

  it("clamps limit to maxLimit", () => {
    const params = new URLSearchParams({ limit: "100" });
    const result = parsePaginationParams(params);
    expect(result.limit).toBe(50);
  });

  it("uses custom defaults", () => {
    const params = new URLSearchParams();
    const result = parsePaginationParams(params, {
      page: 2,
      limit: 10,
      maxLimit: 25,
    });
    expect(result).toEqual({ page: 2, limit: 10 });
  });

  it("handles NaN values gracefully", () => {
    const params = new URLSearchParams({ page: "abc", limit: "xyz" });
    const result = parsePaginationParams(params);
    expect(result.page).toBe(1);
    expect(result.limit).toBe(20);
  });
});

describe("paginateArray", () => {
  const items = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  it("returns first page correctly", () => {
    const result = paginateArray(items, { page: 1, limit: 3 });
    expect(result.data).toEqual([1, 2, 3]);
    expect(result.pagination).toEqual({
      page: 1,
      limit: 3,
      total: 10,
      totalPages: 4,
    });
  });

  it("returns middle page correctly", () => {
    const result = paginateArray(items, { page: 2, limit: 3 });
    expect(result.data).toEqual([4, 5, 6]);
  });

  it("returns last page with remaining items", () => {
    const result = paginateArray(items, { page: 4, limit: 3 });
    expect(result.data).toEqual([10]);
  });

  it("returns empty data for page beyond range", () => {
    const result = paginateArray(items, { page: 5, limit: 3 });
    expect(result.data).toEqual([]);
  });

  it("handles empty array", () => {
    const result = paginateArray([], { page: 1, limit: 10 });
    expect(result.data).toEqual([]);
    expect(result.pagination.total).toBe(0);
    expect(result.pagination.totalPages).toBe(0);
  });
});

describe("buildPaginationMeta", () => {
  it("builds correct pagination metadata", () => {
    const result = buildPaginationMeta(100, { page: 3, limit: 20 });
    expect(result).toEqual({
      page: 3,
      limit: 20,
      total: 100,
      totalPages: 5,
    });
  });

  it("handles zero total", () => {
    const result = buildPaginationMeta(0, { page: 1, limit: 20 });
    expect(result.totalPages).toBe(0);
  });

  it("rounds up totalPages correctly", () => {
    const result = buildPaginationMeta(21, { page: 1, limit: 20 });
    expect(result.totalPages).toBe(2);
  });
});
