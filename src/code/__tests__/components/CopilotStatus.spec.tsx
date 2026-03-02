import { act, fireEvent, render, screen } from "@testing-library/react";
import React from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";

// Use vi.hoisted so variables are available when vi.mock factory runs
const { mockToggle, mockGetStatus, mockOnStatusChange } = vi.hoisted(() => ({
  mockToggle: vi.fn(),
  mockGetStatus: vi.fn(),
  mockOnStatusChange: vi.fn(),
}));

vi.mock("@/services/CopilotService", () => ({
  copilotService: {
    toggle: mockToggle,
    getStatus: mockGetStatus,
    onStatusChange: mockOnStatusChange,
  },
}));

import { CopilotStatus } from "../../components/CopilotStatus";

describe("CopilotStatus", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Default: return unsub fn and call callback when registered
    mockOnStatusChange.mockReturnValue(vi.fn());
    mockGetStatus.mockReturnValue("active");
  });

  it("renders with active status showing green indicator", () => {
    render(<CopilotStatus />);
    const button = screen.getByRole("button");
    expect(button).toBeInTheDocument();
    expect(button.title).toContain("active");
    // Green dot for active
    const dots = button.querySelectorAll(".bg-green-400");
    expect(dots.length).toBe(1);
  });

  it("renders with loading status showing amber indicator", () => {
    mockGetStatus.mockReturnValue("loading");
    // Simulate status change callback
    let capturedCallback: ((s: string) => void) | null = null;
    mockOnStatusChange.mockImplementation((cb: (s: string) => void) => {
      capturedCallback = cb;
      return vi.fn();
    });

    render(<CopilotStatus />);

    // Trigger status update
    if (capturedCallback) {
      capturedCallback("loading");
    }

    const button = screen.getByRole("button");
    const dots = button.querySelectorAll(".bg-amber-400");
    expect(dots.length).toBe(1);
  });

  it("renders with offline status showing gray indicator", () => {
    mockGetStatus.mockReturnValue("offline");
    let capturedCallback: ((s: string) => void) | null = null;
    mockOnStatusChange.mockImplementation((cb: (s: string) => void) => {
      capturedCallback = cb;
      return vi.fn();
    });

    render(<CopilotStatus />);

    if (capturedCallback) {
      capturedCallback("offline");
    }

    const button = screen.getByRole("button");
    const dots = button.querySelectorAll(".bg-gray-400");
    expect(dots.length).toBe(1);
  });

  it("renders with disabled status showing strikethrough text", () => {
    mockGetStatus.mockReturnValue("disabled");
    let capturedCallback: ((s: string) => void) | null = null;
    mockOnStatusChange.mockImplementation((cb: (s: string) => void) => {
      capturedCallback = cb;
      return vi.fn();
    });

    render(<CopilotStatus />);

    if (capturedCallback) {
      capturedCallback("disabled");
    }

    const button = screen.getByRole("button");
    const strikeText = button.querySelector(".line-through");
    expect(strikeText).not.toBeNull();
  });

  it("calls copilotService.toggle() when button is clicked", () => {
    render(<CopilotStatus />);
    const button = screen.getByRole("button");
    fireEvent.click(button);
    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it("registers status change listener on mount", () => {
    render(<CopilotStatus />);
    expect(mockOnStatusChange).toHaveBeenCalledTimes(1);
  });

  it("calls unsubscribe on unmount", () => {
    const unsubscribe = vi.fn();
    mockOnStatusChange.mockReturnValue(unsubscribe);

    const { unmount } = render(<CopilotStatus />);
    unmount();

    expect(unsubscribe).toHaveBeenCalled();
  });

  it("updates status when onStatusChange callback fires", () => {
    let capturedCallback: ((s: string) => void) | null = null;
    mockOnStatusChange.mockImplementation((cb: (s: string) => void) => {
      capturedCallback = cb;
      return vi.fn();
    });

    render(<CopilotStatus />);
    expect(capturedCallback).not.toBeNull();

    // Trigger status change to disabled (must be wrapped in act for React state update)
    act(() => {
      if (capturedCallback) {
        capturedCallback("disabled");
      }
    });

    const button = screen.getByRole("button");
    expect(button.title).toContain("disabled");
  });

  it("triggers toggle on Ctrl+Shift+A keyboard shortcut (non-Mac)", () => {
    // Mock navigator.platform
    Object.defineProperty(navigator, "platform", {
      value: "Win32",
      writable: true,
    });

    render(<CopilotStatus />);

    fireEvent.keyDown(window, {
      key: "A",
      ctrlKey: true,
      shiftKey: true,
      metaKey: false,
    });

    expect(mockToggle).toHaveBeenCalledTimes(1);
  });

  it("does not trigger toggle on incorrect key combination", () => {
    render(<CopilotStatus />);

    fireEvent.keyDown(window, {
      key: "B",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(mockToggle).not.toHaveBeenCalled();
  });

  it("removes keydown listener on unmount", () => {
    const { unmount } = render(<CopilotStatus />);
    unmount();

    fireEvent.keyDown(window, {
      key: "A",
      ctrlKey: true,
      shiftKey: true,
    });

    expect(mockToggle).not.toHaveBeenCalled();
  });
});
