import React from "react";
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { ErrorOverlay } from "@/ui/components/editor/ErrorOverlay";

describe("ErrorOverlay", () => {
  const baseError = { message: "Unexpected token at position 42" };
  const errorWithLocation = { message: "Type error", line: 12, column: 4 };

  it("renders nothing when error is null", () => {
    const { container } = render(
      <ErrorOverlay error={null} onDismiss={vi.fn()} />,
    );
    expect(container.firstChild).toBeNull();
  });

  it("renders error message", () => {
    render(<ErrorOverlay error={baseError} onDismiss={vi.fn()} />);
    expect(screen.getByText(baseError.message)).toBeInTheDocument();
  });

  it("has role=alert for accessibility", () => {
    render(<ErrorOverlay error={baseError} onDismiss={vi.fn()} />);
    expect(screen.getByRole("alert")).toBeInTheDocument();
  });

  it("calls onDismiss when dismiss button is clicked", () => {
    const onDismiss = vi.fn();
    render(<ErrorOverlay error={baseError} onDismiss={onDismiss} />);
    fireEvent.click(screen.getByLabelText("Dismiss error"));
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("shows line location badge when line is provided", () => {
    render(<ErrorOverlay error={errorWithLocation} onDismiss={vi.fn()} />);
    expect(screen.getByText("Line 12:4")).toBeInTheDocument();
  });

  it("calls onGoToLine with correct args when location button is clicked", () => {
    const onGoToLine = vi.fn();
    render(
      <ErrorOverlay
        error={errorWithLocation}
        onDismiss={vi.fn()}
        onGoToLine={onGoToLine}
      />,
    );
    fireEvent.click(screen.getByLabelText("Jump to Line 12:4 in editor"));
    expect(onGoToLine).toHaveBeenCalledWith(12, 4);
  });

  it("does not show location badge when no line provided", () => {
    render(<ErrorOverlay error={baseError} onDismiss={vi.fn()} />);
    expect(screen.queryByText(/Line \d+/)).toBeNull();
  });
});
