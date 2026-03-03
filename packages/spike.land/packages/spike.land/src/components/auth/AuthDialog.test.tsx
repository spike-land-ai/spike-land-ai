import { beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AuthDialog } from "./AuthDialog";

// Mock next-auth/react
const mockSignIn = vi.fn();
const mockUpdate = vi.fn();
const mockGetProviders = vi.fn();
vi.mock("next-auth/react", () => ({
  useSession: () => ({
    data: null,
    status: "unauthenticated",
    update: mockUpdate,
  }),
  signIn: (...args: unknown[]) => mockSignIn(...args),
  getProviders: (...args: unknown[]) => mockGetProviders(...args),
}));

// Mock qrcode.react
vi.mock("qrcode.react", () => ({
  QRCodeSVG: ({ value }: { value: string; }) => (
    <div data-testid="qr-code" data-value={value}>
      QR Code
    </div>
  ),
}));

// Mock sonner
vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock fetch for QR API calls
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe("AuthDialog", () => {
  const defaultProps = {
    open: true,
    onOpenChange: vi.fn(),
    callbackUrl: "/settings",
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockSignIn.mockResolvedValue({ ok: true });
    mockFetch.mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ token: "test-token", hash: "test-hash" }),
    });
    // Default: return all three OAuth providers
    mockGetProviders.mockResolvedValue({
      google: { id: "google", name: "Google" },
      github: { id: "github", name: "GitHub" },
      apple: { id: "apple", name: "Apple" },
    });
  });

  it("renders the dialog when open", () => {
    render(<AuthDialog {...defaultProps} />);
    expect(screen.getByText("Sign in to your account")).toBeInTheDocument();
  });

  it("does not render when closed", () => {
    render(<AuthDialog {...defaultProps} open={false} />);
    expect(screen.queryByText("Sign in to your account")).not.toBeInTheDocument();
  });

  it("shows email input by default", () => {
    render(<AuthDialog {...defaultProps} />);
    expect(screen.getByPlaceholderText("name@example.com")).toBeInTheDocument();
  });

  it("shows send magic link button", () => {
    render(<AuthDialog {...defaultProps} />);
    expect(screen.getByText("Send magic link")).toBeInTheDocument();
  });

  it("disables send button when email is empty", () => {
    render(<AuthDialog {...defaultProps} />);
    const button = screen.getByText("Send magic link");
    expect(button.closest("button")).toBeDisabled();
  });

  it("enables send button when email is entered", () => {
    render(<AuthDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("name@example.com");
    fireEvent.change(input, { target: { value: "test@example.com" } });
    const button = screen.getByText("Send magic link");
    expect(button.closest("button")).not.toBeDisabled();
  });

  it("submits magic link on form submission", async () => {
    render(<AuthDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("name@example.com");
    fireEvent.change(input, { target: { value: "test@example.com" } });

    const button = screen.getByText("Send magic link");
    fireEvent.click(button);

    await waitFor(() => {
      expect(mockSignIn).toHaveBeenCalledWith("email", {
        email: "test@example.com",
        redirect: false,
        callbackUrl: "/settings",
      });
    });
  });

  it("shows check your email state after sending", async () => {
    render(<AuthDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("name@example.com");
    fireEvent.change(input, { target: { value: "test@example.com" } });

    const button = screen.getByText("Send magic link");
    fireEvent.click(button);

    await waitFor(() => {
      expect(screen.getByText("Check your email")).toBeInTheDocument();
    });
  });

  it("shows More sign-in options collapsible", () => {
    render(<AuthDialog {...defaultProps} />);
    expect(screen.getByText("More sign-in options")).toBeInTheDocument();
  });

  it("expands OAuth options when clicked", async () => {
    render(<AuthDialog {...defaultProps} />);
    const trigger = screen.getByText("More sign-in options");
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("Continue with Google")).toBeInTheDocument();
      expect(screen.getByText("Continue with GitHub")).toBeInTheDocument();
      expect(screen.getByText("Continue with Apple")).toBeInTheDocument();
    });
  });

  it("triggers Google sign-in when button clicked", async () => {
    render(<AuthDialog {...defaultProps} />);
    const trigger = screen.getByText("More sign-in options");
    fireEvent.click(trigger);

    await waitFor(() => {
      const googleButton = screen.getByText("Continue with Google");
      fireEvent.click(googleButton);
      expect(mockSignIn).toHaveBeenCalledWith("google", {
        callbackUrl: "/settings",
      });
    });
  });

  it("shows error message when magic link fails", async () => {
    mockSignIn.mockResolvedValueOnce({ error: "EmailSignin" });

    render(<AuthDialog {...defaultProps} />);
    const input = screen.getByPlaceholderText("name@example.com");
    fireEvent.change(input, { target: { value: "test@example.com" } });

    const button = screen.getByText("Send magic link");
    fireEvent.click(button);

    await waitFor(() => {
      expect(
        screen.getByText("Failed to send sign-in link. Please try again."),
      ).toBeInTheDocument();
    });
  });

  it("shows description for accessibility", () => {
    render(<AuthDialog {...defaultProps} />);
    expect(
      screen.getByText("The AI development platform"),
    ).toBeInTheDocument();
  });

  it("hides More sign-in options when no OAuth providers are configured", async () => {
    mockGetProviders.mockResolvedValueOnce({
      email: { id: "email", name: "Email" },
    });

    render(<AuthDialog {...defaultProps} />);

    await waitFor(() => {
      expect(screen.queryByText("More sign-in options")).not.toBeInTheDocument();
    });
  });

  it("shows only configured OAuth providers when subset available", async () => {
    mockGetProviders.mockResolvedValueOnce({
      google: { id: "google", name: "Google" },
      email: { id: "email", name: "Email" },
    });

    render(<AuthDialog {...defaultProps} />);
    const trigger = await screen.findByText("More sign-in options");
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("Continue with Google")).toBeInTheDocument();
      expect(screen.queryByText("Continue with GitHub")).not.toBeInTheDocument();
      expect(screen.queryByText("Continue with Apple")).not.toBeInTheDocument();
    });
  });

  it("shows all OAuth buttons as fallback when getProviders fails", async () => {
    mockGetProviders.mockRejectedValueOnce(new Error("Network error"));

    render(<AuthDialog {...defaultProps} />);
    const trigger = await screen.findByText("More sign-in options");
    fireEvent.click(trigger);

    await waitFor(() => {
      expect(screen.getByText("Continue with Google")).toBeInTheDocument();
      expect(screen.getByText("Continue with GitHub")).toBeInTheDocument();
      expect(screen.getByText("Continue with Apple")).toBeInTheDocument();
    });
  });
});
