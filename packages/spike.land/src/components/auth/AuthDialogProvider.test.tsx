import { describe, expect, it, vi } from "vitest";
import { act, renderHook } from "@testing-library/react";
import { AuthDialogProvider, useAuthDialog } from "./AuthDialogProvider";

// Mock the AuthDialog component since it has complex dependencies
vi.mock("./AuthDialog", () => ({
  AuthDialog: ({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) =>
    open ? (
      <button data-testid="auth-dialog" onClick={() => onOpenChange(false)}>
        Dialog
      </button>
    ) : null,
}));

// Mock next-auth/react
vi.mock("next-auth/react", () => ({
  useSession: () => ({ data: null, status: "unauthenticated", update: vi.fn() }),
  signIn: vi.fn(),
}));

describe("AuthDialogProvider", () => {
  it("provides openAuthDialog and closeAuthDialog", () => {
    const { result } = renderHook(() => useAuthDialog(), {
      wrapper: ({ children }) => <AuthDialogProvider>{children}</AuthDialogProvider>,
    });

    expect(result.current.openAuthDialog).toBeInstanceOf(Function);
    expect(result.current.closeAuthDialog).toBeInstanceOf(Function);
    expect(result.current.isOpen).toBe(false);
  });

  it("opens the dialog when openAuthDialog is called", () => {
    const { result } = renderHook(() => useAuthDialog(), {
      wrapper: ({ children }) => <AuthDialogProvider>{children}</AuthDialogProvider>,
    });

    act(() => {
      result.current.openAuthDialog();
    });

    expect(result.current.isOpen).toBe(true);
  });

  it("closes the dialog when closeAuthDialog is called", () => {
    const { result } = renderHook(() => useAuthDialog(), {
      wrapper: ({ children }) => <AuthDialogProvider>{children}</AuthDialogProvider>,
    });

    act(() => {
      result.current.openAuthDialog();
    });
    expect(result.current.isOpen).toBe(true);

    act(() => {
      result.current.closeAuthDialog();
    });
    expect(result.current.isOpen).toBe(false);
  });

  it("accepts callbackUrl option", () => {
    const { result } = renderHook(() => useAuthDialog(), {
      wrapper: ({ children }) => <AuthDialogProvider>{children}</AuthDialogProvider>,
    });

    act(() => {
      result.current.openAuthDialog({ callbackUrl: "/settings" });
    });

    expect(result.current.isOpen).toBe(true);
  });

  it("throws when used outside provider", () => {
    expect(() => {
      renderHook(() => useAuthDialog());
    }).toThrow("useAuthDialog must be used within an AuthDialogProvider");
  });
});
