import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { ToastProvider, useToast } from "@/components/Toast";

function ToastTrigger({
  message,
  variant,
}: {
  message: string;
  variant?: "success" | "error" | "info";
}) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(message, variant)}>Show Toast</button>;
}

function TestApp({
  message = "Hello",
  variant,
}: {
  message?: string;
  variant?: "success" | "error" | "info";
}) {
  return (
    <ToastProvider>
      <ToastTrigger message={message} variant={variant} />
    </ToastProvider>
  );
}

describe("ToastProvider / useToast", () => {
  it("throws when useToast used outside provider", () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => {
      render(<ToastTrigger message="test" />);
    }).toThrow("useToast must be used within ToastProvider");
    consoleError.mockRestore();
  });

  it("renders children without showing toasts initially", () => {
    render(<TestApp />);
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("shows a toast message when showToast is called", async () => {
    render(<TestApp message="Test message" />);
    fireEvent.click(screen.getByText("Show Toast"));
    await waitFor(() => {
      expect(screen.getByRole("status")).toBeInTheDocument();
      expect(screen.getByText("Test message")).toBeInTheDocument();
    });
  });

  it("dismisses toast when dismiss notification button clicked", async () => {
    render(<TestApp message="Dismissible" />);
    fireEvent.click(screen.getByText("Show Toast"));
    await waitFor(() => screen.getByRole("status"));

    fireEvent.click(screen.getByLabelText("Dismiss notification"));
    await waitFor(() => {
      expect(screen.queryByRole("status")).not.toBeInTheDocument();
    });
  });

  it("auto-dismisses toast after TOAST_DURATION_MS (5000ms)", async () => {
    vi.useFakeTimers();
    render(<TestApp message="Auto dismiss" />);
    fireEvent.click(screen.getByText("Show Toast"));
    await act(async () => {
      await Promise.resolve();
    });
    expect(screen.getByRole("status")).toBeInTheDocument();

    await act(async () => {
      vi.advanceTimersByTime(5000);
    });
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
    vi.useRealTimers();
  });

  it("shows success variant with correct aria-live region", async () => {
    render(<TestApp message="Success!" variant="success" />);
    fireEvent.click(screen.getByText("Show Toast"));
    await waitFor(() => screen.getByRole("status"));
    const liveRegion = screen.getByLabelText("Notifications");
    expect(liveRegion).toHaveAttribute("aria-live", "polite");
  });

  it("shows up to 5 toasts (keeps last 5)", async () => {
    function MultiToast() {
      const { showToast } = useToast();
      return (
        <button
          onClick={() => {
            for (let i = 0; i < 7; i++) showToast(`toast ${i}`);
          }}
        >
          Show Many
        </button>
      );
    }
    render(
      <ToastProvider>
        <MultiToast />
      </ToastProvider>,
    );
    fireEvent.click(screen.getByText("Show Many"));
    await waitFor(() => {
      const toasts = screen.getAllByRole("status");
      expect(toasts.length).toBeLessThanOrEqual(5);
    });
  });

  it("renders with info variant by default", async () => {
    render(<TestApp message="Info message" />);
    fireEvent.click(screen.getByText("Show Toast"));
    await waitFor(() => screen.getByRole("status"));
    // Info variant applies primary border style
    const toast = screen.getByRole("status");
    expect(toast.className).toContain("border-primary");
  });
});
