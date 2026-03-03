import { describe, expect, it } from "vitest";
import { pMap } from "./promise-utils";

describe("pMap", () => {
  it("maps items to results preserving order", async () => {
    const results = await pMap([1, 2, 3], async n => n * 2, 2);
    expect(results).toEqual([2, 4, 6]);
  });

  it("handles empty array", async () => {
    const results = await pMap([], async (n: number) => n, 5);
    expect(results).toEqual([]);
  });

  it("processes with concurrency 1 (sequential)", async () => {
    const order: number[] = [];
    await pMap([1, 2, 3, 4], async n => {
      order.push(n);
      return n;
    }, 1);
    expect(order).toEqual([1, 2, 3, 4]);
  });

  it("respects concurrency limit", async () => {
    let concurrent = 0;
    let maxConcurrent = 0;

    await pMap(
      [1, 2, 3, 4, 5, 6],
      async n => {
        concurrent++;
        maxConcurrent = Math.max(maxConcurrent, concurrent);
        await new Promise(r => setTimeout(r, 10));
        concurrent--;
        return n;
      },
      2,
    );

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });

  it("passes index to mapper", async () => {
    const indices: number[] = [];
    await pMap(["a", "b", "c"], async (_, i) => {
      indices.push(i);
      return i;
    }, 3);
    expect(indices.sort((a, b) => a - b)).toEqual([0, 1, 2]);
  });

  it("propagates errors from mapper", async () => {
    const error = new Error("mapping failed");
    await expect(
      pMap([1, 2, 3], async n => {
        if (n === 2) throw error;
        return n;
      }, 3),
    ).rejects.toThrow("mapping failed");
  });

  it("handles concurrency larger than item count", async () => {
    const results = await pMap([10, 20], async n => n + 1, 100);
    expect(results).toEqual([11, 21]);
  });

  it("handles concurrency of 0 (treated as 1)", async () => {
    const results = await pMap([1, 2, 3], async n => n * 3, 0);
    expect(results).toEqual([3, 6, 9]);
  });

  it("handles async mapper returning strings", async () => {
    const results = await pMap(["a", "b", "c"], async s => s.toUpperCase(), 2);
    expect(results).toEqual(["A", "B", "C"]);
  });

  it("handles single item", async () => {
    const results = await pMap([42], async n => n * 2, 1);
    expect(results).toEqual([84]);
  });
});
