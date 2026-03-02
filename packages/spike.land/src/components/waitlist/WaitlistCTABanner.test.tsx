import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

vi.mock("./WaitlistInlineForm", () => ({
  WaitlistInlineForm: ({ source }: { source?: string }) => (
    <form data-testid="waitlist-form" data-source={source}>
      <input type="email" />
      <button>Join</button>
    </form>
  ),
}));

import { WaitlistCTABanner } from "./WaitlistCTABanner";

describe("WaitlistCTABanner", () => {
  it("renders hero variant with heading", () => {
    render(<WaitlistCTABanner variant="hero" />);
    expect(screen.getByText("Join the waiting list")).toBeDefined();
    expect(screen.getByTestId("waitlist-form")).toBeDefined();
  });

  it("renders inline variant", () => {
    render(<WaitlistCTABanner variant="inline" />);
    expect(screen.getByText(/early access/i)).toBeDefined();
    expect(screen.getByTestId("waitlist-form")).toBeDefined();
  });
});
