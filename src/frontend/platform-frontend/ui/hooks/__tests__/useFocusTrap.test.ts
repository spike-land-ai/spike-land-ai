import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFocusTrap } from "../useFocusTrap";

// ---------------------------------------------------------------------------
// Helpers to build a real DOM container with focusable elements
// ---------------------------------------------------------------------------

function buildContainer(buttonCount = 2): HTMLDivElement {
  const container = document.createElement("div");
  for (let i = 0; i < buttonCount; i++) {
    const btn = document.createElement("button");
    btn.textContent = `Button ${i + 1}`;
    btn.setAttribute("data-testid", `btn-${i}`);
    container.appendChild(btn);
  }
  document.body.appendChild(container);
  return container;
}

function cleanup(container: HTMLDivElement) {
  document.body.removeChild(container);
}

describe("useFocusTrap", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns a ref object", () => {
    const { result } = renderHook(() => useFocusTrap(false));
    expect(result.current).toHaveProperty("current");
  });

  it("does not focus anything when active=false", () => {
    const container = buildContainer(2);
    const { result } = renderHook(() => useFocusTrap(false));
    // Attach ref manually
    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    const btn0 = container.querySelector<HTMLButtonElement>("[data-testid='btn-0']")!;
    expect(document.activeElement).not.toBe(btn0);
    cleanup(container);
  });

  it("focuses the first focusable element when activated", () => {
    const container = buildContainer(2);
    const btn0 = container.querySelector<HTMLButtonElement>("[data-testid='btn-0']")!;

    const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
      initialProps: { active: false },
    });

    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    act(() => {
      rerender({ active: true });
    });

    expect(document.activeElement).toBe(btn0);
    cleanup(container);
  });

  it("calls onClose when Escape is pressed while active", () => {
    const container = buildContainer(2);
    const onClose = vi.fn();

    const { result, rerender } = renderHook(({ active }) => useFocusTrap(active, onClose), {
      initialProps: { active: false },
    });

    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    act(() => {
      rerender({ active: true });
    });

    act(() => {
      container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onClose).toHaveBeenCalledOnce();
    cleanup(container);
  });

  it("does not call onClose when Escape is pressed while inactive", () => {
    const container = buildContainer(2);
    const onClose = vi.fn();

    renderHook(() => useFocusTrap(false, onClose));

    act(() => {
      container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
    });

    expect(onClose).not.toHaveBeenCalled();
    cleanup(container);
  });

  it("traps Tab forward: wraps focus from last to first element", () => {
    const container = buildContainer(2);
    const btn0 = container.querySelector<HTMLButtonElement>("[data-testid='btn-0']")!;
    const btn1 = container.querySelector<HTMLButtonElement>("[data-testid='btn-1']")!;

    const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
      initialProps: { active: false },
    });

    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    act(() => {
      rerender({ active: true });
    });

    // Manually move focus to last button
    act(() => {
      btn1.focus();
    });
    expect(document.activeElement).toBe(btn1);

    // Dispatch Tab on container (last element focused → should wrap to first)
    act(() => {
      container.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey: false, bubbles: true }),
      );
    });

    expect(document.activeElement).toBe(btn0);
    cleanup(container);
  });

  it("traps Shift+Tab backward: wraps focus from first to last element", () => {
    const container = buildContainer(2);
    const btn0 = container.querySelector<HTMLButtonElement>("[data-testid='btn-0']")!;
    const btn1 = container.querySelector<HTMLButtonElement>("[data-testid='btn-1']")!;

    const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
      initialProps: { active: false },
    });

    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    act(() => {
      rerender({ active: true });
    });

    // First element should have focus (from activation)
    expect(document.activeElement).toBe(btn0);

    // Dispatch Shift+Tab — should wrap to last element
    act(() => {
      container.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey: true, bubbles: true }),
      );
    });

    expect(document.activeElement).toBe(btn1);
    cleanup(container);
  });

  it("does not wrap Tab when focus is not on the last element", () => {
    const container = buildContainer(2);
    const btn0 = container.querySelector<HTMLButtonElement>("[data-testid='btn-0']")!;
    const btn1 = container.querySelector<HTMLButtonElement>("[data-testid='btn-1']")!;

    const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
      initialProps: { active: false },
    });

    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    act(() => {
      rerender({ active: true });
    });

    // Focus is on btn0 (first), pressing Tab forward should do nothing special
    expect(document.activeElement).toBe(btn0);

    act(() => {
      container.dispatchEvent(
        new KeyboardEvent("keydown", { key: "Tab", shiftKey: false, bubbles: true }),
      );
    });

    // Focus should NOT have jumped to btn0 (it was already btn0 and not at last)
    expect(document.activeElement).not.toBe(btn1);
    cleanup(container);
  });

  it("handles empty focusable list gracefully", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);

    const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
      initialProps: { active: false },
    });

    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    // Should not throw when there are no focusable elements
    expect(() => {
      act(() => {
        rerender({ active: true });
      });
    }).not.toThrow();

    document.body.removeChild(container);
  });

  it("restores focus to the triggering element on deactivation", () => {
    const container = buildContainer(2);
    // Create a trigger button outside the trap
    const trigger = document.createElement("button");
    trigger.textContent = "Open";
    document.body.appendChild(trigger);
    trigger.focus();
    expect(document.activeElement).toBe(trigger);

    const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
      initialProps: { active: false },
    });

    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    act(() => {
      rerender({ active: true });
    });

    // Focus moved into trap
    const btn0 = container.querySelector<HTMLButtonElement>("[data-testid='btn-0']")!;
    expect(document.activeElement).toBe(btn0);

    // Deactivate: focus should return to trigger
    act(() => {
      rerender({ active: false });
    });

    expect(document.activeElement).toBe(trigger);

    cleanup(container);
    document.body.removeChild(trigger);
  });

  it("ignores non-Tab and non-Escape key events", () => {
    const container = buildContainer(2);
    const onClose = vi.fn();

    const { result, rerender } = renderHook(({ active }) => useFocusTrap(active, onClose), {
      initialProps: { active: false },
    });

    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    act(() => {
      rerender({ active: true });
    });

    act(() => {
      container.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter", bubbles: true }));
      container.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }));
    });

    // onClose should not be called; no errors thrown
    expect(onClose).not.toHaveBeenCalled();
    cleanup(container);
  });

  it("works without an onClose callback (no error on Escape)", () => {
    const container = buildContainer(1);

    const { result, rerender } = renderHook(({ active }) => useFocusTrap(active), {
      initialProps: { active: false },
    });

    (result.current as React.MutableRefObject<HTMLDivElement>).current = container;

    act(() => {
      rerender({ active: true });
    });

    expect(() => {
      act(() => {
        container.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape", bubbles: true }));
      });
    }).not.toThrow();

    cleanup(container);
  });
});

// Need React import for MutableRefObject type annotation
import type React from "react";
