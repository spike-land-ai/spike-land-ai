import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useTable } from "./useTable";

describe("useTable", () => {
  beforeEach(() => {
    // Clear any cached stores by dispatching empty events
  });

  it("returns empty array initially", () => {
    const { result } = renderHook(() => useTable("TestTable"));
    expect(result.current).toEqual([]);
  });

  it("updates when a custom event is dispatched", () => {
    const { result } = renderHook(() => useTable<{ id: string; name: string }>("Users"));

    expect(result.current).toEqual([]);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("stdb:table:Users", {
          detail: [
            { id: "1", name: "Alice" },
            { id: "2", name: "Bob" },
          ],
        }),
      );
    });

    expect(result.current).toHaveLength(2);
    expect(result.current[0].name).toBe("Alice");
    expect(result.current[1].name).toBe("Bob");
  });

  it("applies filter when provided", () => {
    const { result } = renderHook(() =>
      useTable<{ id: string; active: boolean }>("FilteredTable", (row) => row.active),
    );

    act(() => {
      window.dispatchEvent(
        new CustomEvent("stdb:table:FilteredTable", {
          detail: [
            { id: "1", active: true },
            { id: "2", active: false },
            { id: "3", active: true },
          ],
        }),
      );
    });

    expect(result.current).toHaveLength(2);
    expect(result.current.every((r) => r.active)).toBe(true);
  });

  it("multiple hooks on same table share updates", () => {
    const { result: r1 } = renderHook(() => useTable<{ id: string }>("SharedTable"));
    const { result: r2 } = renderHook(() => useTable<{ id: string }>("SharedTable"));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("stdb:table:SharedTable", {
          detail: [{ id: "x" }],
        }),
      );
    });

    expect(r1.current).toHaveLength(1);
    expect(r2.current).toHaveLength(1);
  });

  it("handles empty table update", () => {
    const { result } = renderHook(() => useTable("EmptyTable"));

    act(() => {
      window.dispatchEvent(new CustomEvent("stdb:table:EmptyTable", { detail: [] }));
    });

    expect(result.current).toEqual([]);
  });

  it("replaces previous data on new event", () => {
    const { result } = renderHook(() => useTable<{ id: string }>("ReplaceTable"));

    act(() => {
      window.dispatchEvent(
        new CustomEvent("stdb:table:ReplaceTable", {
          detail: [{ id: "1" }, { id: "2" }],
        }),
      );
    });
    expect(result.current).toHaveLength(2);

    act(() => {
      window.dispatchEvent(
        new CustomEvent("stdb:table:ReplaceTable", {
          detail: [{ id: "3" }],
        }),
      );
    });
    expect(result.current).toHaveLength(1);
    expect(result.current[0].id).toBe("3");
  });
});
